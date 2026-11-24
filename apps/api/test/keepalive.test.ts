/* Tự giữ API thức: chỉ bật trên Render, gọi /health định kỳ, lỗi mạng không làm dừng. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { keepAliveUrl, startKeepAlive } from '../src/keepalive';

const log = () => ({ info: vi.fn(), warn: vi.fn() });

afterEach(() => { vi.useRealTimers(); });

describe('keepAliveUrl', () => {
  it('dùng địa chỉ Render tự cấp, bỏ dấu / cuối', () => {
    expect(keepAliveUrl({ RENDER_EXTERNAL_URL: 'https://tptl-api.onrender.com/' })).toBe('https://tptl-api.onrender.com/health');
  });
  it('KEEPALIVE_URL ghi đè, "off" thì tắt', () => {
    expect(keepAliveUrl({ RENDER_EXTERNAL_URL: 'https://a.onrender.com', KEEPALIVE_URL: 'https://api.example.com' })).toBe('https://api.example.com/health');
    expect(keepAliveUrl({ RENDER_EXTERNAL_URL: 'https://a.onrender.com', KEEPALIVE_URL: 'off' })).toBeNull();
  });
  it('chạy ngoài Render (máy cá nhân, test) thì không bật', () => {
    expect(keepAliveUrl({})).toBeNull();
  });
});

describe('startKeepAlive', () => {
  it('gọi định kỳ, lỗi mạng chỉ ghi cảnh báo, dừng được', async () => {
    vi.useFakeTimers();
    const l = log();
    const f = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    const stop = startKeepAlive('https://a.onrender.com/health', l, 1000, f);
    expect(f).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(f).toHaveBeenCalledTimes(1);
    expect(l.warn).toHaveBeenCalledWith(expect.stringContaining('ECONNRESET'));

    await vi.advanceTimersByTimeAsync(1000);
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls[1][0]).toBe('https://a.onrender.com/health');
    expect(l.warn).toHaveBeenCalledTimes(1);

    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(f).toHaveBeenCalledTimes(2);
  });
});
