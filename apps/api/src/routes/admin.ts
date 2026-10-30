import { and, asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ACT_KEYS, LIMITS, type GroupQuestion } from '@tptl/shared';
import type { Ctx, User } from '../app';
import { questions } from '../db/schema';
import { HttpError, parse } from '../errors';
import { requireMember, uuidParam } from './groups';

const text = (max: number) => z.string().transform((s) => s.trim()).pipe(z.string().min(1, 'không được để trống').max(max));

export function adminRoutes(app: FastifyInstance, { db, requireUser }: Ctx) {
  async function requireOwner(u: User, gid: string) {
    const g = await requireMember(db, u, gid);
    if (g.ownerId !== u.id) throw new HttpError(403, 'owner_only', 'Chỉ trưởng nhóm làm được việc này.');
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

  app.delete('/groups/:gid/questions/:qid', async (req) => {
    const u = await requireUser(req);
    const { gid, qid } = parse(uuidParam('gid', 'qid'), req.params);
    await requireOwner(u, gid);
    const del = await db.delete(questions).where(and(eq(questions.id, qid), eq(questions.groupId, gid))).returning({ id: questions.id });
    if (!del.length) throw new HttpError(404, 'question_not_found', 'Không tìm thấy câu hỏi.');
    return { ok: true };
  });
}
