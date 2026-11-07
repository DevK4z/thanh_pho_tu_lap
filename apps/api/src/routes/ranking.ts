/* Bảng điểm nhóm và xếp hạng giữa các nhóm. Chỉ phiên đã xác minh và không bị kiểm tra trực tiếp bác mới có điểm. */
import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { POINTS_PER_SESSION, dkey, pointsOf, type RankContribution, type RankGroup, type Ranking } from '@tptl/shared';
import type { Ctx } from '../app';
import { focusSessions, groups, players } from '../db/schema';
import { parse } from '../errors';

export function rankingRoutes(app: FastifyInstance, { db, requireUser, isAdmin }: Ctx) {
  app.get('/ranking', async (req): Promise<Ranking> => {
    const u = await requireUser(req);
    const { range } = parse(z.object({ range: z.enum(['week', 'all']).default('week') }), req.query);

    // Mỗi thành viên một dòng, kể cả người chưa có điểm (left join) để biết quy mô nhóm.
    const f = focusSessions;
    const scored = sql`${f.playerId} = ${players.id} and ${f.status} = 'done' and ${f.verified} and ${f.spotResult} is distinct from 'no'`;
    const joinOn = range === 'week' ? sql`${scored} and ${f.day} >= ${dkey(Date.now() - 6 * 86400000)}` : scored;
    const rows = await db
      .select({
        playerId: players.id, name: players.name, groupId: groups.id, groupName: groups.name,
        cs: sql<number>`coalesce(sum(${f.activeSec}), 0)::int`, c: sql<number>`count(${f.id})::int`,
      })
      .from(players)
      .innerJoin(groups, eq(groups.id, players.groupId))
      .leftJoin(f, joinOn)
      .groupBy(players.id, groups.id);

    const byGroup = new Map<string, { name: string; list: (typeof rows)[number][] }>();
    for (const r of rows) {
      const g = byGroup.get(r.groupId) ?? { name: r.groupName, list: [] };
      g.list.push(r);
      byGroup.set(r.groupId, g);
    }
    const stat = (r: (typeof rows)[number]) => ({ minutes: Math.round(r.cs / 60), sessions: r.c, points: pointsOf(r.cs / 60, r.c) });

    const list: Omit<RankGroup, 'rank'>[] = [...byGroup].map(([id, g]) => {
      const minutes = g.list.reduce((s, r) => s + r.cs, 0) / 60;
      const sessions = g.list.reduce((s, r) => s + r.c, 0);
      const points = pointsOf(minutes, sessions);
      return {
        id, name: g.name, members: g.list.length, contributors: g.list.filter((r) => r.c > 0).length,
        points, minutes: Math.round(minutes), sessions, perMember: Math.round(points / g.list.length),
      };
    }).sort((a, b) => b.points - a.points || b.sessions - a.sessions || a.name.localeCompare(b.name, 'vi'));
    // Điểm bằng nhau thì đồng hạng.
    const ranked: RankGroup[] = list.map((g, i) => ({ ...g, rank: i > 0 && list[i - 1].points === g.points ? 0 : i + 1 }));
    ranked.forEach((g, i) => { if (!g.rank) g.rank = ranked[i - 1].rank; });

    // Chia theo điểm thô của cả nhóm để các phần trăm cộng lại đúng 100.
    const mine = u.currentGroupId ? byGroup.get(u.currentGroupId) : undefined;
    let contributions: RankContribution[] = [];
    if (mine) {
      const total = mine.list.reduce((s, r) => s + r.cs / 60 + POINTS_PER_SESSION * r.c, 0);
      contributions = mine.list
        .map((r) => ({ playerId: r.playerId, name: r.name, ...stat(r), share: total > 0 ? Math.round(((r.cs / 60 + POINTS_PER_SESSION * r.c) / total) * 1000) / 10 : null }))
        .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'vi'));
    }
    // Người ngoài nhóm chỉ thấy thứ hạng và điểm, không thấy tên hay mã của nhóm khác.
    const shown = isAdmin(u) ? ranked : ranked.map((g, i) => (g.id === u.currentGroupId ? g : { ...g, id: 'an-' + i, name: 'Nhóm khác' }));
    return { range, generatedAt: Date.now(), groups: shown, myGroupId: mine ? u.currentGroupId : null, contributions };
  });
}
