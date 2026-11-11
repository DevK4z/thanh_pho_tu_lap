import { randomInt } from 'node:crypto';
import { and, count, desc, eq, gte, inArray, ne } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  DAILY_GOALS, DAY_FIELDS, DAY_RE, HKEYS, INVITE_ALPHABET, INVITE_LENGTH, ITEMS, LIMITS, PARTICIPANT_RE, SLOTS, dkey, normalizeCode,
  type Days, type GroupDetail, type GroupSummary, type Player, type SessionLog,
} from '@tptl/shared';
import type { Ctx, User } from '../app';
import type { Db } from '../db/client';
import { dayStats, focusSessions, groups, players, users } from '../db/schema';
import { HttpError, parse, pgCode } from '../errors';
import { publicSession } from '../questions';
import { findRecall } from '../recall';
import { cleanName } from './auth';

export type PlayerRow = typeof players.$inferSelect;
type GroupRow = typeof groups.$inferSelect;

export const uuidParam = (...keys: string[]) => z.object(Object.fromEntries(keys.map((k) => [k, z.string().uuid('mã không hợp lệ')])));
export const groupKey = (name: string) => name.toLowerCase();
const makeInvite = () => Array.from({ length: INVITE_LENGTH }, () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]).join('');
// Giữ nguyên dấu gạch để khớp với mã trong phiếu khảo sát; chỉ bỏ khoảng trắng và viết hoa.
const participantCode = z.string().transform((v) => v.trim().toUpperCase()).refine((v) => PARTICIPANT_RE.test(v), 'mã cá nhân không hợp lệ');
const joinLimit = { rateLimit: { max: 20, timeWindow: '1 minute' } };
/** Số liệu theo ngày được trả về trong khoảng này (đủ cho bảng 365 ngày và xuất CSV). */
const DAYS_WINDOW = 400;

export function toPlayer(p: PlayerRow, days: Days): Player {
  return {
    id: p.id, userId: p.userId, name: p.name, participantCode: p.participantCode, style: p.style, dailyGoal: p.dailyGoal, totalFocusMin: p.totalFocusMin, unverifiedMin: p.unverifiedMin,
    plot: p.plot, pending: p.pending, quitReasons: p.quitReasons, days,
    currentStreak: p.currentStreak, bestStreak: p.bestStreak, tasksDone: p.tasksDone, tasksFailed: p.tasksFailed,
    createdAt: p.createdAt.getTime(), lastAt: p.lastAt ? p.lastAt.getTime() : null,
  };
}

/** Người dùng phải đang ở trong nhóm (users.current_group_id). asAdmin: quản trị viên ứng dụng xem và quản lý mọi nhóm. */
export async function requireMember(db: Db, u: User, gid: string, asAdmin = false): Promise<GroupRow> {
  if (u.currentGroupId !== gid && !asAdmin) throw new HttpError(403, 'not_member', 'Bạn không ở trong nhóm này.');
  const [g] = await db.select().from(groups).where(eq(groups.id, gid)).limit(1);
  if (!g) throw new HttpError(404, 'group_not_found', 'Nhóm không còn tồn tại.');
  return g;
}

/** Trưởng nhóm hoặc quản trị viên ứng dụng. */
export async function requireManager(db: Db, u: User, gid: string, asAdmin: boolean): Promise<GroupRow> {
  const g = await requireMember(db, u, gid, asAdmin);
  if (g.ownerId !== u.id && !asAdmin) throw new HttpError(403, 'owner_only', 'Chỉ trưởng nhóm làm được việc này.');
  return g;
}

export async function findPlayer(db: Db, gid: string, uid: string): Promise<PlayerRow | undefined> {
  const [p] = await db.select().from(players).where(and(eq(players.groupId, gid), eq(players.userId, uid))).limit(1);
  return p;
}
export async function requirePlayer(db: Db, gid: string, uid: string): Promise<PlayerRow> {
  const p = await findPlayer(db, gid, uid);
  if (!p) throw new HttpError(409, 'no_player', 'Bạn chưa tạo nhà trong nhóm này.');
  return p;
}

async function loadDays(db: Db, ids: string[]): Promise<Map<string, Days>> {
  const out = new Map<string, Days>(ids.map((id) => [id, {}]));
  if (!ids.length) return out;
  const since = dkey(Date.now() - DAYS_WINDOW * 86400000);
  const rows = await db.select().from(dayStats).where(and(inArray(dayStats.playerId, ids), gte(dayStats.day, since)));
  for (const r of rows) {
    const d = {} as Days[string];
    for (const f of DAY_FIELDS) d[f] = r[f];
    out.get(r.playerId)![r.day] = d;
  }
  return out;
}

export function groupRoutes(app: FastifyInstance, { db, env, requireUser, toMe, isAdmin }: Ctx) {
  /** Mã mời chưa dùng (thử lại vài lần nếu trùng). */
  async function freshInvite(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const c = makeInvite();
      const [hit] = await db.select({ id: groups.id }).from(groups).where(eq(groups.inviteCode, c)).limit(1);
      if (!hit) return c;
    }
    throw new HttpError(500, 'invite_failed', 'Chưa tạo được mã mời, hãy thử lại.');
  }

  /** Danh sách nhóm chỉ dành cho quản trị viên ứng dụng; người khác vào nhóm bằng mã mời. */
  app.get('/groups', async (req): Promise<GroupSummary[]> => {
    const u = await requireUser(req);
    if (!isAdmin(u)) return [];
    const members = db.select({ groupId: players.groupId, n: count().as('n') }).from(players).groupBy(players.groupId).as('members');
    const rows = await db
      .select({ id: groups.id, name: groups.name, inviteCode: groups.inviteCode, createdAt: groups.createdAt, ownerName: users.name, members: members.n })
      .from(groups)
      .innerJoin(users, eq(users.id, groups.ownerId))
      .leftJoin(members, eq(members.groupId, groups.id))
      .orderBy(desc(groups.createdAt))
      .limit(100);
    return rows.map((r) => ({ id: r.id, name: r.name, inviteCode: r.inviteCode, ownerName: r.ownerName, createdAt: r.createdAt.getTime(), members: Number(r.members ?? 0) }));
  });

  app.post('/groups', async (req, reply) => {
    const u = await requireUser(req);
    if (env.GROUP_CREATION === 'admin' && !isAdmin(u)) throw new HttpError(403, 'admin_only', 'Chỉ quản trị viên ứng dụng lập được nhóm. Hãy xin mã mời từ thầy cô hoặc trưởng nhóm.');
    const { name } = parse(z.object({ name: cleanName(LIMITS.groupName) }), req.body);
    const inviteCode = await freshInvite();
    try {
      const me = await db.transaction(async (tx) => {
        const [g] = await tx.insert(groups).values({ name, nameKey: groupKey(name), ownerId: u.id, inviteCode }).returning();
        const [nu] = await tx.update(users).set({ currentGroupId: g.id }).where(eq(users.id, u.id)).returning();
        return nu;
      });
      return reply.status(201).send(toMe(me));
    } catch (e) {
      if (pgCode(e) === '23505') throw new HttpError(409, 'group_name_taken', `Đã có nhóm “${name}”. Hãy tham gia nhóm đó hoặc đặt tên khác.`);
      throw e;
    }
  });

  /** Vào nhóm bằng mã mời. */
  app.post('/groups/join', { config: joinLimit }, async (req) => {
    const u = await requireUser(req);
    const { code } = parse(z.object({ code: z.string().max(20).transform(normalizeCode) }), req.body);
    const [g] = code ? await db.select({ id: groups.id }).from(groups).where(eq(groups.inviteCode, code)).limit(1) : [];
    if (!g) throw new HttpError(404, 'invite_invalid', 'Mã mời không đúng hoặc đã được đổi. Hãy hỏi lại thầy cô hoặc trưởng nhóm.');
    const [nu] = await db.update(users).set({ currentGroupId: g.id }).where(eq(users.id, u.id)).returning();
    return toMe(nu);
  });

  /** Vào nhóm theo mã nhóm: chỉ quản trị viên ứng dụng (người khác dùng mã mời). */
  app.post('/groups/:gid/join', async (req) => {
    const u = await requireUser(req);
    const { gid } = parse(uuidParam('gid'), req.params);
    if (!isAdmin(u)) throw new HttpError(403, 'invite_required', 'Hãy vào nhóm bằng mã mời.');
    const [g] = await db.select({ id: groups.id }).from(groups).where(eq(groups.id, gid)).limit(1);
    if (!g) throw new HttpError(404, 'group_not_found', 'Nhóm không còn tồn tại.');
    const [nu] = await db.update(users).set({ currentGroupId: gid }).where(eq(users.id, u.id)).returning();
    return toMe(nu);
  });

  app.post('/me/leave-group', async (req) => {
    const u = await requireUser(req);
    if (u.currentGroupId) {
      const p = await findPlayer(db, u.currentGroupId, u.id);
      if (p) {
        const [act] = await db.select({ id: focusSessions.id }).from(focusSessions).where(and(eq(focusSessions.playerId, p.id), eq(focusSessions.status, 'active'))).limit(1);
        if (act) throw new HttpError(409, 'session_active', 'Bạn đang trong phiên cam kết.');
      }
    }
    const [nu] = await db.update(users).set({ currentGroupId: null }).where(eq(users.id, u.id)).returning();
    return toMe(nu);
  });

  app.get('/groups/:gid', async (req): Promise<GroupDetail> => {
    const u = await requireUser(req);
    const { gid } = parse(uuidParam('gid'), req.params);
    const { day } = parse(z.object({ day: z.string().regex(DAY_RE).optional() }), req.query);
    const g = await requireMember(db, u, gid, isAdmin(u));
    const [owner] = await db.select({ name: users.name }).from(users).where(eq(users.id, g.ownerId)).limit(1);
    const rows = await db.select().from(players).where(eq(players.groupId, gid)).orderBy(desc(players.totalFocusMin));
    const days = await loadDays(db, rows.map((r) => r.id));
    const mine = rows.find((r) => r.userId === u.id);
    let active: GroupDetail['active'] = null;
    let recall: GroupDetail['recall'] = null;
    if (mine) {
      recall = await findRecall(db, mine.id, day ?? dkey(Date.now()));
      const [s] = await db.select().from(focusSessions).where(and(eq(focusSessions.playerId, mine.id), eq(focusSessions.status, 'active'))).limit(1);
      if (s) active = publicSession(s);
    }
    return {
      group: { id: g.id, name: g.name, ownerId: g.ownerId, ownerName: owner?.name ?? '', createdAt: g.createdAt.getTime(), inviteCode: g.ownerId === u.id || isAdmin(u) ? g.inviteCode : null },
      isOwner: g.ownerId === u.id,
      canManage: g.ownerId === u.id || isAdmin(u),
      players: rows.map((r) => toPlayer(r, days.get(r.id)!)),
      meId: mine?.id ?? null,
      active,
      recall,
      serverTime: Date.now(),
    };
  });

  app.post('/groups/:gid/players', async (req, reply) => {
    const u = await requireUser(req);
    const { gid } = parse(uuidParam('gid'), req.params);
    await requireMember(db, u, gid);
    const body = parse(z.object({
      name: cleanName(LIMITS.userName),
      style: z.enum(HKEYS as [string, ...string[]]),
      dailyGoal: z.number().int().refine((n) => DAILY_GOALS.includes(n), 'mục tiêu không hợp lệ'),
      participantCode,
    }), req.body);
    await uniqueCode(gid, body.participantCode);
    try {
      const [p] = await db.insert(players).values({ groupId: gid, userId: u.id, name: body.name, style: body.style as PlayerRow['style'], dailyGoal: body.dailyGoal, participantCode: body.participantCode }).returning();
      return reply.status(201).send(toPlayer(p, {}));
    } catch (e) {
      if (pgCode(e) === '23505') throw new HttpError(409, 'player_exists', 'Bạn đã có nhà trong nhóm này.');
      throw e;
    }
  });

  async function uniqueCode(gid: string, code: string, except?: string) {
    const [hit] = await db.select({ id: players.id }).from(players).where(and(eq(players.groupId, gid), eq(players.participantCode, code))).limit(1);
    if (hit && hit.id !== except) throw new HttpError(409, 'participant_taken', `Mã cá nhân ${code} đã có người dùng trong nhóm. Hãy kiểm tra lại với thầy cô hoặc trưởng nhóm.`);
  }

  /** Đổi mã mời: mã cũ hết hiệu lực, thành viên đang ở trong nhóm không bị ảnh hưởng. */
  app.post('/groups/:gid/invite', async (req) => {
    const u = await requireUser(req);
    const { gid } = parse(uuidParam('gid'), req.params);
    await requireManager(db, u, gid, isAdmin(u));
    const inviteCode = await freshInvite();
    await db.update(groups).set({ inviteCode }).where(eq(groups.id, gid));
    return { inviteCode };
  });

  /** Mã cá nhân: tự đặt khi chưa có; sau đó chỉ trưởng nhóm hoặc quản trị viên ứng dụng sửa được. */
  app.patch('/groups/:gid/players/:pid/participant', async (req) => {
    const u = await requireUser(req);
    const { gid, pid } = parse(uuidParam('gid', 'pid'), req.params);
    const { participantCode: code } = parse(z.object({ participantCode }), req.body);
    const admin = isAdmin(u);
    const g = await requireMember(db, u, gid, admin);
    const [p] = await db.select().from(players).where(and(eq(players.id, pid), eq(players.groupId, gid))).limit(1);
    if (!p) throw new HttpError(404, 'player_not_found', 'Không tìm thấy thành viên.');
    const manager = g.ownerId === u.id || admin;
    if (!manager && !(p.userId === u.id && !p.participantCode)) throw new HttpError(403, 'forbidden', 'Mã cá nhân đã được đặt. Nhờ trưởng nhóm sửa nếu bị sai.');
    await uniqueCode(gid, code, pid);
    await db.update(players).set({ participantCode: code }).where(eq(players.id, pid));
    req.log.info({ gid, pid, by: u.id }, 'participant_code_set');
    return { participantCode: code };
  });

  /** Đặt phần thưởng đầu tiên trong hàng chờ lên một lô đất. */
  app.post('/groups/:gid/plot', async (req) => {
    const u = await requireUser(req);
    const { gid } = parse(uuidParam('gid'), req.params);
    await requireMember(db, u, gid);
    const body = parse(z.object({
      item: z.enum(ITEMS.map((i) => i.id) as [string, ...string[]]),
      slot: z.number().int().min(0).max(SLOTS.length - 1),
    }), req.body);
    const p = await db.transaction(async (tx) => {
      const [me] = await tx.select().from(players).where(and(eq(players.groupId, gid), eq(players.userId, u.id))).for('update');
      if (!me) throw new HttpError(409, 'no_player', 'Bạn chưa tạo nhà trong nhóm này.');
      const pend = me.pending[0];
      if (!pend) throw new HttpError(409, 'no_reward', 'Bạn không còn phần thưởng nào để đặt.');
      const item = ITEMS.find((i) => i.id === body.item)!;
      if (item.t > pend.t) throw new HttpError(400, 'tier_too_high', 'Công trình này cần phần thưởng hạng cao hơn.');
      const plot = me.plot.filter((x) => x.s !== body.slot).concat([{ s: body.slot, i: item.id, t: pend.t, g: pend.g }]);
      const [np] = await tx.update(players).set({ plot, pending: me.pending.slice(1) }).where(eq(players.id, me.id)).returning();
      return np;
    });
    const days = await loadDays(db, [p.id]);
    return toPlayer(p, days.get(p.id)!);
  });

  /** Nhật ký phiên: chủ nhân, trưởng nhóm hoặc quản trị viên ứng dụng mới xem được. */
  app.get('/groups/:gid/players/:pid/sessions', async (req): Promise<SessionLog[]> => {
    const u = await requireUser(req);
    const { gid, pid } = parse(uuidParam('gid', 'pid'), req.params);
    const admin = isAdmin(u);
    const g = await requireMember(db, u, gid, admin);
    const [p] = await db.select().from(players).where(and(eq(players.id, pid), eq(players.groupId, gid))).limit(1);
    if (!p) throw new HttpError(404, 'player_not_found', 'Không tìm thấy thành viên.');
    if (p.userId !== u.id && g.ownerId !== u.id && !admin) throw new HttpError(403, 'forbidden', 'Chỉ trưởng nhóm xem được nhật ký của người khác.');
    const rows = await db.select().from(focusSessions)
      .where(and(eq(focusSessions.playerId, pid), ne(focusSessions.status, 'active')))
      .orderBy(desc(focusSessions.startedAt)).limit(20);
    return rows.map((r) => ({
      id: r.id, day: r.day, startedAt: r.startedAt.getTime(), endedAt: r.endedAt ? r.endedAt.getTime() : null, act: r.act, mode: r.mode,
      plannedSec: r.plannedSec, activeSec: r.activeSec, status: r.status as SessionLog['status'], reason: r.reason ?? null,
      dist: r.dist, missed: r.missed, focus: r.focus,
      // Giấu ghi chú khỏi chính chủ cho đến khi trả lời xong câu hỏi nhớ lại.
      note: r.recallDue && p.userId === u.id ? '' : r.note,
      verified: r.verified, proofStatus: r.proofStatus, proofReason: r.proofReason,
      recallQuestion: r.recallDue ? '' : r.recallQ, recallAnswer: r.recallA, recallScore: r.recallScore, recallVerdict: r.recallVerdict, recallReason: r.recallReason,
      spotResult: r.spotResult, review: r.review,
      resultStatus: r.resultStatus, resultScore: r.resultScore, resultReason: r.resultReason,
    }));
  });
}
