import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { ApiError } from '@google/genai';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dkey, type ActiveSession, type GroupDetail, type Me, type ProofState, type Ranking, type RecallResult, type SessionLog, type SessionResult, type SpotDraw } from '@tptl/shared';
import type { EvidenceAI } from '../src/ai';
import { buildApp } from '../src/app';
import { openDatabase, type Database } from '../src/db/client';
import { focusSessions } from '../src/db/schema';
import { loadEnv } from '../src/env';
import { groups } from '../src/db/schema';

let codeSeq = 0;
/** Mã mời của nhóm, đọc thẳng trong database. */
async function inviteOf(gid: string) {
  const [g] = await database.db.select({ c: groups.inviteCode }).from(groups).where(eq(groups.id, gid));
  return g.c;
}

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).toString('base64');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).toString('base64');
const realNow = Date.now.bind(Date);
let shift = 0;
let app: FastifyInstance;
let noAi: FastifyInstance;
let database: Database;
const ai = { checkPhoto: vi.fn(), recallQuestion: vi.fn(), judgeRecall: vi.fn() } satisfies EvidenceAI;
const day = (ms = 0) => dkey(Date.now() + ms);
const DAY = 86400000;

beforeAll(async () => {
  database = await openDatabase({ migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
  const env = loadEnv({ ADMIN_EMAILS: 'boss-account@example.com', GROUP_CREATION: 'open' });
  const verifiers = { google: async (c: string) => ({ sub: 'g-' + c, name: 'Boss', email: c + '@example.com', avatarUrl: null }) };
  app = await buildApp({ db: database.db, env, rateLimit: false, ai, verifiers });
  noAi = await buildApp({ db: database.db, env, rateLimit: false, ai: null });
  vi.spyOn(Date, 'now').mockImplementation(() => realNow() + shift);
});
afterAll(async () => { await app.close(); await noAi.close(); await database.close(); });
beforeEach(() => {
  ai.checkPhoto.mockReset().mockResolvedValue({ ok: true, reason: 'Ảnh khớp mã.' });
  ai.recallQuestion.mockReset().mockResolvedValue('Hôm đó bạn dừng ở chương nào?');
  ai.judgeRecall.mockReset().mockResolvedValue({ score: 80, verdict: 'khop', reason: 'Nhất quán.' });
});
afterEach(() => { shift = 0; });

async function call(method: 'GET' | 'POST', url: string, token?: string, payload?: unknown, on = app) {
  const r = await on.inject({ method, url: '/api' + url, payload: payload as object, headers: token ? { authorization: 'Bearer ' + token } : {} });
  return { status: r.statusCode, body: r.json() };
}
let seq = 0;
async function setup(name: string, gid?: string) {
  const { token } = (await call('POST', '/auth/guest', undefined, { name })).body as { token: string };
  let id = gid;
  if (id) await call('POST', '/groups/join', token, { code: await inviteOf(id) });
  else id = ((await call('POST', '/groups', token, { name: `Nhóm ${name} ${++seq}` })).body as Me).currentGroupId!;
  const p = (await call('POST', `/groups/${id}/players`, token, { name, style: 'ngoi', dailyGoal: 30, participantCode: 'P' + (++codeSeq) })).body as { id: string };
  return { token, gid: id, pid: p.id };
}
type U = Awaited<ReturnType<typeof setup>>;

/** Bắt đầu một phiên đọc sách rồi tua đến lúc hết giờ. */
async function reading(u: U, minutes = 10, goal = 'đọc chương 3') {
  const r = await call('POST', `/groups/${u.gid}/sessions`, u.token, { act: 'read', minutes, goal, day: day() });
  expect(r.status).toBe(201);
  shift += minutes * 60 * 1000;
  return r.body as ActiveSession;
}
async function finish(u: U, s: ActiveSession) {
  const [row] = await database.db.select().from(focusSessions).where(eq(focusSessions.id, s.id));
  const r = await call('POST', `/sessions/${s.id}/complete`, u.token, {
    awaySec: 0, dist: 0, self: 5, confirmed: true, note: 'nhân vật chính quyết định rời làng đi tìm thầy', verify: row.questions.verify.map((q) => q.a),
  });
  expect(r.status).toBe(200);
  return r.body as SessionResult;
}
const detail = async (u: U, d = day()) => (await call('GET', `/groups/${u.gid}?day=${d}`, u.token)).body as GroupDetail;
const mine = async (u: U) => (await detail(u)).players.find((p) => p.id === u.pid)!;

describe('lớp 1: mã thử thách và ảnh', () => {
  it('ảnh khớp thì phiên được xác minh và có điểm', async () => {
    const u = await setup('An');
    const s = await reading(u);
    const code = await call('POST', `/sessions/${s.id}/proof/code`, u.token, { pages: 40 });
    const proof = code.body as ProofState;
    expect(proof.status).toBe('ready');
    expect(proof.code).toMatch(/^[A-Z]+-\d{2}$/);
    expect(proof.page).toBeGreaterThanOrEqual(1);
    expect(proof.page).toBeLessThanOrEqual(40);
    const up = await call('POST', `/sessions/${s.id}/proof`, u.token, { image: JPEG });
    expect(up.body).toMatchObject({ status: 'ok', tries: 1 });
    expect(ai.checkPhoto).toHaveBeenCalledWith(expect.objectContaining({ code: proof.code, page: proof.page, act: 'read', imageBase64: JPEG }));

    expect(await finish(u, s)).toMatchObject({ verified: true });
    expect(await mine(u)).toMatchObject({ totalFocusMin: 10, unverifiedMin: 0 });
    const r = (await call('GET', '/ranking', u.token)).body as Ranking;
    expect(r.contributions[0]).toMatchObject({ minutes: 10, sessions: 1, points: 20 });
    // Ảnh không được lưu ở bất kỳ đâu trong phiên.
    const [row] = await database.db.select().from(focusSessions).where(eq(focusSessions.id, s.id));
    expect(JSON.stringify(row)).not.toContain(JPEG);
  });

  it('không có ảnh: vẫn nhận công trình nhưng phút không tính, không có điểm nhóm', async () => {
    const u = await setup('Bình');
    const s = await reading(u);
    expect(await finish(u, s)).toMatchObject({ verified: false, shiny: false, tier: expect.any(Number) });
    const p = await mine(u);
    expect(p).toMatchObject({ totalFocusMin: 0, unverifiedMin: 10 });
    expect(p.pending).toHaveLength(1);
    expect(((await call('GET', '/ranking', u.token)).body as Ranking).contributions[0]).toMatchObject({ points: 0, sessions: 0 });
  });

  it('chặn lấy mã sớm, gửi quá hạn, ảnh không phải JPEG và quá 3 lần thử', async () => {
    const u = await setup('Chi');
    const st = (await call('POST', `/groups/${u.gid}/sessions`, u.token, { act: 'move', minutes: 5, goal: '', day: day() })).body as ActiveSession;
    expect((await call('POST', `/sessions/${st.id}/proof/code`, u.token, {})).body.error.code).toBe('too_early');
    shift += 300_000;
    expect((await call('POST', `/sessions/${st.id}/proof`, u.token, { image: JPEG })).body.error.code).toBe('proof_no_code');
    const code = (await call('POST', `/sessions/${st.id}/proof/code`, u.token)).body as ProofState;
    expect(code.page).toBeNull();
    expect((await call('POST', `/sessions/${st.id}/proof`, u.token, { image: PNG })).body.error.code).toBe('bad_image');

    shift += 136_000;
    expect((await call('POST', `/sessions/${st.id}/proof`, u.token, { image: JPEG })).body.error.code).toBe('proof_expired');
    await call('POST', `/sessions/${st.id}/proof/code`, u.token);
    ai.checkPhoto.mockResolvedValue({ ok: false, reason: 'Không thấy mã.' });
    for (const tries of [1, 2, 3]) expect((await call('POST', `/sessions/${st.id}/proof`, u.token, { image: JPEG })).body).toMatchObject({ status: 'fail', tries, reason: 'Không thấy mã.' });
    expect((await call('POST', `/sessions/${st.id}/proof`, u.token, { image: JPEG })).body.error.code).toBe('proof_no_tries');
    expect((await call('POST', `/sessions/${st.id}/proof/code`, u.token)).body.error.code).toBe('proof_no_tries');
    expect(ai.checkPhoto).toHaveBeenCalledTimes(3);
  });

  it('người khác không dùng được phiên, lỗi AI trả lại lượt thử, khóa sai thì chuyển sang chưa bật', async () => {
    const u = await setup('Dũng');
    const other = await setup('Em');
    const s = await reading(u);
    expect((await call('POST', `/sessions/${s.id}/proof/code`, other.token, {})).status).toBe(404);
    await call('POST', `/sessions/${s.id}/proof/code`, u.token, {});
    ai.checkPhoto.mockRejectedValueOnce(new Error('quá tải'));
    expect((await call('POST', `/sessions/${s.id}/proof`, u.token, { image: JPEG })).status).toBe(503);
    const [row] = await database.db.select().from(focusSessions).where(eq(focusSessions.id, s.id));
    expect(row.proofTries).toBe(0);
    ai.checkPhoto.mockRejectedValueOnce(new ApiError({ status: 400, message: 'API key not valid.' }));
    expect((await call('POST', `/sessions/${s.id}/proof`, u.token, { image: JPEG })).body).toMatchObject({ status: 'na', tries: 0 });
  });

  it('máy chủ chưa có khóa AI: báo chưa bật, phiên vẫn hoàn thành được', async () => {
    const u = await setup('Giang');
    const s = await reading(u);
    expect((await call('POST', `/sessions/${s.id}/proof/code`, u.token, {}, noAi)).body).toMatchObject({ status: 'na', code: null });
    expect(await finish(u, s)).toMatchObject({ verified: false });
  });

  it('phiên trên máy đạt điểm tập trung từ 70 được xác minh không cần ảnh; thấp hơn thì không', async () => {
    const u = await setup('Hà');
    for (const [awaySec, verified] of [[0, true], [200, false]] as const) {
      const s = (await call('POST', `/groups/${u.gid}/sessions`, u.token, { act: 'deep', minutes: 5, goal: '', day: day() })).body as ActiveSession;
      shift += 300_000;
      const [row] = await database.db.select().from(focusSessions).where(eq(focusSessions.id, s.id));
      for (const c of row.questions.checks) await call('POST', `/sessions/${s.id}/checks`, u.token, { index: row.questions.checks.indexOf(c), choice: c.a });
      const r = await call('POST', `/sessions/${s.id}/complete`, u.token, { awaySec, dist: 0, self: 5, verify: row.questions.verify.map((q) => q.a) });
      expect(r.body).toMatchObject({ verified });
    }
  });

  it('tự khai chưa làm đủ: giữ chuỗi, không có điểm, chỉ khai được sau khi hết giờ', async () => {
    const u = await setup('Hùng');
    const a = await reading(u);
    await database.db.update(focusSessions).set({ proofStatus: 'ok' }).where(eq(focusSessions.id, a.id));
    await finish(u, a);
    const b = (await call('POST', `/groups/${u.gid}/sessions`, u.token, { act: 'move', minutes: 10, goal: '', day: day() })).body as ActiveSession;
    expect((await call('POST', `/sessions/${b.id}/quit`, u.token, { awaySec: 0, dist: 0, reason: 'honest' })).body.error.code).toBe('too_early');
    shift += 600_000;
    expect((await call('POST', `/sessions/${b.id}/quit`, u.token, { awaySec: 0, dist: 0, reason: 'honest' })).body).toMatchObject({ lostStreak: 0, stats: { currentStreak: 1, tasksFailed: 1 } });
  });
});

describe('lớp 2: câu hỏi nhớ lại', () => {
  it('hôm sau mới hỏi, chặn phiên mới, giấu ghi chú, chấm xong thì mở lại', async () => {
    const u = await setup('Khánh');
    const s = await reading(u);
    await finish(u, s);
    expect((await detail(u)).recall).toBeNull();

    shift += DAY;
    const due = (await detail(u)).recall!;
    expect(due).toMatchObject({ sid: s.id, act: 'read', question: null });
    expect((await call('POST', `/groups/${u.gid}/sessions`, u.token, { act: 'read', minutes: 5, goal: '', day: day() })).body.error.code).toBe('recall_due');
    const logs = (await call('GET', `/groups/${u.gid}/players/${u.pid}/sessions`, u.token)).body as SessionLog[];
    expect(logs[0].note).toBe('');

    expect((await call('POST', `/sessions/${s.id}/recall/answer`, u.token, { answer: 'một hai ba bốn năm', day: day() })).body.error.code).toBe('recall_no_question');
    const q = await call('POST', `/sessions/${s.id}/recall/question`, u.token);
    expect(q.body).toEqual({ question: 'Hôm đó bạn dừng ở chương nào?' });
    await call('POST', `/sessions/${s.id}/recall/question`, u.token);
    expect(ai.recallQuestion).toHaveBeenCalledTimes(1);
    expect(ai.recallQuestion).toHaveBeenCalledWith(expect.objectContaining({ goal: 'đọc chương 3', note: expect.stringContaining('rời làng') }));

    expect((await call('POST', `/sessions/${s.id}/recall/answer`, u.token, { answer: 'ngắn', day: day() })).body.error.code).toBe('answer_too_short');
    const r = (await call('POST', `/sessions/${s.id}/recall/answer`, u.token, { answer: 'mình dừng ở đoạn rời làng', day: day() })).body as RecallResult;
    expect(r).toEqual({ score: 80, verdict: 'khop', reason: 'Nhất quán.' });
    expect((await call('POST', `/sessions/${s.id}/recall/answer`, u.token, { answer: 'trả lời thêm lần nữa nhé', day: day() })).body.error.code).toBe('recall_closed');

    const p = await mine(u);
    expect(p.days[day()]).toMatchObject({ rq: 1, rc: 1 });
    expect((await detail(u)).recall).toBeNull();
    expect((await call('POST', `/groups/${u.gid}/sessions`, u.token, { act: 'read', minutes: 5, goal: '', day: day() })).status).toBe(201);
    expect(((await call('GET', `/groups/${u.gid}/players/${u.pid}/sessions`, u.token)).body as SessionLog[]).find((x) => x.id === s.id)!.note).toContain('rời làng');
  });

  it('chọn không nhớ thì 0 điểm; AI lỗi thì câu soạn sẵn và chờ người xem, không tính vào độ tin cậy', async () => {
    const u = await setup('Lan');
    const a = await reading(u);
    await finish(u, a);
    shift += DAY;
    await call('POST', `/sessions/${a.id}/recall/question`, u.token);
    expect((await call('POST', `/sessions/${a.id}/recall/answer`, u.token, { skip: true, day: day() })).body).toMatchObject({ score: 0, verdict: 'khong_nho' });
    expect((await mine(u)).days[day()]).toMatchObject({ rq: 1, rc: 0 });

    const b = await reading(u);
    await finish(u, b);
    shift += DAY;
    ai.recallQuestion.mockRejectedValueOnce(new Error('quá tải'));
    const q = (await call('POST', `/sessions/${b.id}/recall/question`, u.token)).body as { question: string };
    expect(q.question).toContain('đọc chương 3');
    expect((await call('POST', `/sessions/${b.id}/recall/answer`, u.token, { answer: 'mình nhớ đoạn rời làng rất rõ', day: day() })).body).toMatchObject({ score: null, verdict: 'cho_duyet' });
    expect(ai.judgeRecall).not.toHaveBeenCalled();
    expect((await mine(u)).days[day()]?.rq ?? 0).toBe(0);
  });

  it('chỉ hỏi phiên gần nhất, phiên không có nội dung thì không hỏi, quá 4 ngày thì bỏ', async () => {
    const u = await setup('Minh');
    const a = await reading(u);
    await finish(u, a);
    const b = await reading(u, 5);
    await finish(u, b);
    shift += DAY;
    expect((await detail(u)).recall).toMatchObject({ sid: b.id });
    shift += 5 * DAY;
    expect((await detail(u)).recall).toBeNull();
  });
});

describe('lớp 4: kiểm tra trực tiếp', () => {
  async function verified(u: U) {
    const s = await reading(u, 10, '');
    await database.db.update(focusSessions).set({ proofStatus: 'ok' }).where(eq(focusSessions.id, s.id));
    await finish(u, s);
    await database.db.update(focusSessions).set({ recallDue: false }).where(eq(focusSessions.id, s.id));
    return s;
  }

  it('bốc 1 hoặc 2 phiên, không khớp thì mất phút, mất điểm và độ tin cậy, chấm lại được', async () => {
    const owner = await setup('Trưởng');
    const m1 = await setup('Nam', owner.gid);
    const m2 = await setup('Oanh', owner.gid);
    for (let i = 0; i < 4; i++) await verified(m1);
    await verified(m2);
    await verified(owner);

    expect((await call('GET', `/groups/${owner.gid}/spot`, m1.token)).status).toBe(403);
    expect((await call('POST', `/groups/${owner.gid}/spot/draw`, m1.token)).status).toBe(403);
    expect(((await call('GET', `/groups/${owner.gid}/spot`, owner.token)).body as SpotDraw).week).toBeNull();

    const d = (await call('POST', `/groups/${owner.gid}/spot/draw`, owner.token)).body as SpotDraw;
    const row = (n: string, x = d) => x.rows.find((r) => r.name === n)!;
    expect(row('Nam').picks).toHaveLength(2);
    expect(row('Oanh').picks).toHaveLength(1);
    // Trưởng nhóm không thấy phiên của chính mình.
    expect(row('Trưởng')).toMatchObject({ self: true, picks: [] });

    // Thành viên không nhìn thấy phiên nào bị bốc.
    const log = (await call('GET', `/groups/${owner.gid}/players/${m1.pid}/sessions`, m1.token)).body as SessionLog[];
    expect(log.every((x) => x.spotResult === null)).toBe(true);

    const pick = row('Oanh').picks[0];
    expect((await call('POST', `/groups/${owner.gid}/spot/${pick.sid}`, m1.token, { result: 'no' })).status).toBe(403);
    expect((await call('POST', `/groups/${owner.gid}/spot/${pick.sid}`, owner.token, { result: 'no' })).status).toBe(200);
    expect(await mine(m2)).toMatchObject({ totalFocusMin: 0 });
    let r = (await call('GET', '/ranking', m2.token)).body as Ranking;
    expect(r.contributions.find((c) => c.name === 'Oanh')).toMatchObject({ points: 0 });
    expect(((await detail(m2)).players.find((p) => p.id === m2.pid)!.days[pick.day])).toMatchObject({ sn: 1, so: 0 });

    // Chấm nhầm thì sửa được; bấm lại cùng kết quả không cộng hai lần.
    await call('POST', `/groups/${owner.gid}/spot/${pick.sid}`, owner.token, { result: 'ok' });
    await call('POST', `/groups/${owner.gid}/spot/${pick.sid}`, owner.token, { result: 'ok' });
    expect(await mine(m2)).toMatchObject({ totalFocusMin: 10 });
    expect((await mine(m2)).days[pick.day]).toMatchObject({ sn: 0, so: 1 });
    r = (await call('GET', '/ranking', m2.token)).body as Ranking;
    expect(r.contributions.find((c) => c.name === 'Oanh')).toMatchObject({ points: 20 });

    // Bốc lại giữ phiên đã chấm.
    const again = (await call('POST', `/groups/${owner.gid}/spot/draw`, owner.token)).body as SpotDraw;
    expect(row('Oanh', again).picks).toMatchObject([{ sid: pick.sid, result: 'ok' }]);
  });

  it('quản trị viên ứng dụng chấm được phiên của trưởng nhóm, nhưng không tự chấm', async () => {
    const owner = await setup('Quân');
    await verified(owner);
    const admin = (await call('POST', '/auth/google', undefined, { credential: 'boss-account' })).body as { token: string; me: Me };
    const d = (await call('POST', `/groups/${owner.gid}/spot/draw`, admin.token)).body as SpotDraw;
    const pick = d.rows[0].picks[0];
    expect((await call('POST', `/groups/${owner.gid}/spot/${pick.sid}`, owner.token, { result: 'ok' })).body.error.code).toBe('own_session');
    expect((await call('POST', `/groups/${owner.gid}/spot/${pick.sid}`, admin.token, { result: 'ok' })).status).toBe(200);
    // Mã phiên của nhóm khác không chấm được từ nhóm này.
    const other = await setup('Rin');
    expect((await call('POST', `/groups/${other.gid}/spot/${pick.sid}`, other.token, { result: 'no' })).status).toBe(404);
  });
});
