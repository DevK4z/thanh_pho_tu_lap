/* Đánh thức máy chủ ngay khi mở trang. Gói miễn phí của Render cho máy chủ ngủ khi không có ai dùng,
   lần mở đầu tiên mất khoảng một phút; trong lúc đó trang chờ và tự thử lại thay vì báo lỗi. */
import { useEffect, useState } from 'react';
import { API_URL } from './api';

export type ServerState = 'checking' | 'ready' | 'down';

/** Mỗi lần thử chờ tối đa 20 giây; sau khoảng 2 phút rưỡi vẫn không được thì báo lỗi để người dùng thử lại. */
const TRY_MS = 20_000;
const GIVE_UP_MS = 150_000;

export function useServerReady() {
  const [state, setState] = useState<ServerState>('checking');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    const t0 = Date.now();
    (async () => {
      while (alive) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          // /api/config nhẹ, không chạm database, và đi qua cùng đường với mọi lời gọi API khác.
          const r = await Promise.race([
            fetch(`${API_URL}/api/config?t=${Date.now()}`),
            new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), TRY_MS); }),
          ]);
          if (r.ok) { if (alive) setState('ready'); return; }
        } catch { /* máy chủ đang thức dậy hoặc mất mạng */ } finally { clearTimeout(timer); }
        if (Date.now() - t0 > GIVE_UP_MS) { if (alive) setState('down'); return; }
        await new Promise((res) => setTimeout(res, 3000));
      }
    })();
    return () => { alive = false; };
  }, [attempt]);
  return { state, retry: () => { setState('checking'); setAttempt((a) => a + 1); } };
}
