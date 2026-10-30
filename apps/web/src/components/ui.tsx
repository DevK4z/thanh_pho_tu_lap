/* Thành phần giao diện dùng chung, viết bằng Tailwind. Màu lấy từ token (bg-surface, border-line, text-muted…). */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

export function Card({ className, children, as: Tag = 'div' }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'details' }) {
  return <Tag className={cx('min-w-0 rounded-[14px] border border-line bg-surface p-4 flex flex-col gap-3.5', className)}>{children}</Tag>;
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
const btnVariant: Record<BtnVariant, string> = {
  default: 'border-line bg-surface text-ink hover:bg-surface2',
  primary: 'border-pine bg-pine text-pine-ink hover:brightness-110',
  lamp: 'border-lamp bg-lamp text-lamp-ink hover:brightness-105',
  danger: 'border-bad bg-surface text-bad hover:bg-surface2',
  ghost: 'border-transparent bg-transparent text-muted hover:bg-surface2',
};
export function Button({ variant = 'default', big, block, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; big?: boolean; block?: boolean }) {
  return (
    <button
      type="button"
      {...p}
      className={cx('inline-flex items-center justify-center gap-2.5 rounded-[10px] border font-semibold disabled:cursor-not-allowed disabled:opacity-45',
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
      className={cx('rounded-full border px-[13px] py-2 text-sm font-medium', pressed ? 'border-pine bg-pine text-pine-ink' : 'border-line bg-surface text-ink hover:bg-surface2', p.className)} />
  );
}
/** Nút lựa chọn dạng thẻ: tiêu đề đậm, mô tả nhỏ, hình minh họa tùy chọn. */
export function Option({ pressed, title, sub, children, ...p }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> & { pressed?: boolean; title: ReactNode; sub?: ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} {...p}
      className={cx('flex flex-col gap-[3px] rounded-xl border bg-surface px-3.5 py-3 text-left text-sm font-medium text-ink disabled:opacity-45',
        pressed ? 'border-pine shadow-[inset_0_0_0_2px_var(--pine)]' : 'border-line hover:bg-surface2', p.className)}>
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
  <div className={cx('rounded-xl border bg-surface px-3.5 py-[11px] text-sm', tone === 'bad' ? 'border-bad' : 'border-lamp', className)}>{children}</div>
);
export function Meter({ value, max = 100, label }: { value: number; max?: number; label?: string }) {
  const w = max ? Math.max(0, Math.min(100, Math.round((100 * value) / max))) : 0;
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <i className="block h-full rounded-full bg-pine" style={{ width: w + '%' }} />
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
        <div key={i} className="flex flex-col gap-0.5 rounded-xl border border-line bg-bg px-1.5 py-2.5 text-center">
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

export function Modal({ label, children, onClose }: { label: string; children: ReactNode; onClose?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button,input,[tabindex]')?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && onClose) onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(5,15,13,.62)] p-4">
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} className="flex max-h-[92vh] w-[min(520px,100%)] flex-col gap-3.5 overflow-auto rounded-[14px] border border-line bg-surface p-4">
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
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(t.current);
    t.current = setTimeout(() => setMsg(null), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div role="status" aria-live="polite" className={cx('fixed bottom-[calc(20px+env(safe-area-inset-bottom,0px))] left-1/2 z-[60] max-w-[90vw] -translate-x-1/2 rounded-[10px] bg-ink px-4 py-2.5 text-sm text-bg', !msg && 'hidden')}>
        {msg}
      </div>
    </ToastCtx.Provider>
  );
}
