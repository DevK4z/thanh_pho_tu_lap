const pad = (n: number) => String(n).padStart(2, '0');

export const mmss = (sec: number) => { sec = Math.max(0, Math.round(sec)); return pad(Math.floor(sec / 60)) + ':' + pad(sec % 60); };
export const hm = (ms: number) => { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
/** "2026-10-30" -> "30/10" */
export const dmy = (k: string) => { const p = k.split('-'); return p[2] + '/' + p[1]; };
export const dmyFull = (ms: number) => { const d = new Date(ms); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); };
export function fmtMin(m: number) {
  m = Math.round(m);
  if (m < 60) return m + ' phút';
  const h = Math.floor(m / 60), r = m % 60;
  return h + ' giờ' + (r ? ' ' + r + ' phút' : '');
}
export const pct = (v: number | null | undefined) => (v == null ? '–' : Math.round(v * 100) + '%');
export const num = (v: number | null | undefined) => (v == null ? '–' : String(v));
export function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
