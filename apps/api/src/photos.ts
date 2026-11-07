/* Ảnh hiện trường của phiên vận động, chăm cây: lưu để trưởng nhóm duyệt, tự xóa sau PHOTO_RETENTION_DAYS ngày.
   Thời gian do máy chủ ghi; vị trí làm tròn khoảng 100 m và chỉ trưởng nhóm, quản trị viên xem được. */
import { and, asc, eq, lt } from 'drizzle-orm';
import { PHOTO_RETENTION_DAYS, type FieldPhoto, type PhotoKind } from '@tptl/shared';
import type { Db } from './db/client';
import { sessionPhotos } from './db/schema';

export interface Geo { lat?: number; lng?: number; acc?: number }

/** 3 chữ số thập phân: khoảng 110 m, đủ để biết có di chuyển hay không mà không lộ chính xác nhà ở đâu. */
const round = (v: number | undefined) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000);

export async function savePhoto(db: Db, sessionId: string, kind: PhotoKind, image: string, geo: Geo) {
  const row = { sessionId, kind, data: image, takenAt: new Date(Date.now()), lat: round(geo.lat), lng: round(geo.lng), acc: geo.acc == null ? null : Math.min(100_000, Math.round(geo.acc)) };
  // Chụp lại trong cùng khung giờ thì thay ảnh cũ.
  await db.insert(sessionPhotos).values(row).onConflictDoUpdate({ target: [sessionPhotos.sessionId, sessionPhotos.kind], set: row });
  await db.delete(sessionPhotos).where(lt(sessionPhotos.takenAt, new Date(Date.now() - PHOTO_RETENTION_DAYS * 86400000)));
}

export async function photoMeta(db: Db, sessionId: string): Promise<FieldPhoto[]> {
  const rows = await db.select({ kind: sessionPhotos.kind, takenAt: sessionPhotos.takenAt, lat: sessionPhotos.lat, lng: sessionPhotos.lng, acc: sessionPhotos.acc })
    .from(sessionPhotos).where(eq(sessionPhotos.sessionId, sessionId)).orderBy(asc(sessionPhotos.takenAt));
  return rows.map((r) => ({ kind: r.kind, takenAt: r.takenAt.getTime(), lat: r.lat, lng: r.lng, acc: r.acc }));
}

export async function photoData(db: Db, sessionId: string, kind: PhotoKind): Promise<string | null> {
  const [r] = await db.select({ data: sessionPhotos.data }).from(sessionPhotos).where(and(eq(sessionPhotos.sessionId, sessionId), eq(sessionPhotos.kind, kind))).limit(1);
  return r?.data ?? null;
}
