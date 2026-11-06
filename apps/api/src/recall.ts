/* Tìm phiên đang chờ câu hỏi nhớ lại: phiên hoàn thành gần nhất có mục tiêu hoặc ghi chú, từ ngày trước đó. */
import { and, eq } from 'drizzle-orm';
import { RECALL_WINDOW_DAYS, type RecallDue } from '@tptl/shared';
import type { Db } from './db/client';
import { focusSessions } from './db/schema';

export async function findRecall(db: Db, playerId: string, today: string): Promise<RecallDue | null> {
  const f = focusSessions;
  const [s] = await db.select().from(f).where(and(eq(f.playerId, playerId), eq(f.recallDue, true))).limit(1);
  if (!s || s.day >= today) return null;
  // Quá hạn thì bỏ, không phạt.
  if (!s.endedAt || Date.now() - s.endedAt.getTime() > RECALL_WINDOW_DAYS * 86400000) {
    await db.update(f).set({ recallDue: false }).where(eq(f.id, s.id));
    return null;
  }
  return { sid: s.id, day: s.day, act: s.act, question: s.recallQ || null };
}
