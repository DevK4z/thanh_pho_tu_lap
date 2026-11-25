/* Linh vật của trang Nhiệm vụ trong ngày: 4 chủ đề, mỗi chủ đề 6 giai đoạn (0 đến 5) lớn dần theo tỷ lệ việc đã xong.
   Vẽ bằng SVG nét viền tròn, khung 120 x 120. */
import { useId, type ReactNode } from 'react';
import type { PetTheme } from '@tptl/shared';

const O = '#4b3f5c'; // màu nét viền
const SW = 2.6;
const line = { stroke: O, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

const Shadow = ({ w = 30, y = 108 }: { w?: number; y?: number }) => <ellipse cx="60" cy={y} rx={w} ry="4.5" fill="#000" opacity=".09" />;
/** Ngôi sao lấp lánh 4 cánh. */
const Spark = ({ x, y, s = 6, c = '#f6c344' }: { x: number; y: number; s?: number; c?: string }) => (
  <path d={`M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`} fill={c} stroke="#e0a400" strokeWidth=".8" />
);
const Sparks = () => <><Spark x={18} y={22} /><Spark x={102} y={24} s={7} /><Spark x={106} y={58} s={4.5} /></>;
const Heart = ({ x, y, s = 1, c = '#f37ea6' }: { x: number; y: number; s?: number; c?: string }) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 3C-6-3-3-8 0-4.5C3-8 6-3 0 3Z" fill={c} />
);
/** Ngôi sao 5 cánh. */
function starPath(cx: number, cy: number, r: number) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1);
  }
  return d + 'Z';
}

/* ---------------- Mèo tím ---------------- */
const CAT = { body: '#ab9ddb', light: '#efe9fc', ear: '#f4b9d0', cheek: '#f6a3c0' };
type Eyes = 'open' | 'closed' | 'happy';
function CatHead({ x, y, r, eyes }: { x: number; y: number; r: number; eyes: Eyes }) {
  const ex = r * 0.4, ey = y + r * 0.02;
  const earL = `M${x - r * 0.9} ${y - r * 0.25}L${x - r * 0.72} ${y - r * 1.12}L${x - r * 0.15} ${y - r * 0.78}Z`;
  const earR = `M${x + r * 0.9} ${y - r * 0.25}L${x + r * 0.72} ${y - r * 1.12}L${x + r * 0.15} ${y - r * 0.78}Z`;
  return (
    <g>
      <path d={earL} fill={CAT.body} {...line} />
      <path d={earR} fill={CAT.body} {...line} />
      <path d={`M${x - r * 0.72} ${y - r * 0.45}L${x - r * 0.64} ${y - r * 0.92}L${x - r * 0.35} ${y - r * 0.72}Z`} fill={CAT.ear} />
      <path d={`M${x + r * 0.72} ${y - r * 0.45}L${x + r * 0.64} ${y - r * 0.92}L${x + r * 0.35} ${y - r * 0.72}Z`} fill={CAT.ear} />
      <ellipse cx={x} cy={y} rx={r} ry={r * 0.86} fill={CAT.body} {...line} />
      <ellipse cx={x} cy={y + r * 0.3} rx={r * 0.48} ry={r * 0.32} fill={CAT.light} />
      {eyes === 'open' && <><circle cx={x - ex} cy={ey} r={r * 0.12} fill={O} /><circle cx={x + ex} cy={ey} r={r * 0.12} fill={O} />
        <circle cx={x - ex + r * 0.04} cy={ey - r * 0.05} r={r * 0.04} fill="#fff" /><circle cx={x + ex + r * 0.04} cy={ey - r * 0.05} r={r * 0.04} fill="#fff" /></>}
      {eyes === 'closed' && <path d={`M${x - ex - r * 0.13} ${ey}q${r * 0.13} ${r * 0.12} ${r * 0.26} 0M${x + ex - r * 0.13} ${ey}q${r * 0.13} ${r * 0.12} ${r * 0.26} 0`} fill="none" {...line} />}
      {eyes === 'happy' && <path d={`M${x - ex - r * 0.13} ${ey + r * 0.04}q${r * 0.13} ${-r * 0.16} ${r * 0.26} 0M${x + ex - r * 0.13} ${ey + r * 0.04}q${r * 0.13} ${-r * 0.16} ${r * 0.26} 0`} fill="none" {...line} />}
      <path d={`M${x - r * 0.14} ${y + r * 0.26}q${r * 0.07} ${r * 0.1} ${r * 0.14} 0q${r * 0.07} ${r * 0.1} ${r * 0.14} 0`} fill="none" {...line} strokeWidth={SW * 0.8} />
      <ellipse cx={x - r * 0.62} cy={y + r * 0.24} rx={r * 0.15} ry={r * 0.09} fill={CAT.cheek} opacity=".75" />
      <ellipse cx={x + r * 0.62} cy={y + r * 0.24} rx={r * 0.15} ry={r * 0.09} fill={CAT.cheek} opacity=".75" />
    </g>
  );
}
function CatSitting({ x, y, r, eyes = 'open', collar, beret }: { x: number; y: number; r: number; eyes?: Eyes; collar?: boolean; beret?: boolean }) {
  const by = y + r * 1.25;
  return (
    <g>
      <path d={`M${x + r * 0.7} ${by + r * 0.5}q${r * 0.9} ${-r * 0.1} ${r * 0.75} ${-r * 0.95}`} fill="none" stroke={O} strokeWidth={r * 0.36} strokeLinecap="round" />
      <path d={`M${x + r * 0.7} ${by + r * 0.5}q${r * 0.9} ${-r * 0.1} ${r * 0.75} ${-r * 0.95}`} fill="none" stroke={CAT.body} strokeWidth={r * 0.36 - SW * 2} strokeLinecap="round" />
      <ellipse cx={x} cy={by} rx={r * 0.88} ry={r * 0.82} fill={CAT.body} {...line} />
      <ellipse cx={x} cy={by + r * 0.1} rx={r * 0.5} ry={r * 0.58} fill={CAT.light} />
      <ellipse cx={x - r * 0.35} cy={by + r * 0.72} rx={r * 0.22} ry={r * 0.15} fill={CAT.light} {...line} />
      <ellipse cx={x + r * 0.35} cy={by + r * 0.72} rx={r * 0.22} ry={r * 0.15} fill={CAT.light} {...line} />
      <CatHead x={x} y={y} r={r} eyes={eyes} />
      {collar && <>
        <path d={`M${x - r * 0.55} ${y + r * 0.78}q${r * 0.55} ${r * 0.32} ${r * 1.1} 0`} fill="none" stroke="#f37ea6" strokeWidth={r * 0.16} strokeLinecap="round" />
        <circle cx={x} cy={y + r * 1.0} r={r * 0.13} fill="#f6c344" {...line} strokeWidth={SW * 0.7} />
      </>}
      {beret && <>
        <ellipse cx={x + r * 0.15} cy={y - r * 0.78} rx={r * 0.72} ry={r * 0.26} fill="#6b5aa8" {...line} transform={`rotate(-10 ${x} ${y - r * 0.78})`} />
        <circle cx={x + r * 0.2} cy={y - r * 1.06} r={r * 0.1} fill="#6b5aa8" {...line} strokeWidth={SW * 0.7} />
      </>}
    </g>
  );
}
const Bed = () => <>
  <ellipse cx="60" cy="96" rx="36" ry="11" fill="#cfc4f0" {...line} />
  <ellipse cx="60" cy="93" rx="27" ry="6" fill="#ebe5fb" />
</>;
function Cat({ stage }: { stage: number }) {
  switch (stage) {
    case 0: return <><Shadow w={36} /><Bed /><Spark x={36} y={66} s={5} c="#c7b6f2" /><Spark x={82} y={58} s={6} c="#c7b6f2" /></>;
    case 1: return <><Shadow w={36} /><Bed />
      <path d="M38 90q-10-4 2-8" fill="none" stroke={O} strokeWidth="8" strokeLinecap="round" /><path d="M38 90q-10-4 2-8" fill="none" stroke={CAT.body} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="64" cy="84" rx="25" ry="12" fill={CAT.body} {...line} />
      <CatHead x={50} y={77} r={13} eyes="closed" />
      <text x="74" y="62" fontSize="11" fontWeight="700" fill="#8f82c2">z</text><text x="82" y="54" fontSize="8" fontWeight="700" fill="#8f82c2">z</text></>;
    case 2: return <><Shadow w={28} />
      <circle cx="86" cy="96" r="9" fill="#d3c5f5" {...line} /><path d="M79 92q7 3 14-1M80 99q6-4 12 2" fill="none" stroke={O} strokeWidth="1.4" />
      <CatSitting x={54} y={60} r={16} /></>;
    case 3: return <><Shadow /><CatSitting x={60} y={46} r={20} collar /></>;
    case 4: return <><Shadow w={40} />
      <path d="M14 82Q60 128 106 82Q60 104 14 82Z" fill="#ffe08a" {...line} />
      <CatSitting x={60} y={36} r={18} eyes="happy" collar />
      <Spark x={20} y={40} s={5} c="#c7b6f2" /><Spark x={100} y={34} s={6} c="#c7b6f2" /></>;
    default: return <>
      <g fill="#f3efff" {...line}><circle cx="34" cy="98" r="12" /><circle cx="52" cy="92" r="15" /><circle cx="72" cy="93" r="14" /><circle cx="88" cy="99" r="11" /></g>
      <rect x="24" y="96" width="72" height="12" fill="#f3efff" />
      <CatSitting x={60} y={38} r={18} eyes="happy" collar beret />
      <Sparks /><Spark x={16} y={64} s={4} c="#c7b6f2" /></>;
  }
}

/* ---------------- Cây anh đào ---------------- */
const Soil = () => <path d="M24 102Q60 82 96 102Z" fill="#8b5e3c" {...line} />;
const Trunk = ({ w = 10, top = 62 }: { w?: number; top?: number }) => <path d={`M${60 - w / 2} 98L${60 - w / 3} ${top}H${60 + w / 3}L${60 + w / 2} 98Z`} fill="#7a5134" {...line} />;
function Blossom({ x, y, r = 4.5 }: { x: number; y: number; r?: number }) {
  return <g>{[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={x + r * 0.7 * Math.cos((a * Math.PI) / 180)} cy={y + r * 0.7 * Math.sin((a * Math.PI) / 180)} r={r * 0.55} fill="#fbd3e3" stroke="#e57aa6" strokeWidth=".8" />)}<circle cx={x} cy={y} r={r * 0.3} fill="#f6c344" /></g>;
}
function Canopy({ pink }: { pink?: boolean }) {
  const a = pink ? '#f7b8d2' : '#72be5e', b = pink ? '#f29cc0' : '#5aa74a';
  return <g {...line}>
    <circle cx="40" cy="60" r="17" fill={b} /><circle cx="80" cy="60" r="17" fill={b} /><circle cx="60" cy="42" r="25" fill={a} />
    <circle cx="48" cy="34" r="6" fill="#fff" opacity=".35" stroke="none" />
  </g>;
}
function Tree({ stage }: { stage: number }) {
  switch (stage) {
    case 0: return <><Shadow w={34} /><Soil /><ellipse cx="60" cy="90" rx="8" ry="5.5" fill="#5b3c25" {...line} /><ellipse cx="57" cy="88.5" rx="2.5" ry="1.4" fill="#fff" opacity=".35" /></>;
    case 1: return <><Shadow w={34} /><Soil />
      <path d="M60 94Q58 82 60 72" fill="none" {...line} stroke="#3f7d35" strokeWidth="4" />
      <ellipse cx="51" cy="72" rx="9" ry="5" fill="#86cf70" {...line} transform="rotate(-25 51 72)" />
      <ellipse cx="69" cy="70" rx="9" ry="5" fill="#86cf70" {...line} transform="rotate(25 69 70)" /></>;
    case 2: return <><Shadow w={34} /><Soil /><Trunk w={7} top={50} />
      <path d="M58 70L46 58M62 62L74 50" fill="none" {...line} stroke="#7a5134" strokeWidth="4" />
      {[[44, 54, -30], [76, 46, 30], [60, 44, 0], [50, 66, -50], [72, 62, 50]].map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx="8" ry="5" fill="#86cf70" {...line} transform={`rotate(${r} ${x} ${y})`} />)}</>;
    case 3: return <><Shadow w={34} /><Soil /><Trunk /><Canopy /></>;
    case 4: return <><Shadow w={34} /><Soil /><Trunk /><Canopy />
      {[[46, 40], [66, 30], [74, 52], [44, 62], [58, 54], [82, 64]].map(([x, y], i) => <Blossom key={i} x={x} y={y} />)}</>;
    default: return <><Shadow w={36} /><Soil /><Trunk /><Canopy pink />
      {[[46, 38], [64, 28], [76, 48], [42, 60], [58, 50], [80, 64], [52, 26], [36, 50]].map(([x, y], i) => <Blossom key={i} x={x} y={y} r={5} />)}
      <ellipse cx="22" cy="86" rx="3" ry="2" fill="#f7b8d2" transform="rotate(30 22 86)" /><ellipse cx="100" cy="92" rx="3" ry="2" fill="#f7b8d2" transform="rotate(-20 100 92)" /><ellipse cx="94" cy="80" rx="2.5" ry="1.6" fill="#f29cc0" />
      <Sparks /></>;
  }
}

/* ---------------- Gà con ---------------- */
const CHICK = { y: '#ffd23f', light: '#fff1a8', beak: '#f59a23' };
const Egg = ({ crack }: { crack?: boolean }) => <>
  <ellipse cx="60" cy="68" rx="27" ry="34" fill="#fffaf0" {...line} />
  <path d="M72 46q8 10 7 26" fill="none" stroke="#efe3cc" strokeWidth="5" strokeLinecap="round" />
  {crack && <path d="M40 60l7 6 6-8 7 9 6-8 6 7 7-5" fill="none" {...line} />}
</>;
function ChickFace({ x, y, r, happy }: { x: number; y: number; r: number; happy?: boolean }) {
  return <g>
    {happy ? <path d={`M${x - r * 0.48} ${y}q${r * 0.12} ${-r * 0.16} ${r * 0.24} 0M${x + r * 0.24} ${y}q${r * 0.12} ${-r * 0.16} ${r * 0.24} 0`} fill="none" {...line} />
      : <><circle cx={x - r * 0.36} cy={y} r={r * 0.1} fill={O} /><circle cx={x + r * 0.36} cy={y} r={r * 0.1} fill={O} /></>}
    <path d={`M${x - r * 0.16} ${y + r * 0.16}L${x + r * 0.16} ${y + r * 0.16}L${x} ${y + r * 0.38}Z`} fill={CHICK.beak} {...line} strokeWidth={SW * 0.7} />
    <ellipse cx={x - r * 0.62} cy={y + r * 0.26} rx={r * 0.14} ry={r * 0.08} fill="#f6a3a3" opacity=".8" />
    <ellipse cx={x + r * 0.62} cy={y + r * 0.26} rx={r * 0.14} ry={r * 0.08} fill="#f6a3a3" opacity=".8" />
  </g>;
}
const ShellBottom = ({ top = 66 }: { top?: number }) => (
  <path d={`M33 ${top}l7 -7 6 7 7 -8 7 8 7 -8 7 8 6 -7 7 7C93 ${top + 26} 80 102 60 102S27 ${top + 26} 33 ${top}Z`} fill="#fffaf0" {...line} />
);
function Chick({ stage }: { stage: number }) {
  switch (stage) {
    case 0: return <><Shadow w={26} /><Egg /></>;
    case 1: return <><Shadow w={26} /><Egg crack /></>;
    case 2: return <><Shadow w={26} />
      <circle cx="60" cy="62" r="20" fill={CHICK.y} {...line} /><ChickFace x={60} y={60} r={20} />
      <ShellBottom /></>;
    case 3: return <><Shadow w={28} />
      <circle cx="60" cy="56" r="24" fill={CHICK.y} {...line} /><ChickFace x={60} y={54} r={24} />
      <path d="M40 38l6 -6 6 6 6 -7 6 7 6 -6 6 6C78 22 70 16 60 16S40 22 40 38Z" fill="#fffaf0" {...line} transform="rotate(-12 60 30)" />
      <ShellBottom top={72} /></>;
    case 4: return <><Shadow w={28} />
      <path d="M48 98v6m-4 0h8M72 98v6m-4 0h8" fill="none" {...line} stroke={CHICK.beak} strokeWidth="3.4" />
      <ellipse cx="60" cy="68" rx="29" ry="31" fill={CHICK.y} {...line} />
      <ellipse cx="60" cy="78" rx="17" ry="15" fill={CHICK.light} />
      <path d="M32 72q-6 6 2 12" fill={CHICK.y} {...line} /><path d="M88 72q6 6 -2 12" fill={CHICK.y} {...line} />
      <path d="M58 38q-2 -8 4 -10q-1 5 3 7" fill={CHICK.y} {...line} />
      <ChickFace x={60} y={58} r={22} /></>;
    default: return <><Shadow w={30} />
      <path d="M48 98v6m-4 0h8M72 98v6m-4 0h8" fill="none" {...line} stroke={CHICK.beak} strokeWidth="3.4" />
      <path d="M33 66q-16 -6 -14 -18q8 4 16 6" fill={CHICK.y} {...line} /><path d="M87 66q16 -6 14 -18q-8 4 -16 6" fill={CHICK.y} {...line} />
      <ellipse cx="60" cy="68" rx="29" ry="31" fill={CHICK.y} {...line} />
      <ellipse cx="60" cy="78" rx="17" ry="15" fill={CHICK.light} />
      <path d="M54 39q-4 -10 3 -12q0 6 3 6q0 -8 6 -9q-2 7 0 13" fill="#ffb627" {...line} />
      <ChickFace x={60} y={58} r={22} happy />
      <Heart x={92} y={34} s={1.2} /><Sparks /></>;
  }
}

/* ---------------- Hũ sao ---------------- */
const JAR_STARS: [number, number, number][] = [
  [52, 92, 7], [70, 93, 7], [42, 84, 6], [61, 83, 7], [79, 84, 6], [51, 74, 7], [70, 74, 7], [41, 66, 6],
  [60, 64, 7], [80, 66, 6], [49, 55, 6], [70, 55, 7], [59, 46, 6], [42, 47, 5], [79, 46, 5],
];
const JAR_COUNT = [0, 1, 3, 6, 10, 15];
function StarJar({ stage }: { stage: number }) {
  const clip = useId();
  const n = JAR_COUNT[stage] ?? 0;
  return <>
    <Shadow w={34} />
    {stage === 5 && <circle cx="60" cy="66" r="44" fill="#ffe9a8" opacity=".55" />}
    <defs><clipPath id={clip}><rect x="31" y="34" width="58" height="68" rx="14" /></clipPath></defs>
    <rect x="30" y="33" width="60" height="70" rx="15" fill="#e3f0ff" {...line} stroke="#5b7fb5" />
    <g clipPath={`url(#${clip})`}>{JAR_STARS.slice(0, n).map(([x, y, r], i) => <path key={i} d={starPath(x, y, r)} fill="#ffd23f" stroke="#e0a400" strokeWidth="1.2" strokeLinejoin="round" />)}</g>
    <path d="M38 44v40" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".8" />
    <rect x="34" y="22" width="52" height="13" rx="4" fill="#9cc0ee" {...line} stroke="#5b7fb5" />
    <path d="M40 26h28" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".7" />
    {stage === 5 && <><g transform="translate(60 18)">{[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-5" rx="3.5" ry="5.5" fill="#f7a8c7" stroke="#e57aa6" strokeWidth=".8" transform={`rotate(${a})`} />)}<circle r="3" fill="#ffd23f" /></g><Sparks /></>}
  </>;
}

const DRAW: Record<PetTheme, (p: { stage: number }) => ReactNode> = { meo: Cat, cay: Tree, ga: Chick, hu_sao: StarJar };

export function Pet({ theme, stage, className, label }: { theme: PetTheme; stage: number; className?: string; label?: string }) {
  const D = DRAW[theme] ?? Cat;
  return (
    <svg viewBox="0 0 120 120" className={className} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <D stage={Math.max(0, Math.min(5, stage))} />
    </svg>
  );
}
