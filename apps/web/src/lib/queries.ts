/* Hook dữ liệu. Mỗi màn hình đọc qua đây thay vì gọi fetch trực tiếp. */
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dkey, type DayTask, type GroupDetail, type GroupQuestion, type GroupSummary, type Me, type Player, type PublicConfig, type RankRange, type Ranking, type SessionLog, type SpotDraw, type TaskCategory, type TaskDayStat, type TaskPriority } from '@tptl/shared';
import { api, ApiError, setToken } from './api';
import { clearCache, readCache, writeCache } from './cache';

export const qk = {
  config: ['config'] as const,
  me: ['me'] as const,
  groups: ['groups'] as const,
  group: (gid: string) => ['group', gid] as const,
  logs: (gid: string, pid: string) => ['logs', gid, pid] as const,
  questions: (gid: string) => ['questions', gid] as const,
  ranking: (range: string) => ['ranking', range] as const,
  spot: (gid: string) => ['spot', gid] as const,
  field: (gid: string) => ['field', gid] as const,
  results: (gid: string) => ['results', gid] as const,
  tasks: (day: string) => ['tasks', day] as const,
  taskStats: (from: string, to: string) => ['taskStats', from, to] as const,
};

export const useConfig = () => useQuery({ queryKey: qk.config, queryFn: () => api<PublicConfig>('GET', '/config'), staleTime: Infinity, retry: 1 });

/** null khi chưa đăng nhập hoặc token hết hạn. Hiện ngay dữ liệu lần trước (nếu có) rồi cập nhật khi máy chủ trả lời. */
export const useMe = () =>
  useQuery({
    queryKey: qk.me,
    initialData: () => readCache<Me>('me'),
    initialDataUpdatedAt: 0,
    queryFn: async () => {
      try { return writeCache('me', await api<Me>('GET', '/me')); } catch (e) {
        if (e instanceof ApiError && e.status === 401) { setToken(null); clearCache(); return null; }
        throw e;
      }
    },
    retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2,
  });

/** Danh sách nhóm: chỉ quản trị viên ứng dụng mới có dữ liệu. */
export const useGroups = (enabled = true) => useQuery({ queryKey: qk.groups, queryFn: () => api<GroupSummary[]>('GET', '/groups'), refetchInterval: 15_000, enabled });

/** Dữ liệu nhóm tự làm mới định kỳ để thấy tiến độ của các thành viên khác. */
export const useGroup = (gid: string, live = true) =>
  useQuery({
    queryKey: qk.group(gid),
    // Hiện ngay thành phố lần trước; dataUpdatedAt = 0 cho biết đây là dữ liệu cũ chưa được máy chủ xác nhận.
    initialData: () => readCache<GroupDetail>('group:' + gid),
    initialDataUpdatedAt: 0,
    queryFn: async () => writeCache('group:' + gid, await api<GroupDetail>('GET', `/groups/${gid}?day=${dkey(Date.now())}`)),
    refetchInterval: live ? 20_000 : false,
  });

export const useLogs = (gid: string, pid: string | null) =>
  useQuery({ queryKey: qk.logs(gid, pid || ''), queryFn: () => api<SessionLog[]>('GET', `/groups/${gid}/players/${pid}/sessions`), enabled: !!pid });

export const useSpot = (gid: string) => useQuery({ queryKey: qk.spot(gid), queryFn: () => api<SpotDraw>('GET', `/groups/${gid}/spot`) });

export const useQuestions = (gid: string) => useQuery({ queryKey: qk.questions(gid), queryFn: () => api<GroupQuestion[]>('GET', `/groups/${gid}/questions`) });

/** Cập nhật thành phố của mình trong bộ nhớ đệm của nhóm mà không cần tải lại. */
export function usePatchMyPlayer(gid: string) {
  const qc = useQueryClient();
  return (p: Player) => qc.setQueryData<GroupDetail>(qk.group(gid), (d) => d && { ...d, meId: p.id, players: d.players.some((x) => x.id === p.id) ? d.players.map((x) => (x.id === p.id ? p : x)) : d.players.concat([p]) });
}

/** Đổi tài khoản: bỏ dữ liệu của tài khoản cũ nhưng giữ query `me` (đang có màn hình theo dõi) và cấu hình. */
function switchAccount(qc: QueryClient, me: Me | null) {
  clearCache();
  if (me) writeCache('me', me);
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
    joinCode: useMutation({ mutationFn: (code: string) => api<Me>('POST', '/groups/join', { code }), onSuccess: done }),
    leave: useMutation({ mutationFn: () => api<Me>('POST', '/me/leave-group'), onSuccess: done }),
  };
}

/** Bảng điểm nhóm và xếp hạng; làm mới định kỳ để thấy điểm mới khi có người hoàn thành phiên. */
export const useRanking = (range: RankRange) =>
  useQuery({ queryKey: qk.ranking(range), queryFn: () => api<Ranking>('GET', '/ranking?range=' + range), refetchInterval: 30_000 });

/* ---------- Nhiệm vụ trong ngày ---------- */
export const useTasks = (day: string) => useQuery({ queryKey: qk.tasks(day), queryFn: () => api<DayTask[]>('GET', `/tasks?day=${day}`) });
export const useTaskStats = (from: string, to: string) =>
  useQuery({ queryKey: qk.taskStats(from, to), queryFn: () => api<TaskDayStat[]>('GET', `/tasks/stats?from=${from}&to=${to}`) });

export interface TaskInput { title: string; category: TaskCategory; priority: TaskPriority; note: string }
export type TaskPatch = Partial<TaskInput & { done: boolean; day: string }>;

/** Thêm, sửa, xóa, dời việc. Đánh dấu xong và sửa được cập nhật ngay trên màn hình (lạc quan), lỗi thì trả lại như cũ. */
export function useTaskActions(day: string) {
  const qc = useQueryClient();
  const key = qk.tasks(day);
  const settle = () => {
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['taskStats'] });
  };
  const optimistic = async (f: (list: DayTask[]) => DayTask[]) => {
    await qc.cancelQueries({ queryKey: key });
    const prev = qc.getQueryData<DayTask[]>(key);
    if (prev) qc.setQueryData<DayTask[]>(key, f(prev));
    return { prev };
  };
  const rollback = (_e: unknown, _v: unknown, c?: { prev?: DayTask[] }) => { if (c?.prev) qc.setQueryData(key, c.prev); };
  return {
    add: useMutation({
      mutationFn: (t: TaskInput) => api<DayTask>('POST', '/tasks', { day, ...t }),
      onSuccess: (t) => qc.setQueryData<DayTask[]>(key, (l) => [...(l ?? []), t]),
      onSettled: settle,
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: TaskPatch }) => api<DayTask>('PATCH', `/tasks/${id}`, patch),
      onMutate: ({ id, patch }) => optimistic((l) => patch.day && patch.day !== day
        ? l.filter((t) => t.id !== id)
        : l.map((t) => (t.id === id ? { ...t, ...patch, doneAt: patch.done === undefined ? t.doneAt : patch.done ? Date.now() : null } : t))),
      onError: rollback,
      onSettled: settle,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api<{ ok: true }>('DELETE', `/tasks/${id}`),
      onMutate: (id) => optimistic((l) => l.filter((t) => t.id !== id)),
      onError: rollback,
      onSettled: settle,
    }),
    carry: useMutation({
      mutationFn: ({ from, to }: { from: string; to: string }) => api<{ moved: number; left: number }>('POST', '/tasks/carry', { from, to }),
      onSettled: settle,
    }),
  };
}
