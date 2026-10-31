import { and, asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { ACT_KEYS, LIMITS, TIERS, type GrantResult, type GroupQuestion, type PendingReward } from '@tptl/shared';
import type { Ctx, User } from '../app';
import { players, questions } from '../db/schema';
import { HttpError, parse } from '../errors';
import { requireMember, uuidParam } from './groups';

const text = (max: number) => z.string().transform((s) => s.trim()).pipe(z.string().min(1, 'không được để trống').max(max));

export function adminRoutes(app: FastifyInstance, { db, requireUser, isAdmin }: Ctx) {
  /** Trưởng nhóm, hoặc quản trị viên ứng dụng (mọi nhóm). */
  async function requireOwner(u: User, gid: string) {
    const admin = isAdmin(u);
    const g = await requireMember(db, u, gid, admin);
    if (g.ownerId !== u.id && !admin) throw new HttpError(403, 'owner_only', 'Chỉ trưởng nhóm làm được việc này.');
    return g;
  }
  const toQ = (q: typeof questions.$inferSelect): GroupQuestion => ({ id: q.id, act: q.act, q: q.q, o: q.options, a: q.answer });

  app.get('/groups/:gid/questions', async (req) => {
    const u = await requireUser(req);
    const { gid } = parse(uuidParam('gid'), req.params);
    await requireOwner(u, gid);
    const rows = await db.select().from(questions).where(eq(questions.groupId, gid)).orderBy(asc(questions.createdAt));
    return rows.map(toQ);
  });

  app.post('/groups/:gid/questions', async (req, reply) => {
    const u = await requireUser(req);
    const { gid } = parse(uuidParam('gid'), req.params);
    await requireOwner(u, gid);
    const body = parse(z.object({
      act: z.enum(['all', ...ACT_KEYS] as [string, ...string[]]),
      q: text(LIMITS.question),
      o: z.array(text(LIMITS.option)).length(4),
      a: z.number().int().min(0).max(3),
    }), req.body);
    const [q] = await db.insert(questions).values({ groupId: gid, act: body.act as GroupQuestion['act'], q: body.q, options: body.o, answer: body.a }).returning();
    return reply.status(201).send(toQ(q));
  });

  /** Công cụ thử nghiệm của quản trị viên ứng dụng: cộng/trừ vàng, gỗ và cấp phần thưởng công trình cho một thành viên. */
  app.post('/groups/:gid/players/:pid/grant', async (req): Promise<GrantResult> => {
    const u = await requireUser(req);
    const { gid, pid } = parse(uuidParam('gid', 'pid'), req.params);
    if (!isAdmin(u)) throw new HttpError(403, 'admin_only', 'Chỉ quản trị viên ứng dụng cấp được vàng, gỗ và công trình.');
    await requireMember(db, u, gid, true);
    const body = parse(z.object({
      gold: z.number().int().min(-1_000_000).max(1_000_000).default(0),
      wood: z.number().int().min(-1_000_000).max(1_000_000).default(0),
      rewards: z.object({ tier: z.number().int().min(1).max(TIERS.length), count: z.number().int().min(1).max(20), shiny: z.boolean().default(false) }).optional(),
    }).refine((b) => b.gold || b.wood || b.rewards, 'cần cấp ít nhất một thứ'), req.body);
    const r = await db.transaction(async (tx) => {
      const [p] = await tx.select().from(players).where(and(eq(players.id, pid), eq(players.groupId, gid))).for('update');
      if (!p) throw new HttpError(404, 'player_not_found', 'Không tìm thấy thành viên.');
      const tier = body.rewards ? TIERS[body.rewards.tier - 1] : null;
      const extra: PendingReward[] = body.rewards
        ? Array.from({ length: body.rewards.count }, () => ({ sid: 'admin-' + randomUUID(), t: tier!.t, g: body.rewards!.shiny ? 1 : 0, m: tier!.min, a: 'deep' }))
        : [];
      const [np] = await tx.update(players).set({
        gold: Math.max(0, p.gold + body.gold),
        wood: Math.max(0, p.wood + body.wood),
        pending: p.pending.concat(extra),
      }).where(eq(players.id, p.id)).returning();
      return { name: np.name, gold: np.gold, wood: np.wood, pending: np.pending.length };
    });
    req.log.info({ adminGrant: { adminId: u.id, groupId: gid, playerId: pid, ...body, after: r } }, 'admin_grant');
    return r;
  });

  app.delete('/groups/:gid/questions/:qid', async (req) => {
    const u = await requireUser(req);
    const { gid, qid } = parse(uuidParam('gid', 'qid'), req.params);
    await requireOwner(u, gid);
    const del = await db.delete(questions).where(and(eq(questions.id, qid), eq(questions.groupId, gid))).returning({ id: questions.id });
    if (!del.length) throw new HttpError(404, 'question_not_found', 'Không tìm thấy câu hỏi.');
    return { ok: true };
  });
}
