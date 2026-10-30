/* Hook dữ liệu. Mỗi màn hình đọc qua đây thay vì gọi fetch trực tiếp. */
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GroupDetail, GroupQuestion, GroupSummary, Me, Player, PublicConfig, SessionLog } from '@tptl/shared';
import { api, ApiError, setToken } from './api';

export const qk = {
  config: ['config'] as const,
  me: ['me'] as const,
  groups: ['groups'] as const,
  group: (gid: string) => ['group', gid] as const,
  logs: (gid: string, pid: string) => ['logs', gid, pid] as const,
  questions: (gid: string) => ['questions', gid] as const,
};

export const useConfig = () => useQuery({ queryKey: qk.config, queryFn: () => api<PublicConfig>('GET', '/config'), staleTime: Infinity, retry: 1 });

/** null khi chưa đăng nhập hoặc token hết hạn. */
export const useMe = () =>
  useQuery({
    queryKey: qk.me,
    queryFn: async () => {
      try { return await api<Me>('GET', '/me'); } catch (e) {
        if (e instanceof ApiError && e.status === 401) { setToken(null); return null; }
        throw e;
      }
    },
    retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2,
  });

export const useGroups = () => useQuery({ queryKey: qk.groups, queryFn: () => api<GroupSummary[]>('GET', '/groups'), refetchInterval: 15_000 });

/** Dữ liệu nhóm tự làm mới định kỳ để thấy tiến độ của các thành viên khác. */
export const useGroup = (gid: string, live = true) =>
  useQuery({ queryKey: qk.group(gid), queryFn: () => api<GroupDetail>('GET', '/groups/' + gid), refetchInterval: live ? 20_000 : false });

export const useLogs = (gid: string, pid: string | null) =>
  useQuery({ queryKey: qk.logs(gid, pid || ''), queryFn: () => api<SessionLog[]>('GET', `/groups/${gid}/players/${pid}/sessions`), enabled: !!pid });

export const useQuestions = (gid: string) => useQuery({ queryKey: qk.questions(gid), queryFn: () => api<GroupQuestion[]>('GET', `/groups/${gid}/questions`) });

/** Cập nhật thành phố của mình trong bộ nhớ đệm của nhóm mà không cần tải lại. */
export function usePatchMyPlayer(gid: string) {
  const qc = useQueryClient();
  return (p: Player) => qc.setQueryData<GroupDetail>(qk.group(gid), (d) => d && { ...d, meId: p.id, players: d.players.some((x) => x.id === p.id) ? d.players.map((x) => (x.id === p.id ? p : x)) : d.players.concat([p]) });
}

/** Đổi tài khoản: bỏ dữ liệu của tài khoản cũ nhưng giữ query `me` (đang có màn hình theo dõi) và cấu hình. */
function switchAccount(qc: QueryClient, me: Me | null) {
  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' && q.queryKey[0] !== 'config' });
  qc.setQueryData(qk.me, me);
}

export function useSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { kind: 'guest'; name: string } | { kind: 'google'; credential: string } | { kind: 'facebook'; accessToken: string }) => {
      const { kind, ...body } = v;
      return api<{ token: string; me: Me }>('POST', '/auth/' + kind, body);
    },
    onSuccess: (r) => { setToken(r.token); switchAccount(qc, r.me); },
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api('POST', '/auth/logout').catch(() => undefined),
    onSettled: () => { setToken(null); switchAccount(qc, null); },
  });
}

/** Lập, tham gia hoặc rời nhóm: đều trả về hồ sơ mới với currentGroupId. */
export function useGroupMembership() {
  const qc = useQueryClient();
  const done = (me: Me) => { qc.setQueryData(qk.me, me); qc.invalidateQueries({ queryKey: qk.groups }); };
  return {
    create: useMutation({ mutationFn: (name: string) => api<Me>('POST', '/groups', { name }), onSuccess: done }),
    join: useMutation({ mutationFn: (gid: string) => api<Me>('POST', `/groups/${gid}/join`), onSuccess: done }),
    leave: useMutation({ mutationFn: () => api<Me>('POST', '/me/leave-group'), onSuccess: done }),
  };
}
