/* Chu kỳ ngày đêm liên tục cho thành phố 3D.
   Giờ trong cảnh là một số thực 0–24. Mỗi khung hình: trộn ánh sáng, màu sương, màu trời theo trọng số ngày / hoàng hôn / đêm
   suy ra từ giờ, di chuyển mặt trời và mặt trăng trên vòm trời. Đổi chế độ thì giờ chạy xuôi tới giờ đích trong vài giây
   (ví dụ từ ngày sang đêm sẽ đi qua hoàng hôn); đổi thời tiết cũng chuyển dần. Không gây vẽ lại React mỗi khung hình. */
import { useEffect, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { Weather } from './effects';
import { glow } from './parts';

export type Phase = 'day' | 'dusk' | 'night';
export const PHASES: Phase[] = ['day', 'dusk', 'night'];
export const WEATHERS: Weather[] = ['clear', 'rain', 'snow'];

/** Màu trời (gradient CSS sau canvas trong suốt) và màu sương khớp chân trời, theo thời tiết và thời điểm. */
export const SKY: Record<Weather, Record<Phase, { bg: string; fog: string }>> = {
  clear: {
    day: { bg: 'linear-gradient(180deg,#5aaef0 0%,#9fd4fb 45%,#dff1ff 100%)', fog: '#cfe8fb' },
    dusk: { bg: 'linear-gradient(180deg,#2e3a78 0%,#8a5b9c 32%,#e2788a 60%,#f8b56f 85%,#ffd9a0 100%)', fog: '#e8a08f' },
    night: { bg: 'linear-gradient(180deg,#03081a 0%,#0a1433 55%,#1a2c5c 100%)', fog: '#0f1c3d' },
  },
  rain: {
    day: { bg: 'linear-gradient(180deg,#5d6876 0%,#8c97a4 50%,#b9c2cc 100%)', fog: '#a7b1bc' },
    dusk: { bg: 'linear-gradient(180deg,#2f3343 0%,#5d5867 50%,#8c7f84 100%)', fog: '#6f6a74' },
    night: { bg: 'linear-gradient(180deg,#05070d 0%,#111725 60%,#20283a 100%)', fog: '#1a2030' },
  },
  snow: {
    day: { bg: 'linear-gradient(180deg,#a9bacb 0%,#d3dde8 50%,#f2f6fa 100%)', fog: '#e3eaf1' },
    dusk: { bg: 'linear-gradient(180deg,#56607e 0%,#a58fa6 50%,#e9c9c0 100%)', fog: '#c9b2b5' },
    night: { bg: 'linear-gradient(180deg,#0b1222 0%,#1d2a45 60%,#3a4a6a 100%)', fog: '#2c3a56' },
  },
};

/** Ánh sáng mốc của từng thời điểm (trời quang). */
const LIGHT: Record<Phase, { sky: string; ground: string; hemi: number; sun: string; sunI: number }> = {
  day: { sky: '#d8ecff', ground: '#6a8f4a', hemi: 1.1, sun: '#fff1d6', sunI: 2.4 },
  dusk: { sky: '#ffcfb0', ground: '#4a3f63', hemi: 0.85, sun: '#ffab6b', sunI: 2.1 },
  night: { sky: '#3a4f88', ground: '#14200f', hemi: 0.45, sun: '#a9bcff', sunI: 0.55 },
};
/** Mây che bớt nắng: hệ số độ sáng theo thời tiết. */
const DIM: Record<Weather, number> = { clear: 1, rain: 0.45, snow: 0.75 };

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Trọng số [ngày, hoàng hôn, đêm] theo giờ (tổng bằng 1): bình minh 4h30–7h, chiều tà 16h30–20h. */
export function phaseWeights(h: number): [number, number, number] {
  h = ((h % 24) + 24) % 24;
  let day: number, night: number;
  if (h < 12) { night = 1 - smooth(4.5, 5.6, h); day = smooth(5.6, 7, h); }
  else { day = 1 - smooth(16.5, 18, h); night = smooth(18.3, 20, h); }
  const dusk = Math.max(0, 1 - day - night);
  return [day, dusk, night];
}
export const dominantPhase = (h: number): Phase => { const w = phaseWeights(h); return PHASES[w.indexOf(Math.max(...w))]; };

/** Hướng mặt trời: mọc phía đông lúc 5h30, lên cao giữa trưa, lặn phía tây lúc 19h. */
function sunDir(h: number, out: THREE.Vector3) {
  const a = ((Math.min(19, Math.max(5.5, h)) - 5.5) / 13.5) * Math.PI;
  return out.set(Math.cos(a) * 0.85, Math.max(0.12, Math.sin(a)), -0.45).normalize();
}
/** Hướng mặt trăng: mọc 19h, cao nhất khoảng 0h, lặn 5h30. */
function moonDir(h: number, out: THREE.Vector3) {
  const k = (((h - 19) % 24) + 24) % 24;
  const a = (Math.min(10.5, k) / 10.5) * Math.PI;
  return out.set(-Math.cos(a) * 0.7, Math.max(0.25, Math.sin(a)), -0.6).normalize();
}

/** Khoảng cách có dấu từ giờ `from` tới `to`: thường đi xuôi (kể cả qua đêm), chỉ đi lùi khi đích ở phía sau dưới 6 tiếng. */
export function hourStep(from: number, to: number) {
  const a = (((to - from) % 24) + 24) % 24;
  return a > 18 ? a - 24 : a;
}

const tmp = { a: new THREE.Color(), b: new THREE.Color(), c: new THREE.Color(), v: new THREE.Vector3(), m: new THREE.Vector3() };
/** Trộn ba màu theo trọng số. */
function mix3(out: THREE.Color, cols: string[], w: number[]) {
  out.setRGB(0, 0, 0);
  cols.forEach((c, i) => { tmp.c.set(c); out.r += tmp.c.r * w[i]; out.g += tmp.c.g * w[i]; out.b += tmp.c.b * w[i]; });
  return out;
}

export interface DayCycleProps {
  /** Giờ đích (0–24). */
  hour: number;
  weather: Weather;
  shadows: boolean;
  /** Các lớp nền trời CSS, khóa `${weather}-${phase}`; độ mờ được đặt trực tiếp mỗi khung hình. */
  layers: RefObject<Record<string, HTMLDivElement | null>>;
  /** Báo thời điểm nổi trội khi nó đổi (để bật đèn, đom đóm…). */
  onPhase: (p: Phase) => void;
  /** Thời gian chuyển khi đổi chế độ, giây. */
  seconds?: number;
}

export function DayCycle({ hour, weather, shadows, layers, onPhase, seconds = 3 }: DayCycleProps) {
  const scene = useThree((s) => s.scene);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const sunMesh = useRef<THREE.Group>(null);
  const moonMesh = useRef<THREE.Group>(null);
  const stars = useRef<THREE.Group>(null);
  const cur = useRef(hour);
  const rate = useRef(1);
  const ww = useRef<Record<Weather, number>>({ clear: weather === 'clear' ? 1 : 0, rain: weather === 'rain' ? 1 : 0, snow: weather === 'snow' ? 1 : 0 });
  const phase = useRef<Phase>(dominantPhase(hour));

  // Giờ đích đổi: tính tốc độ để đi hết quãng đường trong `seconds` giây.
  useEffect(() => { rate.current = Math.max(Math.abs(hourStep(cur.current, hour)) / seconds, 0.02); }, [hour, seconds]);
  useEffect(() => { onPhase(phase.current); return () => { glow.value = -1; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    // Chạy giờ tới đích.
    const step = hourStep(cur.current, hour);
    if (Math.abs(step) > 1e-3) cur.current = (cur.current + Math.sign(step) * Math.min(Math.abs(step), rate.current * dt) + 24) % 24;
    const h = cur.current;
    // Thời tiết chuyển dần.
    for (const k of WEATHERS) ww.current[k] += ((k === weather ? 1 : 0) - ww.current[k]) * Math.min(1, dt * 1.2);
    const W = ww.current;
    const w = phaseWeights(h);
    const dim = W.clear * DIM.clear + W.rain * DIM.rain + W.snow * DIM.snow;

    if (hemi.current) {
      mix3(hemi.current.color, PHASES.map((p) => LIGHT[p].sky), w);
      mix3(hemi.current.groundColor, PHASES.map((p) => LIGHT[p].ground), w);
      hemi.current.intensity = PHASES.reduce((s, p, i) => s + LIGHT[p].hemi * w[i], 0) * (0.5 + dim / 2);
    }
    if (sun.current) {
      mix3(sun.current.color, PHASES.map((p) => LIGHT[p].sun), w);
      sun.current.intensity = PHASES.reduce((s, p, i) => s + LIGHT[p].sunI * w[i], 0) * dim;
      // Nguồn sáng chính đi từ mặt trời sang mặt trăng theo trọng số đêm (bóng đổ xoay dần, không nhảy).
      sunDir(h, tmp.v); moonDir(h, tmp.m);
      tmp.v.lerp(tmp.m, w[2]).normalize();
      sun.current.position.copy(tmp.v).multiplyScalar(22);
    }
    // Mặt trời, mặt trăng trên vòm trời: mờ dần khi mây che hoặc khi chuyển thời điểm.
    const sunVis = (1 - w[2]) * W.clear, moonVis = w[2] * (W.clear + W.snow * 0.8);
    if (sunMesh.current) {
      sunDir(h, tmp.v);
      sunMesh.current.position.copy(tmp.v).multiplyScalar(62);
      sunMesh.current.visible = sunVis > 0.02;
      const big = 1 + w[1] * 0.35;
      sunMesh.current.scale.setScalar(big);
      sunMesh.current.children.forEach((c, i) => {
        const mat = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mix3(mat.color, ['#fff6cf', '#ffb15e', '#ffb15e'], w);
        mat.opacity = sunVis * (i ? 0.18 : 1);
      });
    }
    if (moonMesh.current) {
      moonDir(h, tmp.m);
      moonMesh.current.position.copy(tmp.m).multiplyScalar(60);
      moonMesh.current.visible = moonVis > 0.02;
      moonMesh.current.children.forEach((c, i) => { ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = moonVis * (i === 1 ? 0.16 : 1); });
    }
    if (stars.current) stars.current.visible = (w[2] + w[1] * 0.3) * W.clear > 0.25;

    // Sương mù: màu trộn theo thời điểm và thời tiết, gần hơn khi mưa tuyết.
    if (scene.fog instanceof THREE.Fog) {
      const f = scene.fog;
      f.color.setRGB(0, 0, 0);
      for (const k of WEATHERS) PHASES.forEach((p, i) => { tmp.c.set(SKY[k][p].fog); const x = W[k] * w[i]; f.color.r += tmp.c.r * x; f.color.g += tmp.c.g * x; f.color.b += tmp.c.b * x; });
      f.near = 40 - 14 * (1 - W.clear);
      f.far = 95 - 25 * (1 - W.clear);
    }
    // Nền trời CSS: chỉnh độ mờ từng lớp (không vẽ lại React).
    const L = layers.current;
    if (L) for (const k of WEATHERS) PHASES.forEach((p, i) => { const el = L[`${k}-${p}`]; if (el) el.style.opacity = String(W[k] * w[i]); });

    // Đèn, cửa sổ sáng dần từ chiều tà; trời mưa tuyết ban ngày cũng hơi sáng đèn.
    glow.value = Math.min(1, w[2] + w[1] * 0.75 + (1 - W.clear) * 0.25 * w[0]);
    glow.night = w[2];
    const dp = PHASES[w.indexOf(Math.max(...w))];
    if (dp !== phase.current) { phase.current = dp; onPhase(dp); }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={[LIGHT.day.sky, LIGHT.day.ground, 1]} />
      <directionalLight ref={sun} position={[12, 18, 8]} intensity={2} castShadow={shadows}
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-radius={5}
        shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={16} shadow-camera-bottom={-16} shadow-camera-far={60} />
      <group ref={sunMesh}>
        <mesh><sphereGeometry args={[3, 32, 24]} /><meshBasicMaterial transparent fog={false} toneMapped={false} /></mesh>
        <mesh><sphereGeometry args={[5.4, 32, 24]} /><meshBasicMaterial transparent depthWrite={false} fog={false} toneMapped={false} /></mesh>
      </group>
      <group ref={moonMesh}>
        <mesh><sphereGeometry args={[2.4, 32, 24]} /><meshBasicMaterial color="#f4f1dc" transparent fog={false} toneMapped={false} /></mesh>
        <mesh><sphereGeometry args={[4.2, 32, 24]} /><meshBasicMaterial color="#f4f1dc" transparent depthWrite={false} fog={false} toneMapped={false} /></mesh>
        <mesh position={[0.7, 0.5, 1]}><sphereGeometry args={[0.55, 16, 12]} /><meshBasicMaterial color="#d9d5bd" transparent fog={false} /></mesh>
      </group>
      <group ref={stars}><Stars radius={70} depth={25} count={2200} factor={3.5} fade speed={0.6} /></group>
    </>
  );
}
