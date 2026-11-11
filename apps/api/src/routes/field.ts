/* Ảnh hiện trường cho vận động, chăm cây (như ứng dụng giám sát hiện trường): ảnh lúc bắt đầu chụp ở đây; ảnh lúc kết thúc
   kèm mã xác thực đi qua /sessions/:sid/proof. Thời gian do máy chủ ghi, kèm vị trí. Trưởng nhóm duyệt Đạt hoặc Không đạt. */
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ACTS, FIELD_START_SECONDS,
  type FieldPhoto, type FieldReview, type SpotResult,
} from '@tptl/shared';
import type { Ctx, User } from '../app';
import { focusSessions, players, sessionPhotos } from '../db/schema';
import { HttpError, parse } from '../errors';
import { photoData, photoMeta, savePhoto } from '../photos';
import { requireManager, uuidParam } from './groups';
import { addDay } from './sessions';

/** Ảnh xem được (gồm 'mid' của dữ liệu cũ). Chỉ ảnh bắt đầu được gửi qua đây; ảnh kết thúc phải có mã xác thực. */
const KINDS = ['start', 'mid', 'end', 'result'] as const;
/** Cho phép trễ một chút vì còn phải nén và gửi ảnh. */
const LATE_MS = 15_000;
export const MAX_IMAGE_CHARS = 1_400_000;
export const isJpeg = (b64: string) => { const b = Buffer.from(b64.slice(0, 8), 'base64'); return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff; };
export const geoBody = {
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  acc: z.number().min(0).max(1_000_000).optional(),
};

export function fieldRoutes(app: FastifyInstance, { db, requireUser, isAdmin }: Ctx) {
  async function sessionOf(sid: string) {
    const [row] = await db.select({ s: focusSessions, p: players }).from(focusSessions)
      .innerJoin(players, eq(players.id, focusSessions.playerId)).where(eq(focusSessions.id, sid)).limit(1);
    if (!row) throw new HttpError(404, 'session_not_found', 'Không tìm thấy phiên.');
    return row;
  }
  /** Chủ phiên, trưởng nhóm hoặc quản trị viên ứng dụng. */
  async function canSee(u: User, sid: string) {
    const { s, p } = await sessionOf(sid);
    if (p.userId !== u.id) await requireManager(db, u, p.groupId, isAdmin(u));
    return s;
  }

  app.post('/sessions/:sid/photos/:kind', { bodyLimit: MAX_IMAGE_CHARS + 1024 }, async (req): Promise<FieldPhoto[]> => {
    const u = await requireUser(req);
    const { sid } = parse(z.object({ sid: z.string().uuid('mã không hợp lệ') }), req.params);
    const { kind } = parse(z.object({ kind: z.literal('start', { errorMap: () => ({ message: 'chỉ gửi được ảnh bắt đầu; ảnh kết thúc chụp kèm mã xác thực' }) }) }), req.params);
    const { image, ...geo } = parse(z.object({ image: z.string().min(16).max(MAX_IMAGE_CHARS), ...geoBody }), req.body);
    if (!isJpeg(image)) throw new HttpError(400, 'bad_image', 'Ảnh không đọc được, hãy chụp lại.');
    const { s, p } = await sessionOf(sid);
    if (p.userId !== u.id) throw new HttpError(404, 'session_not_found', 'Không tìm thấy phiên.');
    if (!ACTS[s.act].field) throw new HttpError(400, 'not_field', 'Hoạt động này không cần ảnh hiện trường.');
    if (s.status !== 'active') throw new HttpError(409, 'session_ended', 'Phiên này đã kết thúc.');
    if (Date.now() > s.startedAt.getTime() + FIELD_START_SECONDS * 1000 + LATE_MS) throw new HttpError(409, 'photo_too_late', 'Đã quá giờ chụp ảnh bắt đầu.');
    await savePhoto(db, sid, kind, image, geo);
    req.log.info({ sid, kind, geo: geo.lat != null }, 'field_photo');
    return photoMeta(db, sid);
  });

  app.get('/sessions/:sid/photos', async (req): Promise<FieldPhoto[]> => {
    const u = await requireUser(req);
    const { sid } = parse(uuidParam('sid'), req.params);
    await canSee(u, sid);
    return photoMeta(db, sid);
  });

  app.get('/sessions/:sid/photos/:kind', async (req, reply) => {
    const u = await requireUser(req);
    const { sid } = parse(z.object({ sid: z.string().uuid('mã không hợp lệ') }), req.params);
    const { kind } = parse(z.object({ kind: z.enum(KINDS) }), req.params);
    await canSee(u, sid);
    const data = await photoData(db, sid, kind);
    if (!data) throw new HttpError(404, 'photo_not_found', 'Không có ảnh này (có thể đã quá hạn lưu).');
    return reply.header('content-type', 'image/jpeg').header('cache-control', 'private, max-age=3600').send(Buffer.from(data, 'base64'));
  });

  /** Phiên vận động, chăm cây trong 14 ngày để trưởng nhóm duyệt. */
  app.get('/groups/:gid/field', async (req): Promise<FieldReview> => {
    const u = await requireUser(req);
    const { gid } = parse(uuidParam('gid'), req.params);
    await requireManager(db, u, gid, isAdmin(u));
    const f = focusSessions;
    const rows = await db.select({ s: f, p: players }).from(f).innerJoin(players, eq(players.id, f.playerId))
      .where(and(eq(players.groupId, gid), eq(f.status, 'done'), inArray(f.act, ['move', 'plant']), gte(f.endedAt, new Date(Date.now() - 14 * 86400000))))
      .orderBy(desc(f.endedAt)).limit(100);
    const metas = rows.length
      ? await db.select({ sessionId: sessionPhotos.sessionId, kind: sessionPhotos.kind, takenAt: sessionPhotos.takenAt, lat: sessionPhotos.lat, lng: sessionPhotos.lng, acc: sessionPhotos.acc })
        .from(sessionPhotos).where(inArray(sessionPhotos.sessionId, rows.map((r) => r.s.id)))
      : [];
    return {
      items: rows.map(({ s, p }) => ({
        sid: s.id, playerId: p.id, name: p.name, participantCode: p.participantCode, self: p.userId === u.id,
        act: s.act, day: s.day, minutes: Math.round(s.plannedSec / 60), startedAt: s.startedAt.getTime(), endedAt: s.endedAt ? s.endedAt.getTime() : null,
        verified: s.verified, proofStatus: s.proofStatus, review: s.review, proofCode: s.proofCode,
        photos: metas.filter((m) => m.sessionId === s.id).map((m) => ({ kind: m.kind, takenAt: m.takenAt.getTime(), lat: m.lat, lng: m.lng, acc: m.acc }))
          .sort((a, b) => a.takenAt - b.takenAt),
      })),
    };
  });

  /** Duyệt Đạt hoặc Không đạt; duyệt lại được nếu bấm nhầm. Đạt thì phiên được xác minh: tính phút và điểm nhóm. */
  app.post('/groups/:gid/field/:sid', async (req) => {
    const u = await requireUser(req);
    const { gid, sid } = parse(uuidParam('gid', 'sid'), req.params);
    const { result } = parse(z.object({ result: z.enum(['ok', 'no']) }), req.body);
    await requireManager(db, u, gid, isAdmin(u));
    await db.transaction(async (tx) => {
      const [row] = await tx.select({ s: focusSessions, p: players }).from(focusSessions)
        .innerJoin(players, eq(players.id, focusSessions.playerId)).where(and(eq(focusSessions.id, sid), eq(players.groupId, gid))).for('update');
      if (!row || row.s.status !== 'done' || !(ACTS[row.s.act].field || row.s.mode === 'screen')) throw new HttpError(404, 'session_not_found', 'Không tìm thấy phiên cần duyệt.');
      const { s, p } = row;
      if (p.userId === u.id) throw new HttpError(403, 'own_session', 'Bạn không thể tự duyệt phiên của mình.');
      const next = result === 'ok';
      await tx.update(focusSessions).set({ review: result as SpotResult, verified: next }).where(eq(focusSessions.id, sid));
      if (next === s.verified) return;
      const minutes = Math.round(s.plannedSec / 60);
      const counted = (v: boolean) => (v && s.spotResult !== 'no' ? minutes : 0);
      const d = next ? 1 : -1;
      await addDay(tx, s.playerId, s.day, { vf: d, uv: -d });
      await tx.update(players).set({
        totalFocusMin: Math.max(0, p.totalFocusMin + counted(next) - counted(s.verified)),
        unverifiedMin: Math.max(0, p.unverifiedMin + (next ? -minutes : minutes)),
      }).where(eq(players.id, p.id));
    });
    req.log.info({ gid, sid, by: u.id, result }, 'field_review');
    return { result };
  });
}
