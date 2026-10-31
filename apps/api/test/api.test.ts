import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dkey, type ActiveSession, type GroupDetail, type GroupSummary, type Me } from '@tptl/shared';
import { buildApp } from '../src/app';
import { openDatabase, type Database } from '../src/db/client';
import { focusSessions } from '../src/db/schema';
import { loadEnv } from '../src/env';
import { HttpError } from '../src/errors';

let app: FastifyInstance;
let database: Database;
const realNow = Date.now.bind(Date);
let shift = 0;

beforeAll(async () => {
  database = await openDatabase({ migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
  app = await buildApp({
    db: database.db,
    env: loadEnv({ ADMIN_EMAILS: ' Boss-Account@Example.com , khac@example.com' }),
    rateLimit: false,
    verifiers: {
      google: async (cred) => {
        if (cred === 'bad-credential') throw new HttpError(401, 'invalid_credential', 'sai');
        return { sub: 'g-' + cred, name: 'Google ' + cred, email: cred + '@example.com', avatarUrl: null };
      },
    },
  });
  vi.spyOn(Date, 'now').mockImplementation(() => realNow() + shift);
});
afterAll(async () => {
  await app.close();
  await database.close();
});
afterEach(() => { shift = 0; });

/** Gọi API; trả về { status, body }. */
async function call(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, token?: string, payload?: unknown) {
  const r = await app.inject({ method, url: '/api' + url, payload: payload as object, headers: token ? { authorization: 'Bearer ' + token } : {} });
  return { status: r.statusCode, body: r.json() };
}
async function guest(name: string) {
  const r = await call('POST', '/auth/guest', undefined, { name });
  expect(r.status).toBe(200);
  return r.body as { token: string; me: Me };
}
async function answersOf(sid: string) {
  const [s] = await database.db.select().from(focusSessions).where(eq(focusSessions.id, sid));
  return s.questions;
}
const today = () => dkey(Date.now());

describe('đăng nhập', () => {
  it('khách phải có tên, tên được chuẩn hóa', async () => {
    expect((await call('POST', '/auth/guest', undefined, { name: '   ' })).status).toBe(400);
    const { token, me } = await guest('  Minh   Anh ');
    expect(me).toMatchObject({ name: 'Minh Anh', provider: 'guest', currentGroupId: null });
    expect((await call('GET', '/me', token)).body).toMatchObject({ id: me.id });
  });

  it('thiếu hoặc sai token thì 401', async () => {
    expect((await call('GET', '/me')).status).toBe(401);
    expect((await call('GET', '/me', 'khong-hop-le')).status).toBe(401);
  });

  it('Google: cùng tài khoản đăng nhập lại ra cùng người dùng', async () => {
    const a = await call('POST', '/auth/google', undefined, { credential: 'user-one-credential' });
    const b = await call('POST', '/auth/google', undefined, { credential: 'user-one-credential' });
    expect(a.status).toBe(200);
    expect(a.body.me.provider).toBe('google');
    expect(b.body.me.id).toBe(a.body.me.id);
    expect(b.body.token).not.toBe(a.body.token);
    expect((await call('POST', '/auth/google', undefined, { credential: 'bad-credential' })).status).toBe(401);
  });

  it('Facebook chưa cấu hình thì báo 501, /config phản ánh đúng', async () => {
    expect((await call('POST', '/auth/facebook', undefined, { accessToken: 'abcdefghijklmn' })).status).toBe(501);
    expect((await call('GET', '/config')).body).toEqual({ google: 'test', facebook: null });
  });

  it('đăng xuất làm token hết hiệu lực', async () => {
    const { token } = await guest('Tạm');
    expect((await call('POST', '/auth/logout', token)).status).toBe(200);
    expect((await call('GET', '/me', token)).status).toBe(401);
  });
});

describe('luồng nhóm và phiên tập trung', () => {
  let A: { token: string; me: Me };
  let B: { token: string; me: Me };
  let gid: string;
  let aPid: string;
  let bPid: string;

  beforeAll(async () => {
    A = await guest('An');
    B = await guest('Bình');
  });

  it('lập nhóm: tự vào nhóm, chặn trùng tên không phân biệt hoa thường', async () => {
    const r = await call('POST', '/groups', A.token, { name: ' Lớp  10A1 ' });
    expect(r.status).toBe(201);
    gid = r.body.currentGroupId;
    expect(gid).toBeTruthy();
    const dup = await call('POST', '/groups', B.token, { name: 'lớp 10a1' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('group_name_taken');
  });

  it('danh sách nhóm và tham gia', async () => {
    const list = (await call('GET', '/groups', B.token)).body as GroupSummary[];
    const g = list.find((x) => x.id === gid)!;
    expect(g).toMatchObject({ name: 'Lớp 10A1', ownerName: 'An', members: 0 });
    expect((await call('GET', '/groups/' + gid, B.token)).status).toBe(403);
    expect((await call('POST', '/groups/00000000-0000-0000-0000-000000000000/join', B.token)).status).toBe(404);
    expect((await call('POST', `/groups/${gid}/join`, B.token)).body.currentGroupId).toBe(gid);
  });

  it('tạo nhà một lần mỗi nhóm', async () => {
    const r = await call('POST', `/groups/${gid}/players`, A.token, { name: 'An', style: 'ngoi', dailyGoal: 30 });
    expect(r.status).toBe(201);
    aPid = r.body.id;
    expect((await call('POST', `/groups/${gid}/players`, A.token, { name: 'An', style: 'ngoi', dailyGoal: 30 })).status).toBe(409);
    expect((await call('POST', `/groups/${gid}/players`, B.token, { name: 'Bình', style: 'xxx', dailyGoal: 30 })).status).toBe(400);
    bPid = (await call('POST', `/groups/${gid}/players`, B.token, { name: 'Bình', style: 'da', dailyGoal: 45 })).body.id;
    const d = (await call('GET', '/groups/' + gid, B.token)).body as GroupDetail;
    expect(d.players).toHaveLength(2);
    expect(d).toMatchObject({ isOwner: false, meId: bPid, active: null });
  });

  it('phiên trên máy: không lộ đáp án, chấm điểm ở máy chủ, chặn hoàn thành sớm', async () => {
    const st = await call('POST', `/groups/${gid}/sessions`, A.token, { act: 'deep', minutes: 25, goal: ' làm bài ', day: today() });
    expect(st.status).toBe(201);
    const s = st.body as ActiveSession;
    expect(s).toMatchObject({ mode: 'screen', plannedSec: 1500, goal: 'làm bài', checksAnswered: 0 });
    expect(s.checks).toHaveLength(2);
    expect(s.verify).toHaveLength(1);
    expect(JSON.stringify(s)).not.toMatch(/"a":/);
    expect((await call('POST', `/groups/${gid}/sessions`, A.token, { act: 'deep', minutes: 25, day: today() })).status).toBe(409);
    expect((await call('POST', `/groups/${gid}/sessions`, A.token, { act: 'deep', minutes: 3, day: today() })).status).toBe(400);

    const q = await answersOf(s.id);
    expect((await call('POST', `/sessions/${s.id}/checks`, A.token, { index: 1, choice: 0 })).status).toBe(409);
    expect((await call('POST', `/sessions/${s.id}/checks`, A.token, { index: 0, choice: q.checks[0].a })).body).toEqual({ correct: true, missed: false });
    expect((await call('POST', `/sessions/${s.id}/checks`, A.token, { index: 1, choice: -1 })).body).toEqual({ correct: false, missed: true });
    expect((await call('POST', `/sessions/${s.id}/checks`, B.token, { index: 1, choice: 0 })).status).toBe(404);

    const done = { awaySec: 150, dist: 2, self: 4, note: '', verify: [q.verify[0].a] };
    const early = await call('POST', `/sessions/${s.id}/complete`, A.token, done);
    expect(early.body.error.code).toBe('too_early');

    shift = 1500 * 1000;
    const r = await call('POST', `/sessions/${s.id}/complete`, A.token, done);
    expect(r.status).toBe(200);
    // 10% rời trang, 2 lần rời, 1 câu bỏ lỡ; đúng 2/3 câu
    expect(r.body).toMatchObject({ minutes: 25, tier: 2, qa: 3, qc: 2, missed: 1, dist: 2, away: 150, focus: Math.round((90 - 11) * (0.75 + 0.25 * 2 / 3)), shiny: false });
    expect((await call('POST', `/sessions/${s.id}/complete`, A.token, done)).body.error.code).toBe('session_ended');

    const d = (await call('GET', '/groups/' + gid, A.token)).body as GroupDetail;
    const me = d.players.find((p) => p.id === aPid)!;
    expect(me.totalFocusMin).toBe(25);
    expect(me.pending).toHaveLength(1);
    expect(me.days[s.day]).toMatchObject({ s: 1, c: 1, pl: 1500, cs: 1500, dn: 2, ms: 1, qa: 3, qc: 2, fn: 1 });
    expect(me).toMatchObject({ gold: 50, wood: 50, currentStreak: 1, bestStreak: 1, tasksDone: 1, tasksFailed: 0 });
    expect(r.body).toMatchObject({ gold: 50, wood: 50, mult: 1, stats: { currentStreak: 1, tasksDone: 1 } });
    expect(d.isOwner).toBe(true);
  });

  it('đặt công trình theo đúng hạng phần thưởng', async () => {
    expect((await call('POST', `/groups/${gid}/plot`, A.token, { item: 'thap', slot: 3 })).body.error.code).toBe('tier_too_high');
    expect((await call('POST', `/groups/${gid}/plot`, A.token, { item: 'vuon', slot: 99 })).status).toBe(400);
    const r = await call('POST', `/groups/${gid}/plot`, A.token, { item: 'vuon', slot: 3 });
    expect(r.body.plot).toEqual([{ s: 3, i: 'vuon', t: 2, g: 0 }]);
    expect(r.body.pending).toEqual([]);
    expect((await call('POST', `/groups/${gid}/plot`, A.token, { item: 'cay', slot: 4 })).body.error.code).toBe('no_reward');
  });

  it('phiên ngoài màn hình: cần xác nhận và ghi chú đủ dài, hoàn thành vẫn nhận vàng, gỗ, tăng chuỗi', async () => {
    expect((await call('POST', `/groups/${gid}/sessions`, B.token, { act: 'bơi', minutes: 10, day: today() })).status).toBe(400);
    const s = (await call('POST', `/groups/${gid}/sessions`, B.token, { act: 'read', minutes: 10, day: today() })).body as ActiveSession;
    expect(s).toMatchObject({ mode: 'offline', checks: [] });
    expect(s.verify).toHaveLength(2);
    shift = 600 * 1000;
    const base = { awaySec: 0, dist: 0, self: 5, verify: [0, 0] };
    expect((await call('POST', `/sessions/${s.id}/complete`, B.token, { ...base, note: 'một hai ba bốn năm sáu' })).body.error.code).toBe('not_confirmed');
    expect((await call('POST', `/sessions/${s.id}/complete`, B.token, { ...base, confirmed: true, note: 'ngắn quá' })).body.error.code).toBe('note_too_short');
    const r = await call('POST', `/sessions/${s.id}/complete`, B.token, { ...base, confirmed: true, note: 'một hai ba bốn năm sáu' });
    expect(r.body).toMatchObject({ mode: 'offline', gold: 50, wood: 50, stats: { currentStreak: 1, tasksDone: 1 } });
    await call('POST', `/groups/${gid}/plot`, B.token, { item: 'cay', slot: 0 });
  });

  it('phiên viết: ghi chú đủ dài, bỏ cuộc được ghi lý do', async () => {
    const s = (await call('POST', `/groups/${gid}/sessions`, B.token, { act: 'write', minutes: 10, day: today() })).body as ActiveSession;
    expect(s).toMatchObject({ mode: 'screen' });
    expect(s.verify).toHaveLength(1);
    shift = 600 * 1000;
    expect((await call('POST', `/sessions/${s.id}/complete`, B.token, { awaySec: 0, dist: 0, self: 5, verify: [0], note: 'ngắn quá' })).body.error.code).toBe('note_too_short');
    expect((await call('POST', `/me/leave-group`, B.token)).body.error.code).toBe('session_active');
    const q = await call('POST', `/sessions/${s.id}/quit`, B.token, { reason: 'tired', awaySec: 0, dist: 0 });
    expect(q.body).toMatchObject({ lostStreak: 1, stats: { tasksFailed: 1, currentStreak: 0, tasksDone: 1 } });
    const d = (await call('GET', '/groups/' + gid, B.token)).body as GroupDetail;
    const me = d.players.find((p) => p.id === bPid)!;
    expect(me.quitReasons).toEqual({ tired: 1 });
    expect(me.days[s.day]).toMatchObject({ s: 2, q: 1, c: 1 });
    expect(d.active).toBeNull();
  });

  it('nhật ký: chủ nhân và trưởng nhóm xem được, người khác thì không', async () => {
    const own = await call('GET', `/groups/${gid}/players/${bPid}/sessions`, B.token);
    expect(own.body).toHaveLength(2);
    expect(own.body[0]).toMatchObject({ status: 'quit', reason: 'tired', act: 'write' });
    expect(own.body[1]).toMatchObject({ status: 'done', act: 'read' });
    expect((await call('GET', `/groups/${gid}/players/${aPid}/sessions`, B.token)).status).toBe(403);
    expect((await call('GET', `/groups/${gid}/players/${bPid}/sessions`, A.token)).body).toHaveLength(2);
  });

  it('câu hỏi riêng của nhóm: chỉ trưởng nhóm sửa, được dùng trong phiên', async () => {
    const q = { act: 'deep', q: 'Câu hỏi riêng?', o: ['A', 'B', 'C', 'D'], a: 2 };
    expect((await call('POST', `/groups/${gid}/questions`, B.token, q)).status).toBe(403);
    expect((await call('POST', `/groups/${gid}/questions`, A.token, { ...q, o: ['A', 'B'] })).status).toBe(400);
    const r = await call('POST', `/groups/${gid}/questions`, A.token, q);
    expect(r.status).toBe(201);
    expect((await call('GET', `/groups/${gid}/questions`, A.token)).body).toEqual([{ id: r.body.id, ...q }]);
    // Hoạt động "deep" có 3 câu mặc định + 2 câu chung + 1 câu riêng; phát đủ nhiều lần sẽ gặp câu riêng.
    let seen = false;
    for (let i = 0; i < 12 && !seen; i++) {
      const s = (await call('POST', `/groups/${gid}/sessions`, B.token, { act: 'deep', minutes: 5, day: today() })).body as ActiveSession;
      seen = s.checks.concat(s.verify).some((v) => v.id === r.body.id);
      await call('POST', `/sessions/${s.id}/quit`, B.token, { reason: 'other', awaySec: 0, dist: 0 });
    }
    expect(seen).toBe(true);
    expect((await call('DELETE', `/groups/${gid}/questions/${r.body.id}`, A.token)).status).toBe(200);
  });

  it('rời nhóm rồi vào lại vẫn giữ thành phố', async () => {
    expect((await call('POST', '/me/leave-group', B.token)).body.currentGroupId).toBeNull();
    expect((await call('GET', '/groups/' + gid, B.token)).status).toBe(403);
    await call('POST', `/groups/${gid}/join`, B.token);
    expect(((await call('GET', '/groups/' + gid, B.token)).body as GroupDetail).meId).toBe(bPid);
  });

  it('chuỗi thành công nhân thưởng; thất bại đưa chuỗi về 0', async () => {
    const C = await guest('Chi');
    await call('POST', `/groups/${gid}/join`, C.token);
    await call('POST', `/groups/${gid}/players`, C.token, { name: 'Chi', style: 'san', dailyGoal: 30 });
    /** Chạy một phiên 5 phút trên máy: hoàn thành hoặc bị hệ thống đánh thất bại vì rời màn hình. */
    async function run(ok: boolean) {
      const s = (await call('POST', `/groups/${gid}/sessions`, C.token, { act: 'deep', minutes: 5, day: today() })).body as ActiveSession;
      if (!ok) return (await call('POST', `/sessions/${s.id}/quit`, C.token, { reason: 'violation', awaySec: 4, dist: 1 })).body;
      shift += 301_000;
      return (await call('POST', `/sessions/${s.id}/complete`, C.token, { awaySec: 0, dist: 0, self: 5, verify: [0] })).body;
    }
    const got: [number, number, number][] = [];
    for (let i = 0; i < 6; i++) { const r = await run(true); got.push([r.stats.currentStreak, r.mult, r.gold]); }
    expect(got).toEqual([[1, 1, 50], [2, 1, 50], [3, 1, 50], [4, 1, 50], [5, 2, 100], [6, 2, 100]]);

    const f = await run(false);
    expect(f).toEqual({ lostStreak: 6, stats: { tasksDone: 6, tasksFailed: 1, currentStreak: 0, bestStreak: 6, gold: 400, wood: 400 } });
    const again = await run(true);
    expect(again).toMatchObject({ mult: 1, gold: 50, stats: { currentStreak: 1, bestStreak: 6, gold: 450 } });

    const d = (await call('GET', '/groups/' + gid, C.token)).body as GroupDetail;
    expect(d.players.find((p) => p.id === d.meId)!.quitReasons).toEqual({ violation: 1 });
  });

  it('báo cáo admin: chỉ email trong ADMIN_EMAILS (đăng nhập Google) xem được, đủ tỷ lệ từng người', async () => {
    // Khách không có email nên không thể là admin; Google với email khác cũng không.
    expect((await call('GET', '/admin/report', A.token)).status).toBe(403);
    const other = (await call('POST', '/auth/google', undefined, { credential: 'nguoi-thuong' })).body;
    expect(other.me.isAdmin).toBe(false);
    expect((await call('GET', '/admin/report', other.token)).body.error.code).toBe('admin_only');

    const boss = (await call('POST', '/auth/google', undefined, { credential: 'boss-account' })).body;
    expect(boss.me.isAdmin).toBe(true);
    expect((await call('GET', '/me', boss.token)).body.isAdmin).toBe(true);
    const r = await call('GET', '/admin/report', boss.token);
    expect(r.status).toBe(200);
    const byName = Object.fromEntries((r.body.rows as { name: string }[]).map((x) => [x.name, x]));
    // An: 1 phiên 25 phút hoàn thành.
    expect(byName['An']).toMatchObject({ groupName: 'Lớp 10A1', registered: 1, done: 1, failed: 0, completionRate: 1, quitRate: 0, plannedMin: 25, doneMin: 25, timeRate: 1 });
    // Chi: 7 phiên hoàn thành, 1 thất bại (5 phút mỗi phiên).
    expect(byName['Chi']).toMatchObject({ registered: 8, done: 7, failed: 1, completionRate: 7 / 8, quitRate: 1 / 8, plannedMin: 40, doneMin: 35, bestStreak: 6 });
    expect(r.body.totals).toMatchObject({ players: 3, groups: 1 });
    expect(r.body.totals.registered).toBe(r.body.totals.done + r.body.totals.failed + r.body.totals.active);
    // Lọc theo số ngày; tham số sai bị từ chối.
    expect((await call('GET', '/admin/report?days=7', boss.token)).body.days).toBe(7);
    expect((await call('GET', '/admin/report?days=0', boss.token)).status).toBe(400);
  });

  it('ngày trên máy lệch quá xa bị từ chối', async () => {
    expect((await call('POST', `/groups/${gid}/sessions`, A.token, { act: 'deep', minutes: 5, day: '2020-01-01' })).body.error.code).toBe('bad_day');
  });
});
