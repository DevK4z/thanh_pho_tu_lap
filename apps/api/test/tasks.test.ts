/* Nhiệm vụ trong ngày: thêm, sửa, đánh dấu xong, dời ngày, thống kê, giới hạn và quyền sở hữu. */
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TASK_LIMITS, type DayTask, type Me, type TaskDayStat } from '@tptl/shared';
import { buildApp } from '../src/app';
import { openDatabase, type Database } from '../src/db/client';
import { loadEnv } from '../src/env';

let app: FastifyInstance;
let database: Database;

beforeAll(async () => {
  database = await openDatabase({ migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
  app = await buildApp({ db: database.db, env: loadEnv({}), rateLimit: false });
});
afterAll(async () => { await app.close(); await database.close(); });

async function call<T = unknown>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, token?: string, payload?: unknown) {
  const r = await app.inject({ method, url: '/api' + url, payload: payload as object, headers: token ? { authorization: 'Bearer ' + token } : {} });
  return { status: r.statusCode, body: r.json() as T };
}
const guest = async (name: string) => (await call<{ token: string; me: Me }>('POST', '/auth/guest', undefined, { name })).body.token;

describe('nhiệm vụ trong ngày', () => {
  it('thêm, liệt kê theo ngày, đánh dấu xong, sửa và xóa', async () => {
    const t = await guest('An');
    const a = (await call<DayTask>('POST', '/tasks', t, { day: '2026-10-21', title: '  Gửi   báo cáo tuần ', category: 'work', priority: 'high', note: 'Đính kèm số liệu' })).body;
    expect(a).toMatchObject({ title: 'Gửi báo cáo tuần', category: 'work', priority: 'high', note: 'Đính kèm số liệu', done: false, doneAt: null, position: 0 });
    const b = (await call<DayTask>('POST', '/tasks', t, { day: '2026-10-21', title: 'Đóng tiền điện' })).body;
    expect(b).toMatchObject({ category: 'other', priority: 'medium', position: 1 });
    await call('POST', '/tasks', t, { day: '2026-10-22', title: 'Việc ngày mai' });

    const list = (await call<DayTask[]>('GET', '/tasks?day=2026-10-21', t)).body;
    expect(list.map((x) => x.title)).toEqual(['Gửi báo cáo tuần', 'Đóng tiền điện']);

    const done = (await call<DayTask>('PATCH', `/tasks/${a.id}`, t, { done: true })).body;
    expect(done.done).toBe(true);
    expect(done.doneAt).toBeTypeOf('number');
    const undone = (await call<DayTask>('PATCH', `/tasks/${a.id}`, t, { done: false })).body;
    expect(undone.doneAt).toBeNull();

    const edited = (await call<DayTask>('PATCH', `/tasks/${b.id}`, t, { title: 'Đóng tiền điện, nước', priority: 'low', category: 'personal' })).body;
    expect(edited).toMatchObject({ title: 'Đóng tiền điện, nước', priority: 'low', category: 'personal' });

    expect((await call('DELETE', `/tasks/${b.id}`, t)).status).toBe(200);
    expect((await call<DayTask[]>('GET', '/tasks?day=2026-10-21', t)).body).toHaveLength(1);
  });

  it('dời một việc và dời mọi việc chưa xong sang ngày khác', async () => {
    const t = await guest('Bình');
    const ids: string[] = [];
    for (const title of ['Một', 'Hai', 'Ba']) ids.push((await call<DayTask>('POST', '/tasks', t, { day: '2026-11-01', title })).body.id);
    await call('POST', '/tasks', t, { day: '2026-11-02', title: 'Có sẵn' });
    await call('PATCH', `/tasks/${ids[1]}`, t, { done: true });

    const moved = (await call<DayTask>('PATCH', `/tasks/${ids[0]}`, t, { day: '2026-11-03' })).body;
    expect(moved).toMatchObject({ day: '2026-11-03', position: 0 });

    const r = (await call<{ moved: number; left: number }>('POST', '/tasks/carry', t, { from: '2026-11-01', to: '2026-11-02' })).body;
    expect(r).toEqual({ moved: 1, left: 0 });
    const next = (await call<DayTask[]>('GET', '/tasks?day=2026-11-02', t)).body;
    expect(next.map((x) => x.title)).toEqual(['Có sẵn', 'Ba']);
    // Việc đã xong ở lại ngày cũ.
    expect((await call<DayTask[]>('GET', '/tasks?day=2026-11-01', t)).body.map((x) => x.title)).toEqual(['Hai']);
    expect((await call('POST', '/tasks/carry', t, { from: '2026-11-01', to: '2026-11-01' })).status).toBe(400);
  });

  it('thống kê số việc và số việc xong theo ngày', async () => {
    const t = await guest('Chi');
    const x = (await call<DayTask>('POST', '/tasks', t, { day: '2026-09-10', title: 'A' })).body;
    await call('POST', '/tasks', t, { day: '2026-09-10', title: 'B' });
    await call('POST', '/tasks', t, { day: '2026-09-12', title: 'C' });
    await call('POST', '/tasks', t, { day: '2026-12-01', title: 'Ngoài khoảng' });
    await call('PATCH', `/tasks/${x.id}`, t, { done: true });
    const s = (await call<TaskDayStat[]>('GET', '/tasks/stats?from=2026-09-01&to=2026-09-30', t)).body;
    expect(s).toEqual([{ day: '2026-09-10', total: 2, done: 1 }, { day: '2026-09-12', total: 1, done: 0 }]);
    expect((await call('GET', '/tasks/stats?from=2026-01-01&to=2026-12-31', t)).status).toBe(400);
  });

  it('kiểm tra dữ liệu, giới hạn mỗi ngày và chỉ chủ sở hữu mới thấy hoặc sửa được', async () => {
    const t = await guest('Dũng');
    const other = await guest('Em');
    expect((await call('GET', '/tasks?day=2026-10-21')).status).toBe(401);
    expect((await call('POST', '/tasks', t, { day: '2026-02-31', title: 'Ngày sai' })).status).toBe(400);
    expect((await call('POST', '/tasks', t, { day: '2026-10-21', title: '   ' })).status).toBe(400);
    expect((await call('POST', '/tasks', t, { day: '2026-10-21', title: 'x', priority: 'urgent' })).status).toBe(400);
    expect((await call('POST', '/tasks', t, { day: '2026-10-21', title: 'x'.repeat(TASK_LIMITS.title + 1) })).status).toBe(400);

    const mine = (await call<DayTask>('POST', '/tasks', t, { day: '2026-10-21', title: 'Của Dũng' })).body;
    expect((await call<DayTask[]>('GET', '/tasks?day=2026-10-21', other)).body).toEqual([]);
    expect((await call('PATCH', `/tasks/${mine.id}`, other, { done: true })).status).toBe(404);
    expect((await call('DELETE', `/tasks/${mine.id}`, other)).status).toBe(404);

    for (let i = 1; i < TASK_LIMITS.perDay; i++) await call('POST', '/tasks', t, { day: '2026-10-21', title: 'Việc ' + i });
    const over = await call<{ error: { code: string } }>('POST', '/tasks', t, { day: '2026-10-21', title: 'Quá giới hạn' });
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe('tasks_full');
  });
});
