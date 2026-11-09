/* Nhớ dữ liệu lần trước trên máy để mở trang là hiện ngay, không phải chờ máy chủ thức dậy.
   Dữ liệu gắn với token đăng nhập; đổi tài khoản hoặc đăng xuất thì bỏ. Đọc ghi lỗi (chế độ riêng tư, chặn lưu trữ) thì coi như không có. */
import { getToken } from './api';

const PREFIX = 'tptl-cache:';

/** Dấu nhận dạng token (không lưu chính token vào bộ nhớ đệm). */
function tokenTag(): string | null {
  const t = getToken();
  if (!t) return null;
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return String(h);
}

export function readCache<T>(key: string): T | undefined {
  try {
    const tag = tokenTag();
    const raw = tag && localStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const x = JSON.parse(raw) as { tag: string; data: T };
    return x.tag === tag ? x.data : undefined;
  } catch { return undefined; }
}

export function writeCache<T>(key: string, data: T): T {
  try {
    const tag = tokenTag();
    if (tag) localStorage.setItem(PREFIX + key, JSON.stringify({ tag, data }));
  } catch { /* hết chỗ hoặc bị chặn: lần sau chờ máy chủ như bình thường */ }
  return data;
}

export function clearCache() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k);
  } catch { /* bị chặn lưu trữ */ }
}
