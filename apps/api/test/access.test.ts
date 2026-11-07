/* Quyền truy cập mặc định: chỉ quản trị viên lập nhóm, vào nhóm bằng mã mời, mã cá nhân bắt buộc, bảng xếp hạng ẩn tên nhóm khác, tải dữ liệu. */
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FullExport, GroupDetail, GroupSummary, Me, Player, Ranking } from '@tptl/shared';
import { buildApp } from '../src/app';
import { openDatabase, type Database } from '../src/db/client';
import { loadEnv } from '../src/env';

let app: FastifyInstance;
let database: Database;

beforeAll(async () => {
  database = await openDatabase({ migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
  app = await buildApp({
    db: database.db,
    env: loadEnv({ ADMIN_EMAILS: 'teacher-one@example.com' }),
    rateLimit: false,
    ai: null,
    verifiers: { google: async (c: string) => ({ sub: 'g-' + c, name: 'Cô ' + c, email: c + '@example.com', avatarUrl: null }) },
  });
});
afterAll(async () => { await app.close(); await database.close(); });

async function call(method: 'GET' | 'POST' | 'PATCH', url: string, token?: string, payload?: unknown) {
  const r = await app.inject({ method, url: '/api' + url, payload: payload as object, headers: token ? { authorization: 'Bearer ' + token } : {} });
  return { status: r.statusCode, body: r.json() };
}
const guest = async (name: string) => (await call('POST', '/auth/guest', undefined, { name })).body.token as string;
const google = async (c: string) => (await call('POST', '/auth/google', undefined, { credential: c })).body.token as string;
const house = (gid: string, token: string, name: string, participantCode?: string) =>
  call('POST', `/groups/${gid}/players`, token, { name, style: 'san', dailyGoal: 30, ...(participantCode ? { participantCode } : {}) });

describe('quyền truy cập', () => {
  let admin = '', gid = '', other = '', invite = '';

  it('chỉ quản trị viên ứng dụng lập được nhóm; cấu hình công khai báo đúng chế độ', async () => {
    expect((await call('GET', '/config')).body).toMatchObject({ groupCreation: 'admin' });
    const g = await guest('Người lạ');
    expect((await call('POST', '/groups', g, { name: 'Nhóm lạ' })).body.error.code).toBe('admin_only');
    expect((await call('POST', '/groups', await google('someone-else'), { name: 'Nhóm lạ' })).status).toBe(403);
    admin = await google('teacher-one');
    gid = ((await call('POST', '/groups', admin, { name: '10A1 thực nghiệm' })).body as Me).currentGroupId!;
    other = ((await call('POST', '/groups', admin, { name: '10A2 đối chứng' })).body as Me).currentGroupId!;
    await call('POST', `/groups/${gid}/join`, admin);
    expect(gid && other).toBeTruthy();
  });

  it('người thường không thấy danh sách nhóm; quản trị viên thấy kèm mã mời', async () => {
    expect((await call('GET', '/groups', await guest('Tò mò'))).body).toEqual([]);
    const list = (await call('GET', '/groups', admin)).body as GroupSummary[];
    expect(list).toHaveLength(2);
    invite = list.find((g) => g.id === gid)!.inviteCode;
    expect(invite).toMatch(/^[A-Z2-9]{6}$/);
  });

  it('vào nhóm bằng mã mời; không vào được bằng mã nhóm', async () => {
    const hs = await guest('Học sinh A');
    expect((await call('POST', `/groups/${gid}/join`, hs)).body.error.code).toBe('invite_required');
    expect((await call('POST', '/groups/join', hs, { code: invite })).body.currentGroupId).toBe(gid);
    expect((await call('GET', '/groups/' + other, hs)).status).toBe(403);
  });

  it('mã cá nhân bắt buộc, không trùng trong nhóm; tự đặt một lần, sau đó chỉ trưởng nhóm sửa', async () => {
    const a = await guest('An');
    const b = await guest('Bình');
    for (const t of [a, b]) await call('POST', '/groups/join', t, { code: invite });
    expect((await house(gid, a, 'An')).status).toBe(400);
    expect((await house(gid, a, 'An', 'mã có dấu')).status).toBe(400);
    const pa = (await house(gid, a, 'An', 't0-015')).body as Player;
    expect(pa.participantCode).toBe('T0-015');
    expect((await house(gid, b, 'Bình', 'T0-015')).body.error.code).toBe('participant_taken');
    const pb = (await house(gid, b, 'Bình', 'T0-016')).body as Player;

    // Người cũ chưa có mã thì tự đặt được; đã có mã thì không tự sửa.
    expect((await call('PATCH', `/groups/${gid}/players/${pa.id}/participant`, a, { participantCode: 'T0-099' })).status).toBe(403);
    expect((await call('PATCH', `/groups/${gid}/players/${pb.id}/participant`, a, { participantCode: 'T0-099' })).status).toBe(403);
    expect((await call('PATCH', `/groups/${gid}/players/${pa.id}/participant`, admin, { participantCode: 'T0-016' })).body.error.code).toBe('participant_taken');
    expect((await call('PATCH', `/groups/${gid}/players/${pa.id}/participant`, admin, { participantCode: 'T1-015' })).body).toEqual({ participantCode: 'T1-015' });
    const d = (await call('GET', '/groups/' + gid, a)).body as GroupDetail;
    expect(d.players.find((p) => p.id === pa.id)!.participantCode).toBe('T1-015');
  });

  it('đổi mã mời: mã cũ hết hiệu lực, chỉ trưởng nhóm hoặc quản trị viên đổi được', async () => {
    const hs = await guest('Học sinh B');
    await call('POST', '/groups/join', hs, { code: invite });
    expect((await call('POST', `/groups/${gid}/invite`, hs)).status).toBe(403);
    const fresh = (await call('POST', `/groups/${gid}/invite`, admin)).body.inviteCode as string;
    expect(fresh).not.toBe(invite);
    expect((await call('POST', '/groups/join', await guest('Đến muộn'), { code: invite })).body.error.code).toBe('invite_invalid');
    expect((await call('POST', '/groups/join', await guest('Đến muộn 2'), { code: fresh })).status).toBe(200);
  });

  it('bảng xếp hạng ẩn tên và mã của nhóm khác, quản trị viên thấy đủ', async () => {
    const hs = await guest('Học sinh C');
    const code = ((await call('GET', '/groups', admin)).body as GroupSummary[]).find((g) => g.id === gid)!.inviteCode;
    await call('POST', '/groups/join', hs, { code });
    // Nhóm chưa có ai tạo nhà thì không lên bảng; thêm một người cho nhóm đối chứng.
    const b = await guest('Học sinh 10A2');
    const otherCode = ((await call('GET', '/groups', admin)).body as GroupSummary[]).find((g) => g.id === other)!.inviteCode;
    await call('POST', '/groups/join', b, { code: otherCode });
    await house(other, b, 'Dương', 'C-001');
    const r = (await call('GET', '/ranking', hs)).body as Ranking;
    expect(r.groups.map((g) => g.name).sort()).toEqual(['10A1 thực nghiệm', 'Nhóm khác']);
    expect(r.groups.some((g) => g.id === other)).toBe(false);
    const ra = (await call('GET', '/ranking', admin)).body as Ranking;
    expect(ra.groups.map((g) => g.name).sort()).toEqual(['10A1 thực nghiệm', '10A2 đối chứng']);
  });

  it('tải toàn bộ dữ liệu: chỉ quản trị viên, có mã cá nhân, không có email hay đáp án', async () => {
    expect((await call('GET', '/admin/export', await guest('Không quyền'))).status).toBe(403);
    const res = await app.inject({ method: 'GET', url: '/api/admin/export', headers: { authorization: 'Bearer ' + admin } });
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="thanh-pho-tu-lap-\d{4}-\d{2}-\d{2}\.json"/);
    const x = res.json() as FullExport;
    expect(x.groups).toHaveLength(2);
    expect(x.players.map((p) => p.participantCode).sort()).toEqual(['C-001', 'T0-016', 'T1-015']);
    const raw = res.body;
    expect(raw).not.toContain('@example.com');
    expect(raw).not.toContain('"questions"');
    expect(raw).not.toContain('proofCode');
  });
});
