/* Biểu đồ cột và đường bằng SVG; màu và nét lấy từ class trong game.css (.bar, .sl, .s1–.s3). */
import { niceMax } from '../lib/format';

export function BarChart({ labels, vals, label }: { labels: string[]; vals: number[]; label: string }) {
  const W = 420, H = 190, L = 34, R = 8, T = 12, B = 26;
  const mx = niceMax(Math.max(10, ...vals));
  const iw = W - L - R, ih = H - T - B, bw = iw / vals.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {[0, 0.5, 1].map((f) => {
        const y = T + ih * (1 - f);
        return (
          <g key={f}>
            <line className="gl" x1={L} x2={W - R} y1={y} y2={y} />
            <text className="tx" x={L - 6} y={y + 4} textAnchor="end">{Math.round(mx * f)}</text>
          </g>
        );
      })}
      {vals.map((v, i) => {
        const h = (ih * v) / mx;
        return (
          <g key={i}>
            <rect className="bar" x={L + i * bw + bw * 0.18} y={T + ih - h} width={bw * 0.64} height={Math.max(h, v > 0 ? 2 : 0)} rx={2} />
            {(vals.length - 1 - i) % 2 === 0 && <text className="tx" x={L + i * bw + bw / 2} y={H - 8} textAnchor="middle">{labels[i]}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export interface Series { vals: (number | null)[]; cls: 's1' | 's2' | 's3' }

/** Đường theo thang 0–100; giá trị null làm đứt đoạn. */
export function LineChart({ labels, series, label }: { labels: string[]; series: Series[]; label: string }) {
  const W = 420, H = 200, L = 34, R = 14, T = 12, B = 26, n = labels.length;
  const iw = W - L - R, ih = H - T - B;
  const X = (i: number) => (n > 1 ? L + (iw * i) / (n - 1) : L + iw / 2);
  const Y = (v: number) => T + ih * (1 - v / 100);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line className="gl" x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} />
          <text className="tx" x={L - 6} y={Y(v) + 4} textAnchor="end">{v}</text>
        </g>
      ))}
      {labels.map((lb, i) => (n <= 7 || (n - 1 - i) % 2 === 0) && <text key={i} className="tx" x={X(i)} y={H - 8} textAnchor="middle">{lb}</text>)}
      {series.map((se, si) => {
        const segs: [number, number][][] = [];
        let cur: [number, number][] = [];
        se.vals.forEach((v, i) => {
          if (v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([X(i), Y(v)]);
        });
        if (cur.length) segs.push(cur);
        let last = -1;
        se.vals.forEach((v, i) => { if (v != null) last = i; });
        return (
          <g key={si}>
            {segs.filter((s) => s.length > 1).map((s, k) => <polyline key={k} className={'sl ' + se.cls} points={s.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')} />)}
            {se.vals.map((v, i) => v != null && <circle key={i} className={se.cls.replace('s', 'pt')} cx={X(i)} cy={Y(v)} r={i === last ? 5 : 2.8} />)}
          </g>
        );
      })}
    </svg>
  );
}

export function Legend({ items }: { items: [Series['cls'], string][] }) {
  return (
    <div className="legend">
      {items.map(([c, t]) => <span key={c}><i className={c} style={{ color: `var(--c${c[1]})` }} />{t}</span>)}
    </div>
  );
}
