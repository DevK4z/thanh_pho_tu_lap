/* Tự giữ API thức trên gói miễn phí của Render.
   Render cho dịch vụ ngủ sau 15 phút không có truy cập từ bên ngoài, mở lại mất khoảng 1 phút.
   Lịch của GitHub Actions (keepalive.yml) thực tế chỉ chạy vài tiếng một lần nên không đủ.
   Ở đây máy chủ tự gọi /health qua địa chỉ công khai: yêu cầu đi qua cổng của Render nên được tính là truy cập.
   Một dịch vụ chạy cả tháng dùng tối đa 744 giờ, nằm trong 750 giờ miễn phí mỗi tháng. */

export const KEEPALIVE_MS = 10 * 60 * 1000;

interface Log { info: (msg: string) => void; warn: (msg: string) => void }

/** Địa chỉ cần gọi: KEEPALIVE_URL nếu có (đặt "off" để tắt), không thì RENDER_EXTERNAL_URL do Render tự cấp. Chạy ngoài Render thì không bật. */
export function keepAliveUrl(src: NodeJS.ProcessEnv = process.env): string | null {
  const own = src.KEEPALIVE_URL?.trim();
  if (own === 'off') return null;
  const base = own || src.RENDER_EXTERNAL_URL?.trim();
  return base ? base.replace(/\/+$/, '') + '/health' : null;
}

/** Gọi url mỗi `every` mili giây. Trả về hàm dừng. Lỗi mạng chỉ ghi cảnh báo, lần sau gọi tiếp. */
export function startKeepAlive(url: string, log: Log, every = KEEPALIVE_MS, fetcher: typeof fetch = fetch): () => void {
  const ping = async () => {
    try {
      const r = await fetcher(url, { signal: AbortSignal.timeout(30_000), headers: { 'user-agent': 'tptl-keepalive' } });
      if (!r.ok) log.warn(`Giữ thức: ${url} trả về ${r.status}`);
    } catch (e) {
      log.warn(`Giữ thức: không gọi được ${url} (${e instanceof Error ? e.message : String(e)})`);
    }
  };
  const id = setInterval(ping, every);
  id.unref?.();
  log.info(`Giữ thức: tự gọi ${url} mỗi ${Math.round(every / 60000)} phút.`);
  return () => clearInterval(id);
}
