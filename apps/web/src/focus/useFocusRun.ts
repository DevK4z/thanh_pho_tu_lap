/* Theo dõi một phiên đang chạy: đếm ngược, thời gian rời trang, câu kiểm tra hiện diện, giữ màn hình sáng.
   Trạng thái thay đổi liên tục giữ trong ref để không phải dựng lại listener mỗi lần đếm. */
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

export function useFocusRun(s: ActiveSession, onFinish: (m: RunMeasures) => void, toast: (m: string) => void) {
  const endAt = s.startedAt + s.plannedSec * 1000;
  const times = useMemo(() => checkTimes(s.checks.length, s.plannedSec), [s.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = useRef({ awaySec: 0, dist: 0, awayAt: null as number | null, next: s.checksAnswered, qa: s.checksAnswered, qc: s.checksCorrect, done: false });
  const [now, setNow] = useState(Date.now());
  const [check, setCheck] = useState<OpenCheck | null>(null);
  const [awayNote, setAwayNote] = useState<string | null>(null);
  const checkRef = useRef<OpenCheck | null>(null);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  const toastRef = useRef(toast);
  toastRef.current = toast;

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
      toastRef.current(choice === -1 ? 'Chưa kịp trả lời. Đã ghi nhận không phản hồi.' : r.correct ? 'Chính xác.' : 'Chưa đúng, bạn vẫn tiếp tục phiên.');
    } catch (e) { toastRef.current(errorMessage(e)); }
  }, [s.id]);

  /** Số đo hiện tại, tính cả lần rời trang đang diễn ra. */
  const measures = useCallback((): RunMeasures => {
    const x = st.current;
    return { awaySec: x.awaySec + (x.awayAt ? (Date.now() - x.awayAt) / 1000 : 0), dist: x.dist };
  }, []);

  useEffect(() => {
    const tick = () => {
      const t = Date.now();
      setNow(t);
      const x = st.current;
      if (x.done) return;
      if (t >= endAt) {
        x.done = true;
        if (x.awayAt) { const dt = (endAt - x.awayAt) / 1000; x.awayAt = null; if (dt >= 3) { x.awaySec += dt; x.dist++; } }
        openCheck(null);
        finishRef.current({ awaySec: x.awaySec, dist: x.dist });
        return;
      }
      if (s.mode !== 'screen') return;
      const c = checkRef.current;
      if (c && t > c.deadline) answer(-1);
      else if (!c && !document.hidden && !x.awayAt && x.next < times.length && (t - s.startedAt) / 1000 >= times[x.next]) {
        openCheck({ index: x.next, q: s.checks[x.next], deadline: t + CHECK_SECONDS * 1000 });
      }
    };
    const id = setInterval(tick, 500);
    tick();
    return () => clearInterval(id);
  }, [s.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rời trang (đổi tab, thu nhỏ, chuyển ứng dụng) từ 3 giây trở lên tính là một lần xao nhãng.
  useEffect(() => {
    if (s.mode !== 'screen') return;
    let hideNote: ReturnType<typeof setTimeout>;
    const away = () => { const x = st.current; if (!x.done && !x.awayAt) x.awayAt = Date.now(); };
    const back = () => {
      const x = st.current;
      if (x.done || !x.awayAt) return;
      const dt = (Date.now() - x.awayAt) / 1000;
      x.awayAt = null;
      if (dt >= 3) {
        x.awaySec += dt;
        x.dist++;
        setAwayNote(`Bạn vừa rời trang ${Math.round(dt)} giây. Đã ghi nhận 1 lần xao nhãng.`);
        clearTimeout(hideNote);
        hideNote = setTimeout(() => setAwayNote(null), 7000);
      }
    };
    const vis = () => (document.hidden ? away() : back());
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('blur', away);
    window.addEventListener('focus', back);
    return () => {
      clearTimeout(hideNote);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('blur', away);
      window.removeEventListener('focus', back);
    };
  }, [s.id, s.mode]);

  // Giữ màn hình sáng trong lúc chạy phiên (nếu trình duyệt hỗ trợ).
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {});
    return () => { lock?.release().catch(() => {}); };
  }, [s.id]);

  const x = st.current;
  return {
    left: Math.max(0, Math.ceil((endAt - now) / 1000)),
    awayNow: x.awaySec + (x.awayAt ? (now - x.awayAt) / 1000 : 0),
    dist: x.dist,
    qa: x.qa,
    qc: x.qc,
    check,
    checkLeft: check ? Math.max(0, Math.ceil((check.deadline - now) / 1000)) : 0,
    answer,
    awayNote,
    measures,
    stop: () => { st.current.done = true; openCheck(null); },
  };
}
