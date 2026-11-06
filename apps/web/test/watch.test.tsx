/* Giám sát phiên đọc sách, chăm cây: giữ ứng dụng mở và màn hình sáng. Vận động không giám sát. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveSession, ActKey, Mode, Me } from '@tptl/shared';
import { ToastProvider } from '../src/components/ui';
import { FocusRun } from '../src/screens/FocusRun';

const api = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api }));

const me = { id: 'u1', name: 'An' } as Me;
const stats = { tasksDone: 0, tasksFailed: 1, currentStreak: 0, bestStreak: 0 };
const START = new Date('2026-11-07T08:00:00').getTime();
const session = (a: ActKey, mode: Mode = 'offline'): ActiveSession => ({
  id: 's1', act: a, mode, plannedSec: 300, startedAt: START, goal: '', day: '2026-11-07',
  checks: [], checksAnswered: 0, checksCorrect: 0, verify: [], proof: { status: 'none', code: null, page: null, expiresAt: null, tries: 0, reason: '' },
});

let hidden = false;
const setHidden = (v: boolean) => { hidden = v; fireEvent(document, new Event('visibilitychange')); };
const tick = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const requestLock = vi.fn();

function mount(s: ActiveSession) {
  const onFinish = vi.fn(), onFailed = vi.fn();
  render(<QueryClientProvider client={new QueryClient()}><ToastProvider><FocusRun me={me} s={s} onFinish={onFinish} onFailed={onFailed} /></ToastProvider></QueryClientProvider>);
  return { onFinish, onFailed };
}

beforeEach(() => {
  vi.useFakeTimers({ now: START });
  hidden = false;
  api.mockReset().mockResolvedValue({ lostStreak: 2, stats });
  requestLock.mockReset().mockImplementation(async () => ({ release: async () => {} }));
  Object.defineProperty(document, 'hidden', { get: () => hidden, configurable: true });
  Object.defineProperty(navigator, 'wakeLock', { value: { request: requestLock }, configurable: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('phiên đọc sách, chăm cây', () => {
  it.each<ActKey>(['read', 'plant'])('%s: thoát ứng dụng quá 3 giây thì thất bại', async (a) => {
    const { onFailed, onFinish } = mount(session(a));
    expect(screen.getByText('Giữ ứng dụng mở và úp điện thoại xuống.')).toBeTruthy();
    setHidden(true);
    await tick(500);
    expect(screen.getByText('Bạn đang rời khỏi phiên!')).toBeTruthy();
    await tick(3500);
    expect(api).toHaveBeenCalledWith('POST', '/sessions/s1/quit', expect.objectContaining({ reason: 'violation' }));
    expect(onFailed).toHaveBeenCalledWith(expect.objectContaining({ kind: 'violation', cause: 'tab' }));
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('quay lại trong 3 giây chỉ ghi cảnh báo và xin giữ màn hình sáng lại', async () => {
    const { onFailed } = mount(session('read'));
    await tick(0);
    expect(requestLock).toHaveBeenCalledTimes(1);
    setHidden(true);
    await tick(1000);
    setHidden(false);
    await tick(500);
    expect(onFailed).not.toHaveBeenCalled();
    expect(screen.queryByText('Bạn đang rời khỏi phiên!')).toBeNull();
    expect(screen.getByText(/quay lại kịp trong thời gian ân hạn/)).toBeTruthy();
    expect(requestLock).toHaveBeenCalledTimes(2);
  });

  it('click ra ngoài cửa sổ không tính, vì không yêu cầu toàn màn hình', async () => {
    const { onFailed } = mount(session('read'));
    fireEvent.blur(window);
    await tick(5000);
    expect(onFailed).not.toHaveBeenCalled();
    expect(screen.queryByText('Bạn đang rời khỏi phiên!')).toBeNull();
  });

  it('rời đi đến sau khi hết giờ rồi quay lại vẫn là thất bại, không qua được', async () => {
    const { onFailed, onFinish } = mount(session('read'));
    await tick(60_000);
    setHidden(true);
    // Trang bị đóng băng: đồng hồ trôi qua nhưng bộ đếm không chạy, rồi quay lại sau khi hết giờ.
    vi.setSystemTime(START + 400_000);
    hidden = false;
    await tick(1000);
    expect(onFinish).not.toHaveBeenCalled();
    expect(onFailed).toHaveBeenCalledWith(expect.objectContaining({ kind: 'violation' }));
  });

  it('ở lại đến hết giờ thì sang bước xác nhận, có ghi nhận số lần rời đi', async () => {
    const { onFinish, onFailed } = mount(session('plant'));
    await tick(10_000);
    setHidden(true);
    await tick(1000);
    setHidden(false);
    await tick(295_000);
    expect(onFailed).not.toHaveBeenCalled();
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ dist: 1 }));
  });

  it('máy không hỗ trợ giữ màn hình sáng thì báo trước', async () => {
    Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true });
    mount(session('read'));
    await tick(0);
    expect(screen.getByText(/không giữ được màn hình sáng/)).toBeTruthy();
  });
});

describe('vận động', () => {
  it('không giám sát: thoát ứng dụng vẫn chạy tiếp đến hết giờ', async () => {
    const { onFinish, onFailed } = mount(session('move'));
    expect(screen.getByText('Hãy cất điện thoại.')).toBeTruthy();
    setHidden(true);
    await tick(10_000);
    expect(screen.queryByText('Bạn đang rời khỏi phiên!')).toBeNull();
    setHidden(false);
    await tick(291_000);
    expect(onFailed).not.toHaveBeenCalled();
    expect(onFinish).toHaveBeenCalled();
  });
});
