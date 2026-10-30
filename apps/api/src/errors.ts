import type { z } from 'zod';

/** Lỗi trả về cho client dạng { error: { code, message } }; message hiển thị được cho người dùng. */
export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new HttpError(400, 'invalid_input', 'Dữ liệu không hợp lệ' + (first ? ` (${first.path.join('.') || 'body'}: ${first.message})` : '') + '.');
  }
  return r.data;
}

/** Mã lỗi PostgreSQL, kể cả khi drizzle bọc lỗi gốc trong `cause`. */
export function pgCode(e: unknown): string | undefined {
  const x = e as { code?: unknown; cause?: { code?: unknown } } | null;
  const c = x?.code ?? x?.cause?.code;
  return typeof c === 'string' ? c : undefined;
}
