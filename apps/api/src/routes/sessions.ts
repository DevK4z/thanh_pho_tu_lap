/* Phiên tập trung. Máy chủ giữ giờ bắt đầu, câu hỏi và đáp án; tự chấm điểm, tính chuỗi và cấp phần thưởng.
   Trình duyệt chỉ báo những gì nó đo được: thời gian rời trang, số lần rời trang, câu trả lời và tự đánh giá. */
import { eq, sql } from 'drizzle-orm';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ACTS, LIMITS, MAX_MINUTES, MIN_MINUTES, MIN_NOTE_WORDS, REASON_KEYS, SESSION_ACTS, DAY_RE,
  checkCount, levelOf, rewardFor, scoreSession, tierFor, verifyCount, wordCount,
  type ActKey, type DayStat, type QuitResult, type SessionResult, type TaskStats,
} from '@tptl/shared';
import type { Ctx, User } from '../app';
import type { Db } from '../db/client';
import { dayStats, focusSessions, players, questions as questionsTable, type SessionQuestions } from '../db/schema';
import { HttpError, parse, pgCode } from '../errors';
import { DEFAULT_QUESTIONS, issueQuestions, publicSession, type BankQuestion } from '../questions';
import { requireMember, requirePlayer, uuidParam } from './groups';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type SessionRow = typeof focusSessions.$inferSelect;
type PlayerRow = typeof players.$inferSelect;

/** Cộng dồn số liệu vào một ngày (tạo dòng nếu chưa có). */
async function addDay(tx: Tx, playerId: string, day: string, inc: Partial<DayStat>) {
  const keys = (Object.keys(inc) as (keyof DayStat)[]).filter((k) => inc[k]);
  if (!keys.length) return;
  const set = Object.fromEntries(keys.map((k) => [k, sql`${dayStats[k]} + excluded.${sql.identifier(k)}`]));
  await tx.insert(dayStats).values({ playerId, day, ...inc }).onConflictDoUpdate({ target: [dayStats.playerId, dayStats.day], set });
}

export async function groupBank(db: Db | Tx, gid: string): Promise<BankQuestion[]> {
  const custom = await db.select().from(questionsTable).where(eq(questionsTable.groupId, gid));
  return DEFAULT_QUESTIONS.concat(custom.map((q) => ({ id: q.id, act: q.act, q: q.q, o: q.options, a: q.answer })));
}

/** Ngày địa phương do trình duyệt gửi phải lệch không quá ~1 ngày so với giờ máy chủ. */
function plausibleDay(day: string, now: number) {
  const t = Date.parse(day + 'T12:00:00Z');
  return Number.isFinite(t) && Math.abs(t - now) <= 38 * 3600_000;
}

function answeredStats(q: SessionQuestions) {
  const done = q.checks.filter((c) => c.ans !== undefined);
  return { qa: done.length, qc: done.filter((c) => c.ans === c.a).length, missed: done.filter((c) => c.ans === -1).length };
}

const statsOf = (p: Pick<PlayerRow, keyof TaskStats>): TaskStats => ({
  tasksDone: p.tasksDone, tasksFailed: p.tasksFailed, currentStreak: p.currentStreak, bestStreak: p.bestStreak, gold: p.gold, wood: p.wood,
});

/** Báo cáo cho admin mỗi khi một phiên kết thúc: ghi vào log máy chủ (terminal khi chạy local, tab Logs trên Render). */
function reportToAdmin(log: FastifyBaseLogger, userId: string, playerId: string, taskStatus: 'success' | 'failed', st: TaskStats, reason?: string) {
  const total = st.tasksDone + st.tasksFailed;
  log.info({
    adminReport: {
      userId, playerId, taskStatus, reason,
      totalTasks: total, successTasks: st.tasksDone, failedTasks: st.tasksFailed,
      completionRate: total ? Math.round((st.tasksDone / total) * 1000) / 10 : null,
      currentStreak: st.currentStreak, gold: st.gold, wood: st.wood,
    },
  }, 'admin_report');
}

const measured = {
  awaySec: z.number().min(0).max(24 * 3600),
  dist: z.number().int().min(0).max(10_000),
};

export function sessionRoutes(app: FastifyInstance, { db, requireUser }: Ctx) {
  /** Khóa phiên đang chạy của chính người dùng để cập nhật. */
  async function lockActive(tx: Tx, u: User, sid: string): Promise<{ s: SessionRow; p: PlayerRow }> {
    const [row] = await tx.select({ s: focusSessions, p: players }).from(focusSessions)
      .innerJoin(players, eq(players.id, focusSessions.playerId))
      .where(eq(focusSessions.id, sid)).for('update');
    if (!row || row.p.userId !== u.id) throw new HttpError(404, 'session_not_found', 'Không tìm thấy phiên.');
    if (row.s.status !== 'active') throw new HttpError(409, 'session_ended', 'Phiên này đã kết thúc.');
    return row;
  }

  app.post('/groups/:gid/sessions', async (req, reply) => {
    const u = await requireUser(req);
    const { gid } = parse(uuidParam('gid'), req.params);
    await requireMember(db, u, gid);
    const p = await requirePlayer(db, gid, u.id);
    const body = parse(z.object({
      act: z.enum(SESSION_ACTS as [ActKey, ...ActKey[]], { errorMap: () => ({ message: 'chỉ đăng ký được hoạt động trên máy' }) }),
      minutes: z.number().int().min(MIN_MINUTES).max(MAX_MINUTES),
      goal: z.string().max(LIMITS.goal).default('').transform((s) => s.trim()),
      day: z.string().regex(DAY_RE),
    }), req.body);
    const now = Date.now();
    if (!plausibleDay(body.day, now)) throw new HttpError(400, 'bad_day', 'Ngày trên máy không khớp với giờ thực. Hãy kiểm tra đồng hồ của máy.');
    const mode = ACTS[body.act].mode;
    const plannedSec = body.minutes * 60;
    const bank = await groupBank(db, gid);
    const used = new Set<string>();
    const qs: SessionQuestions = {
      checks: issueQuestions(bank, body.act, checkCount(mode, plannedSec), used),
      verify: issueQuestions(bank, body.act, verifyCount(mode), used),
    };
    try {
      const s = await db.transaction(async (tx) => {
        const [s] = await tx.insert(focusSessions).values({ playerId: p.id, act: body.act, mode, plannedSec, goal: body.goal, day: body.day, startedAt: new Date(now), questions: qs }).returning();
        await addDay(tx, p.id, body.day, { s: 1, pl: plannedSec });
        return s;
      });
      return reply.status(201).send(publicSession(s));
    } catch (e) {
      if (pgCode(e) === '23505') throw new HttpError(409, 'session_active', 'Bạn đang có một phiên chưa kết thúc.');
      throw e;
    }
  });

  /** Trả lời câu kiểm tra hiện diện tiếp theo; choice = -1 nghĩa là hết giờ không trả lời. */
  app.post('/sessions/:sid/checks', async (req) => {
    const u = await requireUser(req);
    const { sid } = parse(uuidParam('sid'), req.params);
    const body = parse(z.object({ index: z.number().int().min(0), choice: z.number().int().min(-1).max(9) }), req.body);
    return db.transaction(async (tx) => {
      const { s } = await lockActive(tx, u, sid);
      const q = s.questions;
      const next = q.checks.findIndex((c) => c.ans === undefined);
      if (next === -1) throw new HttpError(409, 'no_check', 'Không còn câu kiểm tra nào.');
      if (body.index !== next) throw new HttpError(409, 'wrong_check', 'Câu kiểm tra không đúng thứ tự.');
      const c = q.checks[next];
      if (body.choice >= c.o.length) throw new HttpError(400, 'invalid_input', 'Phương án không hợp lệ.');
      c.ans = body.choice;
      await tx.update(focusSessions).set({ questions: q }).where(eq(focusSessions.id, sid));
      return { correct: body.choice === c.a, missed: body.choice === -1 };
    });
  });

  app.post('/sessions/:sid/complete', async (req): Promise<SessionResult> => {
    const u = await requireUser(req);
    const { sid } = parse(uuidParam('sid'), req.params);
    const body = parse(z.object({
      ...measured,
      self: z.number().int().min(1).max(5),
      note: z.string().max(LIMITS.note).default('').transform((s) => s.trim()),
      confirmed: z.boolean().default(false),
      verify: z.array(z.number().int().min(0).max(9)).max(5),
    }), req.body);
    const r = await db.transaction(async (tx) => {
      const { s, p } = await lockActive(tx, u, sid);
      const now = Date.now();
      if (now < s.startedAt.getTime() + s.plannedSec * 1000 - 2000) throw new HttpError(409, 'too_early', 'Chưa hết thời gian cam kết.');
      const q = s.questions;
      if (body.verify.length !== q.verify.length) throw new HttpError(400, 'invalid_input', 'Cần trả lời đủ câu hỏi xác nhận.');
      if (s.mode === 'offline' && !body.confirmed) throw new HttpError(400, 'not_confirmed', 'Cần xác nhận đã thực hiện đủ thời gian.');
      if (ACTS[s.act].needNote && wordCount(body.note) < MIN_NOTE_WORDS) throw new HttpError(400, 'note_too_short', `Ghi chú cần ít nhất ${MIN_NOTE_WORDS} từ.`);

      body.verify.forEach((ans, i) => { q.verify[i].ans = ans; });
      const chk = answeredStats(q);
      const qa = chk.qa + q.verify.length;
      const qc = chk.qc + q.verify.filter((v) => v.ans === v.a).length;
      const activeSec = s.plannedSec;
      const awaySec = s.mode === 'screen' ? Math.round(Math.min(body.awaySec, activeSec)) : 0;
      const dist = s.mode === 'screen' ? body.dist : 0;
      const focus = scoreSession({ mode: s.mode, activeSec, awaySec, distractions: dist, missed: chk.missed, qa, qc, self: body.self });
      const minutes = Math.round(s.plannedSec / 60);
      const tier = tierFor(minutes);
      const shiny = focus >= 85;

      await tx.update(focusSessions).set({
        status: 'done', endedAt: new Date(now), activeSec, awaySec, dist, missed: chk.missed, qa, qc, focus, self: body.self, note: body.note, questions: q,
      }).where(eq(focusSessions.id, sid));
      await addDay(tx, p.id, s.day, { c: 1, ac: activeSec, cs: activeSec, aw: awaySec, dn: dist, ms: chk.missed, qa, qc, fs: focus, fn: 1 });
      // Chuỗi tăng 1; hệ số thưởng tính theo chuỗi sau khi tăng.
      const streak = p.currentStreak + 1;
      const reward = rewardFor(streak);
      const [np] = await tx.update(players).set({
        totalFocusMin: p.totalFocusMin + minutes,
        pending: p.pending.concat([{ sid, t: tier, g: shiny ? 1 : 0, m: minutes, a: s.act }]),
        lastAt: new Date(now),
        gold: p.gold + reward.gold,
        wood: p.wood + reward.wood,
        currentStreak: streak,
        bestStreak: Math.max(p.bestStreak, streak),
        tasksDone: p.tasksDone + 1,
      }).where(eq(players.id, p.id)).returning();
      const result: SessionResult = {
        focus, minutes, tier, shiny, qc, qa, dist, away: awaySec, missed: chk.missed, mode: s.mode,
        prevLv: levelOf(p.totalFocusMin).lv, newLv: levelOf(p.totalFocusMin + minutes).lv,
        gold: reward.gold, wood: reward.wood, mult: reward.mult, stats: statsOf(np),
      };
      return { result, playerId: p.id };
    });
    reportToAdmin(req.log, u.id, r.playerId, 'success', r.result.stats);
    return r.result;
  });

  /** Bỏ cuộc hoặc thất bại (rời màn hình, đóng trang): chuỗi về 0. */
  app.post('/sessions/:sid/quit', async (req): Promise<QuitResult> => {
    const u = await requireUser(req);
    const { sid } = parse(uuidParam('sid'), req.params);
    const body = parse(z.object({ ...measured, reason: z.enum(REASON_KEYS as [string, ...string[]]) }), req.body);
    const reason = body.reason as (typeof REASON_KEYS)[number];
    const r = await db.transaction(async (tx) => {
      const { s, p } = await lockActive(tx, u, sid);
      const now = Date.now();
      // Phiên bị đóng giữa chừng không biết đã làm bao lâu nên không tính thời gian thực hiện.
      const activeSec = reason === 'closed' ? 0 : Math.max(0, Math.min(s.plannedSec, Math.round((now - s.startedAt.getTime()) / 1000)));
      const chk = answeredStats(s.questions);
      const awaySec = s.mode === 'screen' ? Math.round(Math.min(body.awaySec, s.plannedSec)) : 0;
      const dist = s.mode === 'screen' ? body.dist : 0;
      await tx.update(focusSessions).set({ status: 'quit', reason, endedAt: new Date(now), activeSec, awaySec, dist, missed: chk.missed, qa: chk.qa, qc: chk.qc }).where(eq(focusSessions.id, sid));
      await addDay(tx, p.id, s.day, { q: 1, ac: activeSec, aw: awaySec, dn: dist, ms: chk.missed, qa: chk.qa, qc: chk.qc });
      const qr = { ...p.quitReasons, [reason]: (p.quitReasons[reason] || 0) + 1 };
      const [np] = await tx.update(players).set({
        quitReasons: qr, lastAt: new Date(now), currentStreak: 0, tasksFailed: p.tasksFailed + 1,
      }).where(eq(players.id, p.id)).returning();
      return { playerId: p.id, out: { lostStreak: p.currentStreak, stats: statsOf(np) } };
    });
    reportToAdmin(req.log, u.id, r.playerId, 'failed', r.out.stats, reason);
    return r.out;
  });
}

