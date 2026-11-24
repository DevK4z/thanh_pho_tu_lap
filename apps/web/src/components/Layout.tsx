import type { ReactNode } from 'react';
import { Icon } from './Icons';

export function Layout({ who, nav, children }: { who?: ReactNode; nav?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[1120px]">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="grid size-12 flex-none place-items-center rounded-2xl border border-line bg-surface shadow-(--shadow-sm) sm:size-14">
            <Icon name="logo" className="size-9 drop-shadow-[0_2px_2px_rgba(0,0,0,.15)] sm:size-10" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">CLB kỷ luật tự thân và tập trung sâu</p>
            <h1 className="bg-linear-to-r from-pine to-[color-mix(in_srgb,var(--pine)_55%,var(--lamp))] bg-clip-text text-transparent">Thành Phố Tự Lập</h1>
          </div>
        </div>
        {who}
      </header>
      {nav ?? <div className="mb-4 border-b border-line" />}
      <main className="flex flex-col gap-3.5">{children}</main>
    </div>
  );
}
