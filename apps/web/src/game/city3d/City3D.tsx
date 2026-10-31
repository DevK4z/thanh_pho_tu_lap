/* Thành phố 3D: Canvas, ánh sáng ngày/đêm, camera xoay/phóng/kéo, thanh công cụ.
   Điều khiển: kéo chuột trái để xoay, cuộn để phóng to, kéo chuột phải (hoặc hai ngón) để di chuyển. */
import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { CameraControls, Stars } from '@react-three/drei';
import type { CityOwner } from '../iso';
import { CityScene, cellPos, type HoverInfo } from './CityScene';

type TimeMode = 'auto' | 'day' | 'night';
type Quality = 'auto' | 'low' | 'high';
type View = 'overview' | 'home' | 'top';

const load = <T extends string>(k: string, d: T, ok: readonly T[]): T => {
  try { const v = localStorage.getItem(k) as T | null; return v && ok.includes(v) ? v : d; } catch { return d; }
};
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } };

const isNightNow = () => { const h = new Date().getHours(); return h < 6 || h >= 18; };
const lowEnd = () => typeof matchMedia !== 'undefined' && (matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency ?? 8) <= 4);

const [hx, hz] = cellPos(1, 1);
const VIEWS: Record<View, [number, number, number, number, number, number]> = {
  overview: [17, 16, 17, 0, 0, 0],
  home: [hx + 6, 5.5, hz + 6, hx, 0.6, hz],
  top: [0.01, 30, 0.01, 0, 0, 0],
};

/** Tự xoay quanh thành phố khi bật. */
function AutoRotate({ controls, on }: { controls: React.RefObject<CameraControls | null>; on: boolean }) {
  useFrame((_, dt) => { if (on) controls.current?.rotate(dt * 0.12, 0, false); });
  return null;
}

function Lights({ night, shadows }: { night: boolean; shadows: boolean }) {
  return night ? (
    <>
      <hemisphereLight args={['#3a4f88', '#14200f', 0.45]} />
      <directionalLight position={[-8, 14, 6]} intensity={0.55} color="#a9bcff" castShadow={shadows}
        shadow-mapSize={[1024, 1024]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} />
    </>
  ) : (
    <>
      <hemisphereLight args={['#d8ecff', '#6a8f4a', 1.15]} />
      <directionalLight position={[12, 18, 8]} intensity={2.3} color="#fff4e0" castShadow={shadows}
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} />
    </>
  );
}

const btn = 'rounded-lg border border-white/40 bg-black/45 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-black/60 aria-pressed:bg-white aria-pressed:text-black';

export default function City3D({ owner, onPick, onSwitch2D, height = 'h-[440px] sm:h-[560px]' }: {
  owner: CityOwner;
  onPick?: (slot: number) => void;
  onSwitch2D?: () => void;
  height?: string;
}) {
  const [time, setTime] = useState<TimeMode>(() => load('tptl-3d-time', 'auto', ['auto', 'day', 'night'] as const));
  const [quality, setQuality] = useState<Quality>(() => load('tptl-3d-quality', 'auto', ['auto', 'low', 'high'] as const));
  const [rotate, setRotate] = useState(() => load('tptl-3d-rotate', 'off', ['on', 'off'] as const) === 'on');
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [clockNight, setClockNight] = useState(isNightNow);
  const controls = useRef<CameraControls | null>(null);

  useEffect(() => {
    const id = setInterval(() => setClockNight(isNightNow()), 60_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => save('tptl-3d-time', time), [time]);
  useEffect(() => save('tptl-3d-quality', quality), [quality]);
  useEffect(() => save('tptl-3d-rotate', rotate ? 'on' : 'off'), [rotate]);

  const night = time === 'auto' ? clockNight : time === 'night';
  const high = quality === 'high' || (quality === 'auto' && !lowEnd());
  const go = (v: View) => { const [a, b, c, d, e, f] = VIEWS[v]; controls.current?.setLookAt(a, b, c, d, e, f, true); };
  const bg = night ? '#0b1530' : '#bfe3ff';

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl border border-line ${height}`} style={{ background: bg }}>
      <Canvas shadows={high} dpr={high ? [1, 2] : 1} camera={{ position: VIEWS.overview.slice(0, 3) as [number, number, number], fov: 35, near: 0.5, far: 200 }}
        gl={{ antialias: true }} onPointerMissed={() => setHover(null)}>
        <color attach="background" args={[bg]} />
        <fog attach="fog" args={[bg, 38, 80]} />
        <Lights night={night} shadows={high} />
        {night && <Stars radius={60} depth={20} count={1500} factor={3} fade speed={0.5} />}
        <CityScene owner={owner} night={night} onPick={onPick} onHover={setHover} />
        <CameraControls ref={controls} makeDefault minDistance={6} maxDistance={48} minPolarAngle={0.15} maxPolarAngle={1.35} smoothTime={0.35} />
        <AutoRotate controls={controls} on={rotate && !onPick} />
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-2.5">
        <div className="pointer-events-auto flex flex-wrap gap-1.5">
          {(['overview', 'home', 'top'] as const).map((v) => (
            <button key={v} type="button" className={btn} onClick={() => go(v)}>{v === 'overview' ? 'Tổng quan' : v === 'home' ? 'Nhà chính' : 'Từ trên'}</button>
          ))}
          {!onPick && <button type="button" className={btn} aria-pressed={rotate} onClick={() => setRotate((x) => !x)}>Tự xoay</button>}
        </div>
        <div className="pointer-events-auto flex flex-wrap gap-1.5">
          {(['auto', 'day', 'night'] as const).map((t) => (
            <button key={t} type="button" className={btn} aria-pressed={time === t} onClick={() => setTime(t)}>{t === 'auto' ? 'Theo giờ' : t === 'day' ? 'Ngày' : 'Đêm'}</button>
          ))}
          <button type="button" className={btn} onClick={() => setQuality(high ? 'low' : 'high')} title="Đổi chất lượng hiển thị">{high ? 'Đẹp' : 'Nhẹ'}</button>
          {onSwitch2D && <button type="button" className={btn} onClick={onSwitch2D}>2D</button>}
        </div>
      </div>
      {hover && (
        <div className="pointer-events-none absolute left-1/2 top-14 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-sm font-semibold text-white">{hover.label}</div>
      )}
      <p className="pointer-events-none absolute inset-x-0 bottom-0 p-2 text-center text-[11px] text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">
        {onPick ? 'Bấm vào lô đất phát sáng để xây · ' : ''}Kéo để xoay · Cuộn để phóng to · Chuột phải hoặc hai ngón để di chuyển
      </p>
    </div>
  );
}
