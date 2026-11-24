/* Thành phần giao diện dùng chung, viết bằng Tailwind. Màu lấy từ token (bg-surface, border-line, text-muted…). */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

export function Card({ className, children, as: Tag = 'div' }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'details' }) {
  return <Tag className={cx('card rise min-w-0 rounded-2xl border border-line bg-surface p-4 flex flex-col gap-3.5', className)}>{children}</Tag>;
}

export const Stack = ({ className, children }: { className?: string; children: ReactNode }) => <div className={cx('flex flex-col gap-3.5', className)}>{children}</div>;
export const Row = ({ className, children }: { className?: string; children: ReactNode }) => <div className={cx('flex flex-wrap items-center gap-2.5', className)}>{children}</div>;
/** Lưới tự xuống dòng: cột tối thiểu 300px (g2) hoặc 200px (g3). */
export const Grid = ({ cols = 2, className, children }: { cols?: 2 | 3; className?: string; children: ReactNode }) => (
  <div className={cx('grid gap-3.5', cols === 2 ? 'grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]' : 'grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]', className)}>{children}</div>
);

export const Eyebrow = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cx('text-xs font-semibold uppercase tracking-[.08em] text-muted', className)}>{children}</p>
);
export const Muted = ({ children, small, className }: { children: ReactNode; small?: boolean; className?: string }) => (
  <p className={cx('text-muted', small && 'text-[13px]', className)}>{children}</p>
);
export function Heading({ eyebrow, title, sub, right }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <div>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2>{title}</h2>
        {sub && <p className="mt-1.5 text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

type BtnVariant = 'default' | 'primary' | 'lamp' | 'danger' | 'ghost';
// Nút có cạnh dưới dày như phím bấm; bấm xuống thì lún vào.
const btnVariant: Record<BtnVariant, string> = {
  default: 'border-line bg-surface text-ink hover:bg-surface2 shadow-[0_3px_0_var(--line)] enabled:active:shadow-[0_1px_0_var(--line)]',
  primary: 'border-pine bg-linear-to-b from-[color-mix(in_srgb,var(--pine)_82%,#fff)] to-pine text-pine-ink hover:brightness-110 shadow-[0_3px_0_var(--pine-deep)] enabled:active:shadow-[0_1px_0_var(--pine-deep)]',
  lamp: 'border-lamp bg-linear-to-b from-[color-mix(in_srgb,var(--lamp)_70%,#fff)] to-lamp text-lamp-ink hover:brightness-105 shadow-[0_3px_0_var(--lamp-deep)] enabled:active:shadow-[0_1px_0_var(--lamp-deep)]',
  danger: 'border-bad bg-surface text-bad hover:bg-surface2 shadow-[0_3px_0_color-mix(in_srgb,var(--bad)_45%,transparent)] enabled:active:shadow-[0_1px_0_color-mix(in_srgb,var(--bad)_45%,transparent)]',
  ghost: 'border-transparent bg-transparent text-muted hover:bg-surface2 hover:text-ink',
};
export function Button({ variant = 'default', big, block, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; big?: boolean; block?: boolean }) {
  return (
    <button
      type="button"
      {...p}
      className={cx('inline-flex items-center justify-center gap-2.5 rounded-xl border font-semibold transition-[transform,box-shadow,filter,background-color,color] duration-100 enabled:active:translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-45',
        big ? 'px-[22px] py-[13px] text-base' : 'px-4 py-2.5 text-sm', block && 'w-full', btnVariant[variant], className)}
    />
  );
}
export const LinkButton = (p: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" {...p} className={cx('py-0.5 text-[13px] font-semibold text-pine underline underline-offset-[3px]', p.className)} />
);

export function Chip({ pressed, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { pressed: boolean }) {
  return (
    <button type="button" aria-pressed={pressed} {...p}
      className={cx('rounded-full border px-[13px] py-2 text-sm font-medium transition-[background-color,color,border-color,transform,box-shadow] duration-150 active:scale-95',
        pressed ? 'border-pine bg-pine text-pine-ink shadow-[0_3px_10px_color-mix(in_srgb,var(--pine)_30%,transparent)]' : 'border-line bg-surface text-ink hover:border-pine hover:bg-surface2', p.className)} />
  );
}
/** Nút lựa chọn dạng thẻ: tiêu đề đậm, mô tả nhỏ, hình minh họa tùy chọn. */
export function Option({ pressed, title, sub, children, ...p }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> & { pressed?: boolean; title: ReactNode; sub?: ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} {...p}
      className={cx('flex flex-col gap-[3px] rounded-xl border bg-surface px-3.5 py-3 text-left text-sm font-medium text-ink transition-[transform,box-shadow,border-color,background-color] duration-150 enabled:hover:-translate-y-0.5 enabled:active:translate-y-0 disabled:opacity-45',
        pressed ? 'border-pine bg-[color-mix(in_srgb,var(--pine)_8%,var(--surface))] shadow-[inset_0_0_0_2px_var(--pine),0_6px_16px_color-mix(in_srgb,var(--pine)_22%,transparent)]' : 'border-line hover:bg-surface2 hover:shadow-(--shadow-sm)', p.className)}>
      {children}
      <b className="text-[15px]">{title}</b>
      {sub && <span className="text-[13px] font-normal text-muted">{sub}</span>}
    </button>
  );
}

type Tone = 'plain' | 'good' | 'warn' | 'bad';
const toneCls: Record<Tone, string> = { plain: 'border-line', good: 'border-good text-good', warn: 'border-warn text-warn', bad: 'border-bad text-bad' };
export const Pill = ({ tone = 'plain', children }: { tone?: Tone; children: ReactNode }) => (
  <span className={cx('inline-block whitespace-nowrap rounded-full border px-[9px] py-0.5 text-xs font-semibold', toneCls[tone])}>{children}</span>
);

export const inputCls = 'w-full min-w-0 rounded-[10px] border border-line bg-bg px-3 py-2.5 text-[15px] font-normal text-ink';
export function Field({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return <label className={cx('flex flex-col gap-[5px] text-sm font-semibold', className)}>{label}{children}</label>;
}
export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex items-start gap-2.5 py-2 text-sm">
      <input type="checkbox" className="mt-1 size-[18px] accent-pine" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export const Banner = ({ tone = 'lamp', children, className }: { tone?: 'lamp' | 'bad'; children: ReactNode; className?: string }) => (
  <div className={cx('rise rounded-xl border border-l-4 px-3.5 py-[11px] text-sm shadow-(--shadow-sm)',
    tone === 'bad' ? 'border-bad bg-[color-mix(in_srgb,var(--bad)_9%,var(--surface))]' : 'border-lamp bg-[color-mix(in_srgb,var(--lamp)_12%,var(--surface))]', className)}>{children}</div>
);
/** Thanh tiến độ: chạy từ 0 tới giá trị khi xuất hiện. */
export function Meter({ value, max = 100, label }: { value: number; max?: number; label?: string }) {
  const w = max ? Math.max(0, Math.min(100, Math.round((100 * value) / max))) : 0;
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (typeof requestAnimationFrame !== 'function') { setOn(true); return; }
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-surface2 shadow-[inset_0_1px_2px_rgba(0,0,0,.12)]" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <i className="block h-full rounded-full bg-linear-to-r from-pine to-[color-mix(in_srgb,var(--pine)_55%,var(--lamp))] transition-[width] duration-700 ease-out"
        style={{ width: (on ? w : 0) + '%' }} />
    </div>
  );
}
export const BigNumber = ({ children }: { children: ReactNode }) => <div className="font-display text-[44px] leading-none font-bold tabular-nums sm:text-[52px]">{children}</div>;

export function Trend({ d, unit = '' }: { d: number | null; unit?: string }) {
  if (d == null) return <span className="text-[13px] font-semibold text-muted">chưa đủ dữ liệu so sánh</span>;
  const r = Math.round(d);
  if (r >= 3) return <span className="text-[13px] font-semibold text-good">▲ +{r}{unit} so với kỳ trước</span>;
  if (r <= -3) return <span className="text-[13px] font-semibold text-bad">▼ {r}{unit} so với kỳ trước</span>;
  return <span className="text-[13px] font-semibold text-muted">– ổn định so với kỳ trước</span>;
}

/** Danh sách nhãn – giá trị hai cột. */
export function KV({ rows, className }: { rows: [ReactNode, ReactNode][]; className?: string }) {
  return (
    <dl className={cx('m-0 grid grid-cols-[1fr_auto] gap-x-3 gap-y-[7px] text-sm', className)}>
      {rows.map(([k, v], i) => [<dt key={'k' + i} className="text-muted">{k}</dt>, <dd key={'v' + i} className="m-0 text-right font-semibold tabular-nums">{v}</dd>])}
    </dl>
  );
}

export function Stat3({ items }: { items: [ReactNode, string][] }) {
  return (
    <div className="my-3.5 grid grid-cols-3 gap-2">
      {items.map(([v, l], i) => (
        <div key={i} className="rise flex flex-col gap-0.5 rounded-xl border border-line bg-bg px-1.5 py-2.5 text-center shadow-[inset_0_1px_0_var(--hi)]" style={{ animationDelay: i * 70 + 'ms' }}>
          <b className="font-display text-[22px] leading-tight font-bold tabular-nums">{v}</b>
          <span className="text-xs text-muted">{l}</span>
        </div>
      ))}
    </div>
  );
}

export const tableCls = {
  wrap: 'overflow-x-auto',
  table: 'w-full border-collapse text-[13px] tabular-nums',
  th: 'whitespace-nowrap border-b border-line px-2.5 py-2 text-right text-xs font-semibold text-muted first:text-left',
  td: 'whitespace-nowrap border-b border-line px-2.5 py-2 text-right first:text-left',
};

export function Modal({ label, children, onClose, wide }: { label: string; children: ReactNode; onClose?: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button,input,[tabindex]')?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && onClose) onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return createPortal(
    <div className="fade-in fixed inset-0 z-50 grid place-items-center bg-[rgba(5,15,13,.55)] p-4 backdrop-blur-[3px]">
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} className={'modal-in flex max-h-[94vh] flex-col gap-3.5 overflow-auto rounded-2xl border border-line bg-surface p-4 shadow-(--shadow-lg) sm:p-5 ' + (wide ? 'w-[min(1100px,100%)]' : 'w-[min(520px,100%)]')}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- thông báo ngắn ---------- */
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [n, setN] = useState(0);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    setN((k) => k + 1);
    clearTimeout(t.current);
    t.current = setTimeout(() => setMsg(null), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {/* Vùng thông báo giữ cố định để trình đọc màn hình đọc được; chỉ phần bên trong tạo lại để chạy hiệu ứng. */}
      <div role="status" aria-live="polite" className={cx('fixed bottom-[calc(20px+env(safe-area-inset-bottom,0px))] left-1/2 z-[60] max-w-[90vw] -translate-x-1/2 max-sm:bottom-[calc(96px+env(safe-area-inset-bottom,0px))]', !msg && 'hidden')}>
        {msg && <div key={n} className="toast-in rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-bg shadow-(--shadow-lg)">{msg}</div>}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- khung chờ, màn hình trống, số đếm lên, pháo giấy ---------- */
export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden="true" className={cx('skel h-4', className)} />;

/** Thẻ đang tải: dòng chữ (cho trình đọc màn hình và người dùng) kèm khung chờ hình dạng nội dung. */
export function Loading({ text, lines = 3 }: { text: string; lines?: number }) {
  return (
    <Card>
      <div className="flex items-center gap-2.5 text-muted">
        <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-line border-t-pine" />
        <p>{text}</p>
      </div>
      <Skeleton className="h-7 w-1/2" />
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} className={i === lines - 1 ? 'w-2/3' : 'w-full'} />)}
    </Card>
  );
}

/** Màn hình trống: hình minh họa nhún nhẹ, tiêu đề, lời mời làm bước tiếp theo. */
export function EmptyState({ art, title, children, action, compact }: { art: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={cx('flex flex-col items-center gap-2 text-center', compact ? 'py-2' : 'py-5')}>
      <div className={cx('bob grid place-items-center rounded-full bg-surface2 shadow-[inset_0_2px_6px_rgba(0,0,0,.08)]', compact ? 'size-16' : 'size-24')}>{art}</div>
      <h3 className="mt-1">{title}</h3>
      {children && <div className="max-w-md text-[14px] text-muted">{children}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

const reduceMotion = () => typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Số chạy từ 0 tới giá trị cuối. Máy giảm chuyển động hoặc môi trường không có matchMedia thì hiện ngay giá trị cuối. */
export function CountUp({ to, dur = 900, delay = 0 }: { to: number; dur?: number; delay?: number }) {
  const [v, setV] = useState(() => (reduceMotion() ? to : 0));
  useEffect(() => {
    if (reduceMotion()) { setV(to); return; }
    let raf = 0;
    const t0 = performance.now() + delay;
    const step = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / dur));
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, dur, delay]);
  return <span className="tabular-nums">{v}</span>;
}

const CONFETTI = ['#f6b21b', '#2fc2ae', '#3a74d8', '#ef7aa2', '#a24de0', '#7ccb55', '#ff7a29'];
/** Pháo giấy rơi một lần rồi tự gỡ khỏi trang. */
export function Confetti({ count = 70 }: { count?: number }) {
  const [on, setOn] = useState(!reduceMotion());
  const [bits] = useState(() => Array.from({ length: count }, (_, i) => ({
    left: Math.random() * 100,
    dx: (Math.random() - 0.5) * 30 + 'vw',
    rot: (Math.random() * 900 - 450) + 'deg',
    dur: 2.2 + Math.random() * 1.8 + 's',
    delay: Math.random() * 0.5 + 's',
    color: CONFETTI[i % CONFETTI.length],
    round: Math.random() < 0.3,
  })));
  useEffect(() => { const id = setTimeout(() => setOn(false), 4800); return () => clearTimeout(id); }, []);
  if (!on) return null;
  return createPortal(
    <div className="confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <i key={i} style={{ left: b.left + '%', background: b.color, borderRadius: b.round ? '50%' : undefined, ['--dx' as string]: b.dx, ['--rot' as string]: b.rot, ['--dur' as string]: b.dur, ['--delay' as string]: b.delay }} />
      ))}
    </div>,
    document.body,
  );
}
