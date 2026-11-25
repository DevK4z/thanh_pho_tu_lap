/* Nhiệm vụ trong ngày: danh sách việc đột xuất của từng người dùng, xem theo ngày, đánh dấu xong, dời việc chưa xong sang ngày khác.
   Gắn với tài khoản (không gắn với nhóm) và không cộng vào thành phố hay điểm nhóm. */
import { and, asc, count, eq, gte, lte, max, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DAY_RE, TASK_CATEGORY_KEYS, TASK_LIMITS, TASK_PRIORITY_KEYS, type DayTask, type TaskDayStat } from '@tptl/shared';
import type { Ctx } from '../app';
import type { Db } from '../db/client';
import { dayTasks } from '../db/schema';
import { HttpError, parse } from '../errors';
import { uuidParam } from './groups';

/** Ngày dạng YYYY-MM-DD và là ngày có thật (chặn 2026-02-31). */
const day = z.string().regex(DAY_RE, 'ngày phải có dạng YYYY-MM-DD').refine((d) => {
  const t = new Date(d + 'T00:00:00Z');
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}, 'ngày không tồn tại');
const title = z.string().transform((s) => s.trim().replace(/\s+/g, ' ')).pipe(z.string().min(1, 'cần tên việc').max(TASK_LIMITS.title));
const note = z.string().max(TASK_LIMITS.note).transform((s) => s.trim());
const category = z.enum(TASK_CATEGORY_KEYS as [string, ...string[]]);
const priority = z.enum(TASK_PRIORITY_KEYS as [string, ...string[]]);

type Row = typeof dayTasks.$inferSelect;
const toTask = (r: Row): DayTask => ({
  id: r.id, day: r.day, title: r.title, category: r.category, priority: r.priority, note: r.note,
  done: r.done, doneAt: r.doneAt?.getTime() ?? null, position: r.position, createdAt: r.createdAt.getTime(),
});

const dayCount = async (db: Db, userId: string, d: string) =>
  (await db.select({ n: count() }).from(dayTasks).where(and(eq(dayTasks.userId, userId), eq(dayTasks.day, d))))[0].n;
const nextPosition = async (db: Db, userId: string, d: string) =>
  ((await db.select({ m: max(dayTasks.position) }).from(dayTasks).where(and(eq(dayTasks.userId, userId), eq(dayTasks.day, d))))[0].m ?? -1) + 1;
const full = () => new HttpError(409, 'tasks_full', `Mỗi ngày tối đa ${TASK_LIMITS.perDay} việc.`);

export function taskRoutes(app: FastifyInstance, { db, requireUser }: Ctx) {
  /** Danh sách việc của một ngày, theo thứ tự đã thêm. */
  app.get('/tasks', async (req): Promise<DayTask[]> => {
    const u = await requireUser(req);
    const q = parse(z.object({ day }), req.query);
    const rows = await db.select().from(dayTasks).where(and(eq(dayTasks.userId, u.id), eq(dayTasks.day, q.day))).orderBy(asc(dayTasks.position), asc(dayTasks.createdAt));
    return rows.map(toTask);
  });

  /** Số việc và số việc đã xong của từng ngày trong khoảng [from, to] (chỉ ngày có việc). */
  app.get('/tasks/stats', async (req): Promise<TaskDayStat[]> => {
    const u = await requireUser(req);
    const q = parse(z.object({ from: day, to: day }), req.query);
    if (q.from > q.to) throw new HttpError(400, 'bad_range', 'Ngày bắt đầu phải trước ngày kết thúc.');
    const span = (Date.parse(q.to) - Date.parse(q.from)) / 86400000 + 1;
    if (span > TASK_LIMITS.statsDays) throw new HttpError(400, 'bad_range', `Chỉ xem tối đa ${TASK_LIMITS.statsDays} ngày một lần.`);
    const rows = await db.select({ day: dayTasks.day, total: count(), done: sql<number>`count(*) filter (where ${dayTasks.done})` })
      .from(dayTasks).where(and(eq(dayTasks.userId, u.id), gte(dayTasks.day, q.from), lte(dayTasks.day, q.to)))
      .groupBy(dayTasks.day).orderBy(asc(dayTasks.day));
    return rows.map((r) => ({ day: r.day, total: Number(r.total), done: Number(r.done) }));
  });

  app.post('/tasks', async (req): Promise<DayTask> => {
    const u = await requireUser(req);
    const b = parse(z.object({ day, title, category: category.default('other'), priority: priority.default('medium'), note: note.default('') }), req.body);
    if ((await dayCount(db, u.id, b.day)) >= TASK_LIMITS.perDay) throw full();
    const [row] = await db.insert(dayTasks).values({
      userId: u.id, day: b.day, title: b.title, category: b.category as Row['category'], priority: b.priority as Row['priority'], note: b.note,
      position: await nextPosition(db, u.id, b.day),
    }).returning();
    return toTask(row);
  });

  /** Sửa việc: đổi tên, phân loại, ưu tiên, ghi chú, đánh dấu xong, hoặc dời sang ngày khác (xếp cuối danh sách ngày đó). */
  app.patch('/tasks/:id', async (req): Promise<DayTask> => {
    const u = await requireUser(req);
    const { id } = parse(uuidParam('id'), req.params);
    const b = parse(z.object({ title, category, priority, note, done: z.boolean(), day }).partial(), req.body);
    const [cur] = await db.select().from(dayTasks).where(and(eq(dayTasks.id, id), eq(dayTasks.userId, u.id))).limit(1);
    if (!cur) throw new HttpError(404, 'task_not_found', 'Không tìm thấy việc này.');
    const set: Partial<typeof dayTasks.$inferInsert> = {};
    if (b.title !== undefined) set.title = b.title;
    if (b.category !== undefined) set.category = b.category as Row['category'];
    if (b.priority !== undefined) set.priority = b.priority as Row['priority'];
    if (b.note !== undefined) set.note = b.note;
    if (b.done !== undefined && b.done !== cur.done) { set.done = b.done; set.doneAt = b.done ? new Date() : null; }
    if (b.day !== undefined && b.day !== cur.day) {
      if ((await dayCount(db, u.id, b.day)) >= TASK_LIMITS.perDay) throw full();
      set.day = b.day;
      set.position = await nextPosition(db, u.id, b.day);
    }
    if (!Object.keys(set).length) return toTask(cur);
    const [row] = await db.update(dayTasks).set(set).where(eq(dayTasks.id, id)).returning();
    return toTask(row);
  });

  app.delete('/tasks/:id', async (req) => {
    const u = await requireUser(req);
    const { id } = parse(uuidParam('id'), req.params);
    const gone = await db.delete(dayTasks).where(and(eq(dayTasks.id, id), eq(dayTasks.userId, u.id))).returning({ id: dayTasks.id });
    if (!gone.length) throw new HttpError(404, 'task_not_found', 'Không tìm thấy việc này.');
    return { ok: true };
  });

  /** Dời mọi việc chưa xong của ngày `from` sang ngày `to`, giữ thứ tự, không vượt giới hạn số việc của ngày đích. */
  app.post('/tasks/carry', async (req): Promise<{ moved: number; left: number }> => {
    const u = await requireUser(req);
    const b = parse(z.object({ from: day, to: day }), req.body);
    if (b.from === b.to) throw new HttpError(400, 'same_day', 'Hãy chọn một ngày khác để dời việc.');
    const open = await db.select().from(dayTasks)
      .where(and(eq(dayTasks.userId, u.id), eq(dayTasks.day, b.from), eq(dayTasks.done, false))).orderBy(asc(dayTasks.position), asc(dayTasks.createdAt));
    const room = Math.max(0, TASK_LIMITS.perDay - (await dayCount(db, u.id, b.to)));
    const take = open.slice(0, room);
    let pos = await nextPosition(db, u.id, b.to);
    for (const t of take) await db.update(dayTasks).set({ day: b.to, position: pos++ }).where(eq(dayTasks.id, t.id));
    return { moved: take.length, left: open.length - take.length };
  });
}
