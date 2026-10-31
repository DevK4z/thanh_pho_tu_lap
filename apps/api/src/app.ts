import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { eq } from 'drizzle-orm';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import type { Db } from './db/client';
import { authSessions, users } from './db/schema';
import type { Env } from './env';
import { HttpError } from './errors';
import { facebookVerifier, googleVerifier, type Verifiers } from './auth/identity';
import { hashToken } from './auth/tokens';
import { authRoutes } from './routes/auth';
import { groupRoutes } from './routes/groups';
import { sessionRoutes } from './routes/sessions';
import { adminRoutes } from './routes/admin';

export type User = typeof users.$inferSelect;

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null;
    tokenHash: string | null;
  }
}

export interface Ctx {
  db: Db;
  env: Env;
  verifiers: Verifiers;
  /** Bắt buộc đăng nhập; trả về người dùng hiện tại. */
  requireUser(req: FastifyRequest): Promise<User>;
}

export interface AppOptions {
  db: Db;
  env: Env;
  /** Thay bộ xác minh Google/Facebook (dùng trong test). */
  verifiers?: Verifiers;
  logger?: boolean;
  rateLimit?: boolean;
}

export async function buildApp(o: AppOptions): Promise<FastifyInstance> {
  const { db, env } = o;
  const app = Fastify({ logger: o.logger ?? false, trustProxy: true, bodyLimit: 64 * 1024 });

  const origins = env.WEB_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
  await app.register(cors, { origin: origins, methods: ['GET', 'POST', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'], maxAge: 600 });
  if (o.rateLimit !== false) await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

  const verifiers: Verifiers = o.verifiers ?? {
    google: env.GOOGLE_CLIENT_ID ? googleVerifier(env.GOOGLE_CLIENT_ID) : undefined,
    facebook: env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET ? facebookVerifier(env.FACEBOOK_APP_ID, env.FACEBOOK_APP_SECRET) : undefined,
  };

  app.decorateRequest('user', null);
  app.decorateRequest('tokenHash', null);

  async function requireUser(req: FastifyRequest): Promise<User> {
    if (req.user) return req.user;
    const h = req.headers.authorization;
    if (!h || !h.startsWith('Bearer ')) throw new HttpError(401, 'unauthorized', 'Cần đăng nhập.');
    const hash = hashToken(h.slice(7).trim());
    const [row] = await db
      .select({ user: users, lastSeenAt: authSessions.lastSeenAt })
      .from(authSessions)
      .innerJoin(users, eq(users.id, authSessions.userId))
      .where(eq(authSessions.tokenHash, hash))
      .limit(1);
    if (!row) throw new HttpError(401, 'unauthorized', 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');
    if (Date.now() - row.lastSeenAt.getTime() > 3600_000) {
      await db.update(authSessions).set({ lastSeenAt: new Date() }).where(eq(authSessions.tokenHash, hash));
    }
    req.user = row.user;
    req.tokenHash = hash;
    return row.user;
  }

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
    const e = err as { statusCode?: number; code?: string; message?: string };
    // Lỗi phía client do Fastify sinh ra (JSON sai, vượt giới hạn tần suất…).
    if (e.statusCode && e.statusCode < 500) return reply.status(e.statusCode).send({ error: { code: e.code || 'bad_request', message: e.message || 'Yêu cầu không hợp lệ.' } });
    req.log.error(err);
    return reply.status(500).send({ error: { code: 'internal', message: 'Máy chủ gặp lỗi. Hãy thử lại sau.' } });
  });
  app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: { code: 'not_found', message: 'Không tìm thấy.' } }));

  const ctx: Ctx = { db, env, verifiers, requireUser };
  // commit: mã git đang chạy (Render tự đặt RENDER_GIT_COMMIT), để kiểm tra đã deploy đúng bản.
  app.get('/health', async () => ({ ok: true, commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? null }));
  await app.register(async (api) => {
    authRoutes(api, ctx);
    groupRoutes(api, ctx);
    sessionRoutes(api, ctx);
    adminRoutes(api, ctx);
  }, { prefix: '/api' });

  return app;
}
