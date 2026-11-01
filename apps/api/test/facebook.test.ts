import { describe, expect, it } from 'vitest';
import { facebookVerifier } from '../src/auth/identity';

/** Facebook giả: trả lời debug_token và /me, ghi lại các địa chỉ được gọi. */
function fakeFb(over: { valid?: boolean; appId?: string; userId?: string; meId?: string } = {}) {
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(String(url));
    const u = new URL(String(url));
    const body = u.pathname.endsWith('/debug_token')
      ? { data: { is_valid: over.valid ?? true, app_id: over.appId ?? 'APP', user_id: over.userId ?? 'U1' } }
      : { id: over.meId ?? 'U1', name: 'Trần', picture: { data: { url: 'https://img/x.jpg' } } };
    return { json: async () => body } as Response;
  }) as unknown as typeof fetch;
  return { calls, verify: facebookVerifier('APP', 'SECRET', impl) };
}

describe('đăng nhập Facebook', () => {
  it('chỉ lấy tên và ảnh, không xin email', async () => {
    const f = fakeFb();
    expect(await f.verify('token-hop-le-1234')).toEqual({ sub: 'U1', name: 'Trần', email: null, avatarUrl: 'https://img/x.jpg' });
    const me = f.calls.find((c) => c.includes('/me?'))!;
    expect(new URL(me).searchParams.get('fields')).toBe('id,name,picture.type(large)');
    expect(me).not.toContain('email');
  });

  it('từ chối token không hợp lệ, của app khác hoặc của người khác', async () => {
    for (const over of [{ valid: false }, { appId: 'APP-KHAC' }, { meId: 'U2' }]) {
      await expect(fakeFb(over).verify('token-khong-hop-le-1234')).rejects.toMatchObject({ status: 401 });
    }
  });
});
