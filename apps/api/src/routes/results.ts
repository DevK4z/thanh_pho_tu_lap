/* Chấm kết quả thay vì chấm thời gian (phiên trên máy): cuối phiên học sinh nộp kết quả (ảnh chụp, ảnh màn hình hoặc đoạn đã viết),
   Gemini đối chiếu với mục tiêu đã đăng ký và xem lượng việc có tương xứng với thời gian không. Trưởng nhóm xem và duyệt. */
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ACTS, LIMITS, RESULT_TRIES, type ResultReview, type ResultState } from '@tptl/shared';
import { aiOff } from '../ai';
import type { Ctx } from '../app';
import { focusSessions, players } from '../db/schema';
import { HttpError, parse } from '../errors';
import { savePhoto, photoData } from '../photos';
import { resultState } from '../questions';
import { isJpeg, MAX_IMAGE_CHARS } from './field';
import { requireManager, uuidParam } from './groups';

export function resultRoutes(app: FastifyInstance, { db, requireUser, isAdmin, ai }: Ctx) {
  app.post('/sessions/:sid/result', { bodyLimit: MAX_IMAGE_CHARS + LIMITS.resultText * 4 + 1024 }, async (req): Promise<ResultState> => {
    const u = await requireUser(req);
    const { sid } = parse(uuidParam('sid'), req.params);
    const body = parse(z.object({
      text: z.string().max(LIMITS.resultText).default('').transform((x) => x.trim()),
      image: z.string().min(16).max(MAX_IMAGE_CHARS).optional(),
    }), req.body);
    if (!body.text && !body.image) throw new HttpError(400, 'result_empty', 'Hãy dán đoạn đã viết hoặc chụp ảnh kết quả.');
    if (body.image && !isJpeg(body.image)) throw new HttpError(400, 'bad_image', 'Ảnh không đọc được, hãy chụp lại.');

    const [row] = await db.select({ s: focusSessions, userId: players.userId }).from(focusSessions)
      .innerJoin(players, eq(players.id, focusSessions.playerId)).where(eq(focusSessions.id, sid)).limit(1);
    if (!row || row.userId !== u.id) throw new HttpError(404, 'session_not_found', 'Không tìm thấy phiên.');
    const s = row.s;
    if (s.mode !== 'screen') throw new HttpError(400, 'not_screen', 'Chỉ phiên trên máy cần nộp kết quả.');
    if (s.status !== 'active') throw new HttpError(409, 'session_ended', 'Phiên này đã kết thúc.');
    if (Date.now() < s.startedAt.getTime() + s.plannedSec * 1000 - 2000) throw new HttpError(409, 'too_early', 'Chưa hết thời gian cam kết.');
    if (s.resultStatus === 'ok') throw new HttpError(409, 'result_done', 'Kết quả của phiên này đã đạt.');

    // Giữ chỗ một lượt trước khi gọi AI, để gửi đồng thời cũng không vượt số lần nộp.
    const [slot] = await db.update(focusSessions).set({ resultTries: sql`${focusSessions.resultTries} + 1` })
      .where(and(eq(focusSessions.id, sid), sql`${focusSessions.resultTries} < ${RESULT_TRIES}`)).returning({ tries: focusSessions.resultTries });
    if (!slot) throw new HttpError(409, 'result_no_tries', `Đã hết ${RESULT_TRIES} lần nộp cho phiên này.`);
    if (body.image) await savePhoto(db, sid, 'result', body.image, {});
    const saved = { resultText: body.text, resultImage: !!body.image || s.resultImage };
    const finish = async (set: Partial<typeof focusSessions.$inferInsert>) =>
      resultState((await db.update(focusSessions).set({ ...saved, ...set }).where(eq(focusSessions.id, sid)).returning())[0]);

    if (!ai) return finish({ resultStatus: 'sent', resultScore: null, resultReason: 'Đã nộp; trưởng nhóm sẽ xem và đối chiếu với mục tiêu.' });
    try {
      // Ảnh lần trước vẫn dùng được nếu lần này chỉ sửa đoạn văn.
      const image = body.image ?? (s.resultImage ? await photoData(db, sid, 'result') : null);
      const v = await ai.checkResult({ act: s.act, minutes: Math.round(s.plannedSec / 60), goal: s.goal, text: body.text, imageBase64: image });
      return finish({ resultStatus: v.ok ? 'ok' : 'flag', resultScore: v.score, resultReason: v.reason.slice(0, 300) });
    } catch (e) {
      req.log.warn({ err: e }, 'ai_result_failed');
      // Lỗi phía AI không phải lỗi của học sinh: trả lại lượt nộp, kết quả vẫn được lưu để trưởng nhóm xem.
      await db.update(focusSessions).set({ resultTries: sql`${focusSessions.resultTries} - 1` }).where(eq(focusSessions.id, sid));
      return finish({ resultStatus: 'sent', resultScore: null, resultReason: aiOff(e) ? 'Đã nộp; trưởng nhóm sẽ xem.' : 'Chưa chấm tự động được; trưởng nhóm sẽ xem. Bạn có thể nộp lại sau ít phút.' });
    }
  });

  /** Phiên trên máy trong 14 ngày, để trưởng nhóm xem kết quả và duyệt. */
  app.get('/groups/:gid/results', async (req): Promise<ResultReview> => {
    const u = await requireUser(req);
    const { gid } = parse(uuidParam('gid'), req.params);
    await requireManager(db, u, gid, isAdmin(u));
    const f = focusSessions;
    const rows = await db.select({ s: f, p: players }).from(f).innerJoin(players, eq(players.id, f.playerId))
      .where(and(eq(players.groupId, gid), eq(f.status, 'done'), eq(f.mode, 'screen'), gte(f.endedAt, new Date(Date.now() - 14 * 86400000))))
      .orderBy(desc(f.endedAt)).limit(100);
    return {
      items: rows.map(({ s, p }) => ({
        sid: s.id, playerId: p.id, name: p.name, participantCode: p.participantCode, self: p.userId === u.id,
        act: s.act, actName: ACTS[s.act].n, day: s.day, minutes: Math.round(s.plannedSec / 60), goal: s.goal,
        resultText: s.resultText, resultStatus: s.resultStatus, resultScore: s.resultScore, resultReason: s.resultReason, hasImage: s.resultImage,
        verified: s.verified, review: s.review,
      })),
    };
  });
}
