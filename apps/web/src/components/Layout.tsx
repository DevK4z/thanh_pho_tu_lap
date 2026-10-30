import type { ReactNode } from 'react';

export function Layout({ who, nav, children }: { who?: ReactNode; nav?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[1120px]">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-5 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted">CLB kỷ luật tự thân và tập trung sâu</p>
          <h1>Thành Phố Tự Lập</h1>
        </div>
        {who}
      </header>
      {nav ?? <div className="mb-4 border-b border-line" />}
      <main className="flex flex-col gap-3.5">{children}</main>
    </div>
  );
}
