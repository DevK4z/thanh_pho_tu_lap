/* Vẽ thành phố đẳng cự thành chuỗi SVG. Hình ảnh nhà, cây… là sprite nhúng trong index.html (#sp-…).
   Hàm thuần, không phụ thuộc React; component Svg/Scene đưa chuỗi vào DOM. */
import { GN, HST, SLOTS, levelOf, type HouseStyle, type ItemId, type PlotItem } from '@tptl/shared';

type P = [number, number];

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const OX = 300, OY = 170;
let gseq = 0;
const CARS: [number, number, 'c' | 'r', string][] = [[3.18, 1.1, 'c', 'rr'], [2.82, 4.9, 'c', 'rb'], [1.2, 2.82, 'r', 'gold'], [5.3, 3.18, 'r', 'wd'], [3.18, 6.0, 'c', 'rg'], [0.4, 3.18, 'r', 'awn']];
const SPRT: Record<string, P> = { dc0: [120, 102], dc1: [117, 99], dc2: [123, 102], dc3: [116, 134], dc4: [112, 136], tm1: [125, 116], tm2: [135, 126], cv0: [80, 100], cv1: [67, 104], cv2: [74, 101], cv3: [89, 99], cv5: [131, 102], cv6: [119, 98], ct0: [143, 190], ct1: [98, 176], ct2: [155, 185], ht4: [87, 81], rock: [300, 193], bridge: [480, 278], pond: [340, 220] };

const f1 = (n: number) => n.toFixed(1);
function tc(r: number, c: number): P { return [OX + (c - r) * 32, OY + (c + r) * 16 + 16]; }
function pts(a: P[]) { return a.map((p) => f1(p[0]) + ',' + f1(p[1])).join(' '); }
function poly(a: P[], cls: string) { return '<polygon class="' + cls + '" points="' + pts(a) + '"/>'; }
function at(x: number, y: number, s: string) { return '<g transform="translate(' + f1(x) + ',' + f1(y) + ')">' + s + '</g>'; }
function spr(id: string, x: number, y: number, sc: number) { const q = SPRT[id]; return '<use href="#sp-' + id + '" transform="translate(' + f1(x - (q[0] * sc) / 2) + ',' + f1(y - q[1] * sc) + ') scale(' + sc + ')"/>'; }
function sprc(id: string, x: number, y: number, sc: number, fl?: boolean) { const q = SPRT[id], w = q[0] * sc, h = q[1] * sc; return '<use href="#sp-' + id + '" transform="translate(' + f1(fl ? x + w / 2 : x - w / 2) + ',' + f1(y - h / 2) + ') scale(' + (fl ? -sc : sc) + ',' + sc + ')"/>'; }
function foot(w: number, d: number, z: number) { const a = w / 2, b = d / 2; return { N: [-32 * a + 32 * b, -16 * a - 16 * b - z] as P, R: [32 * a + 32 * b, 16 * a - 16 * b - z] as P, F: [32 * a - 32 * b, 16 * a + 16 * b - z] as P, L: [-32 * a - 32 * b, -16 * a + 16 * b - z] as P }; }
function box(w: number, d: number, h: number, z: number, m: string) { const B = foot(w, d, z), T = foot(w, d, z + h); return poly([B.L, B.F, T.F, T.L], 'm-' + m + '-l') + poly([B.F, B.R, T.R, T.F], 'm-' + m + '-r') + poly([T.N, T.R, T.F, T.L], 'm-' + m); }
function shadow(w: number, d: number) { const F = foot(w, d, 0); return '<polygon class="shd" opacity=".17" points="' + pts([F.N, F.R, F.F, F.L].map((p) => [p[0] + 8, p[1] + 3.5] as P)) + '"/>'; }
function tree(x: number, y: number, s = 1) { return spr('cv0', x, y + 3, 0.42 * s); }
function pine(x: number, y: number, s = 1) { return spr('cv1', x, y + 3, 0.42 * s); }
function bush(x: number, y: number, s = 1) { return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')"><ellipse class="m-leaf-r" cx="0" cy="-4" rx="8" ry="5"/><ellipse class="m-leaf" cx="-2" cy="-6" rx="6" ry="4"/></g>'; }
function carSVG(dir: 'c' | 'r', m: string) { const w = dir === 'c' ? 0.36 : 0.16, d = dir === 'c' ? 0.16 : 0.36; return box(w, d, 5, 0, m) + box(w * 0.5, d * 0.7, 4, 5, 'glass'); }

const ISPR: Partial<Record<ItemId, [string, number]>> = { nhanho: ['dc0', 0.62], vuon: ['dc1', 0.62], quan: ['tm1', 0.56], san: ['cv5', 0.54], thuvien: ['ct0', 0.52], chungcu: ['dc3', 0.62], congvien: ['cv6', 0.6], thap: ['ct1', 0.66], kinh: ['dc4', 0.64], truong: ['ct2', 0.5] };
/** Công trình; g = 1 thì có ngôi sao vàng (phiên đạt điểm tập trung từ 85). */
export function itemSVG(id: ItemId, g: number) {
  let o = '';
  const q = ISPR[id];
  if (q) o = spr(q[0], 0, 17, q[1]);
  else if (id === 'cay') o = spr('cv1', -15, 15, 0.42) + spr('cv0', 10, 19, 0.5) + spr('cv2', -2, 25, 0.42);
  else if (id === 'hoa') o = spr('cv3', -12, 17, 0.5) + spr('cv3', 17, 22, 0.36);
  if (g) o += '<path class="m-gold" transform="translate(30,-' + (q ? 70 : 50) + ')" d="M0 -9l2.4 6.6 6.6 2.4-6.6 2.4L0 9l-2.4-6.6L-9 0l6.6-2.4z"/>';
  return o;
}

const HSPR: Record<HouseStyle, string> = { ngoi: 'dc0', da: 'dc1', san: 'dc2', trinh: 'tm2' };
/** Nhà chính theo giai đoạn: 1 nền móng, 2 khung, 3+ nhà hoàn chỉnh, 4+ có cây, 5 có cờ. */
export function houseSVG(key: HouseStyle, lv: number) {
  const s = HST[key] || HST.ngoi, w = s.w, d = s.d, h = s.h, Z = 2.5;
  let o = '';
  if (lv < 3) {
    o += shadow(w + 0.24, d + 0.24) + box(w + 0.1, d + 0.1, 2.5, 0, 'stone');
    if (lv < 2) {
      const P = foot(w, d, 2.5);
      o += '<polygon class="outline" points="' + pts([P.N, P.R, P.F, P.L]) + '"/>' + at(-16, -3, box(0.22, 0.14, 6, 2.5, 'wood')) + at(10, 5, box(0.18, 0.18, 9, 2.5, 'brick')) + at(20, -6, box(0.16, 0.12, 5, 2.5, 'stone')) + at(-2, 6, box(0.2, 0.12, 4, 2.5, 'wood'));
      return o;
    }
    const Q = foot(w, d, Z), T = foot(w, d, Z + h);
    o += '<g opacity=".4">' + box(w, d, h, Z, s.wall) + '</g>';
    for (const p of [Q.N, Q.L, Q.R, Q.F]) o += at(p[0], p[1], box(0.07, 0.07, h, 0, 'wood'));
    o += '<polygon class="outline" points="' + pts([T.N, T.R, T.F, T.L]) + '"/>';
    return o;
  }
  if (lv >= 4) o += spr('cv0', -40, 16, 0.36);
  o += spr(HSPR[key] || 'dc0', 0, 19, 0.74);
  if (lv >= 4) o += spr('cv3', 40, 18, 0.34);
  if (lv >= 5) o += '<path class="pole" d="M-6 -74V-100"/><polygon class="m-gold" points="-6,-100 14,-93 -6,-86"/><circle class="m-f1" cx="-30" cy="14" r="3"/><circle class="m-f2" cx="-22" cy="18" r="3"/><circle class="m-f1" cx="34" cy="16" r="3"/>';
  return o;
}

function walkStrip(r: number, c: number) {
  const ct = tc(r, c), N: P = [ct[0], ct[1] - 16], R: P = [ct[0] + 32, ct[1]], F: P = [ct[0], ct[1] + 16], L: P = [ct[0] - 32, ct[1]], k = 0.17;
  const st = (A: P, B: P, off: P) => poly([A, B, [B[0] + off[0], B[1] + off[1]], [A[0] + off[0], A[1] + off[1]]], 'm-walk');
  let out = '';
  if (r === 2) out += st(L, F, [32 * k, -16 * k]);
  if (r === 4) out += st(N, R, [-32 * k, 16 * k]);
  if (c === 2) out += st(F, R, [-32 * k, -16 * k]);
  if (c === 4) out += st(N, L, [32 * k, 16 * k]);
  return out;
}
function gp(r: number, c: number): P { const p = tc(r, c); return [p[0], p[1] - 16]; }
function gpoly(a: P[], cls: string) { return poly(a.map((q) => gp(q[0], q[1])), cls); }
/** u theo hàng, v theo cột, trong một lô; gốc ở tâm lô. */
function tcOff(u: number, v: number): P { return [(v - 0.5) * 64 - (u - 0.5) * 64, (v - 0.5 + (u - 0.5)) * 32]; }
function fieldSVG(kind: boolean) {
  const col = kind ? ['m-f2', 'm-wb'] : ['m-rg', 'm-leaf'];
  let s = '';
  for (let i = 0; i < 6; i++) { const a = 0.08 + i * 0.14, b = a + 0.09; s += poly([tcOff(a, 0.1), tcOff(a, 0.9), tcOff(b, 0.9), tcOff(b, 0.1)], col[i % 2]); }
  return s;
}
function riverB(off: number): P[] {
  const p: P[] = [];
  const w = (x: number) => { const tp = Math.min(1, Math.max(0, (7.45 - x) / 1.6)); return tp * (0.11 * Math.sin(x * 1.9 + off * 3) + 0.06 * Math.sin(x * 4.3 + 1)); };
  for (let t = -1.6; t < 7.45; t += 0.25) p.push([t, 7.45 + off + w(t)]);
  p.push([7.45 + off, 7.45 + off]);
  for (let t = 7.2; t >= -1.7; t -= 0.25) p.push([7.45 + off + w(t + 0.7), t]);
  return p;
}
function riverP(off: number, cls: string) { return gpoly(riverB(off).concat([[9, -1.6], [9, 9], [-1.6, 9]]), cls); }
function riverLine(off: number) { return '<path class="foam2" d="M' + riverB(off).map((q) => { const g = gp(q[0], q[1]); return f1(g[0]) + ' ' + f1(g[1]); }).join(' L') + '"/>'; }

export interface CityOwner { name: string; style: HouseStyle; totalFocusMin: number; plot: PlotItem[] }

/** Toàn bộ bản đồ 7x7 của một người. pick = true thì vẽ thêm các lô đất bấm được (data-slot). */
export function plotSVG(me: CityOwner, pick = false) {
  const plot = me.plot || [], L = levelOf(me.totalFocusMin || 0), gid = 'sg' + gseq++;
  let s = '<svg viewBox="0 40 600 430" role="img" aria-label="Thành phố của ' + esc(me.name) + ', ' + esc((HST[me.style] || HST.ngoi).n) + ', giai đoạn ' + esc(L.n) + ', ' + plot.length + ' công trình">';
  s += '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--sea1)"/><stop offset="1" style="stop-color:var(--sea2)"/></linearGradient></defs><rect y="0" width="600" height="470" fill="url(#' + gid + ')"/>';
  s += '<use class="gbg" href="#bg-grass"/>' + sprc('rock', 300, 70, 0.5) + sprc('rock', 525, 128, 0.62) + sprc('pond', 110, 118, 0.6);
  for (let r = 0; r < GN; r++) for (let c = 0; c < GN; c++) {
    const ct = tc(r, c);
    if (r === 3 || c === 3) s += poly([[ct[0], ct[1] - 16], [ct[0] + 32, ct[1]], [ct[0], ct[1] + 16], [ct[0] - 32, ct[1]]], 'm-asph');
  }
  s += riverP(-0.34, 'm-sand');
  s += riverP(0, 'wat').replace('<polygon ', '<polygon fill="url(#pw)" ');
  s += riverLine(0.12).replace('foam2', 'shal') + riverLine(0.3).replace('foam2', 'shal2') + riverLine(0);
  for (let r = 0; r < GN; r++) for (let c = 0; c < GN; c++) if (r !== 3 && c !== 3) s += walkStrip(r, c);
  const ln = (r1: number, c1: number, r2: number, c2: number) => { const a = tc(r1, c1), b = tc(r2, c2); return '<path class="lane" d="M' + f1(a[0]) + ' ' + f1(a[1]) + ' L' + f1(b[0]) + ' ' + f1(b[1]) + '"/>'; };
  s += ln(3, -0.4, 3, 2.45) + ln(3, 3.55, 3, GN - 0.4) + ln(-0.4, 3, 2.45, 3) + ln(3.55, 3, GN - 0.4, 3);

  // Vật thể sắp theo độ sâu để vẽ từ sau ra trước.
  const dr: { d: number; r: number; s: string }[] = [];
  const hc = tc(1, 1);
  dr.push({ d: 2, r: 1, s: at(hc[0], hc[1], houseSVG(me.style, L.lv)) });
  // rừng thông quanh rìa phía sau và bên trái
  for (let k = -2; k <= 8; k++) {
    for (const q of [[-0.9, k + 0.2, 0], [-1.9, k + 0.7, 1]]) {
      if (q[1] < -2.4) continue;
      const p = tc(q[0], q[1]);
      dr.push({ d: q[0] + q[1], r: q[0], s: pine(p[0], p[1] + (q[2] ? 4 : 0), 0.95 + (k & 1) * 0.15) });
    }
  }
  for (let k = 0; k <= 6; k++) {
    [[k + 0.3, -0.9], [k + 0.9, -1.9]].forEach((q, j) => { const p = tc(q[0], q[1]); dr.push({ d: q[0] + q[1], r: q[0], s: k % 3 === 0 && !j ? tree(p[0], p[1], 1) : pine(p[0], p[1], 0.95) }); });
  }
  for (let k = 0; k < 4; k++) { const pq = tc(-0.9 - (k % 2) * 0.5, 7.9 + k * 0.55 - 0.2); dr.push({ d: -0.9 + 7.9 + k * 0.5, r: -0.9, s: pine(pq[0], pq[1], 0.95) }); }
  SLOTS.forEach((rc, i) => {
    if (plot.some((p) => p.s === i)) return;
    const ct = tc(rc[0], rc[1]), m = i % 6;
    if (m === 0 || m === 3) dr.push({ d: rc[0] + rc[1] - 0.2, r: rc[0], s: at(ct[0], ct[1], fieldSVG(m === 0)) });
    else {
      const bx = ((i * 13 + 5) % 19) - 9, by = ((i * 7 + 2) % 9) - 3;
      dr.push({ d: rc[0] + rc[1] - 0.3, r: rc[0], s: at(ct[0] + bx, ct[1] + by, m === 1 ? tree(0, 0, 0.7) : bush(0, 0, 0.8)) + at(ct[0] - bx * 0.6 - 6, ct[1] - by * 0.5 + 6, bush(0, 0, 0.55)) });
    }
  });
  for (const p of plot) { const rc = SLOTS[p.s]; if (!rc) continue; const ct = tc(rc[0], rc[1]); dr.push({ d: rc[0] + rc[1], r: rc[0], s: at(ct[0], ct[1], itemSVG(p.i, p.g)) }); }
  for (const q of CARS.slice(0, Math.min(CARS.length, Math.floor(plot.length / 2)))) { const ct = tc(q[0], q[1]); dr.push({ d: q[0] + q[1], r: q[0], s: at(ct[0], ct[1], carSVG(q[2], q[3])) }); }
  // hai cây cầu bắc qua sông
  const b1 = tc(3, 7.6), b2 = tc(7.6, 3);
  dr.push({ d: 14, r: 3, s: sprc('bridge', b1[0], b1[1] - 4, 0.25, false) });
  dr.push({ d: 14, r: 8, s: sprc('bridge', b2[0], b2[1] - 4, 0.25, true) });
  dr.sort((a, b) => a.d - b.d || a.r - b.r);
  for (const x of dr) s += x.s;

  if (pick) {
    SLOTS.forEach((rc, i) => {
      const ct = tc(rc[0], rc[1]), occ = plot.some((p) => p.s === i);
      s += '<g class="slot' + (occ ? ' full' : '') + '" data-slot="' + i + '" tabindex="0" role="button" aria-label="Lô đất ' + (i + 1) + (occ ? ', đang có công trình, sẽ bị thay' : '') + '"><polygon points="' + pts([[ct[0], ct[1] - 16], [ct[0] + 32, ct[1]], [ct[0], ct[1] + 16], [ct[0] - 32, ct[1]]]) + '"/></g>';
    });
  }
  return s + '</svg>';
}
