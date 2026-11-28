/* Nhiệm vụ trong ngày: giao diện React thật với REST API thật (PGlite trong bộ nhớ).
   Thêm việc, đánh dấu xong (tiến độ, linh vật), xóa rồi hoàn tác, chuyển ngày, dời việc chưa xong sang hôm sau. */
import { resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../api/src/app';
import { openDatabase, type Database } from '../../api/src/db/client';
import { loadEnv } from '../../api/src/env';

let server: FastifyInstance;
let database: Database;
let App: typeof import('../src/App').App;
let ToastProvider: typeof import('../src/components/ui').ToastProvider;

beforeAll(async () => {
  database = await openDatabase({ migrationsFolder: resolve(__dirname, '../../api/drizzle') });
  server = await buildApp({ db: database.db, env: loadEnv({ GROUP_CREATION: 'open' }), rateLimit: false, ai: null });
  await server.listen({ port: 0, host: '127.0.0.1' });
  vi.stubEnv('VITE_API_URL', 'http://127.0.0.1:' + (server.server.address() as AddressInfo).port);
  ({ App } = await import('../src/App'));
  ({ ToastProvider } = await import('../src/components/ui'));
}, 60_000);
afterAll(async () => {
  cleanup();
  await server.close();
  await database.close();
});

const find = (text: string | RegExp) => screen.findByText(text, {}, { timeout: 5000 });
const btn = (name: string | RegExp) => screen.getByRole('button', { name });
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
async function addTask(title: string, priority?: string) {
  type('Tên việc', title);
  if (priority) fireEvent.change(screen.getByLabelText('Độ ưu tiên'), { target: { value: priority } });
  fireEvent.click(btn('+ Thêm'));
  await find(title);
}

describe('nhiệm vụ trong ngày', () => {
  it('thêm, đánh dấu xong, xóa và hoàn tác, chuyển ngày, dời việc chưa xong', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={qc}><ToastProvider><App /></ToastProvider></QueryClientProvider>);
    await find('Vào thành phố của bạn');
    type('Tên của bạn', 'Lan');
    fireEvent.click(btn('Vào với tên này'));
    // Khách vào thẳng nhóm riêng.
    await find('Chọn khu đất đầu tiên');

    // Mở được ngay cả khi chưa tạo nhà trong nhóm.
    fireEvent.click(btn('Nhiệm vụ'));
    await find('Nhiệm vụ trong ngày');
    await find('Hôm nay chưa có việc nào');
    expect(screen.getByText('Thêm việc đầu tiên để linh vật bắt đầu lớn.')).toBeTruthy();

    await addTask('Gửi báo cáo tuần', 'high');
    await addTask('Đọc 20 trang sách', 'low');
    await find('✓ Hoàn thành: 0 / 2 việc');
    expect(screen.getAllByText('0 / 1 xong')).toHaveLength(2); // một việc ưu tiên cao, một việc ưu tiên thấp
    expect(screen.getByText('không có')).toBeTruthy(); // ưu tiên trung bình

    fireEvent.click(screen.getByLabelText('Đánh dấu xong: Gửi báo cáo tuần'));
    await find('✓ Hoàn thành: 1 / 2 việc');
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText('Đã đi quá nửa chặng đường!')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Đánh dấu xong: Đọc 20 trang sách'));
    await find('Hoàn thành tất cả. Tuyệt vời!');
    expect(screen.getByText('100%')).toBeTruthy();

    // Xóa rồi hoàn tác: việc quay lại, vẫn ở trạng thái đã xong.
    fireEvent.click(screen.getAllByRole('button', { name: 'Xóa' })[1]);
    await find('Đã xóa “Đọc 20 trang sách”.');
    await find('✓ Hoàn thành: 1 / 1 việc');
    fireEvent.click(btn('Hoàn tác'));
    await find('Đọc 20 trang sách');
    await find('✓ Hoàn thành: 2 / 2 việc');

    // Sửa tên việc.
    fireEvent.click(screen.getAllByRole('button', { name: 'Sửa' })[0]);
    const edit = screen.getAllByLabelText('Tên việc')[0];
    fireEvent.change(edit, { target: { value: 'Gửi báo cáo tuần cho quản lý' } });
    fireEvent.click(btn('Lưu'));
    await find('Gửi báo cáo tuần cho quản lý');

    // Việc chưa xong được dời sang hôm sau.
    await addTask('Dọn thư mục Downloads');
    fireEvent.click(btn(/Dời 1 việc chưa xong sang ngày hôm sau/));
    await find(/^Đã dời 1 việc sang /);
    await waitFor(() => expect(screen.queryByText('Dọn thư mục Downloads')).toBeNull());

    fireEvent.click(btn('Ngày mai ▶'));
    await find('Dọn thư mục Downloads');
    await find('✓ Hoàn thành: 0 / 1 việc');
    fireEvent.click(btn('Hôm nay'));
    await find('Gửi báo cáo tuần cho quản lý');
  }, 30_000);
});
