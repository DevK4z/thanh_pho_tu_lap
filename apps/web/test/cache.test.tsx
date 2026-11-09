/* Máy chủ đang ngủ (không trả lời) mà máy đã có dữ liệu lần trước: vào ngay, không phải chờ. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '@tptl/shared';
import { App } from '../src/App';
import { ToastProvider } from '../src/components/ui';
import { readCache, writeCache, clearCache } from '../src/lib/cache';

const me: Me = { id: 'u1', name: 'Lan', provider: 'guest', avatarUrl: null, currentGroupId: null, isAdmin: false };
const mount = () => render(<QueryClientProvider client={new QueryClient()}><ToastProvider><App /></ToastProvider></QueryClientProvider>);

beforeEach(() => {
  localStorage.clear();
  // Máy chủ ngủ: mọi lời gọi treo, không bao giờ trả lời.
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('vào ngay bằng dữ liệu lần trước', () => {
  it('đã có dữ liệu: hiện màn chính ngay, kèm thanh đang kết nối máy chủ', async () => {
    localStorage.setItem('tptl-token', 'token-cua-lan');
    writeCache('me', me);
    mount();
    expect(await screen.findByText('Nhập mã mời')).toBeTruthy();
    expect(screen.getByText(/Đang kết nối máy chủ/)).toBeTruthy();
  });

  it('chưa có dữ liệu (lần đầu trên máy này) thì vẫn chờ máy chủ', async () => {
    localStorage.setItem('tptl-token', 'token-cua-lan');
    mount();
    expect(await screen.findByText('Đang mở thành phố…')).toBeTruthy();
    expect(screen.queryByText('Nhập mã mời')).toBeNull();
  });

  it('dữ liệu gắn với tài khoản: đổi token thì không dùng dữ liệu cũ; đăng xuất thì xóa', () => {
    localStorage.setItem('tptl-token', 'token-a');
    writeCache('me', me);
    expect(readCache<Me>('me')).toEqual(me);
    localStorage.setItem('tptl-token', 'token-b');
    expect(readCache<Me>('me')).toBeUndefined();
    localStorage.setItem('tptl-token', 'token-a');
    clearCache();
    expect(readCache<Me>('me')).toBeUndefined();
  });
});
