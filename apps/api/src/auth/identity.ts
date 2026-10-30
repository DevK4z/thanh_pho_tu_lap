import { OAuth2Client } from 'google-auth-library';
import { HttpError } from '../errors';

/** Thông tin tài khoản đã được nhà cung cấp xác minh. */
export interface Identity { sub: string; name: string; email: string | null; avatarUrl: string | null }
export type Verifier = (credential: string) => Promise<Identity>;
export interface Verifiers { google?: Verifier; facebook?: Verifier }

/** Xác minh ID token do Google Identity Services cấp cho trình duyệt. */
export function googleVerifier(clientId: string): Verifier {
  const client = new OAuth2Client(clientId);
  return async (idToken) => {
    const ticket = await client.verifyIdToken({ idToken, audience: clientId }).catch(() => {
      throw new HttpError(401, 'invalid_credential', 'Không xác minh được tài khoản Google. Hãy thử lại.');
    });
    const p = ticket.getPayload();
    if (!p?.sub) throw new HttpError(401, 'invalid_credential', 'Không xác minh được tài khoản Google.');
    return { sub: p.sub, name: p.name || p.email || 'Người dùng Google', email: p.email ?? null, avatarUrl: p.picture ?? null };
  };
}

/** Xác minh access token của Facebook Login: token phải hợp lệ và được cấp cho đúng app. */
export function facebookVerifier(appId: string, appSecret: string, fetchImpl: typeof fetch = fetch): Verifier {
  const graph = 'https://graph.facebook.com/v19.0';
  const fail = () => new HttpError(401, 'invalid_credential', 'Không xác minh được tài khoản Facebook. Hãy thử lại.');
  return async (accessToken) => {
    const dbg = await fetchImpl(`${graph}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appId + '|' + appSecret)}`)
      .then((r) => r.json() as Promise<{ data?: { is_valid?: boolean; app_id?: string; user_id?: string } }>)
      .catch(() => { throw fail(); });
    if (!dbg.data?.is_valid || dbg.data.app_id !== appId || !dbg.data.user_id) throw fail();
    const me = await fetchImpl(`${graph}/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`)
      .then((r) => r.json() as Promise<{ id?: string; name?: string; email?: string; picture?: { data?: { url?: string } } }>)
      .catch(() => { throw fail(); });
    if (!me.id || me.id !== dbg.data.user_id) throw fail();
    return { sub: me.id, name: me.name || 'Người dùng Facebook', email: me.email ?? null, avatarUrl: me.picture?.data?.url ?? null };
  };
}
