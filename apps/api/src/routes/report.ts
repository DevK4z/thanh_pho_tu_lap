/* Báo cáo cho quản trị viên ứng dụng: tỷ lệ hoàn thành và bỏ cuộc của từng người ở mọi nhóm. */
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AdminReport, AdminReportRow, FullExport } from '@tptl/shared';
import type { Ctx } from '../app';
import { dayStats, focusSessions, groups, players, users } from '../db/schema';
import { HttpError, parse } from '../errors';

const rate = (a: number, b: number) => (b ? a / b : null);

export function reportRoutes(app: FastifyInstance, { db, requireUser, isAdmin }: Ctx) {
  /** Tải toàn bộ dữ liệu để sao lưu (gói miễn phí của Neon chỉ giữ lịch sử khôi phục 6 giờ) và để phân tích. */
  app.get('/admin/export', async (req, reply): Promise<FullExport> => {
    const u = await requireUser(req);
    if (!isAdmin(u)) throw new HttpError(403, 'admin_only', 'Chỉ quản trị viên ứng dụng tải được dữ liệu.');
    const gs = await db.select({ id: groups.id, name: groups.name, createdAt: groups.createdAt, ownerName: users.name }).from(groups).innerJoin(users, eq(users.id, groups.ownerId));
    const ps = await db.select({ p: players, provider: users.provider }).from(players).innerJoin(users, eq(users.id, players.userId));
    const ss = await db.select().from(focusSessions).orderBy(focusSessions.startedAt);
    const ds = await db.select().from(dayStats).orderBy(dayStats.day);
    const gName = new Map(gs.map((g) => [g.id, g.name]));
    const code = new Map(ps.map(({ p }) => [p.id, p.participantCode]));
    const ms = (d: Date | null) => (d ? d.getTime() : null);
    req.log.info({ adminId: u.id, sessions: ss.length }, 'admin_export');
    reply.header('content-disposition', `attachment; filename="thanh-pho-tu-lap-${new Date().toISOString().slice(0, 10)}.json"`);
    return {
      exportedAt: Date.now(),
      groups: gs.map((g) => ({ id: g.id, name: g.name, ownerName: g.ownerName, createdAt: g.createdAt.getTime() })),
      players: ps.map(({ p, provider }) => ({
        id: p.id, groupId: p.groupId, groupName: gName.get(p.groupId) ?? '', participantCode: p.participantCode, name: p.name, provider,
        totalFocusMin: p.totalFocusMin, unverifiedMin: p.unverifiedMin, tasksDone: p.tasksDone, tasksFailed: p.tasksFailed,
        currentStreak: p.currentStreak, bestStreak: p.bestStreak, createdAt: p.createdAt.getTime(), lastAt: ms(p.lastAt),
      })),
      sessions: ss.map((s) => ({
        id: s.id, playerId: s.playerId, participantCode: code.get(s.playerId) ?? null, act: s.act, mode: s.mode, day: s.day,
        startedAt: s.startedAt.getTime(), endedAt: ms(s.endedAt), status: s.status, reason: s.reason ?? null,
        plannedSec: s.plannedSec, activeSec: s.activeSec, awaySec: s.awaySec, dist: s.dist, missed: s.missed, qa: s.qa, qc: s.qc,
        focus: s.focus, self: s.self, goal: s.goal, note: s.note, verified: s.verified, proofStatus: s.proofStatus, proofTries: s.proofTries,
        recallScore: s.recallScore, recallVerdict: s.recallVerdict, recallAnswer: s.recallA, spotResult: s.spotResult,
      })),
      days: ds.map((d) => ({ ...d, participantCode: code.get(d.playerId) ?? null })),
    };
  });

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
        playerId: players.id, participantCode: players.participantCode, name: players.name, groupId: groups.id, groupName: groups.name, provider: users.provider, email: users.email,
        currentStreak: players.currentStreak, bestStreak: players.bestStreak,
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
        playerId: r.playerId, participantCode: r.participantCode, name: r.name, groupId: r.groupId, groupName: r.groupName, provider: r.provider, email: r.email,
        registered: r.registered, done: r.done, failed: r.failed, active: r.active,
        completionRate: rate(r.done, ended), quitRate: rate(r.failed, ended),
        plannedMin: Math.round(r.plannedSec / 60), doneMin: Math.round(r.doneSec / 60), timeRate: rate(r.doneSec, r.plannedSec),
        currentStreak: r.currentStreak, bestStreak: r.bestStreak,
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
