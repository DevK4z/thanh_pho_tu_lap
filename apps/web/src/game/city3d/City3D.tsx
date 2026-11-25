/* Thành phố 3D: Canvas, ánh sáng ngày/đêm, camera xoay/phóng/kéo, thanh công cụ.
   Điều khiển: kéo chuột trái để xoay, cuộn để phóng to, kéo chuột phải (hoặc hai ngón) để di chuyển. */
import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { CameraControls, Environment, Lightformer, Stars } from '@react-three/drei';
import type * as THREE from 'three';
import { HST, ITEMS, POP, TIERS, levelOf } from '@tptl/shared';
import type { CityOwner } from '../iso';
import { CityScene, cellPos, type HoverInfo, type Selected } from './CityScene';
import { seasonWeather, type Weather } from './effects';

type TimeMode = 'auto' | 'day' | 'dusk' | 'night';
type Phase = 'day' | 'dusk' | 'night';
type WeatherMode = 'auto' | Weather;

const WEATHER_LABEL: Record<Weather, string> = { clear: '☀️ Nắng', rain: '🌧️ Mưa', snow: '❄️ Tuyết' };
const WEATHER_NEXT: Record<WeatherMode, WeatherMode> = { auto: 'clear', clear: 'rain', rain: 'snow', snow: 'auto' };
type Quality = 'auto' | 'low' | 'high';
type View = 'overview' | 'home' | 'top';

const load = <T extends string>(k: string, d: T, ok: readonly T[]): T => {
  try { const v = localStorage.getItem(k) as T | null; return v && ok.includes(v) ? v : d; } catch { return d; }
};
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } };

const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
/** Theo giờ máy: đêm 19h–5h, hoàng hôn/bình minh 17h–19h và 5h–6h30, còn lại là ngày. */
const phaseNow = (): Phase => {
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
  if (h < 5 || h >= 19) return 'night';
  return h >= 17 || h < 6.5 ? 'dusk' : 'day';
};
/** Màu trời (nền CSS phía sau canvas trong suốt) và màu sương mù khớp đường chân trời. */
const SKY: Record<Phase, { bg: string; fog: string }> = {
  day: { bg: 'linear-gradient(180deg,#5aaef0 0%,#9fd4fb 45%,#dff1ff 100%)', fog: '#cfe8fb' },
  dusk: { bg: 'linear-gradient(180deg,#2e3a78 0%,#8a5b9c 32%,#e2788a 60%,#f8b56f 85%,#ffd9a0 100%)', fog: '#e8a08f' },
  night: { bg: 'linear-gradient(180deg,#03081a 0%,#0a1433 55%,#1a2c5c 100%)', fog: '#0f1c3d' },
};
/** Trời khi mưa (xám, tối) và khi tuyết (xám sáng). */
const SKY_RAIN: Record<Phase, { bg: string; fog: string }> = {
  day: { bg: 'linear-gradient(180deg,#5d6876 0%,#8c97a4 50%,#b9c2cc 100%)', fog: '#a7b1bc' },
  dusk: { bg: 'linear-gradient(180deg,#2f3343 0%,#5d5867 50%,#8c7f84 100%)', fog: '#6f6a74' },
  night: { bg: 'linear-gradient(180deg,#05070d 0%,#111725 60%,#20283a 100%)', fog: '#1a2030' },
};
const SKY_SNOW: Record<Phase, { bg: string; fog: string }> = {
  day: { bg: 'linear-gradient(180deg,#a9bacb 0%,#d3dde8 50%,#f2f6fa 100%)', fog: '#e3eaf1' },
  dusk: { bg: 'linear-gradient(180deg,#56607e 0%,#a58fa6 50%,#e9c9c0 100%)', fog: '#c9b2b5' },
  night: { bg: 'linear-gradient(180deg,#0b1222 0%,#1d2a45 60%,#3a4a6a 100%)', fog: '#2c3a56' },
};

/** Chớp khi mưa: thỉnh thoảng lóe sáng hai nhịp. */
function Lightning() {
  const l = useRef<THREE.AmbientLight>(null);
  const next = useRef(4 + Math.random() * 8);
  const t0 = useRef(-10);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (t > next.current) { t0.current = t; next.current = t + 6 + Math.random() * 12; }
    const e = t - t0.current;
    if (l.current) l.current.intensity = e < 0.08 ? 3 : e > 0.16 && e < 0.24 ? 2 : 0;
  });
  return <ambientLight ref={l} color="#dfe8ff" intensity={0} />;
}
const lowEnd = () => typeof matchMedia !== 'undefined' && (matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency ?? 8) <= 4);

const [hx, hz] = cellPos(1, 1);
const VIEWS: Record<View, [number, number, number, number, number, number]> = {
  overview: [14.5, 13.5, 14.5, 0, -0.5, 0],
  home: [hx + 6, 5.5, hz + 6, hx, 0.6, hz],
  top: [0.01, 34, 0.01, 0, 0, 0],
};
/** Khung càng hẹp (dọc, điện thoại) thì lùi camera xa hơn để thấy trọn hòn đảo. */
function viewFor(v: View, aspect: number): [number, number, number, number, number, number] {
  const [a, b, c, d, e, f] = VIEWS[v];
  if (v === 'home') return VIEWS[v];
  const k = aspect >= 1.6 ? 1 : aspect >= 1.25 ? 1.2 : aspect >= 0.9 ? 1.5 : aspect >= 0.7 ? 2.1 : 2.5;
  return v === 'overview' ? [a * k, b * k, c * k, d, e, f] : [a, b * k, c, d, e, f];
}

/** Đặt góc nhìn tổng quan khớp tỉ lệ khung ngay khi mở. */
function InitialView({ controls }: { controls: React.RefObject<CameraControls | null> }) {
  const size = useThree((s) => s.size);
  const done = useRef(false);
  useFrame(() => {
    if (done.current || !controls.current || !size.width) return;
    done.current = true;
    controls.current.setLookAt(...viewFor('overview', size.width / size.height), false);
  });
  return null;
}

/** Tự xoay quanh thành phố khi bật. */
function AutoRotate({ controls, on }: { controls: React.RefObject<CameraControls | null>; on: boolean }) {
  useFrame((_, dt) => { if (on) controls.current?.rotate(dt * 0.12, 0, false); });
  return null;
}

/** Mặt trời hoặc mặt trăng ở xa, không bị sương mù che. */
function SkyBody({ phase }: { phase: Phase }) {
  const pos: [number, number, number] = phase === 'night' ? [-30, 26, -40] : phase === 'dusk' ? [-46, 9, -30] : [34, 34, -42];
  const col = phase === 'night' ? '#f4f1dc' : phase === 'dusk' ? '#ffb15e' : '#fff6cf';
  return (
    <group position={pos}>
      <mesh><sphereGeometry args={[phase === 'dusk' ? 4 : 3, 32, 24]} /><meshBasicMaterial color={col} fog={false} toneMapped={false} /></mesh>
      <mesh><sphereGeometry args={[phase === 'dusk' ? 7 : 5.2, 32, 24]} /><meshBasicMaterial color={col} transparent opacity={0.18} fog={false} depthWrite={false} toneMapped={false} /></mesh>
      {phase === 'night' && <mesh position={[0.9, 0.6, 1.2]}><sphereGeometry args={[0.7, 16, 12]} /><meshBasicMaterial color="#d9d5bd" fog={false} /></mesh>}
    </group>
  );
}

/** Ánh sáng phản chiếu nhẹ trên kính, kim loại (chỉ chế độ đẹp): môi trường dựng từ vài tấm sáng, không tải ảnh. */
function Reflections({ phase }: { phase: Phase }) {
  const warm = phase === 'dusk' ? '#ffb07a' : phase === 'night' ? '#4a5fa8' : '#ffffff';
  return (
    <Environment resolution={64} frames={1} environmentIntensity={phase === 'night' ? 0.15 : 0.35}>
      <Lightformer form="rect" intensity={2} color={warm} position={[0, 8, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[20, 20, 1]} />
      <Lightformer form="rect" intensity={1} color="#bfe3ff" position={[-10, 3, 6]} rotation={[0, Math.PI / 2, 0]} scale={[10, 4, 1]} />
      <Lightformer form="ring" intensity={1.5} color={warm} position={[10, 5, -8]} scale={4} />
    </Environment>
  );
}

/** dim: hệ số giảm sáng khi trời mưa, tuyết (mây che bớt nắng). */
function Lights({ phase, shadows, dim = 1 }: { phase: Phase; shadows: boolean; dim?: number }) {
  if (phase === 'dusk') {
    return (
      <>
        <hemisphereLight args={['#ffcfb0', '#4a3f63', 0.85 * (0.5 + dim / 2)]} />
        <directionalLight position={[-16, 7, 9]} intensity={2.1 * dim} color="#ffab6b" castShadow={shadows}
          shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-radius={6} shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={16} shadow-camera-bottom={-16} />
      </>
    );
  }
  return phase === 'night' ? (
    <>
      <hemisphereLight args={['#3a4f88', '#14200f', 0.45]} />
      <directionalLight position={[-8, 14, 6]} intensity={0.55} color="#a9bcff" castShadow={shadows}
        shadow-mapSize={[1024, 1024]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} />
    </>
  ) : (
    <>
      <hemisphereLight args={['#d8ecff', '#6a8f4a', 1.1 * (0.5 + dim / 2)]} />
      <directionalLight position={[12, 18, 8]} intensity={2.4 * dim} color="#fff1d6" castShadow={shadows}
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-radius={5} shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={16} shadow-camera-bottom={-16} />
    </>
  );
}

/** Thẻ thông tin của công trình hoặc nhà chính đang chọn. */
function InfoCard({ owner, s, onClose }: { owner: CityOwner; s: Selected; onClose: () => void }) {
  let title: string, rows: [string, string][];
  if (s.kind === 'house') {
    const L = levelOf(owner.totalFocusMin || 0);
    title = (HST[owner.style] ?? HST.ngoi).n;
    rows = [['Chủ nhà', owner.name], ['Giai đoạn', `${L.lv}/5 · ${L.n}`], ['Tích lũy', `${Math.round(owner.totalFocusMin)} phút`]];
    if (L.next) rows.push(['Lên giai đoạn sau', `còn ${L.next.at - Math.round(owner.totalFocusMin)} phút`]);
  } else {
    const it = ITEMS.find((x) => x.id === s.item.i)!;
    title = it.n;
    rows = [['Vị trí', `Lô ${s.slot + 1}`], ['Hạng', `${TIERS[s.item.t - 1]?.n ?? '–'} (từ ${TIERS[s.item.t - 1]?.min ?? '–'} phút)`]];
    if (POP[s.item.i]) rows.push(['Dân số', `+${POP[s.item.i]} người`]);
    rows.push(['Mạ vàng', s.item.g ? 'Có ★ (phiên đạt điểm tập trung từ 85)' : 'Không']);
  }
  return (
    <div role="dialog" aria-label={title} className="absolute bottom-12 left-2.5 w-[min(300px,calc(100%-20px))] rounded-2xl border border-white/30 bg-black/70 p-3.5 text-white shadow-xl backdrop-blur">
      <div className="mb-2 flex items-start justify-between gap-2">
        <b className="text-base">{title}</b>
        <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-md px-1.5 text-lg leading-none hover:bg-white/15">×</button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
        {rows.map(([k, v]) => [<dt key={k} className="text-white/70">{k}</dt>, <dd key={k + 'v'} className="m-0 font-semibold">{v}</dd>])}
      </dl>
    </div>
  );
}

const btn = 'rounded-lg border border-white/40 bg-black/45 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-black/60 aria-pressed:bg-white aria-pressed:text-black';

export default function City3D({ owner, onPick, onSwitch2D, height = 'h-[440px] sm:h-[560px]' }: {
  owner: CityOwner;
  onPick?: (slot: number) => void;
  onSwitch2D?: () => void;
  height?: string;
}) {
  const [time, setTime] = useState<TimeMode>(() => load('tptl-3d-time', 'auto', ['auto', 'day', 'dusk', 'night'] as const));
  const [weatherMode, setWeatherMode] = useState<WeatherMode>(() => load('tptl-3d-weather', 'auto', ['auto', 'clear', 'rain', 'snow'] as const));
  const [seasonal, setSeasonal] = useState<Weather>(() => seasonWeather());
  const [quality, setQuality] = useState<Quality>(() => load('tptl-3d-quality', 'auto', ['auto', 'low', 'high'] as const));
  const [rotate, setRotate] = useState(() => load('tptl-3d-rotate', 'off', ['on', 'off'] as const) === 'on');
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [clockPhase, setClockPhase] = useState<Phase>(phaseNow);
  const controls = useRef<CameraControls | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [fs, setFs] = useState(false);
  useEffect(() => {
    const f = () => setFs(document.fullscreenElement === box.current);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);
  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else box.current?.requestFullscreen?.().catch(() => {});
  };
  // Đổi chủ thành phố (xem thành phố người khác) thì bỏ chọn.
  useEffect(() => setSelected(null), [owner.name]);

  useEffect(() => {
    const id = setInterval(() => { setClockPhase(phaseNow()); setSeasonal(seasonWeather()); }, 60_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => save('tptl-3d-time', time), [time]);
  useEffect(() => save('tptl-3d-quality', quality), [quality]);
  useEffect(() => save('tptl-3d-weather', weatherMode), [weatherMode]);
  useEffect(() => save('tptl-3d-rotate', rotate ? 'on' : 'off'), [rotate]);

  const phase: Phase = time === 'auto' ? clockPhase : time;
  const night = phase === 'night';
  const high = quality === 'high' || (quality === 'auto' && !lowEnd());
  const go = (v: View) => {
    const el = box.current;
    controls.current?.setLookAt(...viewFor(v, el ? el.clientWidth / Math.max(1, el.clientHeight) : 1.6), true);
  };
  const weather: Weather = weatherMode === 'auto' ? seasonal : weatherMode;
  const sky = (weather === 'rain' ? SKY_RAIN : weather === 'snow' ? SKY_SNOW : SKY)[phase];

  return (
    <div ref={box} className={`relative w-full overflow-hidden transition-[background] duration-700 ${fs ? 'h-screen' : `rounded-2xl border border-line ${height}`}`} style={{ background: sky.bg }}>
      <Canvas shadows={high ? 'percentage' : false} dpr={high ? [1, 2] : 1} camera={{ position: VIEWS.overview.slice(0, 3) as [number, number, number], fov: 35, near: 0.5, far: 220 }}
        gl={{ antialias: true, alpha: true }} onPointerMissed={() => { setHover(null); setSelected(null); }}>
        <fog attach="fog" args={[sky.fog, weather === 'clear' ? 40 : 26, weather === 'clear' ? 95 : 70]} />
        <Lights phase={phase} shadows={high} dim={weather === 'rain' ? 0.45 : weather === 'snow' ? 0.75 : 1} />
        {(weather === 'clear' || (weather === 'snow' && phase === 'night')) && <SkyBody phase={phase} />}
        {weather === 'rain' && <Lightning />}
        {high && <Reflections phase={phase} />}
        {phase !== 'day' && weather === 'clear' && <Stars radius={70} depth={25} count={phase === 'night' ? 2200 : 500} factor={3.5} fade speed={0.6} />}
        <CityScene owner={owner} night={night} phase={phase} weather={weather} detail={high} onPick={onPick} onHover={setHover} onSelect={onPick ? undefined : setSelected} selected={onPick ? null : selected} />
        <CameraControls ref={controls} makeDefault minDistance={6} maxDistance={48} minPolarAngle={0.15} maxPolarAngle={1.35} smoothTime={0.35} />
        <AutoRotate controls={controls} on={rotate && !onPick} />
        <InitialView controls={controls} />
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-2.5">
        <div className="pointer-events-auto flex flex-wrap gap-1.5">
          {(['overview', 'home', 'top'] as const).map((v) => (
            <button key={v} type="button" className={btn} onClick={() => go(v)}>{v === 'overview' ? 'Tổng quan' : v === 'home' ? 'Nhà chính' : 'Từ trên'}</button>
          ))}
          {!onPick && <button type="button" className={btn} aria-pressed={rotate} onClick={() => setRotate((x) => !x)}>Tự xoay</button>}
        </div>
        <div className="pointer-events-auto flex flex-wrap gap-1.5">
          {(['auto', 'day', 'dusk', 'night'] as const).map((t) => (
            <button key={t} type="button" className={btn} aria-pressed={time === t} onClick={() => setTime(t)}>{t === 'auto' ? 'Theo giờ' : t === 'day' ? 'Ngày' : t === 'dusk' ? 'Hoàng hôn' : 'Đêm'}</button>
          ))}
          <button type="button" className={btn} onClick={() => setWeatherMode(WEATHER_NEXT[weatherMode])}
            title="Đổi thời tiết: theo mùa → nắng → mưa → tuyết" aria-label={`Thời tiết: ${weatherMode === 'auto' ? 'theo mùa, hôm nay ' : ''}${WEATHER_LABEL[weather]}`}>
            {weatherMode === 'auto' ? `Theo mùa · ${WEATHER_LABEL[weather]}` : WEATHER_LABEL[weather]}
          </button>
          <button type="button" className={btn} onClick={() => setQuality(high ? 'low' : 'high')} title="Đổi chất lượng hiển thị">{high ? 'Đẹp' : 'Nhẹ'}</button>
          {onSwitch2D && !fs && <button type="button" className={btn} onClick={onSwitch2D}>2D</button>}
          {document.fullscreenEnabled !== false && (
            <button type="button" className={btn} onClick={toggleFs} title={fs ? 'Thoát toàn màn hình' : 'Toàn màn hình'} aria-label={fs ? 'Thoát toàn màn hình' : 'Toàn màn hình'}>{fs ? '✕' : '⛶'}</button>
          )}
        </div>
      </div>
      {selected && !onPick && <InfoCard owner={owner} s={selected} onClose={() => setSelected(null)} />}
      {hover && (
        <div className="pointer-events-none absolute left-1/2 top-14 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-sm font-semibold text-white">{hover.label}</div>
      )}
      <p className="pointer-events-none absolute bottom-2 left-1/2 max-w-[94%] -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-center text-[11px] text-white backdrop-blur">
        {onPick ? <b>{isTouch() ? 'Chạm' : 'Bấm'} lô sáng để xây · </b> : null}
        {onPick ? null : <>{isTouch() ? 'Chạm' : 'Bấm'} công trình để xem · </>}
        {isTouch() ? 'Vuốt: xoay · Chụm: phóng to · Hai ngón: di chuyển' : 'Kéo: xoay · Cuộn: phóng to · Chuột phải: di chuyển'}
      </p>
    </div>
  );
}
