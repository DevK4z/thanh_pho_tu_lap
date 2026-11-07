/* Ảnh hiện trường cho vận động, chăm cây; trưởng nhóm duyệt; bắt buộc mã cá nhân; sao lưu bằng khóa riêng. */
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dkey, type ActiveSession, type FieldPhoto, type FieldReview, type Me, type Player, type SessionResult } from '@tptl/shared';
import type { EvidenceAI } from '../src/ai';
import { buildApp } from '../src/app';
import { openDatabase, type Database } from '../src/db/client';
import { focusSessions, groups, sessionPhotos } from '../src/db/schema';
import { loadEnv } from '../src/env';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).toString('base64');
const KEY = 'khoa-sao-luu-rat-dai-0123456789';
const realNow = Date.now.bind(Date);
let shift = 0;
let app: FastifyInstance;
let database: Database;
const ai = { checkPhoto: vi.fn(async () => ({ ok: true, reason: 'Khớp mã.' })), recallQuestion: vi.fn(), judgeRecall: vi.fn() } satisfies EvidenceAI;

beforeAll(async () => {
  database = await openDatabase({ migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
  app = await buildApp({ db: database.db, env: loadEnv({ GROUP_CREATION: 'open', BACKUP_KEY: KEY }), rateLimit: false, ai });
  vi.spyOn(Date, 'now').mockImplementation(() => realNow() + shift);
});
afterAll(async () => { await app.close(); await database.close(); });
afterEach(() => { shift = 0; });

async function call(method: 'GET' | 'POST', url: string, token?: string, payload?: unknown, headers: Record<string, string> = {}) {
  const r = await app.inject({ method, url: '/api' + url, payload: payload as object, headers: { ...headers, ...(token ? { authorization: 'Bearer ' + token } : {}) } });
  return { status: r.statusCode, body: r.headers['content-type']?.includes('json') ? r.json() : r.rawPayload, headers: r.headers };
}
let seq = 0;
async function member(name: string, gid?: string, code: string | null = 'P' + ++seq) {
  const { token } = (await call('POST', '/auth/guest', undefined, { name })).body as { token: string };
  let id = gid;
  if (id) {
    const [g] = await database.db.select({ c: groups.inviteCode }).from(groups).where(eq(groups.id, id));
    await call('POST', '/groups/join', token, { code: g.c });
  } else id = ((await call('POST', '/groups', token, { name: 'Nhóm ' + name + seq })).body as Me).currentGroupId!;
  const p = (await call('POST', `/groups/${id}/players`, token, { name, style: 'san', dailyGoal: 30, participantCode: code ?? 'TAM' + seq })).body as Player;
  if (!code) await database.db.execute(`update players set participant_code = null where id = '${p.id}'`);
  return { token, gid: id, pid: p.id };
}
type U = Awaited<ReturnType<typeof member>>;
const day = () => dkey(Date.now());
const start = async (u: U, act: 'move' | 'plant' | 'read', minutes = 10) =>
  (await call('POST', `/groups/${u.gid}/sessions`, u.token, { act, minutes, goal: '', day: day() })).body as ActiveSession;
const photo = (u: U, sid: string, kind: string, geo: object = { lat: 21.028511, lng: 105.804817, acc: 12.4 }) =>
  call('POST', `/sessions/${sid}/photos/${kind}`, u.token, { image: JPEG, ...geo });
async function finish(u: U, s: ActiveSession, withProof = true) {
  if (withProof) {
    await call('POST', `/sessions/${s.id}/proof/code`, u.token, {});
    await call('POST', `/sessions/${s.id}/proof`, u.token, { image: JPEG, lat: 21.0301, lng: 105.8012 });
  }
  const [row] = await database.db.select().from(focusSessions).where(eq(focusSessions.id, s.id));
  return (await call('POST', `/sessions/${s.id}/complete`, u.token, { awaySec: 0, dist: 0, self: 4, confirmed: true, note: '', verify: row.questions.verify.map((q) => q.a) })).body as SessionResult;
}

describe('ảnh hiện trường', () => {
  it('chụp đúng khung giờ, giờ do máy chủ ghi, vị trí làm tròn; đủ ba ảnh và mã khớp thì xác minh', async () => {
    const u = await member('An');
    const s = await start(u, 'move');
    const meta = (await photo(u, s.id, 'start')).body as FieldPhoto[];
    expect(meta).toEqual([{ kind: 'start', takenAt: expect.any(Number), lat: 21.029, lng: 105.805, acc: 12 }]);
    expect((await photo(u, s.id, 'mid')).body.error.code).toBe('photo_too_early');
    shift = 4 * 60_000;
    expect((await photo(u, s.id, 'mid', {})).status).toBe(200);
    expect((await photo(u, s.id, 'end')).body.error.code).toBe('photo_too_early');
    shift = 10 * 60_000;
    expect((await finish(u, s)).verified).toBe(true);
    const kinds = (await database.db.select({ k: sessionPhotos.kind, lat: sessionPhotos.lat }).from(sessionPhotos).where(eq(sessionPhotos.sessionId, s.id)));
    expect(kinds.map((k) => k.k).sort()).toEqual(['end', 'mid', 'start']);
    // Ảnh giữa phiên không gửi vị trí thì để trống, không bịa.
    expect(kinds.find((k) => k.k === 'mid')!.lat).toBeNull();
  });

  it('chặn ảnh bắt đầu quá 5 phút, ảnh giữa phiên quá 80%; thiếu ảnh thì chưa xác minh', async () => {
    const u = await member('Bình');
    const s = await start(u, 'plant');
    shift = 6 * 60_000;
    expect((await photo(u, s.id, 'start')).body.error.code).toBe('photo_too_late');
    shift = 9 * 60_000;
    expect((await photo(u, s.id, 'mid')).body.error.code).toBe('photo_too_late');
    shift = 10 * 60_000;
    expect((await finish(u, s)).verified).toBe(false);
  });

  it('đọc sách không dùng ảnh hiện trường; người khác không gửi được ảnh vào phiên của mình', async () => {
    const u = await member('Chi');
    const other = await member('Dũng');
    const r = await start(u, 'read');
    expect((await photo(u, r.id, 'start')).body.error.code).toBe('not_field');
    expect((await photo(other, r.id, 'start')).status).toBe(404);
  });

  it('chỉ chủ phiên, trưởng nhóm và quản trị viên xem được ảnh; trưởng nhóm duyệt Đạt thì tính phút, không tự duyệt', async () => {
    const lead = await member('Cô Lan');
    const hs = await member('Hùng', lead.gid);
    const other = await member('Khang', lead.gid);
    const s = await start(hs, 'move', 5);
    shift = 5 * 60_000;
    expect((await finish(hs, s, false)).verified).toBe(false);
    await database.db.insert(sessionPhotos).values({ sessionId: s.id, kind: 'start', data: JPEG });

    const img = await call('GET', `/sessions/${s.id}/photos/start`, lead.token);
    expect(img.headers['content-type']).toBe('image/jpeg');
    expect((await call('GET', `/sessions/${s.id}/photos/start`, hs.token)).status).toBe(200);
    expect((await call('GET', `/sessions/${s.id}/photos/start`, other.token)).status).toBe(403);
    expect((await call('GET', `/sessions/${s.id}/photos/mid`, lead.token)).status).toBe(404);

    expect((await call('GET', `/groups/${lead.gid}/field`, hs.token)).status).toBe(403);
    const list = (await call('GET', `/groups/${lead.gid}/field`, lead.token)).body as FieldReview;
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ name: 'Hùng', participantCode: expect.any(String), verified: false, review: null, self: false, photos: [{ kind: 'start' }] });

    expect((await call('POST', `/groups/${lead.gid}/field/${s.id}`, hs.token, { result: 'ok' })).status).toBe(403);
    const p0 = (await call('GET', `/groups/${lead.gid}`, hs.token)).body.players.find((p: Player) => p.id === hs.pid) as Player;
    expect(p0).toMatchObject({ totalFocusMin: 0, unverifiedMin: 5 });
    await call('POST', `/groups/${lead.gid}/field/${s.id}`, lead.token, { result: 'ok' });
    await call('POST', `/groups/${lead.gid}/field/${s.id}`, lead.token, { result: 'ok' });
    let p = (await call('GET', `/groups/${lead.gid}`, hs.token)).body.players.find((x: Player) => x.id === hs.pid) as Player;
    expect(p).toMatchObject({ totalFocusMin: 5, unverifiedMin: 0 });
    expect(p.days[s.day]).toMatchObject({ vf: 1, uv: 0 });
    await call('POST', `/groups/${lead.gid}/field/${s.id}`, lead.token, { result: 'no' });
    p = (await call('GET', `/groups/${lead.gid}`, hs.token)).body.players.find((x: Player) => x.id === hs.pid) as Player;
    expect(p).toMatchObject({ totalFocusMin: 0, unverifiedMin: 5 });

    // Trưởng nhóm không tự duyệt phiên của mình.
    const own = await start(lead, 'move', 5);
    shift = 10 * 60_000 + 5 * 60_000;
    await finish(lead, own, false);
    expect((await call('POST', `/groups/${lead.gid}/field/${own.id}`, lead.token, { result: 'ok' })).body.error.code).toBe('own_session');
  });

  it('ảnh quá 45 ngày tự xóa khi có ảnh mới', async () => {
    const u = await member('Lâm');
    const old = await start(u, 'move', 5);
    await photo(u, old.id, 'start');
    shift = 5 * 60_000;
    await finish(u, old, false);
    shift = 46 * 86400000;
    const s = await start(u, 'move', 5);
    await photo(u, s.id, 'start');
    const left = await database.db.select({ sid: sessionPhotos.sessionId }).from(sessionPhotos).where(eq(sessionPhotos.sessionId, old.id));
    expect(left).toHaveLength(0);
  });
});

describe('mã cá nhân và sao lưu', () => {
  it('chưa có mã cá nhân thì không bắt đầu được phiên', async () => {
    const u = await member('Mai', undefined, null);
    expect((await call('POST', `/groups/${u.gid}/sessions`, u.token, { act: 'read', minutes: 5, goal: '', day: day() })).body.error.code).toBe('participant_required');
  });

  it('workflow sao lưu tải được dữ liệu bằng khóa riêng; khóa sai thì phải đăng nhập', async () => {
    const ok = await call('GET', '/admin/export', undefined, undefined, { 'x-backup-key': KEY });
    expect(ok.status).toBe(200);
    expect(ok.body.players.length).toBeGreaterThan(0);
    expect((await call('GET', '/admin/export', undefined, undefined, { 'x-backup-key': KEY + 'x' })).status).toBe(401);
    expect(() => loadEnv({ BACKUP_KEY: 'ngan' })).toThrow();
  });
});
