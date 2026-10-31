/* Chạy giao diện React thật với REST API thật (PGlite trong bộ nhớ) trong cùng tiến trình.
   Đi qua: đăng nhập khách → lập nhóm → tạo nhà → phiên tập trung → nhận thưởng → người thứ hai tham gia nhóm. */
import { resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../api/src/app';
import { openDatabase, type Database } from '../../api/src/db/client';
import { loadEnv } from '../../api/src/env';

let server: FastifyInstance;
let database: Database;
const realNow = Date.now.bind(Date);
let shift = 0;
let App: typeof import('../src/App').App;
let ToastProvider: typeof import('../src/components/ui').ToastProvider;

/** jsdom không có Fullscreen API: giả lập để kiểm tra luồng toàn màn hình và chống gian lận. */
let fsEl: Element | null = null;
function installFullscreen() {
  Object.defineProperty(document, 'fullscreenElement', { get: () => fsEl, configurable: true });
  Object.defineProperty(document, 'fullscreenEnabled', { get: () => true, configurable: true });
  Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
  const change = () => document.dispatchEvent(new Event('fullscreenchange'));
  document.documentElement.requestFullscreen = async () => { fsEl = document.documentElement; change(); };
  document.exitFullscreen = async () => { fsEl = null; change(); };
}

beforeAll(async () => {
  database = await openDatabase({ migrationsFolder: resolve(__dirname, '../../api/drizzle') });
  server = await buildApp({ db: database.db, env: loadEnv({}), rateLimit: false });
  await server.listen({ port: 0, host: '127.0.0.1' });
  vi.stubEnv('VITE_API_URL', 'http://127.0.0.1:' + (server.server.address() as AddressInfo).port);
  vi.spyOn(Date, 'now').mockImplementation(() => realNow() + shift);
  installFullscreen();
  // Nhập sau khi đặt địa chỉ API.
  ({ App } = await import('../src/App'));
  ({ ToastProvider } = await import('../src/components/ui'));
}, 60_000);
afterAll(async () => {
  cleanup();
  await server.close();
  await database.close();
});

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ToastProvider><App /></ToastProvider></QueryClientProvider>);
}
const find = (text: string | RegExp) => screen.findByText(text, {}, { timeout: 5000 });
const btn = (name: string | RegExp) => screen.getByRole('button', { name });
/** Nút trên thanh tab. */
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Điều hướng' })).getByRole('button', { name });
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('giao diện + API', () => {
  it('người A: khách → lập nhóm → tạo nhà → phiên toàn màn hình → thưởng → thất bại vì rời màn hình', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mount();
    await find('Vào thành phố của bạn');
    expect(btn(/Tiếp tục với Google/)).toHaveProperty('disabled', true);
    expect(btn(/Tiếp tục với Facebook/)).toHaveProperty('disabled', true);

    fireEvent.click(btn('Vào với tên này'));
    await find('Hãy nhập tên để vào với tư cách khách.');
    type('Tên của bạn', 'An');
    fireEvent.click(btn('Vào với tên này'));

    await find('Chọn nhóm');
    await find('Chưa có nhóm nào. Hãy lập nhóm đầu tiên.');
    expect(btn('Tham gia nhóm')).toHaveProperty('disabled', true);
    type('Tên nhóm', 'Lớp 10A1');
    fireEvent.click(btn('Lập nhóm'));

    await find('Chọn khu đất đầu tiên');
    expect(screen.getByLabelText('Tên hiển thị trong nhóm')).toHaveProperty('value', 'An');
    expect(screen.getByText(/Nhóm Lớp 10A1/)).toBeTruthy();
    expect(tab('Quản trị')).toBeTruthy();
    fireEvent.click(btn('Bắt đầu xây thành phố'));
    await find('Thành phố của An');
    await find('Khu phố Lớp 10A1');

    fireEvent.click(tab('Tập trung'));
    await find('Cam kết trước, tập trung sau');
    // Chỉ còn hoạt động trên máy.
    expect(screen.queryByRole('button', { name: /Đọc sách giấy/ })).toBeNull();
    expect(screen.getByText('0 phiên')).toBeTruthy();
    fireEvent.click(btn(/Học sâu trên máy/));
    fireEvent.click(btn('5 phút'));
    const begin = btn(/Vào toàn màn hình và bắt đầu 5 phút/);
    expect(begin).toHaveProperty('disabled', true);
    screen.getAllByRole('checkbox').forEach((c) => fireEvent.click(c));
    fireEvent.click(begin);
    await find('còn lại');
    expect(fsEl).toBe(document.documentElement);
    expect(screen.queryByText('Đăng xuất')).toBeNull();
    await find('Chưa có cảnh báo nào. Giữ vững nhé!');

    // Thoát toàn màn hình (như bấm Escape) rồi quay lại kịp trong 3 giây: chỉ ghi cảnh báo.
    await document.exitFullscreen();
    await find('Bạn đang rời khỏi phiên!');
    fireEvent.click(btn('Quay lại toàn màn hình'));
    await find(/quay lại kịp trong thời gian ân hạn/);
    expect(screen.queryByText('Bạn đang rời khỏi phiên!')).toBeNull();
    expect(screen.getByText('Thoát chế độ toàn màn hình')).toBeTruthy();

    // Tua nhanh hết 5 phút: phiên chuyển sang bước xác nhận và thoát toàn màn hình.
    shift = 5 * 60 * 1000 + 1000;
    await screen.findByText('Xác nhận để nhận công trình', {}, { timeout: 3000 });
    expect(fsEl).toBeNull();
    const finish = btn('Hoàn thành phiên');
    expect(finish).toHaveProperty('disabled', true);
    const question = screen.getAllByRole('heading', { level: 3 })[0].closest('div')!;
    fireEvent.click(within(question).getAllByRole('button')[0]);
    fireEvent.click(btn('5'));
    expect(finish).toHaveProperty('disabled', false);
    fireEvent.click(finish);

    await find('Hoàn thành 5 phút');
    await find('+50 vàng');
    await find('+50 gỗ');
    expect(logSpy).toHaveBeenCalledWith('[sendDataToAdmin]', expect.objectContaining({ taskStatus: 'success', totalTasks: 1, successTasks: 1, completionRate: 100, currentStreak: 1 }));
    await find('Chọn một công trình');
    fireEvent.click(btn(/Cây xanh/));
    const slot = document.querySelector('[data-slot="0"]')!;
    expect(slot).toBeTruthy();
    fireEvent.click(slot);
    await find('Đã xây Cây xanh trong thành phố.');
    await find('Thành phố của An');
    await waitFor(() => expect(screen.getByText('1 / 35')).toBeTruthy());
    expect(screen.getByText('5 phút')).toBeTruthy();
    const res = () => within(screen.getByLabelText('Tài nguyên'));
    expect(res().getAllByText('50')).toHaveLength(2);
    expect(res().getByText('1 / 0 (100%)')).toBeTruthy();

    // Phiên thứ hai: click ra ngoài cửa sổ quá 3 giây → thất bại, chuỗi về 0.
    fireEvent.click(tab('Tập trung'));
    await find('1 phiên');
    fireEvent.click(btn('5 phút'));
    screen.getAllByRole('checkbox').forEach((c) => fireEvent.click(c));
    fireEvent.click(btn(/Vào toàn màn hình và bắt đầu 5 phút/));
    await find('còn lại');
    fireEvent.blur(window);
    await find('Bạn đang rời khỏi phiên!');
    shift += 4000;
    await screen.findByText('Phiên thất bại', {}, { timeout: 3000 });
    expect(screen.getAllByText('Bạn đã mất tập trung!').length).toBeGreaterThan(0);
    await find('Click ra ngoài cửa sổ hoặc chuyển ứng dụng quá thời gian ân hạn. Chuỗi 1 phiên thành công đã về 0.');
    await find(/quá thời gian ân hạn, phiên thất bại/);
    expect(fsEl).toBeNull();
    expect(logSpy).toHaveBeenCalledWith('[sendDataToAdmin]', expect.objectContaining({ taskStatus: 'failed', totalTasks: 2, failedTasks: 1, completionRate: 50, currentStreak: 0 }));
    fireEvent.focus(window);
    fireEvent.click(btn('Về thành phố'));
    await find('Thành phố của An');
    await waitFor(() => expect(res().getByText('1 / 1 (50%)')).toBeTruthy());
    logSpy.mockRestore();

    fireEvent.click(tab('Của tôi'));
    await find('Tiến bộ của tôi');
    await find('Hoàn thành');

    fireEvent.click(btn('Đăng xuất'));
    await find('Đăng xuất tài khoản khách?');
    fireEvent.click(btn('Vẫn đăng xuất'));
    await find('Vào thành phố của bạn');
    cleanup();
  }, 30_000);

  it('người B: thấy nhóm có sẵn, tham gia, không có tab Quản trị, đổi nhóm', async () => {
    shift = 0;
    mount();
    await find('Vào thành phố của bạn');
    type('Tên của bạn', 'Bình');
    fireEvent.click(btn('Vào với tên này'));
    await find('Chọn một trong 1 nhóm đang hoạt động.');
    const join = btn('Tham gia nhóm');
    expect(join).toHaveProperty('disabled', true);
    fireEvent.click(btn(/Lớp 10A1/));
    expect(join).toHaveProperty('disabled', false);
    fireEvent.click(join);
    await find('Chọn khu đất đầu tiên');
    expect(screen.queryByRole('button', { name: 'Quản trị' })).toBeNull();
    fireEvent.click(btn('Bắt đầu xây thành phố'));
    await find('Thành phố của 2 thành viên, xếp theo tiến độ xây dựng.');

    fireEvent.click(btn('Đổi nhóm'));
    await find('Chọn nhóm');
    await find('Đã rời nhóm. Tiến độ trong nhóm cũ vẫn được giữ.');
  }, 30_000);
});
