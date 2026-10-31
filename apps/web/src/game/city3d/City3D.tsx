/* Thành phố 3D: Canvas, ánh sáng ngày/đêm, camera xoay/phóng/kéo, thanh công cụ.
   Điều khiển: kéo chuột trái để xoay, cuộn để phóng to, kéo chuột phải (hoặc hai ngón) để di chuyển. */
import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { CameraControls, Stars } from '@react-three/drei';
import { HST, ITEMS, POP, TIERS, levelOf } from '@tptl/shared';
import type { CityOwner } from '../iso';
import { CityScene, cellPos, type HoverInfo, type Selected } from './CityScene';

type TimeMode = 'auto' | 'day' | 'night';
type Quality = 'auto' | 'low' | 'high';
type View = 'overview' | 'home' | 'top';

const load = <T extends string>(k: string, d: T, ok: readonly T[]): T => {
  try { const v = localStorage.getItem(k) as T | null; return v && ok.includes(v) ? v : d; } catch { return d; }
};
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } };

const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const isNightNow = () => { const h = new Date().getHours(); return h < 6 || h >= 18; };
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
  const [time, setTime] = useState<TimeMode>(() => load('tptl-3d-time', 'auto', ['auto', 'day', 'night'] as const));
  const [quality, setQuality] = useState<Quality>(() => load('tptl-3d-quality', 'auto', ['auto', 'low', 'high'] as const));
  const [rotate, setRotate] = useState(() => load('tptl-3d-rotate', 'off', ['on', 'off'] as const) === 'on');
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [clockNight, setClockNight] = useState(isNightNow);
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
    const id = setInterval(() => setClockNight(isNightNow()), 60_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => save('tptl-3d-time', time), [time]);
  useEffect(() => save('tptl-3d-quality', quality), [quality]);
  useEffect(() => save('tptl-3d-rotate', rotate ? 'on' : 'off'), [rotate]);

  const night = time === 'auto' ? clockNight : time === 'night';
  const high = quality === 'high' || (quality === 'auto' && !lowEnd());
  const go = (v: View) => {
    const el = box.current;
    controls.current?.setLookAt(...viewFor(v, el ? el.clientWidth / Math.max(1, el.clientHeight) : 1.6), true);
  };
  const bg = night ? '#0b1530' : '#bfe3ff';

  return (
    <div ref={box} className={`relative w-full overflow-hidden ${fs ? 'h-screen' : `rounded-2xl border border-line ${height}`}`} style={{ background: bg }}>
      <Canvas shadows={high ? 'percentage' : false} dpr={high ? [1, 2] : 1} camera={{ position: VIEWS.overview.slice(0, 3) as [number, number, number], fov: 35, near: 0.5, far: 200 }}
        gl={{ antialias: true }} onPointerMissed={() => { setHover(null); setSelected(null); }}>
        <color attach="background" args={[bg]} />
        <fog attach="fog" args={[bg, 38, 80]} />
        <Lights night={night} shadows={high} />
        {night && <Stars radius={60} depth={20} count={1500} factor={3} fade speed={0.5} />}
        <CityScene owner={owner} night={night} onPick={onPick} onHover={setHover} onSelect={onPick ? undefined : setSelected} selected={onPick ? null : selected} />
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
          {(['auto', 'day', 'night'] as const).map((t) => (
            <button key={t} type="button" className={btn} aria-pressed={time === t} onClick={() => setTime(t)}>{t === 'auto' ? 'Theo giờ' : t === 'day' ? 'Ngày' : 'Đêm'}</button>
          ))}
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
