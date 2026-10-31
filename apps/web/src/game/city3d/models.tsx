/* Mô hình 3D của nhà chính (theo kiểu nhà và giai đoạn) và 12 công trình. Mỗi mô hình đặt ở tâm lô, vừa ô 2×2. */
import type { ComponentType } from 'react';
import type { HouseStyle, ItemId } from '@tptl/shared';
import { Ball, Box, Bush, C, Cyl, Lamp, Pine, Roof, Tree, Win, WindowGrid } from './parts';

const WALL: Record<string, string> = { wood: C.wood, wb: C.orange, wa: C.cream, wc: C.white };
const ROOF: Record<string, string> = { rr: C.red, rb: C.blue, rg: C.green };
const STYLE: Record<HouseStyle, { wall: string; roof: string; awn: string }> = {
  san: { wall: WALL.wood, roof: ROOF.rr, awn: ROOF.rg },
  trinh: { wall: WALL.wb, roof: ROOF.rb, awn: C.orange },
  ngoi: { wall: WALL.wa, roof: ROOF.rr, awn: ROOF.rg },
  da: { wall: WALL.wc, roof: ROOF.rg, awn: ROOF.rr },
};

/** Ngôi nhà cơ bản: thân, cửa, cửa sổ, mái dốc. */
function SimpleHouse({ w, d, h, wall, roof, roofH = 0.55, door = C.door }: { w: number; d: number; h: number; wall: string; roof: string; roofH?: number; door?: string }) {
  return (
    <group>
      <Box p={[0, h / 2, 0]} s={[w, h, d]} c={wall} />
      <Box p={[0, 0.2, d / 2 + 0.01]} s={[0.22, 0.4, 0.04]} r={0.02} c={door} />
      <Win p={[-w * 0.3, h * 0.6, d / 2 + 0.01]} />
      <Win p={[w * 0.3, h * 0.6, d / 2 + 0.01]} />
      <Win p={[w / 2 + 0.01, h * 0.6, 0]} face="x" />
      <Roof p={[0, h, 0]} w={w + 0.2} d={d + 0.2} h={roofH} c={roof} />
    </group>
  );
}

/** Nhà chính: 1 nền móng, 2 dựng khung, 3 hoàn thiện mái, 4 thêm vườn, 5 nhà mẫu có cờ. */
export function HouseModel({ style, lv }: { style: HouseStyle; lv: number }) {
  const st = STYLE[style] ?? STYLE.ngoi;
  const w = 1.25, d = 1.05, h = 0.85;
  if (lv <= 1) {
    return (
      <group>
        <Box p={[0, 0.06, 0]} s={[w + 0.2, 0.12, d + 0.2]} c={C.stone} />
        <Box p={[-0.4, 0.2, 0.2]} s={[0.4, 0.14, 0.18]} c={C.wood} />
        <Box p={[0.35, 0.25, -0.2]} s={[0.22, 0.24, 0.22]} c={C.brick} />
        <Box p={[0.1, 0.17, 0.35]} s={[0.3, 0.1, 0.16]} c={C.stone} />
        <Cyl p={[0.5, 0.25, 0.4]} r={0.08} h={0.22} c="#d6a33a" seg={10} />
      </group>
    );
  }
  if (lv === 2) {
    const corners: [number, number][] = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]];
    return (
      <group>
        <Box p={[0, 0.06, 0]} s={[w + 0.2, 0.12, d + 0.2]} c={C.stone} />
        {corners.map(([x, z], i) => <Box key={i} p={[x, 0.12 + h / 2, z]} s={[0.07, h, 0.07]} r={0.01} c={C.wood} />)}
        <Box p={[0, 0.12 + h, 0]} s={[w + 0.07, 0.06, d + 0.07]} r={0.01} c={C.wood} />
        <Box p={[0, 0.12 + h / 2, 0]} s={[w, h, d]} c={st.wall} opacity={0.35} cast={false} />
        <Box p={[-0.2, 0.12 + h / 2, d / 2]} s={[0.05, h, 0.05]} r={0.01} c={C.wood} rot={[0, 0, 0.6]} />
      </group>
    );
  }
  return (
    <group>
      <Box p={[0, 0.06, 0]} s={[w + 0.25, 0.12, d + 0.25]} c={C.stone} />
      <group position={[0, 0.12, 0]}>
        <SimpleHouse w={w} d={d} h={h} wall={st.wall} roof={st.roof} roofH={0.6} />
        {/* mái hiên trước cửa */}
        <Box p={[0, 0.55, d / 2 + 0.16]} s={[0.55, 0.05, 0.3]} c={st.awn} rot={[0.25, 0, 0]} />
        {lv >= 4 && <Box p={[0.35, h + 0.45, -0.2]} s={[0.16, 0.45, 0.16]} c={C.brick} />}
      </group>
      {lv >= 4 && (
        <>
          <Tree p={[-0.78, 0, 0.62]} s={0.75} />
          <Bush p={[0.75, 0, 0.7]} s={0.8} />
          {[-0.3, -0.1, 0.1, 0.3].map((x, i) => <Ball key={i} p={[x, 0.07, 0.8]} r={0.06} c={i % 2 ? C.pink : C.yellow} />)}
        </>
      )}
      {lv >= 5 && (
        <group position={[-0.55, 0, -0.5]}>
          <Cyl p={[0, 1.0, 0]} r={0.025} h={2} c="#3d4148" seg={8} />
          <Box p={[0.22, 1.8, 0]} s={[0.4, 0.26, 0.02]} r={0.01} c={C.gold} />
        </group>
      )}
    </group>
  );
}

function Cay() {
  return <><Tree p={[-0.4, 0, -0.3]} s={1.1} /><Pine p={[0.4, 0, -0.2]} s={1.1} /><Tree p={[0.1, 0, 0.45]} s={0.8} c={C.leaf2} /></>;
}
function Hoa() {
  return (
    <>
      {[-0.45, 0, 0.45].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <Box p={[0, 0.06, 0]} s={[0.34, 0.12, 1.3]} c={C.soil} />
          {[-0.45, -0.15, 0.15, 0.45].map((z, j) => <Ball key={j} p={[0, 0.18, z]} r={0.09} c={(i + j) % 2 ? C.pink : C.yellow} />)}
        </group>
      ))}
      <Box p={[0, 0.12, 0.78]} s={[1.5, 0.12, 0.04]} r={0.01} c={C.white} />
    </>
  );
}
function NhaNho() {
  return <><SimpleHouse w={0.95} d={0.85} h={0.65} wall={C.cream} roof={C.red} roofH={0.45} /><Bush p={[0.65, 0, 0.55]} s={0.7} /></>;
}
function Vuon() {
  return (
    <>
      <group position={[-0.15, 0, -0.15]}><SimpleHouse w={1} d={0.85} h={0.75} wall={C.white} roof={C.blue} roofH={0.5} /></group>
      {[-0.7, -0.35, 0, 0.35, 0.7].map((x, i) => <Box key={i} p={[x, 0.13, 0.78]} s={[0.3, 0.26, 0.2]} c={C.leaf} r={0.08} />)}
      <Tree p={[0.7, 0, -0.55]} s={0.8} />
    </>
  );
}
function Quan() {
  return (
    <>
      <Box p={[0, 0.4, -0.25]} s={[1.2, 0.8, 0.8]} c={C.orange} />
      <WindowGrid w={1.2} d={0.8} y0={0.3} y1={0.7} cols={3} rows={1} />
      {[0, 1, 2, 3, 4, 5].map((i) => <Box key={i} p={[-0.5 + i * 0.2, 0.78, 0.25]} s={[0.2, 0.05, 0.4]} r={0.01} c={i % 2 ? C.white : C.red} rot={[0.35, 0, 0]} />)}
      <Box p={[0, 0.84, -0.25]} s={[1.3, 0.08, 0.9]} c={C.brick} />
      {[[-0.45, 0.65], [0.4, 0.6]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Cyl p={[0, 0.17, 0]} r={0.15} h={0.04} c={C.white} />
          <Cyl p={[0, 0.08, 0]} r={0.03} h={0.16} c="#555" seg={8} />
          <Cyl p={[0, 0.55, 0]} r={0.015} h={0.75} c="#555" seg={6} />
          <mesh position={[0, 0.9, 0]} castShadow><coneGeometry args={[0.32, 0.18, 10]} /><meshStandardMaterial color={i ? C.teal : C.yellow} roughness={0.6} /></mesh>
        </group>
      ))}
    </>
  );
}
function San() {
  return (
    <>
      <Box p={[0, 0.03, 0]} s={[1.7, 0.06, 1.7]} c="#4d9a8a" r={0.03} />
      <Box p={[0, 0.065, 0]} s={[1.5, 0.01, 0.03]} r={0} c={C.white} cast={false} />
      {/* cầu trượt */}
      <Box p={[-0.45, 0.35, -0.35]} s={[0.3, 0.6, 0.3]} c={C.red} />
      <Box p={[-0.45, 0.33, 0.12]} s={[0.22, 0.04, 0.75]} c={C.yellow} rot={[0.7, 0, 0]} />
      {/* xích đu */}
      {[-0.35, 0.35].map((z, i) => <Box key={i} p={[0.5, 0.4, z]} s={[0.05, 0.8, 0.05]} r={0.01} c={C.blue} />)}
      <Box p={[0.5, 0.8, 0]} s={[0.06, 0.06, 0.8]} r={0.01} c={C.blue} />
      <Box p={[0.5, 0.25, 0]} s={[0.18, 0.04, 0.12]} r={0.01} c={C.orange} />
      <Ball p={[0.15, 0.13, 0.5]} r={0.1} c={C.pink} />
    </>
  );
}
function ThuVien() {
  return (
    <>
      <Box p={[0, 0.1, 0]} s={[1.6, 0.2, 1.3]} c={C.stone} />
      <Box p={[0, 0.65, -0.12]} s={[1.4, 0.9, 0.95]} c={C.paper} />
      <WindowGrid w={1.4} d={0.95} y0={0.35} y1={1.0} cols={4} rows={2} size={0.16} />
      {[-0.55, -0.2, 0.2, 0.55].map((x, i) => <Cyl key={i} p={[x, 0.65, 0.48]} r={0.06} h={0.9} c={C.white} seg={12} />)}
      <Box p={[0, 1.15, 0.05]} s={[1.5, 0.1, 1.2]} c={C.stone} />
      <Roof p={[0, 1.2, 0.05]} w={1.5} d={1.2} h={0.35} c={C.blue} />
      <Box p={[0, 0.25, 0.62]} s={[0.25, 0.1, 0.12]} c={C.stone} />
    </>
  );
}
function ChungCu() {
  return (
    <>
      <Box p={[0, 1.0, 0]} s={[1.2, 2.0, 1.1]} c={C.white} />
      <WindowGrid w={1.2} d={1.1} y0={0.25} y1={1.9} cols={3} rows={5} size={0.17} />
      {[0.6, 1.0, 1.4].map((y, i) => <Box key={i} p={[0, y, 0.6]} s={[1.0, 0.04, 0.14]} r={0.01} c={C.stone} />)}
      <Box p={[0, 2.06, 0]} s={[1.25, 0.12, 1.15]} c={C.brick} />
      <Box p={[0.3, 2.25, -0.2]} s={[0.3, 0.3, 0.3]} c={C.stone} />
      <Box p={[0, 0.2, 0.56]} s={[0.3, 0.4, 0.04]} r={0.02} c={C.door} />
    </>
  );
}
function CongVien() {
  return (
    <>
      <Box p={[0, 0.03, 0]} s={[1.75, 0.06, 1.75]} c={C.grass2} r={0.04} />
      <Box p={[0, 0.07, 0]} s={[0.3, 0.02, 1.7]} r={0} c={C.walk} cast={false} />
      <Box p={[0, 0.07, 0]} s={[1.7, 0.02, 0.3]} r={0} c={C.walk} cast={false} />
      <Cyl p={[0, 0.12, 0]} r={0.38} h={0.12} c={C.stone} />
      <Cyl p={[0, 0.17, 0]} r={0.32} h={0.04} c={C.water} rough={0.15} />
      <Cyl p={[0, 0.35, 0]} r={0.05} h={0.35} c={C.stone} seg={10} />
      <Ball p={[0, 0.55, 0]} r={0.08} c={C.water} rough={0.1} />
      <Tree p={[-0.6, 0, -0.6]} s={0.8} /><Tree p={[0.6, 0, -0.6]} s={0.7} c={C.leaf2} /><Tree p={[-0.6, 0, 0.6]} s={0.7} c={C.leaf2} /><Pine p={[0.6, 0, 0.6]} s={0.7} />
      <Box p={[0.45, 0.12, 0.2]} s={[0.1, 0.06, 0.35]} c={C.wood} />
    </>
  );
}
function Thap() {
  const legs: [number, number][] = [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]];
  return (
    <>
      <Box p={[0, 0.06, 0]} s={[1, 0.12, 1]} c={C.stone} />
      {legs.map(([x, z], i) => <Box key={i} p={[x * 0.7, 1.2, z * 0.7]} s={[0.08, 2.4, 0.08]} r={0.02} c="#7a8592" rot={[z * 0.08, 0, -x * 0.08]} />)}
      {[0.7, 1.4].map((y, i) => <Box key={i} p={[0, y, 0]} s={[0.5, 0.05, 0.5]} r={0.01} c="#7a8592" />)}
      <Cyl p={[0, 2.5, 0]} r={0.42} h={0.45} c={C.glass} rough={0.15} metal={0.3} />
      <Cyl p={[0, 2.78, 0]} r={0.47} h={0.1} c={C.red} />
      <mesh position={[0, 3.0, 0]} castShadow><coneGeometry args={[0.35, 0.35, 12]} /><meshStandardMaterial color={C.red} roughness={0.5} /></mesh>
      <Cyl p={[0, 3.4, 0]} r={0.015} h={0.5} c="#3d4148" seg={6} />
      <Ball p={[0, 3.67, 0]} r={0.05} c={C.red} emissive={C.red} ei={1.5} />
    </>
  );
}
function Kinh() {
  return (
    <>
      <Box p={[0, 1.25, 0]} s={[1.1, 2.5, 1.1]} c={C.teal} metal={0.4} rough={0.15} />
      {[0.5, 1.0, 1.5, 2.0].map((y, i) => <Box key={i} p={[0, y, 0]} s={[1.14, 0.05, 1.14]} r={0.01} c={C.white} />)}
      <WindowGrid w={1.1} d={1.1} y0={0.3} y1={2.4} cols={3} rows={5} size={0.15} />
      <Box p={[0, 2.56, 0]} s={[1.0, 0.12, 1.0]} c={C.leaf} />
      <Bush p={[-0.25, 2.6, -0.2]} s={0.8} /><Bush p={[0.25, 2.6, 0.2]} s={0.7} />
    </>
  );
}
function Truong() {
  return (
    <>
      <Box p={[0, 0.1, 0]} s={[1.8, 0.2, 1.5]} c={C.stone} />
      <Box p={[0, 0.65, -0.1]} s={[1.6, 0.9, 1.1]} c={C.paper} />
      <WindowGrid w={1.6} d={1.1} y0={0.35} y1={1.0} cols={5} rows={2} size={0.14} />
      {[-0.6, -0.3, 0, 0.3, 0.6].map((x, i) => <Cyl key={i} p={[x, 0.65, 0.55]} r={0.05} h={0.9} c={C.white} seg={12} />)}
      <Box p={[0, 1.15, 0]} s={[1.7, 0.1, 1.35]} c={C.stone} />
      <Cyl p={[0, 1.35, -0.1]} r={0.38} h={0.3} c={C.paper} />
      <mesh position={[0, 1.5, -0.1]} castShadow>
        <sphereGeometry args={[0.38, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={C.gold} metalness={0.5} roughness={0.3} />
      </mesh>
      <Cyl p={[0, 2.05, -0.1]} r={0.015} h={0.35} c="#3d4148" seg={6} />
      <Box p={[0.12, 2.15, -0.1]} s={[0.22, 0.14, 0.02]} r={0.01} c={C.red} />
    </>
  );
}

const MODELS: Record<ItemId, ComponentType> = {
  cay: Cay, hoa: Hoa, nhanho: NhaNho, vuon: Vuon, quan: Quan, san: San,
  thuvien: ThuVien, chungcu: ChungCu, congvien: CongVien, thap: Thap, kinh: Kinh, truong: Truong,
};
/** Chiều cao gần đúng của từng công trình, để đặt ngôi sao mạ vàng phía trên. */
export const ITEM_HEIGHT: Record<ItemId, number> = {
  cay: 1.1, hoa: 0.4, nhanho: 1.2, vuon: 1.3, quan: 1.1, san: 0.9, thuvien: 1.6, chungcu: 2.5, congvien: 1.0, thap: 3.8, kinh: 2.8, truong: 2.3,
};

export function ItemModel({ id }: { id: ItemId }) {
  const M = MODELS[id];
  return M ? <M /> : null;
}

/** Trang trí lô đất trống (ruộng, cây bụi) theo số lô, giống bản 2D. */
export function EmptyLot({ i }: { i: number }) {
  const m = i % 6;
  if (m === 0 || m === 3) {
    const cols = m === 0 ? [C.yellow, C.orange] : [C.green, C.leaf];
    return (
      <>
        {[0, 1, 2, 3, 4].map((k) => <Box key={k} p={[-0.6 + k * 0.3, 0.06, 0]} s={[0.2, 0.12, 1.4]} r={0.04} c={cols[k % 2]} cast={false} />)}
      </>
    );
  }
  const bx = (((i * 13 + 5) % 19) - 9) / 20, bz = (((i * 7 + 2) % 9) - 4) / 10;
  return m === 1 ? <><Tree p={[bx, 0, bz]} s={0.75} /><Bush p={[-bx - 0.3, 0, -bz + 0.3]} s={0.6} /></> : <><Bush p={[bx, 0, bz]} s={0.9} /><Bush p={[-bx, 0, -bz - 0.2]} s={0.6} /></>;
}

export { Lamp };
