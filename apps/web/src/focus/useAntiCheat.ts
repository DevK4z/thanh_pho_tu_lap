/* Giám sát chống gian lận cho phiên trên máy.
   Người dùng phải ở lại trang, giữ cửa sổ được chọn và ở chế độ toàn màn hình. Rời khỏi một trong ba điều đó
   lâu hơn GRACE_SECONDS thì phiên thất bại; quay lại kịp thì chỉ ghi một cảnh báo.

   Nguồn sự kiện:
   - visibilitychange: đổi tab, thu nhỏ trình duyệt, khóa màn hình điện thoại.
   - blur / focus của window: click ra ngoài cửa sổ, chuyển sang ứng dụng khác (Alt+Tab).
   - fullscreenchange: thoát toàn màn hình. Khi đang toàn màn hình, trình duyệt tự xử lý phím Escape
     và không gửi keydown cho trang, nên việc bấm Escape được phát hiện qua sự kiện này.
   - keydown Escape: dự phòng cho trình duyệt có gửi phím này. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { GRACE_SECONDS } from '@tptl/shared';

export type Cause = 'tab' | 'blur' | 'fullscreen';
export const CAUSE_LABEL: Record<Cause, string> = {
  tab: 'Đổi tab hoặc thu nhỏ trình duyệt',
  blur: 'Click ra ngoài cửa sổ hoặc chuyển ứng dụng',
  fullscreen: 'Thoát chế độ toàn màn hình',
};

export interface Warning {
  at: number;
  cause: Cause;
  /** Thời gian rời khỏi (giây). */
  sec: number;
  /** true nếu lần này làm phiên thất bại. */
  failed: boolean;
}

/* ---------- toàn màn hình ---------- */
export const fullscreenSupported = () =>
  typeof document !== 'undefined' && !!document.documentElement.requestFullscreen && document.fullscreenEnabled !== false;
export const isFullscreen = () => !!document.fullscreenElement;
/** Phải gọi trực tiếp trong sự kiện người dùng bấm (trình duyệt chặn nếu không). */
export const enterFullscreen = () => document.documentElement.requestFullscreen({ navigationUI: 'hide' });
export function exitFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

/**
 * @param active  đang giám sát (phiên đang chạy)
 * @param onFail  gọi một lần khi vượt quá thời gian ân hạn; awaySec là tổng thời gian đã rời trong phiên
 */
export function useAntiCheat(active: boolean, onFail: (cause: Cause, awaySec: number, log: Warning[]) => void) {
  const [away, setAway] = useState<{ since: number; cause: Cause } | null>(null);
  const [log, setLog] = useState<Warning[]>([]);
  const [now, setNow] = useState(Date.now());
  const r = useRef({ away: null as { since: number; cause: Cause } | null, blurred: false, total: 0, failed: false, log: [] as Warning[] });
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;

  /** Lý do đang vi phạm, null nếu mọi thứ bình thường. Tab ẩn được ưu tiên vì nó kéo theo cả blur. */
  const currentCause = (): Cause | null =>
    document.hidden ? 'tab' : !isFullscreen() ? 'fullscreen' : r.current.blurred ? 'blur' : null;

  const push = (w: Warning) => {
    r.current.log = r.current.log.concat([w]);
    setLog(r.current.log);
  };

  const evaluate = useCallback(() => {
    const x = r.current;
    if (!active || x.failed) return;
    const t = Date.now();
    const cause = currentCause();
    if (cause && !x.away) {
      x.away = { since: t, cause };
      setAway(x.away);
      return;
    }
    if (!x.away) return;
    const sec = (t - x.away.since) / 1000;
    if (sec >= GRACE_SECONDS) {
      // Hết ân hạn (kể cả khi quay lại trễ, ví dụ bộ đếm bị trình duyệt làm chậm lúc tab ẩn).
      const c = x.away.cause;
      x.failed = true;
      x.total += sec;
      push({ at: x.away.since, cause: c, sec, failed: true });
      x.away = null;
      setAway(null);
      onFailRef.current(c, x.total, x.log);
    } else if (!cause) {
      x.total += sec;
      push({ at: x.away.since, cause: x.away.cause, sec, failed: false });
      x.away = null;
      setAway(null);
    }
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active) return;
    const onBlur = () => { r.current.blurred = true; evaluate(); };
    const onFocus = () => { r.current.blurred = false; evaluate(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setTimeout(evaluate, 0); };
    document.addEventListener('visibilitychange', evaluate);
    document.addEventListener('fullscreenchange', evaluate);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    window.addEventListener('keydown', onKey);
    // Kiểm tra định kỳ để bắt thời điểm hết ân hạn và cập nhật đồng hồ đếm ngược.
    const id = setInterval(() => { evaluate(); setNow(Date.now()); }, 250);
    evaluate();
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', evaluate);
      document.removeEventListener('fullscreenchange', evaluate);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('keydown', onKey);
    };
  }, [active, evaluate]);

  return {
    away,
    /** Giây còn lại trước khi thất bại. */
    graceLeft: away ? Math.max(0, GRACE_SECONDS - (now - away.since) / 1000) : GRACE_SECONDS,
    log,
    isAway: () => !!r.current.away || r.current.failed,
    /** Tổng thời gian rời trong ân hạn và số lần cảnh báo, gửi lên máy chủ khi kết thúc. */
    measures: () => ({ awaySec: r.current.total, dist: r.current.log.length }),
  };
}
