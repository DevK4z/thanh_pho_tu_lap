import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dkey, type Me, type Ranking } from '@tptl/shared';
import { buildApp } from '../src/app';
import { openDatabase, type Database } from '../src/db/client';
import { focusSessions } from '../src/db/schema';
import { loadEnv } from '../src/env';

let app: FastifyInstance;
let database: Database;

beforeAll(async () => {
  database = await openDatabase({ migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
  app = await buildApp({ db: database.db, env: loadEnv({}), rateLimit: false });
});
afterAll(async () => { await app.close(); await database.close(); });

async function call(method: 'GET' | 'POST', url: string, token?: string, payload?: unknown) {
  const r = await app.inject({ method, url: '/api' + url, payload: payload as object, headers: token ? { authorization: 'Bearer ' + token } : {} });
  return { status: r.statusCode, body: r.json() };
}
/** Tạo khách, lập hoặc vào nhóm, tạo nhà; trả về token và mã thành viên. */
async function member(name: string, group: { create: string } | { join: string }) {
  const { token } = (await call('POST', '/auth/guest', undefined, { name })).body as { token: string; me: Me };
  let gid: string;
  if ('create' in group) {
    gid = ((await call('POST', '/groups', token, { name: group.create })).body as Me).currentGroupId!;
  } else {
    gid = group.join;
    await call('POST', `/groups/${gid}/join`, token);
  }
  const p = (await call('POST', `/groups/${gid}/players`, token, { name, style: 'ngoi', dailyGoal: 30 })).body as { id: string };
  return { token, gid, pid: p.id };
}
/** Thêm c phiên đã hoàn thành, tổng cộng cs giây. */
const add = (playerId: string, day: string, cs: number, c: number, verified = true) => database.db.insert(focusSessions).values(
  Array.from({ length: c }, () => ({ playerId, day, act: 'read' as const, mode: 'offline' as const, plannedSec: cs / c, activeSec: cs / c, status: 'done' as const, verified, questions: { checks: [], verify: [] } })),
);

describe('xếp hạng nhóm', () => {
  it('cộng điểm nhóm, chia phần trăm đóng góp và xếp hạng các nhóm', async () => {
    const a1 = await member('An', { create: 'Nhóm Sao' });
    const a2 = await member('Bình', { join: a1.gid });
    const b1 = await member('Chi', { create: 'Nhóm Mây' });
    await member('Dũng', { create: 'Nhóm Trống' });
    const today = dkey(Date.now());
    const old = dkey(Date.now() - 30 * 86400000);
    await add(a1.pid, today, 3600, 2); // 60 phút + 2 phiên = 80 điểm
    await add(a2.pid, today, 1800, 1); // 30 phút + 1 phiên = 40 điểm
    await add(a2.pid, old, 6000, 1); // ngoài tuần: 100 phút + 1 phiên = 110 điểm
    await add(b1.pid, today, 600, 1); // 10 + 10 = 20 điểm
    await add(b1.pid, today, 6000, 1, false); // chưa xác minh: không có điểm

    const week = (await call('GET', '/ranking?range=week', a1.token)).body as Ranking;
    expect(week.groups.map((g) => [g.name, g.rank, g.points])).toEqual([['Nhóm Sao', 1, 120], ['Nhóm Mây', 2, 20], ['Nhóm Trống', 3, 0]]);
    expect(week.groups[0]).toMatchObject({ members: 2, contributors: 2, minutes: 90, sessions: 3, perMember: 60 });
    expect(week.myGroupId).toBe(a1.gid);
    expect(week.contributions.map((c) => [c.name, c.points, c.share])).toEqual([['An', 80, 66.7], ['Bình', 40, 33.3]]);

    const all = (await call('GET', '/ranking?range=all', a2.token)).body as Ranking;
    expect(all.groups[0]).toMatchObject({ name: 'Nhóm Sao', points: 230, minutes: 190, sessions: 4 });
    expect(all.contributions.map((c) => [c.name, c.points])).toEqual([['Bình', 150], ['An', 80]]);

    // Chỉ thấy thành viên của nhóm mình; người ngoài nhóm chỉ thấy bảng xếp hạng.
    const other = (await call('GET', '/ranking', b1.token)).body as Ranking;
    expect(other.contributions.map((c) => c.name)).toEqual(['Chi']);
    const lone = (await call('POST', '/auth/guest', undefined, { name: 'Khách' })).body.token as string;
    expect(((await call('GET', '/ranking', lone)).body as Ranking)).toMatchObject({ myGroupId: null, contributions: [] });
    expect((await call('GET', '/ranking')).status).toBe(401);
    expect((await call('GET', '/ranking?range=nam', a1.token)).status).toBe(400);
  });

  it('điểm bằng nhau thì đồng hạng', async () => {
    const x = await member('Xuân', { create: 'Nhóm Đồng 1' });
    const y = await member('Yến', { create: 'Nhóm Đồng 2' });
    await add(x.pid, dkey(Date.now()), 6000, 1);
    await add(y.pid, dkey(Date.now()), 6000, 1);
    const r = (await call('GET', '/ranking', x.token)).body as Ranking;
    const tied = r.groups.filter((g) => g.name.startsWith('Nhóm Đồng'));
    expect(tied.map((g) => g.rank)).toEqual([tied[0].rank, tied[0].rank]);
  });
});
