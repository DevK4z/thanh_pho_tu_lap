/* Cảnh thành phố 3D (không gồm Canvas và camera, để test được bằng @react-three/test-renderer).
   Bố cục giống bản 2D: lưới 7×7 lô, đường ở hàng 3 và cột 3, nhà chính ở lô (1,1), sông chạy dọc hai cạnh phía trước,
   rừng thông ở hai cạnh phía sau. Trục x theo cột, trục z theo hàng; mỗi lô rộng 2. */
import { useRef, useState, type ReactElement } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { GN, ITEMS, SLOTS, levelOf, type ItemId } from '@tptl/shared';
import type * as THREE from 'three';
import type { CityOwner } from '../iso';
import { EmptyLot, HouseModel, ITEM_HEIGHT, ItemModel } from './models';
import { Box, C, Lamp, NightCtx, Pine, StarShape, Tree } from './parts';

export const CELL = 2;
/** Tâm lô (hàng r, cột c) trong toạ độ thế giới. */
export const cellPos = (r: number, c: number): [number, number] => [(c - 3) * CELL, (r - 3) * CELL];
const HALF = (GN * CELL) / 2;
const EDGE = HALF + 3.2;
const RIVER = [HALF + 0.5, HALF + 2.3] as const;

export interface HoverInfo { label: string; slot?: number }

const itemName = (id: ItemId) => ITEMS.find((x) => x.id === id)?.n ?? id;

/** Mặt đất dạng đảo nổi: lớp cỏ trên, lớp đất hai bên. */
function Ground() {
  const size = EDGE * 2;
  return (
    <group>
      <Box p={[0, -0.75, 0]} s={[size, 1.4, size]} r={0.35} c={C.soil} cast={false} />
      <Box p={[0, -1.6, 0]} s={[size - 0.8, 0.5, size - 0.8]} r={0.2} c={C.soilDark} cast={false} />
      <Box p={[0, -0.04, 0]} s={[size, 0.1, size]} r={0.05} c={C.grass} cast={false} />
    </group>
  );
}

function Roads() {
  const len = EDGE * 2;
  const dashes = Array.from({ length: 16 }, (_, i) => -len / 2 + 1 + i * (len / 16));
  return (
    <group>
      <Box p={[0, 0.02, 0]} s={[len, 0.04, CELL]} r={0} c={C.asph} cast={false} />
      <Box p={[0, 0.021, 0]} s={[CELL, 0.044, len]} r={0} c={C.asph} cast={false} />
      {dashes.filter((x) => Math.abs(x) > 1.2).map((x, i) => (
        <group key={i}>
          <Box p={[x, 0.05, 0]} s={[0.5, 0.01, 0.06]} r={0} c={C.lane} cast={false} />
          <Box p={[0, 0.05, x]} s={[0.06, 0.01, 0.5]} r={0} c={C.lane} cast={false} />
        </group>
      ))}
      {/* vỉa hè hai bên đường */}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <Box p={[0, 0.04, sd * (CELL / 2 + 0.12)]} s={[len, 0.08, 0.24]} r={0} c={C.walk} cast={false} />
          <Box p={[sd * (CELL / 2 + 0.12), 0.04, 0]} s={[0.24, 0.08, len]} r={0} c={C.walk} cast={false} />
        </group>
      ))}
    </group>
  );
}

/** Sông hình chữ L ở hai cạnh phía trước, có cầu ở chỗ đường đi qua. */
function River({ night }: { night: boolean }) {
  const [a, b] = RIVER;
  const w = b - a, mid = (a + b) / 2, len = EDGE * 2;
  const water = night ? C.waterNight : C.water;
  return (
    <group>
      {/* bờ cát */}
      <Box p={[mid, 0.0, 0]} s={[w + 0.4, 0.06, len]} r={0} c={C.sand} cast={false} />
      <Box p={[0, 0.001, mid]} s={[len, 0.06, w + 0.4]} r={0} c={C.sand} cast={false} />
      <Box p={[mid, 0.04, 0]} s={[w, 0.06, len]} r={0} c={water} rough={0.1} metal={0.1} cast={false} />
      <Box p={[0, 0.041, mid]} s={[len, 0.06, w]} r={0} c={water} rough={0.1} metal={0.1} cast={false} />
      {/* cầu */}
      <Box p={[mid, 0.16, 0]} s={[w + 0.6, 0.12, CELL]} r={0.04} c={C.wood} />
      <Box p={[0, 0.16, mid]} s={[CELL, 0.12, w + 0.6]} r={0.04} c={C.wood} />
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <Box p={[mid, 0.32, sd * (CELL / 2 - 0.05)]} s={[w + 0.6, 0.1, 0.08]} r={0.02} c={C.brick} />
          <Box p={[sd * (CELL / 2 - 0.05), 0.32, mid]} s={[0.08, 0.1, w + 0.6]} r={0.02} c={C.brick} />
        </group>
      ))}
    </group>
  );
}

/** Rừng thông ở hai cạnh phía sau. */
function Forest() {
  const out: ReactElement[] = [];
  const back = -HALF - 0.4;
  for (let k = 0; k < 18; k++) {
    const t = -EDGE + 0.7 + k * ((EDGE * 2 - 1.4) / 17);
    const s = 0.95 + ((k * 7) % 5) * 0.08;
    if (Math.abs(t) > 1.3) {
      out.push(<Pine key={'a' + k} p={[t, 0, back - 0.4 - (k % 2) * 0.9]} s={s} />);
      out.push(<Pine key={'b' + k} p={[back - 0.4 - ((k + 1) % 2) * 0.9, 0, t]} s={s} />);
    }
    if (k % 4 === 1 && Math.abs(t) > 1.3) out.push(<Tree key={'c' + k} p={[t + 0.3, 0, back - 1.9]} s={1.1} />);
  }
  return <>{out}</>;
}

function Lamps() {
  const spots = [-5, -1.5, 2.5, 5.5];
  return (
    <>
      {spots.map((x, i) => (
        <group key={i}>
          <Lamp p={[x, 0.08, CELL / 2 + 0.12]} light={i % 2 === 0} />
          <Lamp p={[CELL / 2 + 0.12, 0.08, -x]} light={i % 2 === 1} />
        </group>
      ))}
    </>
  );
}

const CAR_COLORS = [C.red, C.blue, C.gold, C.white, C.green, C.orange];
/** Xe chạy vòng trên hai trục đường; số xe tăng theo số công trình như bản 2D. */
function Cars({ n }: { n: number }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((g, i) => {
      if (!g) return;
      const along = i % 2 === 0;
      const dir = i % 4 < 2 ? 1 : -1;
      const len = EDGE * 2;
      const u = (((t * (0.9 + (i % 3) * 0.25) + i * 3.1) % len) + len) % len - EDGE;
      const lane = dir * 0.45;
      if (along) { g.position.set(u * dir, 0.12, lane); g.rotation.y = dir > 0 ? 0 : Math.PI; }
      else { g.position.set(-lane, 0.12, u * dir); g.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
    });
  });
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g; }}>
          <Box p={[0, 0.07, 0]} s={[0.6, 0.18, 0.3]} r={0.07} c={CAR_COLORS[i % CAR_COLORS.length]} />
          <Box p={[-0.04, 0.22, 0]} s={[0.32, 0.13, 0.26]} r={0.05} c={C.glass} rough={0.2} />
        </group>
      ))}
    </>
  );
}

/** Ngôi sao xoay trên công trình mạ vàng. */
function Spinner({ y }: { y: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.getElapsedTime();
    g.current.rotation.y = t * 1.6;
    g.current.position.y = y + Math.sin(t * 2) * 0.08;
  });
  return <group ref={g} position={[0, y, 0]}><StarShape /></group>;
}

/** Ô sáng nhấp nháy đánh dấu lô bấm được: vàng là đất trống, đỏ là lô đã có công trình (sẽ bị thay).
    Đặt cao hơn ruộng và bụi cây để không bị che. */
function SlotTile({ i, occupied, hot, onOver, onOut, onPick }: {
  i: number; occupied: boolean; hot: boolean;
  onOver: (e: ThreeEvent<PointerEvent>) => void; onOut: (e: ThreeEvent<PointerEvent>) => void; onPick: (slot: number) => void;
}) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!mat.current) return;
    const pulse = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 3 + i * 0.4);
    mat.current.opacity = hot ? 0.85 : (occupied ? 0.35 : 0.45) + pulse * 0.2;
  });
  const col = occupied ? C.red : C.gold;
  return (
    <group position={[0, 0.2, 0]}>
      <mesh name={'slot-' + i} rotation={[-Math.PI / 2, 0, 0]} onPointerOver={onOver} onPointerOut={onOut}
        onClick={(e) => { e.stopPropagation(); onPick(i); }}>
        <planeGeometry args={[1.8, 1.8]} />
        <meshStandardMaterial ref={mat} color={col} emissive={col} emissiveIntensity={hot ? 0.9 : 0.5} transparent opacity={0.5} depthWrite={false} />
      </mesh>
      {/* viền sáng quanh lô */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[1.18, 1.28, 4, 1, Math.PI / 4]} />
        <meshBasicMaterial color={hot ? '#ffffff' : col} transparent opacity={0.95} depthWrite={false} />
      </mesh>
    </group>
  );
}

export interface CitySceneProps {
  owner: CityOwner;
  night: boolean;
  /** Có thì các lô đất bấm được để đặt công trình. */
  onPick?: (slot: number) => void;
  onHover?: (h: HoverInfo | null) => void;
}

export function CityScene({ owner, night, onPick, onHover }: CitySceneProps) {
  const [hover, setHover] = useState<number | null>(null);
  const plot = owner.plot || [];
  const L = levelOf(owner.totalFocusMin || 0);
  const occupied = new Map(plot.map((p) => [p.s, p]));
  const [hx, hz] = cellPos(1, 1);

  const over = (slot: number, label: string) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHover(slot);
    onHover?.({ label, slot });
  };
  const out = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHover(null);
    onHover?.(null);
  };

  return (
    <NightCtx.Provider value={night}>
      <Ground />
      <Roads />
      <River night={night} />
      <Forest />
      <Lamps />
      <Cars n={Math.min(6, Math.floor(plot.length / 2))} />

      <group position={[hx, 0, hz]}
        onPointerOver={(e) => { e.stopPropagation(); onHover?.({ label: `Nhà của ${owner.name} · ${L.n}` }); }}
        onPointerOut={(e) => { e.stopPropagation(); onHover?.(null); }}>
        <HouseModel style={owner.style} lv={L.lv} />
      </group>

      {SLOTS.map(([r, c], i) => {
        const [x, z] = cellPos(r, c);
        const p = occupied.get(i);
        const label = p ? `Lô ${i + 1} · ${itemName(p.i)}${p.g ? ' (mạ vàng)' : ''}` : `Lô ${i + 1} · đất trống`;
        return (
          <group key={i} position={[x, 0, z]}>
            <Box p={[0, 0.02, 0]} s={[1.86, 0.04, 1.86]} r={0} c={C.lot} cast={false} />
            {p ? (
              <group onPointerOver={onPick ? undefined : over(i, label)} onPointerOut={onPick ? undefined : out}>
                <ItemModel id={p.i} />
                {p.g ? <Spinner y={ITEM_HEIGHT[p.i] + 0.35} /> : null}
              </group>
            ) : <EmptyLot i={i} />}
            {onPick && (
              <SlotTile i={i} occupied={!!p} hot={hover === i} onPick={onPick} onOut={out}
                onOver={over(i, p ? `${label} · sẽ bị thay` : `Lô ${i + 1} · bấm để xây`)} />
            )}
          </group>
        );
      })}
    </NightCtx.Provider>
  );
}
