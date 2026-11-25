/* Nhiệm vụ trong ngày: danh sách việc đột xuất theo ngày, đánh dấu xong, vòng tiến độ và linh vật lớn dần theo tỷ lệ hoàn thành.
   Việc gắn với tài khoản (không theo nhóm) và không cộng vào thành phố hay điểm nhóm. */
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  PET_MESSAGES, PET_THEMES, PET_THEME_KEYS, TASK_CATEGORIES, TASK_CATEGORY_KEYS, TASK_LIMITS, TASK_PRIORITIES, TASK_PRIORITY_KEYS,
  dkey, petStage, type DayTask, type PetTheme, type TaskCategory, type TaskPriority,
} from '@tptl/shared';
import { Pet } from '../components/Pets';
import { Banner, Button, Card, Chip, Confetti, EmptyState, Eyebrow, inputCls, Skeleton, useToast } from '../components/ui';
import { errorMessage } from '../lib/api';
import { useTaskActions, useTasks, useTaskStats, type TaskInput } from '../lib/queries';

/* ---------- ngày ---------- */
const WEEKDAY = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const toDate = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k: string, n: number) => { const d = toDate(k); d.setDate(d.getDate() + n); return dkey(d.getTime()); };
const pad = (n: number) => String(n).padStart(2, '0');
const longDate = (k: string) => { const d = toDate(k); return `${WEEKDAY[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };

/* ---------- màu phân loại và ưu tiên ---------- */
const PRIO: Record<TaskPriority, { dot: string; cell: string }> = {
  high: { dot: '#e5483a', cell: 'bg-[color-mix(in_srgb,#e5483a_10%,var(--surface))]' },
  medium: { dot: '#e0a400', cell: 'bg-[color-mix(in_srgb,#f6c344_16%,var(--surface))]' },
  low: { dot: '#2f9d58', cell: 'bg-[color-mix(in_srgb,#2f9d58_10%,var(--surface))]' },
};
const CAT_COLOR: Record<TaskCategory, string> = { work: '#3a74d8', personal: '#d9488f', study: '#8a5cd6', health: '#2f9d58', other: '#7d8b99' };

const PET_KEY = 'tptl-pet';
const loadPet = (): PetTheme => { try { const v = localStorage.getItem(PET_KEY) as PetTheme | null; return v && v in PET_THEMES ? v : 'meo'; } catch { return 'meo'; } };

const PrioTag = ({ p }: { p: TaskPriority }) => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold">
    <i className="size-2.5 rounded-full" style={{ background: PRIO[p].dot }} />{TASK_PRIORITIES[p]}
  </span>
);
const CatTag = ({ c }: { c: TaskCategory }) => (
  <span className="inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-semibold"
    style={{ color: CAT_COLOR[c], background: `color-mix(in srgb, ${CAT_COLOR[c]} 12%, transparent)` }}>{TASK_CATEGORIES[c]}</span>
);
const selCls = inputCls + ' py-2 text-sm';
const IconBtn = ({ label, onClick, children, danger, disabled }: { label: string; onClick: () => void; children: ReactNode; danger?: boolean; disabled?: boolean }) => (
  <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
    className={'grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface2 disabled:opacity-40 ' + (danger ? 'hover:text-bad' : 'hover:text-ink')}>{children}</button>
);
const svgIcon = (d: string) => <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const IC = {
  edit: svgIcon('M13.5 3.5l3 3L7 16H4v-3z'),
  next: svgIcon('M4 10h11M11 6l4 4-4 4'),
  del: svgIcon('M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10'),
};

/** Vòng tiến độ phần trăm. */
function Donut({ value }: { value: number }) {
  const C = 2 * Math.PI * 46;
  return (
    <svg viewBox="0 0 120 120" className="mx-auto size-40" aria-hidden="true">
      <circle cx="60" cy="60" r="46" fill="none" stroke="var(--surface2)" strokeWidth="14" />
      <circle cx="60" cy="60" r="46" fill="none" stroke="url(#tg)" strokeWidth="14" strokeLinecap="round" strokeDasharray={C}
        strokeDashoffset={C * (1 - value / 100)} transform="rotate(-90 60 60)" className="transition-[stroke-dashoffset] duration-700 ease-out" />
      <defs><linearGradient id="tg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--pine)" /><stop offset="1" stopColor="color-mix(in srgb, var(--pine) 50%, var(--lamp))" /></linearGradient></defs>
      <text x="60" y="68" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--ink)" fontFamily="var(--font-display)">{value}%</text>
    </svg>
  );
}

/** Ô nhập/sửa một việc: tên, phân loại, ưu tiên, ghi chú. */
function TaskForm({ init, submit, onCancel, busy, compact }: { init: TaskInput; submit: (t: TaskInput) => void; onCancel?: () => void; busy?: boolean; compact?: boolean }) {
  const [t, setT] = useState(init);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (onCancel) ref.current?.focus(); }, [onCancel]);
  function go(e: FormEvent) {
    e.preventDefault();
    if (!t.title.trim()) { ref.current?.focus(); return; }
    submit({ ...t, title: t.title.trim(), note: t.note.trim() });
    if (!onCancel) setT((x) => ({ ...x, title: '', note: '' }));
  }
  return (
    <form onSubmit={go} onKeyDown={(e) => { if (e.key === 'Escape' && onCancel) onCancel(); }}
      className={'grid gap-2 ' + (compact ? 'md:grid-cols-[minmax(0,2fr)_140px_140px]' : 'md:grid-cols-[minmax(0,2fr)_140px_140px_minmax(0,1.5fr)_auto]')}>
      <input ref={ref} className={inputCls} value={t.title} maxLength={TASK_LIMITS.title} placeholder="Việc cần làm…" aria-label="Tên việc"
        onChange={(e) => setT({ ...t, title: e.target.value })} />
      <select className={selCls} value={t.category} aria-label="Phân loại" onChange={(e) => setT({ ...t, category: e.target.value as TaskCategory })}>
        {TASK_CATEGORY_KEYS.map((k) => <option key={k} value={k}>{TASK_CATEGORIES[k]}</option>)}
      </select>
      <select className={selCls} value={t.priority} aria-label="Độ ưu tiên" onChange={(e) => setT({ ...t, priority: e.target.value as TaskPriority })}>
        {TASK_PRIORITY_KEYS.map((k) => <option key={k} value={k}>Ưu tiên {TASK_PRIORITIES[k].toLowerCase()}</option>)}
      </select>
      <input className={inputCls + (compact ? ' md:col-span-3' : '')} value={t.note} maxLength={TASK_LIMITS.note} placeholder="Ghi chú (không bắt buộc)" aria-label="Ghi chú"
        onChange={(e) => setT({ ...t, note: e.target.value })} />
      <div className={'flex gap-2 ' + (compact ? 'md:col-span-3 md:justify-end' : '')}>
        {onCancel && <Button onClick={onCancel}>Hủy</Button>}
        <Button type="submit" variant="primary" disabled={busy || !t.title.trim()} className="max-md:flex-1">{onCancel ? 'Lưu' : '+ Thêm'}</Button>
      </div>
    </form>
  );
}

function TaskRow({ t, editing, onToggle, onEdit, onSave, onCancel, onTomorrow, onDelete }: {
  t: DayTask; editing: boolean; onToggle: () => void; onEdit: () => void; onSave: (x: TaskInput) => void; onCancel: () => void; onTomorrow: () => void; onDelete: () => void;
}) {
  if (editing) {
    return <li className="rounded-xl border border-pine bg-[color-mix(in_srgb,var(--pine)_5%,var(--surface))] p-3"><TaskForm compact init={{ title: t.title, category: t.category, priority: t.priority, note: t.note }} submit={onSave} onCancel={onCancel} /></li>;
  }
  return (
    <li className={'rise grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-line px-2 py-2.5 transition-colors last:border-b-0 md:grid-cols-[auto_minmax(0,2fr)_110px_130px_minmax(0,1.6fr)_auto] '
      + (t.done ? 'bg-surface2/40' : 'hover:bg-surface2/50')}>
      <input type="checkbox" checked={t.done} onChange={onToggle} aria-label={`Đánh dấu xong: ${t.title}`} className="size-5 cursor-pointer accent-pine" />
      <div className="min-w-0">
        <p className={'break-words font-semibold transition-colors ' + (t.done ? 'text-muted line-through decoration-2' : '')}>{t.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 md:hidden">
          <CatTag c={t.category} /><PrioTag p={t.priority} />
          {t.note && <span className="w-full text-[13px] text-muted">{t.note}</span>}
        </div>
      </div>
      <div className="hidden md:block"><CatTag c={t.category} /></div>
      <div className={'hidden self-stretch rounded-lg px-2 md:flex md:items-center ' + PRIO[t.priority].cell}><PrioTag p={t.priority} /></div>
      <p className="hidden text-[13px] text-muted md:block">{t.note || '—'}</p>
      <div className="flex">
        <IconBtn label="Sửa" onClick={onEdit}>{IC.edit}</IconBtn>
        {!t.done && <IconBtn label="Dời sang ngày hôm sau" onClick={onTomorrow}>{IC.next}</IconBtn>}
        <IconBtn label="Xóa" danger onClick={onDelete}>{IC.del}</IconBtn>
      </div>
    </li>
  );
}

export function DailyTasks() {
  const toast = useToast();
  const today = dkey(Date.now());
  const [day, setDay] = useState(today);
  const q = useTasks(day);
  const act = useTaskActions(day);
  const week = useTaskStats(addDays(day, -6), day);
  const recent = useTaskStats(addDays(today, -(TASK_LIMITS.statsDays - 1)), today);
  const [editing, setEditing] = useState<string | null>(null);
  const [undo, setUndo] = useState<DayTask | null>(null);
  const [pet, setPet] = useState<PetTheme>(loadPet);
  const [lastInput, setLastInput] = useState<Pick<TaskInput, 'category' | 'priority'>>({ category: 'personal', priority: 'medium' });
  const [party, setParty] = useState(0);

  const tasks = q.data ?? [];
  const total = tasks.length, done = tasks.filter((t) => t.done).length;
  const pctDone = total ? Math.round((100 * done) / total) : 0;
  const stage = petStage(done, total);
  const fail = (e: unknown) => toast(errorMessage(e));

  // Pháo giấy khi vừa làm xong việc cuối cùng của ngày đang xem.
  const was = useRef<{ day: string; full: boolean } | null>(null);
  useEffect(() => {
    if (!q.data) return;
    const full = total > 0 && done === total;
    if (was.current && was.current.day === day && !was.current.full && full) setParty((n) => n + 1);
    was.current = { day, full };
  }, [q.data, day, total, done]);
  useEffect(() => { setEditing(null); setUndo(null); }, [day]);
  useEffect(() => { try { localStorage.setItem(PET_KEY, pet); } catch { /* bỏ qua */ } }, [pet]);

  const weekMap = useMemo(() => new Map((week.data ?? []).map((s) => [s.day, s])), [week.data]);
  const yesterday = weekMap.get(addDays(day, -1));
  const leftYesterday = yesterday ? yesterday.total - yesterday.done : 0;
  const streak = useMemo(() => {
    const m = new Map((recent.data ?? []).map((s) => [s.day, s]));
    const ok = (k: string) => { const s = m.get(k); return !!s && s.total > 0 && s.done === s.total; };
    let k = ok(today) ? today : addDays(today, -1), n = 0;
    while (ok(k) && n < TASK_LIMITS.statsDays) { n++; k = addDays(k, -1); }
    return n;
  }, [recent.data, today]);

  const d = toDate(day);
  const isToday = day === today;
  const relLabel = isToday ? 'Hôm nay' : day === addDays(today, -1) ? 'Hôm qua' : day === addDays(today, 1) ? 'Ngày mai' : null;

  function add(t: TaskInput) {
    setLastInput({ category: t.category, priority: t.priority });
    act.add.mutate(t, { onError: fail });
  }
  function remove(t: DayTask) {
    setUndo(t);
    act.remove.mutate(t.id, { onError: fail });
  }
  async function restore() {
    if (!undo) return;
    const t = undo;
    setUndo(null);
    try {
      const n = await act.add.mutateAsync({ title: t.title, category: t.category, priority: t.priority, note: t.note });
      if (t.done) act.update.mutate({ id: n.id, patch: { done: true } });
    } catch (e) { fail(e); }
  }
  function carry(from: string, to: string) {
    act.carry.mutate({ from, to }, {
      onSuccess: (r) => toast(r.moved ? `Đã dời ${r.moved} việc sang ${longDate(to)}.` + (r.left ? ` Còn ${r.left} việc chưa dời vì ngày đó đã đủ ${TASK_LIMITS.perDay} việc.` : '') : 'Không có việc nào để dời.'),
      onError: fail,
    });
  }

  const prioStats = TASK_PRIORITY_KEYS.map((p) => ({ p, total: tasks.filter((t) => t.priority === p).length, done: tasks.filter((t) => t.priority === p && t.done).length }));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(day, i - 6));
  const weekMax = Math.max(1, ...weekDays.map((k) => weekMap.get(k)?.total ?? 0));

  return (
    <section className="flex flex-col gap-3.5">
      {party > 0 && <Confetti key={party} count={90} />}
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div><Eyebrow>Việc đột xuất · không tính vào thành phố hay điểm nhóm</Eyebrow><h2>Nhiệm vụ trong ngày</h2></div>
        {streak > 0 && <span className="rounded-full border border-[#ffb37a] bg-[color-mix(in_srgb,#ff7a29_10%,var(--surface))] px-3 py-1 text-sm font-bold">🔥 {streak} ngày liền làm xong hết việc</span>}
      </div>

      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-3.5">
          {/* Thanh chọn ngày */}
          <Card className="gap-3 p-0 overflow-hidden">
            <div className="grid grid-cols-3 border-b border-line text-center sm:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr]">
              <div className="col-span-3 flex flex-col justify-center gap-0.5 border-b border-line px-3 py-3 sm:col-span-1 sm:border-r sm:border-b-0">
                <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted">Ngày đang xem</span>
                <b className="font-display text-xl">{longDate(day)}</b>
                {relLabel && <span className="mx-auto rounded-full bg-pine px-2 py-0.5 text-[11px] font-bold text-pine-ink">{relLabel}</span>}
              </div>
              {([['Ngày', pad(d.getDate())], ['Tháng', 'Tháng ' + (d.getMonth() + 1)], ['Năm', String(d.getFullYear())]] as const).map(([l, v], i) => (
                <div key={l} className={'flex flex-col justify-center gap-0.5 px-2 py-3 ' + (i < 2 ? 'border-r border-line' : '')}>
                  <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted">{l}</span>
                  <b className="font-display text-lg tabular-nums">{v}</b>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
              <Button onClick={() => setDay(addDays(day, -1))}>◀ Hôm qua</Button>
              <Button variant={isToday ? 'primary' : 'default'} onClick={() => setDay(today)}>Hôm nay</Button>
              <Button onClick={() => setDay(addDays(day, 1))}>Ngày mai ▶</Button>
              <input type="date" className={inputCls + ' w-auto py-2 text-sm sm:ml-auto'} value={day} aria-label="Chọn ngày"
                onChange={(e) => { if (e.target.value) setDay(e.target.value); }} />
            </div>
          </Card>

          {leftYesterday > 0 && (
            <Banner className="flex flex-wrap items-center justify-between gap-2.5">
              <span>{relLabel === 'Hôm nay' ? 'Hôm qua' : longDate(addDays(day, -1))} còn <b>{leftYesterday} việc</b> chưa xong.</span>
              <Button variant="lamp" disabled={act.carry.isPending} onClick={() => carry(addDays(day, -1), day)}>Dời sang {isToday ? 'hôm nay' : 'ngày này'}</Button>
            </Banner>
          )}
          {undo && (
            <Banner className="flex flex-wrap items-center justify-between gap-2.5">
              <span>Đã xóa “{undo.title}”.</span>
              <div className="flex gap-2"><Button onClick={restore}>Hoàn tác</Button><Button variant="ghost" onClick={() => setUndo(null)}>Đóng</Button></div>
            </Banner>
          )}

          {/* Danh sách việc */}
          <Card className="gap-0 p-0 overflow-hidden">
            <div className="hidden grid-cols-[auto_minmax(0,2fr)_110px_130px_minmax(0,1.6fr)_auto] gap-x-3 bg-pine px-2 py-2.5 text-[12px] font-bold uppercase tracking-[.05em] text-pine-ink md:grid">
              <span className="w-5 text-center">✓</span><span>Tên nhiệm vụ</span><span>Phân loại</span><span>Độ ưu tiên</span><span>Ghi chú</span><span className="w-24" />
            </div>
            {q.isPending ? (
              <div className="flex flex-col gap-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}<p className="sr-only">Đang tải danh sách việc…</p></div>
            ) : q.isError ? (
              <div className="flex flex-col gap-2 p-4"><p className="text-bad">{errorMessage(q.error)}</p><div><Button onClick={() => q.refetch()}>Thử lại</Button></div></div>
            ) : !tasks.length ? (
              <EmptyState compact art={<Pet theme={pet} stage={0} className="size-14" />} title={isToday ? 'Hôm nay chưa có việc nào' : 'Ngày này chưa có việc nào'}>
                Thêm việc đột xuất cần làm ở ô bên dưới. Mỗi việc xong giúp linh vật lớn thêm một chút.
              </EmptyState>
            ) : (
              <ul className="m-0 list-none p-0">
                {tasks.map((t) => (
                  <TaskRow key={t.id} t={t} editing={editing === t.id}
                    onToggle={() => act.update.mutate({ id: t.id, patch: { done: !t.done } }, { onError: fail })}
                    onEdit={() => setEditing(t.id)}
                    onCancel={() => setEditing(null)}
                    onSave={(x) => { setEditing(null); act.update.mutate({ id: t.id, patch: x }, { onError: fail }); }}
                    onTomorrow={() => act.update.mutate({ id: t.id, patch: { day: addDays(day, 1) } }, { onError: fail, onSuccess: () => toast(`Đã dời “${t.title}” sang ngày hôm sau.`) })}
                    onDelete={() => remove(t)} />
                ))}
              </ul>
            )}
            <div className="border-t border-line bg-bg/60 p-3">
              {total >= TASK_LIMITS.perDay
                ? <p className="text-[13px] text-muted">Ngày này đã đủ {TASK_LIMITS.perDay} việc.</p>
                : <TaskForm key={day} init={{ title: '', note: '', ...lastInput }} submit={add} busy={act.add.isPending} />}
            </div>
            {total > done && (
              <div className="flex justify-end border-t border-line px-3 py-2">
                <Button variant="ghost" disabled={act.carry.isPending} onClick={() => carry(day, addDays(day, 1))}>Dời {total - done} việc chưa xong sang ngày hôm sau →</Button>
              </div>
            )}
          </Card>
        </div>

        {/* Cột bên phải: tiến độ, linh vật, ưu tiên, 7 ngày */}
        <aside className="flex flex-col gap-3.5">
          <Card className="items-center text-center">
            <Eyebrow>Tiến độ nhiệm vụ ngày</Eyebrow>
            <Donut value={pctDone} />
            <p className="font-semibold">✓ Hoàn thành: {done} / {total} việc</p>
          </Card>

          <Card className="items-center overflow-hidden text-center">
            <div className="relative grid w-full place-items-center rounded-xl bg-linear-to-b from-[color-mix(in_srgb,var(--pine)_10%,var(--surface))] to-surface py-2">
              <div key={pet + stage} className="pop-in"><Pet theme={pet} stage={stage} className="bob size-44" label={`${PET_THEMES[pet]}, giai đoạn ${stage} trên 5`} /></div>
            </div>
            <div className="flex w-full items-center justify-center gap-1" aria-label={`Giai đoạn ${stage} trên 5`}>
              {[1, 2, 3, 4, 5].map((k) => <i key={k} className={'h-1.5 flex-1 rounded-full transition-colors ' + (k <= stage ? 'bg-pine' : 'bg-surface2')} />)}
            </div>
            <p className="font-semibold">{total ? PET_MESSAGES[stage] : 'Thêm việc đầu tiên để linh vật bắt đầu lớn.'}</p>
            <div className="flex flex-wrap justify-center gap-1.5" role="group" aria-label="Chọn linh vật">
              {PET_THEME_KEYS.map((k) => (
                <Chip key={k} pressed={pet === k} onClick={() => setPet(k)} className="!flex !items-center !gap-1 !px-2 !py-1 !text-[12px]">
                  <Pet theme={k} stage={5} className="size-5" />{PET_THEMES[k]}
                </Chip>
              ))}
            </div>
          </Card>

          <Card>
            <Eyebrow>Phân bổ độ ưu tiên</Eyebrow>
            {total ? prioStats.map(({ p, total: n, done: k }) => (
              <div key={p} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm"><PrioTag p={p} /><span className="tabular-nums text-muted">{n ? `${k} / ${n} xong` : 'không có'}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-surface2">
                  <i className="block h-full rounded-full transition-[width] duration-500" style={{ width: (n ? (100 * k) / n : 0) + '%', background: PRIO[p].dot }} />
                </div>
              </div>
            )) : <p className="text-[13px] text-muted">Chưa có việc nào.</p>}
          </Card>

          <Card>
            <Eyebrow>7 ngày gần đây</Eyebrow>
            <div className="grid grid-cols-7 items-end gap-1.5">
              {weekDays.map((k) => {
                const s = weekMap.get(k), n = s?.total ?? 0, ok = s?.done ?? 0;
                return (
                  <button key={k} type="button" onClick={() => setDay(k)} aria-label={`${longDate(k)}: ${ok} trên ${n} việc xong`} aria-pressed={k === day}
                    className={'flex flex-col items-center gap-1 rounded-lg p-1 transition-colors hover:bg-surface2 ' + (k === day ? 'bg-surface2 ring-2 ring-pine' : '')}>
                    <span className="flex h-16 w-full items-end justify-center">
                      <span className="relative w-4 overflow-hidden rounded-md bg-surface2" style={{ height: Math.max(6, (64 * n) / weekMax) }}>
                        <i className="absolute inset-x-0 bottom-0 rounded-md bg-pine" style={{ height: n ? (100 * ok) / n + '%' : 0 }} />
                      </span>
                    </span>
                    <span className="text-[11px] font-semibold text-muted">{WEEKDAY_SHORT[toDate(k).getDay()]}</span>
                    <span className="text-[11px] tabular-nums">{n ? `${ok}/${n}` : '–'}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        </aside>
      </div>
    </section>
  );
}
