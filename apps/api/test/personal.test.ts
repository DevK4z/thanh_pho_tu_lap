/* Nhóm riêng của tài khoản khách: tự tạo khi đăng nhập khách, không nhận thành viên, không cần mã cá nhân,
   không hiện trong xếp hạng của người khác, danh sách nhóm của quản trị viên và báo cáo nghiên cứu. */
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dkey, type GroupDetail, type GroupSummary, type Me, type Ranking } from '@tptl/shared';
import { buildApp } from '../src/app';
import { openDatabase, type Database } from '../src/db/client';
import { groups } from '../src/db/schema';
import { loadEnv } from '../src/env';

let app: FastifyInstance;
let database: Database;
beforeAll(async () => {
  database = await openDatabase({ migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
  app = await buildApp({ db: database.db, env: loadEnv({ ADMIN_EMAILS: 'boss@example.com' }), rateLimit: false,
    verifiers: { google: async (c) => ({ sub: c, name: 'Thầy ' + c, email: c === 'boss' ? 'boss@example.com' : c + '@example.com', avatarUrl: null }) } });
});
afterAll(async () => { await app.close(); await database.close(); });

async function call<T = any>(method: 'GET' | 'POST' | 'PATCH', url: string, token?: string, payload?: unknown) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const r = await app.inject({ method, url: '/api' + url, payload: payload as object, headers: token ? { authorization: 'Bearer ' + token } : {} });
  return { status: r.statusCode, body: r.json() as T };
}
const guest = async (name: string) => (await call<{ token: string; me: Me }>('POST', '/auth/guest', undefined, { name })).body;
const google = async (c: string) => (await call<{ token: string; me: Me }>('POST', '/auth/google', undefined, { credential: c })).body;
const inviteOf = async (gid: string) => (await database.db.select({ c: groups.inviteCode }).from(groups).where(eq(groups.id, gid)))[0].c;

describe('nhóm riêng của khách', () => {
  it('đăng nhập khách là vào thẳng nhóm riêng; chơi được ngay không cần mã cá nhân', async () => {
    const { token, me } = await guest('An');
    expect(me.currentGroupId).toBeTruthy();
    const d = (await call<GroupDetail>('GET', `/groups/${me.currentGroupId}?day=${dkey(Date.now())}`, token)).body;
    expect(d.group).toMatchObject({ name: 'Nhóm riêng của An', personal: true, inviteCode: null });
    expect(d.isOwner).toBe(true);

    const p = await call('POST', `/groups/${me.currentGroupId}/players`, token, { name: 'An', style: 'ngoi', dailyGoal: 30 });
    expect(p.status).toBe(201);
    expect(p.body.participantCode).toBeNull();
    const s = await call('POST', `/groups/${me.currentGroupId}/sessions`, token, { act: 'read', minutes: 5, day: dkey(Date.now()) });
    expect(s.status).toBe(201);
  });

  it('hai khách cùng tên có hai nhóm riêng khác nhau; người khác không vào được nhóm riêng bằng mã mời', async () => {
    const a = await guest('Bình');
    const b = await guest('Bình');
    expect(a.me.currentGroupId).not.toBe(b.me.currentGroupId);
    const r = await call('POST', '/groups/join', b.token, { code: await inviteOf(a.me.currentGroupId!) });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('personal_group');
  });

  it('rời nhóm riêng rồi quay lại đúng nhóm cũ; chỉ tài khoản khách có nhóm riêng', async () => {
    const { token, me } = await guest('Chi');
    expect((await call<Me>('POST', '/me/leave-group', token)).body.currentGroupId).toBeNull();
    expect((await call<Me>('POST', '/me/personal-group', token)).body.currentGroupId).toBe(me.currentGroupId);
    const t = await google('teacher');
    expect(t.me.currentGroupId).toBeNull();
    expect((await call('POST', '/me/personal-group', t.token)).status).toBe(403);
  });

  it('nhóm thật vẫn bắt buộc mã cá nhân', async () => {
    const boss = await google('boss');
    const gid = (await call<Me>('POST', '/groups', boss.token, { name: 'Lớp thật' })).body.currentGroupId!;
    const hs = await guest('Dũng');
    await call('POST', '/groups/join', hs.token, { code: await inviteOf(gid) });
    expect((await call('POST', `/groups/${gid}/players`, hs.token, { name: 'Dũng', style: 'ngoi', dailyGoal: 30 })).status).toBe(400);
  });

  it('nhóm riêng không hiện trong danh sách nhóm của quản trị viên, báo cáo, và xếp hạng của người khác', async () => {
    const boss = await google('boss');
    const list = (await call<GroupSummary[]>('GET', '/groups', boss.token)).body;
    expect(list.map((g) => g.name)).toEqual(['Lớp thật']);
    const report = (await call<{ rows: { groupName: string }[] }>('GET', '/admin/report', boss.token)).body;
    expect(report.rows.some((r) => r.groupName.startsWith('Nhóm riêng'))).toBe(false);
    // An (có phiên trong nhóm riêng) thấy nhóm riêng của mình; người khác không thấy.
    const an = await guest('Em');
    await call('POST', `/groups/${an.me.currentGroupId}/players`, an.token, { name: 'Em', style: 'ngoi', dailyGoal: 30 });
    const mine = (await call<Ranking>('GET', '/ranking', an.token)).body;
    expect(mine.myGroupId).toBe(an.me.currentGroupId);
    const others = (await call<Ranking>('GET', '/ranking', boss.token)).body;
    expect(others.groups.some((g) => g.name.startsWith('Nhóm riêng'))).toBe(false);
  });
});
