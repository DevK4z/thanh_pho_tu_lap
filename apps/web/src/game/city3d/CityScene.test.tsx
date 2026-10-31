/* Dựng cảnh 3D không cần WebGL (test-renderer): kiểm tra mọi mô hình dựng được, hoạt cảnh chạy được,
   và bấm vào lô đất ở chế độ đặt công trình gọi đúng onPick. */
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { HKEYS, ITEMS, type PlotItem } from '@tptl/shared';
import { CityScene } from './CityScene';

const allItems: PlotItem[] = ITEMS.map((it, i) => ({ s: i * 2, i: it.id, t: it.t, g: (i % 3 === 0 ? 1 : 0) as 0 | 1 }));
const owner = (lvMin: number, style = HKEYS[0], plot = allItems) => ({ name: 'An', style, totalFocusMin: lvMin, plot });
// Mốc phút của 5 giai đoạn nhà.
const LEVEL_MIN = [0, 30, 90, 240, 600];

describe('CityScene', () => {
  it('dựng đủ 12 công trình (có mạ vàng), ban ngày và ban đêm, chạy được hoạt cảnh', async () => {
    for (const night of [false, true]) {
      const r = await ReactThreeTestRenderer.create(<CityScene owner={owner(600)} night={night} />);
      await r.advanceFrames(5, 0.016);
      // Có xe chạy (12 công trình → 6 xe) và đủ lưới mesh.
      expect(r.scene.findAll((n) => n.type === 'Mesh').length).toBeGreaterThan(300);
      await r.unmount();
    }
  }, 30_000);

  it('dựng nhà chính ở cả 5 giai đoạn với mọi kiểu nhà', async () => {
    for (const style of HKEYS) {
      for (const m of LEVEL_MIN) {
        const r = await ReactThreeTestRenderer.create(<CityScene owner={owner(m, style, [])} night={false} />);
        expect(r.scene.children.length).toBeGreaterThan(0);
        await r.unmount();
      }
    }
  }, 60_000);

  it('chế độ đặt công trình: bấm lô gọi onPick, rê chuột hiện tên lô', async () => {
    const onPick = vi.fn();
    const onHover = vi.fn();
    const r = await ReactThreeTestRenderer.create(<CityScene owner={owner(90)} night={false} onPick={onPick} onHover={onHover} />);
    const slot = (i: number) => r.scene.find((n) => n.props.name === 'slot-' + i);
    await r.fireEvent(slot(5), 'click');
    expect(onPick).toHaveBeenCalledWith(5);
    await r.fireEvent(slot(0), 'pointerOver');
    expect(onHover).toHaveBeenLastCalledWith({ label: 'Lô 1 · Cây xanh (mạ vàng) · sẽ bị thay', slot: 0 });
    await r.fireEvent(slot(1), 'pointerOver');
    expect(onHover).toHaveBeenLastCalledWith({ label: 'Lô 2 · bấm để xây', slot: 1 });
    await r.unmount();
  });

  it('chọn công trình không làm công trình biến mất; công trình mới xây có hiệu ứng rồi về đúng kích thước', async () => {
    const plot = allItems.slice(0, 3);
    const onSelect = vi.fn();
    const r = await ReactThreeTestRenderer.create(<CityScene owner={owner(90, HKEYS[0], plot)} night={false} onSelect={onSelect} />);
    const scaleOf = (slot: number) => r.scene.find((n) => n.props.name === 'item-' + slot).children[0].instance.scale.x;
    expect(scaleOf(0)).toBe(1);
    await r.fireEvent(r.scene.find((n) => n.props.name === 'item-2'), 'click');
    expect(onSelect).toHaveBeenCalledWith({ kind: 'item', slot: 2, item: plot[1] });
    await r.update(<CityScene owner={owner(90, HKEYS[0], plot)} night={false} onSelect={onSelect} selected={{ kind: 'item', slot: 2, item: plot[1] }} />);
    await r.advanceFrames(3, 0.016);
    expect([0, 2, 4].map(scaleOf)).toEqual([1, 1, 1]);
    // Xây thêm một công trình: bắt đầu nhỏ, sau ~1,5 giây về kích thước thật.
    const more = plot.concat([{ s: 10, i: 'thap', t: 4, g: 0 }]);
    await r.update(<CityScene owner={owner(90, HKEYS[0], more)} night={false} onSelect={onSelect} />);
    expect(scaleOf(10)).toBeLessThan(0.1);
    await r.advanceFrames(100, 0.02);
    expect(scaleOf(10)).toBe(1);
    expect(scaleOf(0)).toBe(1);
    await r.unmount();
  }, 30_000);

  it('không có onPick thì không có lô bấm được', async () => {
    const r = await ReactThreeTestRenderer.create(<CityScene owner={owner(90)} night={false} />);
    expect(r.scene.findAll((n) => typeof n.props.name === 'string' && n.props.name.startsWith('slot-'))).toHaveLength(0);
    await r.unmount();
  });
});
