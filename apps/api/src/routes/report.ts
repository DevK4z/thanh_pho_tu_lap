/* Báo cáo cho quản trị viên ứng dụng: tỷ lệ hoàn thành và bỏ cuộc của từng người ở mọi nhóm. */
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AdminReport, AdminReportRow } from '@tptl/shared';
import type { Ctx } from '../app';
import { focusSessions, groups, players, users } from '../db/schema';
import { HttpError, parse } from '../errors';

const rate = (a: number, b: number) => (b ? a / b : null);

export function reportRoutes(app: FastifyInstance, { db, requireUser, isAdmin }: Ctx) {
  app.get('/admin/report', async (req): Promise<AdminReport> => {
    const u = await requireUser(req);
    if (!isAdmin(u)) throw new HttpError(403, 'admin_only', 'Chỉ quản trị viên ứng dụng xem được báo cáo này.');
    const { days } = parse(z.object({ days: z.coerce.number().int().min(1).max(3650).optional() }), req.query);
    const since = days ? new Date(Date.now() - days * 86400000) : null;

    const s = focusSessions;
    // Phiên được tính theo ngày bắt đầu; người chưa có phiên nào trong kỳ vẫn hiện với số 0.
    const joinOn = since ? and(eq(s.playerId, players.id), gte(s.startedAt, since)) : eq(s.playerId, players.id);
    const count = (status?: 'done' | 'quit' | 'active') =>
      status ? sql<number>`count(${s.id}) filter (where ${s.status} = ${status})::int` : sql<number>`count(${s.id})::int`;
    const rows = await db
      .select({
        playerId: players.id, name: players.name, groupId: groups.id, groupName: groups.name, provider: users.provider, email: users.email,
        currentStreak: players.currentStreak, bestStreak: players.bestStreak, gold: players.gold, wood: players.wood,
        createdAt: players.createdAt, lastAt: players.lastAt,
        registered: count(), done: count('done'), failed: count('quit'), active: count('active'),
        plannedSec: sql<number>`coalesce(sum(${s.plannedSec}) filter (where ${s.status} <> 'active'), 0)::int`,
        doneSec: sql<number>`coalesce(sum(${s.plannedSec}) filter (where ${s.status} = 'done'), 0)::int`,
      })
      .from(players)
      .innerJoin(groups, eq(groups.id, players.groupId))
      .innerJoin(users, eq(users.id, players.userId))
      .leftJoin(s, joinOn)
      .groupBy(players.id, groups.id, users.id)
      .orderBy(groups.name, desc(players.createdAt));

    const out: AdminReportRow[] = rows.map((r) => {
      const ended = r.done + r.failed;
      return {
        playerId: r.playerId, name: r.name, groupId: r.groupId, groupName: r.groupName, provider: r.provider, email: r.email,
        registered: r.registered, done: r.done, failed: r.failed, active: r.active,
        completionRate: rate(r.done, ended), quitRate: rate(r.failed, ended),
        plannedMin: Math.round(r.plannedSec / 60), doneMin: Math.round(r.doneSec / 60), timeRate: rate(r.doneSec, r.plannedSec),
        currentStreak: r.currentStreak, bestStreak: r.bestStreak, gold: r.gold, wood: r.wood,
        createdAt: r.createdAt.getTime(), lastAt: r.lastAt ? r.lastAt.getTime() : null,
      };
    });
    const sum = (k: 'registered' | 'done' | 'failed' | 'active') => out.reduce((a, r) => a + r[k], 0);
    const done = sum('done'), failed = sum('failed');
    req.log.info({ adminId: u.id, days: days ?? null, rows: out.length }, 'admin_report_viewed');
    return {
      generatedAt: Date.now(),
      days: days ?? null,
      rows: out,
      totals: {
        players: out.length, groups: new Set(out.map((r) => r.groupName)).size,
        registered: sum('registered'), done, failed, active: sum('active'),
        completionRate: rate(done, done + failed), quitRate: rate(failed, done + failed),
      },
    };
  });
}
