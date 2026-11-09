/* Ba lớp bằng chứng: mã thử thách kèm ảnh, câu hỏi nhớ lại hôm sau, kiểm tra trực tiếp ngẫu nhiên tại buổi sinh hoạt. */
import { randomInt } from 'node:crypto';
import { and, desc, eq, gte, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ACTS, FIELD_PROOF_SECONDS, LIMITS, MIN_RECALL_WORDS, DAY_RE, PROOF_SECONDS, PROOF_TRIES, RECALL_PASS, weekKey, wordCount,
  type ProofState, type RecallResult, type SpotDraw, type SpotPick, type SpotResult,
} from '@tptl/shared';
import { aiOff } from '../ai';
import type { Ctx, User } from '../app';
import type { Db } from '../db/client';
import { focusSessions, players } from '../db/schema';
import { HttpError, parse } from '../errors';
import { proofState } from '../questions';
import { requireManager, uuidParam } from './groups';
import { geoBody, isJpeg, MAX_IMAGE_CHARS } from './field';
import { savePhoto } from '../photos';
import { addDay, plausibleDay } from './sessions';

type SessionRow = typeof focusSessions.$inferSelect;

const CODE_WORDS = ['MAY', 'SONG', 'LUA', 'GIO', 'NUI', 'HOA', 'CAY', 'SAO', 'MUA', 'DAT', 'BIEN', 'RUNG', 'SUOI', 'DEN', 'TRAU', 'CHIM'];
/** Mã tạo ngay tại máy chủ, nên không dùng lại được ảnh cũ. */
const makeCode = () => CODE_WORDS[randomInt(CODE_WORDS.length)] + '-' + randomInt(10, 100);
/** Cho phép trễ một chút vì còn phải nén và gửi ảnh. */
const PROOF_LATE_MS = 15_000;
const dayParam = z.string().regex(DAY_RE);

function shuffled<T>(a: T[]): T[] {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

async function ownedSession(db: Db, u: User, sid: string): Promise<SessionRow> {
  const [row] = await db.select({ s: focusSessions, userId: players.userId }).from(focusSessions)
    .innerJoin(players, eq(players.id, focusSessions.playerId)).where(eq(focusSessions.id, sid)).limit(1);
  if (!row || row.userId !== u.id) throw new HttpError(404, 'session_not_found', 'Không tìm thấy phiên.');
  return row.s;
}

export function evidenceRoutes(app: FastifyInstance, { db, requireUser, isAdmin, ai }: Ctx) {
  async function activeOwned(u: User, sid: string) {
    const s = await ownedSession(db, u, sid);
    if (s.status !== 'active') throw new HttpError(409, 'session_ended', 'Phiên này đã kết thúc.');
    if (Date.now() < s.startedAt.getTime() + s.plannedSec * 1000 - 2000) throw new HttpError(409, 'too_early', 'Chưa hết thời gian cam kết.');
    return s;
  }
  async function saveProof(sid: string, set: Partial<SessionRow>): Promise<ProofState> {
    const [n] = await db.update(focusSessions).set(set).where(eq(focusSessions.id, sid)).returning();
    return proofState(n);
  }

  /* ---------- lớp 1: mã thử thách + ảnh ---------- */

  /** Phát mã mới; thời hạn chụp tính từ lúc này. pages: số trang của sách để bốc trang ngẫu nhiên. */
  app.post('/sessions/:sid/proof/code', async (req): Promise<ProofState> => {
    const u = await requireUser(req);
    const { sid } = parse(uuidParam('sid'), req.params);
    const { pages } = parse(z.object({ pages: z.number().int().min(1).max(5000).default(100) }), req.body ?? {});
    const s = await activeOwned(u, sid);
    const field = ACTS[s.act].field;
    if (s.proofStatus === 'ok') throw new HttpError(409, 'proof_done', 'Ảnh của phiên này đã khớp.');
    if (s.proofTries >= PROOF_TRIES) throw new HttpError(409, 'proof_no_tries', `Đã hết ${PROOF_TRIES} lần thử cho phiên này.`);
    // Vận động, chăm cây vẫn có mã khi chưa bật AI: trưởng nhóm đối chiếu mã trong ảnh lúc duyệt.
    if (!ai && !field) return saveProof(sid, { proofStatus: 'na' });
    if (!field) {
      return saveProof(sid, {
        proofStatus: 'ready', proofCode: makeCode(), proofPage: s.act === 'read' ? randomInt(1, pages + 1) : null,
        proofExp: new Date(Date.now() + PROOF_SECONDS * 1000), proofReason: '',
      });
    }
    // Vận động, chăm cây: mã tự hiện lúc hết giờ và hết hạn đúng FIELD_PROOF_SECONDS sau khi kết thúc, dù lấy mã lúc nào.
    const exp = s.startedAt.getTime() + s.plannedSec * 1000 + FIELD_PROOF_SECONDS * 1000;
    if (Date.now() > exp + PROOF_LATE_MS) throw new HttpError(409, 'proof_window_closed', `Đã quá ${FIELD_PROOF_SECONDS / 60} phút sau khi kết thúc nên không lấy được mã nữa. Phiên sẽ chờ trưởng nhóm duyệt.`);
    // Mở lại trang thì giữ mã cũ; chỉ đổi mã khi ảnh trước chưa khớp.
    if (s.proofCode && (s.proofStatus === 'ready' || s.proofStatus === 'sent')) return proofState(s);
    return saveProof(sid, { proofStatus: 'ready', proofCode: makeCode(), proofPage: null, proofExp: new Date(exp), proofReason: '' });
  });

  /** Gửi ảnh. Đọc sách: ảnh chỉ đi qua Gemini để kiểm tra, không lưu. Vận động, chăm cây: lưu làm ảnh kết thúc để trưởng nhóm duyệt. */
  app.post('/sessions/:sid/proof', { bodyLimit: MAX_IMAGE_CHARS + 1024 }, async (req): Promise<ProofState> => {
    const u = await requireUser(req);
    const { sid } = parse(uuidParam('sid'), req.params);
    const { image, ...geo } = parse(z.object({ image: z.string().min(16).max(MAX_IMAGE_CHARS), ...geoBody }), req.body);
    if (!isJpeg(image)) throw new HttpError(400, 'bad_image', 'Ảnh không đọc được, hãy chụp lại.');
    const s = await activeOwned(u, sid);
    const field = ACTS[s.act].field;
    if (!ai && !field) return saveProof(sid, { proofStatus: 'na' });
    if (s.proofStatus === 'ok') throw new HttpError(409, 'proof_done', 'Ảnh của phiên này đã khớp.');
    if (!s.proofCode || !s.proofExp) throw new HttpError(409, 'proof_no_code', 'Hãy lấy mã thử thách trước.');
    if (Date.now() > s.proofExp.getTime() + PROOF_LATE_MS) {
      throw new HttpError(409, 'proof_expired', field ? `Đã quá ${FIELD_PROOF_SECONDS / 60} phút sau khi kết thúc. Phiên sẽ chờ trưởng nhóm duyệt.` : 'Mã đã hết hạn. Hãy lấy mã mới rồi chụp lại.');
    }
    if (field) await savePhoto(db, sid, 'end', image, geo);
    if (!ai) return saveProof(sid, { proofStatus: 'sent', proofReason: 'Đã gửi ảnh có mã; trưởng nhóm sẽ đối chiếu khi duyệt.' });

    // Giữ chỗ một lượt trước khi gọi AI, để gửi đồng thời nhiều ảnh cũng không vượt số lần thử.
    const [slot] = await db.update(focusSessions).set({ proofTries: sql`${focusSessions.proofTries} + 1` })
      .where(and(eq(focusSessions.id, sid), sql`${focusSessions.proofTries} < ${PROOF_TRIES}`)).returning({ tries: focusSessions.proofTries });
    if (!slot) throw new HttpError(409, 'proof_no_tries', `Đã hết ${PROOF_TRIES} lần thử cho phiên này.`);
    try {
      const v = await ai.checkPhoto({ act: s.act, goal: s.goal, code: s.proofCode, page: s.proofPage, imageBase64: image });
      return saveProof(sid, { proofStatus: v.ok ? 'ok' : 'fail', proofReason: v.reason.slice(0, 200) });
    } catch (e) {
      req.log.warn({ err: e }, 'ai_photo_failed');
      // Lỗi phía AI không phải lỗi của học sinh nên trả lại lượt thử.
      await db.update(focusSessions).set({ proofTries: sql`${focusSessions.proofTries} - 1` }).where(eq(focusSessions.id, sid));
      if (aiOff(e)) return saveProof(sid, { proofStatus: 'na' });
      throw new HttpError(503, 'ai_busy', 'Chưa kiểm tra được ảnh, hãy thử lại sau ít phút.');
    }
  });

  /* ---------- lớp 2: câu hỏi nhớ lại ---------- */

  async function dueOwned(u: User, sid: string) {
    const s = await ownedSession(db, u, sid);
    if (!s.recallDue) throw new HttpError(409, 'recall_closed', 'Câu hỏi này không còn hiệu lực.');
    return s;
  }

  app.post('/sessions/:sid/recall/question', async (req) => {
    const u = await requireUser(req);
    const { sid } = parse(uuidParam('sid'), req.params);
    const s = await dueOwned(u, sid);
    if (s.recallQ) return { question: s.recallQ };
    let question = '';
    if (ai) {
      try { question = (await ai.recallQuestion({ act: s.act, day: s.day, goal: s.goal, note: s.note })).slice(0, 300); }
      catch (e) { req.log.warn({ err: e }, 'ai_recall_question_failed'); }
    }
    const manual = !question;
    if (manual) question = `Hôm trước bạn đã ${ACTS[s.act].n.toLowerCase()}${s.goal ? ` với mục tiêu “${s.goal}”` : ''}. Hãy kể lại hai chi tiết cụ thể bạn nhớ nhất từ phiên đó.`;
    await db.update(focusSessions).set({ recallQ: question, recallManual: manual }).where(eq(focusSessions.id, sid));
    return { question };
  });

  app.post('/sessions/:sid/recall/answer', async (req): Promise<RecallResult> => {
    const u = await requireUser(req);
    const { sid } = parse(uuidParam('sid'), req.params);
    const body = parse(z.object({
      answer: z.string().max(LIMITS.recallAnswer).default('').transform((x) => x.trim()),
      skip: z.boolean().default(false),
      day: dayParam,
    }), req.body);
    if (!plausibleDay(body.day, Date.now())) throw new HttpError(400, 'bad_day', 'Ngày trên máy không khớp với giờ thực. Hãy kiểm tra đồng hồ của máy.');
    const s = await dueOwned(u, sid);
    if (!s.recallQ) throw new HttpError(409, 'recall_no_question', 'Hãy nhận câu hỏi trước.');
    if (!body.skip && wordCount(body.answer) < MIN_RECALL_WORDS) throw new HttpError(400, 'answer_too_short', 'Hãy trả lời ít nhất vài từ, hoặc chọn “Tôi không nhớ”.');

    let res: RecallResult = { score: 0, verdict: 'khong_nho', reason: 'Học sinh chọn “Tôi không nhớ”.' };
    if (!body.skip) {
      res = { score: null, verdict: 'cho_duyet', reason: 'Người tổ chức sẽ xem lại câu trả lời.' };
      if (ai && !s.recallManual) {
        try {
          const v = await ai.judgeRecall({ act: s.act, day: s.day, goal: s.goal, note: s.note, question: s.recallQ, answer: body.answer });
          res = { score: v.score, verdict: v.verdict, reason: v.reason.slice(0, 200) };
        } catch (e) { req.log.warn({ err: e }, 'ai_recall_judge_failed'); }
      }
    }
    await db.transaction(async (tx) => {
      // Chỉ lần gửi đầu tiên được tính, kể cả khi bấm hai lần.
      const [n] = await tx.update(focusSessions)
        .set({ recallDue: false, recallA: body.answer, recallScore: res.score, recallVerdict: res.verdict, recallReason: res.reason })
        .where(and(eq(focusSessions.id, sid), eq(focusSessions.recallDue, true))).returning({ id: focusSessions.id });
      if (!n) throw new HttpError(409, 'recall_closed', 'Câu hỏi này không còn hiệu lực.');
      if (res.score != null) await addDay(tx, s.playerId, body.day, { rq: 1, rc: res.score >= RECALL_PASS ? 1 : 0 });
    });
    return res;
  });

  /* ---------- lớp 4: kiểm tra trực tiếp ---------- */

  const requireManagerOf = (u: User, gid: string) => requireManager(db, u, gid, isAdmin(u));

  async function latestDraw(u: User, gid: string): Promise<SpotDraw> {
    const members = await db.select({ id: players.id, name: players.name, userId: players.userId }).from(players).where(eq(players.groupId, gid)).orderBy(players.name);
    const ids = members.map((m) => m.id);
    const f = focusSessions;
    const [last] = ids.length
      ? await db.select({ week: f.spotWeek }).from(f).where(and(inArray(f.playerId, ids), isNotNull(f.spotWeek))).orderBy(desc(f.spotWeek)).limit(1)
      : [];
    const week = last?.week ?? null;
    const rows = week ? await db.select().from(f).where(and(inArray(f.playerId, ids), eq(f.spotWeek, week))).orderBy(desc(f.startedAt)) : [];
    return {
      week,
      rows: members.map((m) => {
        const self = m.userId === u.id;
        const picks: SpotPick[] = self ? [] : rows.filter((r) => r.playerId === m.id).map((r) => ({
          sid: r.id, day: r.day, act: r.act, minutes: Math.round(r.plannedSec / 60), goal: r.goal, note: r.note, verified: r.verified, result: r.spotResult,
        }));
        return { playerId: m.id, name: m.name, self, picks };
      }),
    };
  }

  app.get('/groups/:gid/spot', async (req): Promise<SpotDraw> => {
    const u = await requireUser(req);
    const { gid } = parse(uuidParam('gid'), req.params);
    await requireManagerOf(u, gid);
    return latestDraw(u, gid);
  });

  /** Bốc 1 phiên, hoặc 2 phiên nếu người đó có từ 4 phiên trong 7 ngày. Bốc lại chỉ thay các phiên chưa chấm. */
  app.post('/groups/:gid/spot/draw', async (req): Promise<SpotDraw> => {
    const u = await requireUser(req);
    const { gid } = parse(uuidParam('gid'), req.params);
    await requireManagerOf(u, gid);
    const week = weekKey();
    const f = focusSessions;
    const ids = (await db.select({ id: players.id }).from(players).where(eq(players.groupId, gid))).map((p) => p.id);
    if (ids.length) {
      await db.transaction(async (tx) => {
        await tx.update(f).set({ spotWeek: null }).where(and(inArray(f.playerId, ids), eq(f.spotWeek, week), isNull(f.spotResult)));
        const since = new Date(Date.now() - 7 * 86400000);
        const done = await tx.select({ id: f.id, playerId: f.playerId, marked: f.spotResult }).from(f)
          .where(and(inArray(f.playerId, ids), eq(f.status, 'done'), gte(f.endedAt, since)));
        const picks = ids.flatMap((pid) => {
          const mine = done.filter((d) => d.playerId === pid);
          return shuffled(mine.filter((d) => !d.marked)).slice(0, mine.length >= 4 ? 2 : 1).map((d) => d.id);
        });
        if (picks.length) await tx.update(f).set({ spotWeek: week }).where(inArray(f.id, picks));
      });
    }
    req.log.info({ gid, by: u.id, week }, 'spot_draw');
    return latestDraw(u, gid);
  });

  /** Chấm khớp hoặc không khớp; chấm lại được nếu bấm nhầm. Không khớp thì phiên mất phút khỏi giai đoạn nhà và mất điểm nhóm. */
  app.post('/groups/:gid/spot/:sid', async (req) => {
    const u = await requireUser(req);
    const { gid, sid } = parse(uuidParam('gid', 'sid'), req.params);
    const { result } = parse(z.object({ result: z.enum(['ok', 'no']) }), req.body);
    await requireManagerOf(u, gid);
    await db.transaction(async (tx) => {
      const [row] = await tx.select({ s: focusSessions, p: players }).from(focusSessions)
        .innerJoin(players, eq(players.id, focusSessions.playerId)).where(and(eq(focusSessions.id, sid), eq(players.groupId, gid))).for('update');
      if (!row || !row.s.spotWeek) throw new HttpError(404, 'spot_not_found', 'Phiên này không nằm trong lượt bốc thăm.');
      const { s, p } = row;
      if (p.userId === u.id) throw new HttpError(403, 'own_session', 'Bạn không thể tự chấm phiên của mình.');
      const prev: SpotResult | null = s.spotResult;
      if (prev === result) return;
      const minutes = Math.round(s.plannedSec / 60);
      const counted = (r: SpotResult | null) => (s.verified && r !== 'no' ? minutes : 0);
      await tx.update(focusSessions).set({ spotResult: result }).where(eq(focusSessions.id, sid));
      await addDay(tx, s.playerId, s.day, { so: (result === 'ok' ? 1 : 0) - (prev === 'ok' ? 1 : 0), sn: (result === 'no' ? 1 : 0) - (prev === 'no' ? 1 : 0) });
      await tx.update(players).set({ totalFocusMin: Math.max(0, p.totalFocusMin + counted(result) - counted(prev)) }).where(eq(players.id, p.id));
    });
    req.log.info({ gid, sid, by: u.id, result }, 'spot_mark');
    return { result };
  });
}

