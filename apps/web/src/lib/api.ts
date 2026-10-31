/* Gọi REST API. Token đăng nhập lưu trong localStorage và gửi qua header Authorization. */
import type { ApiErrorBody } from '@tptl/shared';

/** Bỏ trống thì gọi cùng địa chỉ với trang (khi phát triển, Vite chuyển tiếp /api sang API). */
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'tptl-token';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(t: string | null) {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* trình duyệt chặn lưu trữ */ }
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function api<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(API_URL + '/api' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'network', import.meta.env.DEV
      ? 'Không kết nối được API. Hãy chạy "npm run dev" ở thư mục gốc của dự án (chạy cả API lẫn web), rồi bấm Thử lại.'
      : 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
  }
  const data = await res.json().catch(() => null);
  if (import.meta.env.DEV && !data && res.status >= 500) throw new ApiError(0, 'network', 'Không kết nối được API. Hãy chạy "npm run dev" ở thư mục gốc của dự án (chạy cả API lẫn web), rồi bấm Thử lại.');
  if (!res.ok) {
    const e = (data as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, e?.code || 'http_' + res.status, e?.message || 'Có lỗi xảy ra (' + res.status + ').');
  }
  return data as T;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Có lỗi xảy ra.');
