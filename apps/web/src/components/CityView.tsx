/* Hiển thị thành phố ở dạng 3D (mặc định) hoặc 2D. Thư viện 3D chỉ tải khi cần (tách gói riêng);
   máy không có WebGL thì luôn dùng bản 2D. Lựa chọn được nhớ trong trình duyệt. */
import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import type { CityOwner } from '../game/iso';
import { City } from './Svg';

const City3D = lazy(() => import('../game/city3d/City3D'));

let glCache: boolean | null = null;
export function webglAvailable(): boolean {
  if (glCache != null) return glCache;
  try {
    const c = document.createElement('canvas');
    glCache = !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    glCache = false;
  }
  return glCache;
}

const KEY = 'tptl-view';
function loadMode(): '3d' | '2d' {
  try { return localStorage.getItem(KEY) === '2d' ? '2d' : '3d'; } catch { return '3d'; }
}

/** Lỗi khi dựng cảnh 3D (driver đồ hoạ, hết bộ nhớ…) thì quay về bản 2D thay vì làm hỏng cả trang. */
class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function CityView({ owner, onPick, height }: { owner: CityOwner; onPick?: (slot: number) => void; height?: string }) {
  const [mode, setMode] = useState(loadMode);
  const set = (m: '3d' | '2d') => { setMode(m); try { localStorage.setItem(KEY, m); } catch { /* bỏ qua */ } };
  const flat = (
    <div className="relative">
      <City owner={owner} onPick={onPick} />
      {webglAvailable() && (
        <button type="button" onClick={() => set('3d')}
          className="absolute right-2.5 top-2.5 rounded-lg border border-white/40 bg-black/45 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-black/60">
          Xem 3D
        </button>
      )}
    </div>
  );
  if (mode === '2d' || !webglAvailable()) return flat;
  return (
    <Fallback fallback={flat}>
      <Suspense fallback={flat}>
        <City3D owner={owner} onPick={onPick} onSwitch2D={() => set('2d')} height={height} />
      </Suspense>
    </Fallback>
  );
}
