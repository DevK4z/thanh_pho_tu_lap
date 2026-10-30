/* Công thức tính điểm. Hàm thuần, dùng chung cho API (tính điểm phiên) và giao diện (bảng số liệu). */
import { LV, POP, TIERS, type Level, type Mode } from './constants';
import type { DayStat, Days, PlotItem } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Khóa ngày theo giờ địa phương: YYYY-MM-DD. */
export function dkey(ms: number): string {
  const d = new Date(ms);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function emptyDay(): DayStat {
  return { s: 0, c: 0, q: 0, pl: 0, ac: 0, cs: 0, aw: 0, dn: 0, ms: 0, qa: 0, qc: 0, fs: 0, fn: 0 };
}
export const DAY_FIELDS = Object.keys(emptyDay()) as (keyof DayStat)[];

/** n khóa ngày liên tiếp kết thúc ở (hôm nay - off). */
export function keysBack(n: number, off = 0, now = Date.now()): string[] {
  const out: string[] = [];
  const base = new Date(now);
  base.setHours(12, 0, 0, 0);
  for (let i = n - 1 + off; i >= off; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    out.push(dkey(d.getTime()));
  }
  return out;
}

export type DayTotals = DayStat & { act: number };
export function sumDays(days: Days | undefined, keys: string[]): DayTotals {
  const t = { ...emptyDay(), act: 0 };
  for (const k of keys) {
    const d = days?.[k];
    if (!d) continue;
    for (const f of DAY_FIELDS) t[f] += d[f] || 0;
    if ((d.s || 0) > 0) t.act++;
  }
  return t;
}

export interface Metrics extends DayTotals {
  comp: number | null;
  quitRate: number | null;
  kept: number | null;
  focus: number | null;
  cons: number;
  disc: number | null;
  quiz: number | null;
}
/** Kỷ luật = 40% hoàn thành + 30% thời gian thực hiện/đăng ký + 30% số ngày có hoạt động. */
export function metrics(t: DayTotals, nDays: number, joined: number | null | undefined, now = Date.now()): Metrics {
  const comp = t.s ? t.c / t.s : null;
  const kept = t.pl ? Math.min(1, t.ac / t.pl) : null;
  const eff = Math.max(1, Math.min(nDays, Math.floor((now - (joined || 0)) / 86400000) + 1));
  const cons = Math.min(1, t.act / eff);
  return {
    ...t,
    comp,
    quitRate: t.s ? t.q / t.s : null,
    kept,
    focus: t.fn ? Math.round(t.fs / t.fn) : null,
    cons,
    disc: t.s ? Math.round(100 * (0.4 * (comp ?? 0) + 0.3 * (kept ?? 0) + 0.3 * cons)) : null,
    quiz: t.qa ? t.qc / t.qa : null,
  };
}

export interface ScoreInput {
  mode: Mode;
  activeSec: number;
  awaySec: number;
  distractions: number;
  missed: number;
  qa: number;
  qc: number;
  self: number;
}
/** Điểm tập trung một phiên (0–100). */
export function scoreSession(r: ScoreInput): number {
  const quiz = r.qa ? r.qc / r.qa : 1;
  if (r.mode === 'screen') {
    const base = r.activeSec > 0 ? (1 - Math.min(1, r.awaySec / r.activeSec)) * 100 : 0;
    const pen = 3 * r.distractions + 5 * r.missed;
    return Math.round(Math.max(0, base - pen) * (0.75 + 0.25 * quiz));
  }
  return Math.round(0.6 * quiz * 100 + 0.4 * (((r.self || 3) / 5) * 100));
}

export function levelOf(min: number): Level & { next: Level | null } {
  let L = LV[0];
  for (const l of LV) if (min >= l.at) L = l;
  return { ...L, next: LV.find((l) => l.at > min) ?? null };
}
export function tierFor(min: number): number {
  let t = 0;
  for (const x of TIERS) if (min >= x.min) t = x.t;
  return t;
}
/** Số ngày liên tiếp có phiên hoàn thành; hôm nay chưa có thì vẫn tính chuỗi đến hôm qua. */
export function streakOf(days: Days | undefined, now = Date.now()): number {
  let n = 0;
  const base = new Date(now);
  base.setHours(12, 0, 0, 0);
  for (let i = 0; i < 400; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    const x = days?.[dkey(d.getTime())];
    if (x && x.c > 0) n++;
    else if (i === 0) continue;
    else break;
  }
  return n;
}
export function delta(a: number | null, b: number | null): number | null {
  return a == null || b == null ? null : a - b;
}
export function popOf(plot: PlotItem[] | undefined): number {
  return (plot || []).reduce((s, p) => s + (POP[p.i] || 0), 0);
}
export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}
