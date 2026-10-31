import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().default(8787),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().optional().transform((v) => v || undefined),
  DATABASE_SSL: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  PGLITE_DIR: z.string().default('.data/pglite'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  GOOGLE_CLIENT_ID: z.string().optional().transform((v) => v || undefined),
  FACEBOOK_APP_ID: z.string().optional().transform((v) => v || undefined),
  FACEBOOK_APP_SECRET: z.string().optional().transform((v) => v || undefined),
  /** Email quản trị viên của ứng dụng, cách nhau bằng dấu phẩy. Đăng nhập Google/Facebook bằng email này sẽ xem được báo cáo mọi nhóm. */
  ADMIN_EMAILS: z.string().default('').transform((v) => new Set(v.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean))),
  NODE_ENV: z.string().default('development'),
});
export type Env = z.infer<typeof schema>;

export function loadEnv(src: NodeJS.ProcessEnv = process.env): Env {
  const r = schema.safeParse(src);
  if (!r.success) throw new Error('Biến môi trường không hợp lệ: ' + r.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; '));
  return r.data;
}
