/* Đồng hồ của phiên đang chạy: đếm ngược, câu kiểm tra hiện diện, giữ màn hình sáng.
   Việc phát hiện rời màn hình nằm ở useAntiCheat. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHECK_SECONDS, type ActiveSession, type IssuedQuestion } from '@tptl/shared';
import { api, errorMessage } from '../lib/api';

export interface RunMeasures { awaySec: number; dist: number }
export interface OpenCheck { index: number; q: IssuedQuestion; deadline: number }

/** Thời điểm (giây từ lúc bắt đầu) bật từng câu kiểm tra: rải ngẫu nhiên trong khoảng 15%–90% phiên. */
function checkTimes(n: number, plannedSec: number) {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const s0 = 0.15 + (0.75 * i) / n, s1 = 0.15 + (0.75 * (i + 1)) / n;
    out.push((s0 + Math.random() * (s1 - s0)) * plannedSec);
  }
  return out;
}

/**
 * @param onFinish gọi một lần khi hết giờ
 * @param isAway   đang rời màn hình thì hoãn câu kiểm tra
 */
export function useFocusRun(s: ActiveSession, onFinish: () => void, toast: (m: string) => void, isAway: () => boolean) {
  const endAt = s.startedAt + s.plannedSec * 1000;
  const times = useMemo(() => checkTimes(s.checks.length, s.plannedSec), [s.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = useRef({ next: s.checksAnswered, qa: s.checksAnswered, qc: s.checksCorrect, done: false });
  const [now, setNow] = useState(Date.now());
  const [check, setCheck] = useState<OpenCheck | null>(null);
  const checkRef = useRef<OpenCheck | null>(null);
  const cb = useRef({ onFinish, toast, isAway });
  cb.current = { onFinish, toast, isAway };

  const openCheck = (c: OpenCheck | null) => { checkRef.current = c; setCheck(c); };

  /** Trả lời câu kiểm tra đang mở; -1 là hết giờ không trả lời. Máy chủ chấm đúng/sai. */
  const answer = useCallback(async (choice: number) => {
    const c = checkRef.current;
    if (!c) return;
    openCheck(null);
    const x = st.current;
    x.next = c.index + 1;
    x.qa++;
    try {
      const r = await api<{ correct: boolean }>('POST', `/sessions/${s.id}/checks`, { index: c.index, choice });
      if (r.correct) x.qc++;
      cb.current.toast(choice === -1 ? 'Chưa kịp trả lời. Đã ghi nhận không phản hồi.' : r.correct ? 'Chính xác.' : 'Chưa đúng, bạn vẫn tiếp tục phiên.');
    } catch (e) { cb.current.toast(errorMessage(e)); }
  }, [s.id]);

  useEffect(() => {
    const tick = () => {
      const t = Date.now();
      setNow(t);
      const x = st.current;
      if (x.done) return;
      if (t >= endAt) {
        x.done = true;
        openCheck(null);
        cb.current.onFinish();
        return;
      }
      if (s.mode !== 'screen') return;
      const c = checkRef.current;
      if (c && t > c.deadline) answer(-1);
      else if (!c && !cb.current.isAway() && x.next < times.length && (t - s.startedAt) / 1000 >= times[x.next]) {
        openCheck({ index: x.next, q: s.checks[x.next], deadline: t + CHECK_SECONDS * 1000 });
      }
    };
    const id = setInterval(tick, 500);
    tick();
    return () => clearInterval(id);
  }, [s.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Giữ màn hình sáng trong lúc chạy phiên (nếu trình duyệt hỗ trợ).
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {});
    return () => { lock?.release().catch(() => {}); };
  }, [s.id]);

  const x = st.current;
  return {
    left: Math.max(0, Math.ceil((endAt - now) / 1000)),
    qa: x.qa,
    qc: x.qc,
    check,
    checkLeft: check ? Math.max(0, Math.ceil((check.deadline - now) / 1000)) : 0,
    answer,
    stop: () => { st.current.done = true; openCheck(null); },
  };
}
