/* Hiệu ứng làm cảnh 3D sống động: đáy đảo bằng đá, thác nước, nước lấp lánh, thuyền, mây, chim, đom đóm,
   cỏ hoa, khói ống khói, cờ bay, đài phun nước, đèn tháp. Chỉ dùng hình khối và vật liệu chuẩn (không shader riêng, không tải ảnh). */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Box, C } from './parts';

type V3 = [number, number, number];
/** Số giả ngẫu nhiên ổn định theo hạt giống, để cảnh giống nhau mỗi lần mở. */
const rnd = (n: number) => { const k = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return k - Math.floor(k); };

/** Đáy đảo nổi: khối đá thuôn nhọn, mặt gồ ghề; đỉnh khớp với lớp đất của đảo. */
export function IslandRock({ size, top }: { size: number; top: number }) {
  const H = size * 0.42;
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(((size - 0.8) / 2) * Math.SQRT2, size * 0.06, H, 4, 5);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (y > H / 2 - 0.01) continue; // giữ nguyên mặt trên
      // Lệch theo vị trí (không theo chỉ số) để các đỉnh trùng nhau ở mép nối lệch như nhau, không nứt.
      const f = rnd(Math.round(x * 10) * 7 + Math.round(y * 10) * 131 + Math.round(z * 10) * 17) - 0.5;
      pos.setXYZ(i, x * (1 + f * 0.22), y + f * 0.5, z * (1 - f * 0.18));
    }
    g.computeVertexNormals();
    return g;
  }, [size, H]);
  return (
    <group position={[0, top - H / 2, 0]} rotation={[0, Math.PI / 4, 0]}>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial color="#8a6a4f" roughness={0.95} flatShading />
      </mesh>
      {/* vệt đá sẫm ở giữa thân */}
      <mesh position={[0, H * 0.05, 0]} scale={[0.7, 0.35, 0.7]} geometry={geo}>
        <meshStandardMaterial color="#6f5440" roughness={1} flatShading />
      </mesh>
    </group>
  );
}

/** Vài mỏm đá nhỏ có cỏ, lơ lửng quanh đảo. */
export function FloatingRocks({ edge }: { edge: number }) {
  const g = useRef<THREE.Group>(null);
  const rocks = useMemo(() => [[-edge - 2.6, -1.2, 3, 0.9], [edge + 2.2, -2.4, -4.5, 0.7], [-3, -2.8, -edge - 2.8, 0.8], [5, -0.6, edge + 3.4, 0.55]] as const, [edge]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    g.current?.children.forEach((c, i) => { c.position.y = rocks[i][1] + Math.sin(t * 0.6 + i * 1.7) * 0.25; c.rotation.y = t * 0.05 * (i % 2 ? 1 : -1); });
  });
  return (
    <group ref={g}>
      {rocks.map(([x, y, z, s], i) => (
        <group key={i} position={[x, y, z]} scale={s}>
          <mesh position={[0, -0.55, 0]}><coneGeometry args={[0.8, 1.4, 5]} /><meshStandardMaterial color="#8a6a4f" flatShading roughness={1} /></mesh>
          <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.82, 0.82, 0.22, 5]} /><meshStandardMaterial color={C.grass} roughness={0.9} flatShading /></mesh>
          {i % 2 === 0 && <mesh position={[0.15, 0.55, 0]}><coneGeometry args={[0.28, 0.7, 7]} /><meshStandardMaterial color={C.pine} roughness={0.8} /></mesh>}
        </group>
      ))}
    </group>
  );
}

/** Thác nước đổ xuống từ mép đảo: màn nước trong mờ, vệt bọt chạy xuống và mây bụi nước ở chân thác.
    p: điểm mép trên giữa thác; along: trục ngang của màn nước ('x' hoặc 'z'). */
export function Waterfall({ p, width, along, night }: { p: V3; width: number; along: 'x' | 'z'; night: boolean }) {
  const H = 7;
  const streaks = useRef<(THREE.Mesh | null)[]>([]);
  const mist = useRef<THREE.Group>(null);
  const N = 9;
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    streaks.current.forEach((m, i) => {
      if (!m) return;
      const u = (t * 0.55 + i / N) % 1;
      m.position.y = -u * H;
      (m.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - u);
    });
    mist.current?.children.forEach((c, i) => { const s = 0.8 + 0.25 * Math.sin(t * 2 + i); c.scale.setScalar(s); });
  });
  const rot: V3 = along === 'x' ? [0, 0, 0] : [0, Math.PI / 2, 0];
  return (
    <group position={p} rotation={rot}>
      <mesh position={[0, -H / 2, 0.02]}>
        <planeGeometry args={[width, H]} />
        <meshStandardMaterial color={night ? C.waterNight : '#7cc8ef'} transparent opacity={0.72} roughness={0.1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {Array.from({ length: N }, (_, i) => (
        <mesh key={i} ref={(m) => { streaks.current[i] = m; }} position={[(rnd(i + 3) - 0.5) * width * 0.85, 0, 0.06]}>
          <planeGeometry args={[0.07, 0.9]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} depthWrite={false} />
        </mesh>
      ))}
      <group ref={mist} position={[0, -H, 0.3]}>
        {[-0.5, 0, 0.5].map((x, i) => <mesh key={i} position={[x * width, 0, 0]}><sphereGeometry args={[0.55, 10, 8]} /><meshStandardMaterial color="#ffffff" transparent opacity={0.55} depthWrite={false} /></mesh>)}
      </group>
    </group>
  );
}

/** Đốm sáng lấp lánh trôi trên mặt sông. segs: các đoạn sông [x0, z0, x1, z1]. */
export function Glints({ segs, y = 0.075 }: { segs: [number, number, number, number][]; y?: number }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const n = segs.length * 6;
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((m, i) => {
      if (!m) return;
      const [x0, z0, x1, z1] = segs[i % segs.length];
      const u = (t * 0.06 + rnd(i) ) % 1;
      const side = (rnd(i + 50) - 0.5) * 0.9;
      const horiz = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      m.position.set(x0 + (x1 - x0) * u + (horiz ? 0 : side), y, z0 + (z1 - z0) * u + (horiz ? side : 0));
      (m.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.6 * Math.max(0, Math.sin(t * 3 + i * 1.3));
    });
  });
  return <>{Array.from({ length: n }, (_, i) => (
    <mesh key={i} ref={(m) => { refs.current[i] = m; }} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
      <planeGeometry args={[0.12, 0.12]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.5} depthWrite={false} />
    </mesh>
  ))}</>;
}

/** Thuyền buồm nhỏ đi qua lại trên một đoạn sông (từ a tới b theo trục x, ở z cố định). */
export function Boat({ a, b, z }: { a: number; b: number; z: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.getElapsedTime() * 0.12;
    const u = (Math.sin(t) + 1) / 2;
    g.current.position.set(a + (b - a) * u, 0.1 + Math.sin(t * 20) * 0.015, z);
    g.current.rotation.y = Math.cos(t) >= 0 ? 0 : Math.PI;
    g.current.rotation.z = Math.sin(t * 14) * 0.04;
  });
  return (
    <group ref={g}>
      <Box p={[0, 0.06, 0]} s={[0.6, 0.12, 0.26]} r={0.05} c={C.wood} />
      <Box p={[0, 0.13, 0]} s={[0.5, 0.03, 0.2]} r={0.01} c={C.paper} />
      <mesh position={[0, 0.42, 0]} castShadow><cylinderGeometry args={[0.012, 0.012, 0.55, 6]} /><meshStandardMaterial color="#5b4636" /></mesh>
      <mesh position={[0.1, 0.42, 0]} rotation={[0, 0, 0]} castShadow>
        <coneGeometry args={[0.18, 0.45, 3]} />
        <meshStandardMaterial color={C.white} roughness={0.7} />
      </mesh>
    </group>
  );
}

/** Mây trôi chậm trên trời, đi hết thì quay lại từ đầu. */
export function Clouds({ dim }: { dim: boolean }) {
  const g = useRef<THREE.Group>(null);
  const clouds = useMemo(() => Array.from({ length: 6 }, (_, i) => ({
    x: -26 + i * 9 + rnd(i) * 4, y: 7.5 + rnd(i + 9) * 3, z: -12 + rnd(i + 20) * 22, s: 0.8 + rnd(i + 31) * 0.7, v: 0.25 + rnd(i + 40) * 0.25,
  })), []);
  useFrame((_, dt) => {
    g.current?.children.forEach((c, i) => {
      c.position.x += clouds[i].v * Math.min(dt, 0.1);
      if (c.position.x > 30) c.position.x = -30;
    });
  });
  const col = dim ? '#8090b8' : '#ffffff';
  return (
    <group ref={g}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={[c.s * 1.4, c.s * 0.75, c.s]}>
          {[[0, 0, 0, 1], [0.9, -0.15, 0.1, 0.75], [-0.9, -0.2, -0.1, 0.7], [0.35, 0.35, -0.2, 0.7], [-0.4, 0.25, 0.25, 0.6]].map(([x, y, z, r], k) => (
            <mesh key={k} position={[x, y, z]}><sphereGeometry args={[r, 12, 10]} /><meshStandardMaterial color={col} roughness={1} transparent opacity={dim ? 0.55 : 0.95} /></mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Đàn chim bay vòng trên thành phố, vỗ cánh. */
export function Birds() {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    g.current?.children.forEach((b, i) => {
      const a = t * 0.18 + i * 0.5;
      const r = 9 + (i % 3) * 0.8;
      b.position.set(Math.cos(a) * r, 6 + Math.sin(t * 0.7 + i) * 0.4 + (i % 2) * 0.6, Math.sin(a) * r);
      b.rotation.y = -a;
      const flap = Math.sin(t * 9 + i) * 0.6;
      (b.children[0] as THREE.Object3D).rotation.x = flap;
      (b.children[1] as THREE.Object3D).rotation.x = -flap;
    });
  });
  return (
    <group ref={g}>
      {Array.from({ length: 5 }, (_, i) => (
        <group key={i}>
          <mesh position={[0, 0, 0.12]}><boxGeometry args={[0.08, 0.015, 0.24]} /><meshStandardMaterial color="#3b3b4a" /></mesh>
          <mesh position={[0, 0, -0.12]}><boxGeometry args={[0.08, 0.015, 0.24]} /><meshStandardMaterial color="#3b3b4a" /></mesh>
        </group>
      ))}
    </group>
  );
}

/** Đom đóm ban đêm bay lượn quanh các điểm cho trước. */
export function Fireflies({ spots }: { spots: [number, number][] }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const n = spots.length * 3;
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((m, i) => {
      if (!m) return;
      const [x, z] = spots[i % spots.length];
      const ph = rnd(i) * 10;
      m.position.set(x + Math.sin(t * 0.7 + ph) * 0.9, 0.6 + Math.sin(t * 1.3 + ph) * 0.35 + rnd(i + 7) * 0.6, z + Math.cos(t * 0.5 + ph) * 0.9);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.7 * Math.max(0, Math.sin(t * 2.5 + ph));
    });
  });
  return <>{Array.from({ length: n }, (_, i) => (
    <mesh key={i} ref={(m) => { refs.current[i] = m; }}>
      <sphereGeometry args={[0.04, 6, 6]} />
      <meshBasicMaterial color="#fff38a" transparent opacity={0.8} />
    </mesh>
  ))}</>;
}

/** Cỏ và hoa rải trên viền đảo (dùng instancing: hàng trăm bụi cỏ chỉ tốn vài lần vẽ). */
export function GrassField({ points }: { points: [number, number][] }) {
  const grass = useRef<THREE.InstancedMesh>(null);
  const flowers = useRef<THREE.InstancedMesh>(null);
  const flowerPts = useMemo(() => points.filter((_, i) => i % 3 === 0), [points]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), e = new THREE.Euler();
    points.forEach(([x, z], i) => {
      const k = 0.7 + rnd(i + 3) * 0.7;
      m.compose(v.set(x, 0.09 * k, z), q.setFromEuler(e.set(0, rnd(i) * 6, (rnd(i + 1) - 0.5) * 0.3)), s.set(k, k, k));
      grass.current?.setMatrixAt(i, m);
    });
    if (grass.current) grass.current.instanceMatrix.needsUpdate = true;
    const cols = [new THREE.Color(C.pink), new THREE.Color(C.yellow), new THREE.Color('#ffffff'), new THREE.Color('#b18cf0')];
    flowerPts.forEach(([x, z], i) => {
      m.compose(v.set(x + 0.12, 0.13, z + 0.08), q.identity(), s.set(1, 1, 1));
      flowers.current?.setMatrixAt(i, m);
      flowers.current?.setColorAt(i, cols[i % cols.length]);
    });
    if (flowers.current) { flowers.current.instanceMatrix.needsUpdate = true; if (flowers.current.instanceColor) flowers.current.instanceColor.needsUpdate = true; }
  }, [points, flowerPts]);
  return (
    <>
      <instancedMesh ref={grass} args={[undefined, undefined, points.length]} receiveShadow>
        <coneGeometry args={[0.06, 0.18, 4]} />
        <meshStandardMaterial color={C.leaf2} roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={flowers} args={[undefined, undefined, flowerPts.length]}>
        <sphereGeometry args={[0.045, 6, 5]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
    </>
  );
}

/** Khói bốc lên từ ống khói: các cụm khói nở to rồi mờ dần. */
export function Smoke({ p }: { p: V3 }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const N = 5;
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((m, i) => {
      if (!m) return;
      const u = (t * 0.35 + i / N) % 1;
      m.position.set(Math.sin(u * 3 + i) * 0.08 + u * 0.25, u * 1.3, 0);
      m.scale.setScalar(0.08 + u * 0.22);
      (m.material as THREE.MeshStandardMaterial).opacity = 0.65 * (1 - u);
    });
  });
  return (
    <group position={p}>
      {Array.from({ length: N }, (_, i) => (
        <mesh key={i} ref={(m) => { refs.current[i] = m; }}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#e9eef2" roughness={1} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Lá cờ phấp phới (xoay quanh cán cờ theo nhịp). */
export function Flag({ p, c = C.gold }: { p: V3; c?: string }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (g.current) g.current.rotation.y = Math.sin(clock.getElapsedTime() * 2.4) * 0.35; });
  return (
    <group ref={g} position={p}>
      <Box p={[0.22, 0, 0]} s={[0.4, 0.26, 0.02]} r={0.01} c={c} />
      <Box p={[0.12, 0, 0.012]} s={[0.12, 0.12, 0.01]} r={0.01} c={C.red} cast={false} />
    </group>
  );
}

/** Tia nước của đài phun: các giọt bắn lên theo hình vòm rồi rơi xuống. */
export function FountainSpray({ y }: { y: number }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const N = 12;
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((m, i) => {
      if (!m) return;
      const a = (i / N) * Math.PI * 2;
      const u = (t * 0.9 + (i % 3) / 3) % 1;
      const r = u * 0.28;
      m.position.set(Math.cos(a) * r, y + u * 0.5 - u * u * 0.55, Math.sin(a) * r);
    });
  });
  return <>{Array.from({ length: N }, (_, i) => (
    <mesh key={i} ref={(m) => { refs.current[i] = m; }}>
      <sphereGeometry args={[0.025, 6, 5]} />
      <meshStandardMaterial color="#bfe8ff" roughness={0.1} transparent opacity={0.85} />
    </mesh>
  ))}</>;
}

/** Đèn báo trên đỉnh tháp nhấp nháy. */
export function Beacon({ p }: { p: V3 }) {
  const m = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => { if (m.current) m.current.emissiveIntensity = 0.4 + 2.2 * Math.max(0, Math.sin(clock.getElapsedTime() * 3)); });
  return (
    <mesh position={p}>
      <sphereGeometry args={[0.06, 12, 10]} />
      <meshStandardMaterial ref={m} color={C.red} emissive={C.red} emissiveIntensity={1.5} />
    </mesh>
  );
}
