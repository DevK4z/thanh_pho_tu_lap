import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { LIMITS, type Provider, type PublicConfig } from '@tptl/shared';
import type { Ctx, User } from '../app';
import { authSessions, users } from '../db/schema';
import { HttpError, parse } from '../errors';
import type { Identity } from '../auth/identity';
import { hashToken, newToken } from '../auth/tokens';

export const cleanName = (max: number) => z.string().transform((s) => s.trim().replace(/\s+/g, ' ')).pipe(z.string().min(1, 'không được để trống').max(max));

const authLimit = { rateLimit: { max: 20, timeWindow: '1 minute' } };

export function authRoutes(app: FastifyInstance, { db, env, verifiers, requireUser, toMe }: Ctx) {
  async function issue(user: User) {
    const token = newToken();
    await db.insert(authSessions).values({ tokenHash: hashToken(token), userId: user.id });
    return { token, me: toMe(user) };
  }

  /** Tìm hoặc tạo tài khoản gắn với tài khoản Google/Facebook. Tên hiển thị người dùng đã đổi thì giữ nguyên. */
  async function upsertProvider(provider: Exclude<Provider, 'guest'>, id: Identity) {
    const [found] = await db.select().from(users).where(and(eq(users.provider, provider), eq(users.providerSub, id.sub))).limit(1);
    if (found) {
      const [u] = await db.update(users).set({ email: id.email, avatarUrl: id.avatarUrl }).where(eq(users.id, found.id)).returning();
      return u;
    }
    const [u] = await db.insert(users).values({ name: id.name.slice(0, LIMITS.userName), provider, providerSub: id.sub, email: id.email, avatarUrl: id.avatarUrl }).returning();
    return u;
  }

  app.get('/config', async (): Promise<PublicConfig> => ({
    google: verifiers.google ? env.GOOGLE_CLIENT_ID ?? 'test' : null,
    facebook: verifiers.facebook ? env.FACEBOOK_APP_ID ?? 'test' : null,
  }));

  app.post('/auth/guest', { config: authLimit }, async (req) => {
    const { name } = parse(z.object({ name: cleanName(LIMITS.userName) }), req.body);
    const [u] = await db.insert(users).values({ name, provider: 'guest' }).returning();
    return issue(u);
  });

  app.post('/auth/google', { config: authLimit }, async (req) => {
    if (!verifiers.google) throw new HttpError(501, 'provider_disabled', 'Máy chủ chưa bật đăng nhập Google.');
    const { credential } = parse(z.object({ credential: z.string().min(10).max(4096) }), req.body);
    return issue(await upsertProvider('google', await verifiers.google(credential)));
  });

  app.post('/auth/facebook', { config: authLimit }, async (req) => {
    if (!verifiers.facebook) throw new HttpError(501, 'provider_disabled', 'Máy chủ chưa bật đăng nhập Facebook.');
    const { accessToken } = parse(z.object({ accessToken: z.string().min(10).max(4096) }), req.body);
    return issue(await upsertProvider('facebook', await verifiers.facebook(accessToken)));
  });

  app.post('/auth/logout', async (req) => {
    await requireUser(req);
    await db.delete(authSessions).where(eq(authSessions.tokenHash, req.tokenHash!));
    return { ok: true };
  });

  app.get('/me', async (req) => toMe(await requireUser(req)));

  app.patch('/me', async (req) => {
    const u = await requireUser(req);
    const { name } = parse(z.object({ name: cleanName(LIMITS.userName) }), req.body);
    const [nu] = await db.update(users).set({ name }).where(eq(users.id, u.id)).returning();
    return toMe(nu);
  });
}
