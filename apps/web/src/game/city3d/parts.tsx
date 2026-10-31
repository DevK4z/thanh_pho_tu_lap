/* Khối dựng cơ bản cho thành phố 3D phong cách đồ chơi: khối bo tròn, mái tam giác, cây, cửa sổ, đèn đường.
   Đơn vị: một lô đất rộng 2; mặt đất ở y = 0. */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

export const C = {
  grass: '#6dc24b', grass2: '#5cb043', lot: '#7ccf57', soil: '#a9805a', soilDark: '#8a6644', sand: '#ead9a6',
  asph: '#5f6670', lane: '#f5f2e4', walk: '#dcd7c8', water: '#3fa9dc', waterNight: '#1d4f7a',
  cream: '#f7dfae', orange: '#f2a65a', white: '#ebe6d8', paper: '#fbf3df', stone: '#bdb8aa', wood: '#a97a48', brick: '#b4503c',
  red: '#d63a30', blue: '#2f78c4', green: '#2f9d58', teal: '#2fb8a4', gold: '#efbd35', glass: '#8cc4e6', win: '#bfe6f7', winNight: '#ffd877',
  leaf: '#3da83e', leaf2: '#55b947', pine: '#2c7d3a', trunk: '#8a5a34', pink: '#ef7aa2', yellow: '#f2c744', door: '#7a4e2c',
};

/** Ban đêm: cửa sổ và đèn đường sáng lên. */
export const NightCtx = createContext(false);
export const useNight = () => useContext(NightCtx);

type V3 = [number, number, number];
interface BoxProps { p?: V3; s: V3; c: string; r?: number; rot?: V3; emissive?: string; ei?: number; metal?: number; rough?: number; opacity?: number; cast?: boolean }

/** Khối hộp bo tròn (r = bán kính bo, 0 = hộp vuông). p là tâm khối. */
export function Box({ p = [0, 0, 0], s, c, r = 0.06, rot, emissive, ei = 1, metal = 0, rough = 0.65, opacity, cast = true }: BoxProps) {
  const mat = (
    <meshStandardMaterial color={c} roughness={rough} metalness={metal} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? ei : 0}
      transparent={opacity != null} opacity={opacity ?? 1} />
  );
  if (r <= 0) {
    return <mesh position={p} rotation={rot} castShadow={cast} receiveShadow><boxGeometry args={s} />{mat}</mesh>;
  }
  return (
    <RoundedBox args={s} radius={Math.min(r, ...s.map((x) => x / 2 - 0.001))} smoothness={3} position={p} rotation={rot} castShadow={cast} receiveShadow>
      {mat}
    </RoundedBox>
  );
}

/** Mái dốc hai phía: lăng trụ tam giác, đáy rộng w theo trục x, dài d theo trục z, cao h; p là tâm đáy. */
export function Roof({ p = [0, 0, 0], w, d, h, c, rot }: { p?: V3; w: number; d: number; h: number; c: string; rot?: V3 }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(0, h);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
    g.translate(0, 0, -d / 2);
    return g;
  }, [w, d, h]);
  return (
    <mesh geometry={geo} position={p} rotation={rot} castShadow receiveShadow>
      <meshStandardMaterial color={c} roughness={0.55} />
    </mesh>
  );
}

export function Cyl({ p = [0, 0, 0], r, h, c, rTop, seg = 16, emissive, ei = 1, metal = 0, rough = 0.6 }: { p?: V3; r: number; h: number; c: string; rTop?: number; seg?: number; emissive?: string; ei?: number; metal?: number; rough?: number }) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <cylinderGeometry args={[rTop ?? r, r, h, seg]} />
      <meshStandardMaterial color={c} roughness={rough} metalness={metal} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? ei : 0} />
    </mesh>
  );
}

export function Ball({ p = [0, 0, 0], r, c, emissive, ei = 1, rough = 0.7 }: { p?: V3; r: number; c: string; emissive?: string; ei?: number; rough?: number }) {
  return (
    <mesh position={p} castShadow>
      <sphereGeometry args={[r, 16, 12]} />
      <meshStandardMaterial color={c} roughness={rough} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? ei : 0} />
    </mesh>
  );
}

/** Cây tán tròn. */
export function Tree({ p = [0, 0, 0], s = 1, c = C.leaf }: { p?: V3; s?: number; c?: string }) {
  return (
    <group position={p} scale={s}>
      <Cyl p={[0, 0.25, 0]} r={0.07} h={0.5} c={C.trunk} seg={8} />
      <Ball p={[0, 0.7, 0]} r={0.36} c={c} />
      <Ball p={[0.16, 0.55, 0.1]} r={0.24} c={C.leaf2} />
    </group>
  );
}

/** Cây thông nhiều tầng. */
export function Pine({ p = [0, 0, 0], s = 1 }: { p?: V3; s?: number }) {
  return (
    <group position={p} scale={s}>
      <Cyl p={[0, 0.15, 0]} r={0.07} h={0.3} c={C.trunk} seg={8} />
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.45 + i * 0.28, 0]} castShadow>
          <coneGeometry args={[0.42 - i * 0.1, 0.5, 9]} />
          <meshStandardMaterial color={C.pine} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

export function Bush({ p = [0, 0, 0], s = 1 }: { p?: V3; s?: number }) {
  return (
    <group position={p} scale={s}>
      <Ball p={[0, 0.16, 0]} r={0.2} c={C.leaf} />
      <Ball p={[0.15, 0.12, 0.05]} r={0.14} c={C.leaf2} />
    </group>
  );
}

/** Ô cửa sổ trên một mặt tường; ban đêm phát sáng. face: hướng pháp tuyến của mặt tường. */
export function Win({ p, w = 0.18, h = 0.22, face = 'z' }: { p: V3; w?: number; h?: number; face?: 'z' | 'x' }) {
  const night = useNight();
  const s: V3 = face === 'z' ? [w, h, 0.03] : [0.03, h, w];
  return <Box p={p} s={s} r={0} c={night ? C.winNight : C.win} emissive={night ? C.winNight : undefined} ei={0.9} cast={false} />;
}

/** Lưới cửa sổ trên hai mặt nhìn về phía camera (+x, +z) của một khối w×d, từ y0 tới y1. */
export function WindowGrid({ w, d, y0, y1, cols = 3, rows = 2, size = 0.2 }: { w: number; d: number; y0: number; y1: number; cols?: number; rows?: number; size?: number }) {
  const out: ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const y = y0 + ((r + 0.5) * (y1 - y0)) / rows;
    for (let i = 0; i < cols; i++) {
      const u = -0.5 + (i + 0.5) / cols;
      out.push(<Win key={`z${r}-${i}`} p={[u * w * 0.85, y, d / 2 + 0.01]} w={size} h={size * 1.15} />);
      out.push(<Win key={`x${r}-${i}`} p={[w / 2 + 0.01, y, u * d * 0.85]} w={size} h={size * 1.15} face="x" />);
    }
  }
  return <>{out}</>;
}

/** Đèn đường: ban đêm bóng đèn sáng; `light` thêm nguồn sáng thật (dùng hạn chế vì tốn hiệu năng). */
export function Lamp({ p, light }: { p: V3; light?: boolean }) {
  const night = useNight();
  return (
    <group position={p}>
      <Cyl p={[0, 0.45, 0]} r={0.035} h={0.9} c="#3d4148" seg={8} />
      <Ball p={[0, 0.93, 0]} r={0.08} c={night ? '#fff1b0' : '#e8e8e8'} emissive={night ? '#ffd877' : undefined} ei={2} />
      {night && light && <pointLight position={[0, 0.9, 0]} color="#ffcf7a" intensity={3} distance={4.5} decay={2} />}
    </group>
  );
}

/** Ngôi sao vàng cho công trình mạ vàng (xoay ở CityScene). */
export function StarShape() {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const r = i % 2 ? 0.12 : 0.28;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
    g.center();
    return g;
  }, []);
  return (
    <mesh geometry={geo} castShadow>
      <meshStandardMaterial color={C.gold} metalness={0.6} roughness={0.25} emissive={C.gold} emissiveIntensity={0.35} />
    </mesh>
  );
}
