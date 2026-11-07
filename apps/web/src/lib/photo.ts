/* Nén ảnh ở trình duyệt trước khi gửi và lấy vị trí kèm ảnh hiện trường. */

/** Thu nhỏ ảnh và chuyển sang JPEG, giảm chất lượng đến khi đủ nhẹ để gửi. */
export async function toJpegBase64(file: File, maxSide = 1280, maxChars = 1_300_000, qualities = [0.8, 0.65, 0.5, 0.35]): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  for (const q of qualities) {
    const b64 = c.toDataURL('image/jpeg', q).split(',')[1];
    if (b64.length <= maxChars) return b64;
  }
  throw new Error('Ảnh quá lớn, hãy chụp lại.');
}

/** Ảnh hiện trường được lưu để trưởng nhóm duyệt nên nén nhỏ hơn cho đỡ tốn chỗ. */
export const toFieldJpeg = (file: File) => toJpegBase64(file, 960, 500_000, [0.6, 0.5, 0.4, 0.3]);

export interface GeoFix { lat: number; lng: number; acc: number }

/** Vị trí hiện tại; người dùng từ chối hoặc máy không định vị được thì trả về null, ảnh vẫn gửi được. */
export function getGeo(timeoutMs = 8000): Promise<GeoFix | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

/** Khoảng cách (mét) giữa hai điểm. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
