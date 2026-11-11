/* Chấm kết quả thay vì chấm thời gian: phiên trên máy phải có mục tiêu, cuối phiên nộp kết quả, Gemini đối chiếu; trưởng nhóm duyệt. */
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dkey, type ActiveSession, type Me, type Player, type ResultReview, type ResultState, type SessionLog, type SessionResult } from '@tptl/shared';
import type { EvidenceAI } from '../src/ai';
import { buildApp } from '../src/app';
import { openDatabase, type Database } from '../src/db/client';
import { focusSessions, groups, sessionPhotos } from '../src/db/schema';
import { loadEnv } from '../src/env';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).toString('base64');
const realNow = Date.now.bind(Date);
let shift = 0;
let app: FastifyInstance;
let noAi: FastifyInstance;
let database: Database;
const ai = { checkPhoto: vi.fn(), recallQuestion: vi.fn(), judgeRecall: vi.fn(), checkResult: vi.fn() } satisfies EvidenceAI;

beforeAll(async () => {
  database = await openDatabase({ migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
  app = await buildApp({ db: database.db, env: loadEnv({ GROUP_CREATION: 'open' }), rateLimit: false, ai });
  noAi = await buildApp({ db: database.db, env: loadEnv({ GROUP_CREATION: 'open' }), rateLimit: false, ai: null });
  vi.spyOn(Date, 'now').mockImplementation(() => realNow() + shift);
});
afterAll(async () => { await app.close(); await noAi.close(); await database.close(); });
beforeEach(() => {
  ai.checkResult.mockReset().mockResolvedValue({ ok: true, score: 85, reason: 'Khớp mục tiêu, lượng việc tương xứng.' });
  ai.recallQuestion.mockReset().mockResolvedValue('Hôm qua bạn giải câu khó nhất bằng cách nào?');
});
afterEach(() => { shift = 0; });

async function call(method: 'GET' | 'POST', url: string, token?: string, payload?: unknown, on = app) {
  const r = await on.inject({ method, url: '/api' + url, payload: payload as object, headers: token ? { authorization: 'Bearer ' + token } : {} });
  return { status: r.statusCode, body: r.json() };
}
let seq = 0;
async function member(name: string, gid?: string) {
  const { token } = (await call('POST', '/auth/guest', undefined, { name })).body as { token: string };
  let id = gid;
  if (id) {
    const [g] = await database.db.select({ c: groups.inviteCode }).from(groups).where(eq(groups.id, id));
    await call('POST', '/groups/join', token, { code: g.c });
  } else id = ((await call('POST', '/groups', token, { name: 'Nhóm ' + name + ++seq })).body as Me).currentGroupId!;
  const p = (await call('POST', `/groups/${id}/players`, token, { name, style: 'san', dailyGoal: 30, participantCode: 'R' + ++seq })).body as Player;
  return { token, gid: id, pid: p.id };
}
type U = Awaited<ReturnType<typeof member>>;
const day = () => dkey(Date.now());
const start = (u: U, act: string, goal: string, minutes = 45) => call('POST', `/groups/${u.gid}/sessions`, u.token, { act, minutes, goal, day: day() });
async function complete(u: U, sid: string, on = app) {
  const [row] = await database.db.select().from(focusSessions).where(eq(focusSessions.id, sid));
  return call('POST', `/sessions/${sid}/complete`, u.token, { awaySec: 0, dist: 0, self: 4, note: 'mình viết xong phần mở bài và hai đoạn thân bài', verify: row.questions.verify.map((q) => q.a) }, on);
}

describe('chấm kết quả phiên trên máy', () => {
  it('phiên trên máy phải ghi mục tiêu; phiên ngoài màn hình thì không bắt buộc', async () => {
    const u = await member('An');
    expect((await start(u, 'study', '')).body.error.code).toBe('goal_required');
    expect((await start(u, 'write', 'ab')).body.error.code).toBe('goal_required');
    expect((await start(u, 'read', '', 5)).status).toBe(201);
  });

  it('chưa nộp thì không hoàn thành được; Gemini nhận đúng mục tiêu, số phút, ảnh và văn bản; đạt thì xác minh', async () => {
    const u = await member('Bình');
    const s = (await start(u, 'write', 'viết bài luận về bảo vệ môi trường')).body as ActiveSession;
    expect(s.result).toMatchObject({ status: 'none', tries: 0 });
    expect((await call('POST', `/sessions/${s.id}/result`, u.token, { text: 'mở bài' })).body.error.code).toBe('too_early');
    shift = 45 * 60_000;
    expect((await complete(u, s.id)).body.error.code).toBe('result_required');
    expect((await call('POST', `/sessions/${s.id}/result`, u.token, {})).body.error.code).toBe('result_empty');
    const r = (await call('POST', `/sessions/${s.id}/result`, u.token, { text: '  Bảo vệ môi trường là trách nhiệm của mỗi người...  ', image: JPEG })).body as ResultState;
    expect(r).toMatchObject({ status: 'ok', score: 85, tries: 1, hasImage: true, text: 'Bảo vệ môi trường là trách nhiệm của mỗi người...' });
    expect(ai.checkResult).toHaveBeenCalledWith({ act: 'write', minutes: 45, goal: 'viết bài luận về bảo vệ môi trường', text: 'Bảo vệ môi trường là trách nhiệm của mỗi người...', imageBase64: JPEG });
    expect((await call('POST', `/sessions/${s.id}/result`, u.token, { text: 'nộp thêm' })).body.error.code).toBe('result_done');
    expect(((await complete(u, s.id)).body as SessionResult).verified).toBe(true);
    // Ảnh kết quả được lưu để trưởng nhóm xem.
    expect(await database.db.select({ k: sessionPhotos.kind }).from(sessionPhotos).where(eq(sessionPhotos.sessionId, s.id))).toEqual([{ k: 'result' }]);
  });

  it('ví dụ 45 phút viết luận mà chỉ có 2 câu: đánh dấu đáng ngờ, nộp lại tối đa 3 lần, hoàn thành vẫn được nhưng chưa xác minh', async () => {
    const u = await member('Chi');
    ai.checkResult.mockResolvedValue({ ok: false, score: 15, reason: 'Chỉ có 2 câu, chưa tương xứng với 45 phút.' });
    const s = (await start(u, 'write', 'viết bài luận về tình bạn')).body as ActiveSession;
    shift = 45 * 60_000;
    for (const tries of [1, 2, 3]) {
      expect((await call('POST', `/sessions/${s.id}/result`, u.token, { text: 'Tình bạn rất quan trọng. Ai cũng cần bạn.' })).body)
        .toMatchObject({ status: 'flag', score: 15, tries, reason: 'Chỉ có 2 câu, chưa tương xứng với 45 phút.' });
    }
    expect((await call('POST', `/sessions/${s.id}/result`, u.token, { text: 'lần thứ tư' })).body.error.code).toBe('result_no_tries');
    expect(((await complete(u, s.id)).body as SessionResult).verified).toBe(false);
    const log = (await call('GET', `/groups/${u.gid}/players/${u.pid}/sessions`, u.token)).body as SessionLog[];
    expect(log[0]).toMatchObject({ resultStatus: 'flag', resultScore: 15 });
  });

  it('nộp lại chỉ sửa văn bản thì Gemini vẫn xem ảnh đã nộp trước', async () => {
    const u = await member('Dũng');
    ai.checkResult.mockResolvedValueOnce({ ok: false, score: 40, reason: 'Thiếu phần lời giải.' });
    const s = (await start(u, 'study', 'giải 10 câu hình học không gian', 30)).body as ActiveSession;
    shift = 30 * 60_000;
    await call('POST', `/sessions/${s.id}/result`, u.token, { image: JPEG });
    const r = (await call('POST', `/sessions/${s.id}/result`, u.token, { text: 'câu 1 đến câu 10 đã có lời giải trong vở' })).body as ResultState;
    expect(r).toMatchObject({ status: 'ok', hasImage: true, tries: 2 });
    expect(ai.checkResult).toHaveBeenLastCalledWith(expect.objectContaining({ imageBase64: JPEG, text: 'câu 1 đến câu 10 đã có lời giải trong vở' }));
  });

  it('chưa bật AI hoặc AI lỗi: kết quả vẫn được lưu, chờ trưởng nhóm; trưởng nhóm duyệt Đạt thì tính phút', async () => {
    const lead = await member('Cô Mai');
    const u = await member('Giang', lead.gid);
    const s = (await start(u, 'study', 'ôn tập chương 2 Sinh học', 20)).body as ActiveSession;
    shift = 20 * 60_000;
    expect((await call('POST', `/sessions/${s.id}/result`, u.token, { text: 'đã tóm tắt chương 2 thành sơ đồ tư duy' }, noAi)).body).toMatchObject({ status: 'sent', tries: 1 });
    expect(((await complete(u, s.id, noAi)).body as SessionResult).verified).toBe(false);

    expect((await call('GET', `/groups/${lead.gid}/results`, u.token)).status).toBe(403);
    const list = (await call('GET', `/groups/${lead.gid}/results`, lead.token)).body as ResultReview;
    expect(list.items[0]).toMatchObject({ name: 'Giang', goal: 'ôn tập chương 2 Sinh học', resultText: 'đã tóm tắt chương 2 thành sơ đồ tư duy', resultStatus: 'sent', minutes: 20, verified: false, self: false });
    await call('POST', `/groups/${lead.gid}/field/${s.id}`, lead.token, { result: 'ok' });
    const p = ((await call('GET', `/groups/${lead.gid}`, u.token)).body.players as Player[]).find((x) => x.id === u.pid)!;
    expect(p).toMatchObject({ totalFocusMin: 20, unverifiedMin: 0 });

    // AI lỗi tạm thời: trả lại lượt nộp, vẫn lưu để trưởng nhóm xem.
    const s2 = (await start(u, 'study', 'làm đề Toán số 4', 20)).body as ActiveSession;
    shift = 40 * 60_000;
    ai.checkResult.mockRejectedValueOnce(new Error('quá tải'));
    expect((await call('POST', `/sessions/${s2.id}/result`, u.token, { text: 'đã làm 30 câu trắc nghiệm' })).body).toMatchObject({ status: 'sent', tries: 0 });
  });

  it('hôm sau câu hỏi nhớ lại dựa cả vào kết quả đã nộp', async () => {
    const u = await member('Hùng');
    const s = (await start(u, 'study', 'giải đề Vật lý số 5', 15)).body as ActiveSession;
    shift = 15 * 60_000;
    await call('POST', `/sessions/${s.id}/result`, u.token, { text: 'câu 38 dùng định luật bảo toàn năng lượng' });
    await complete(u, s.id);
    shift += 86400000;
    await call('POST', `/sessions/${s.id}/recall/question`, u.token);
    expect(ai.recallQuestion).toHaveBeenCalledWith(expect.objectContaining({ note: expect.stringContaining('câu 38 dùng định luật bảo toàn năng lượng') }));
  });
});
