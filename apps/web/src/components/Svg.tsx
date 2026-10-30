/* Đưa markup SVG do src/game/iso.ts sinh ra vào DOM. Markup chỉ chứa dữ liệu đã được esc() nên an toàn. */
import { useMemo, type KeyboardEvent, type MouseEvent } from 'react';
import type { HouseStyle, ItemId } from '@tptl/shared';
import { houseSVG, itemSVG, plotSVG, type CityOwner } from '../game/iso';

export function Svg({ viewBox, markup, className, label }: { viewBox: string; markup: string; className?: string; label?: string }) {
  return <svg viewBox={viewBox} className={className} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} dangerouslySetInnerHTML={{ __html: markup }} />;
}

const GRASS = '<polygon class="m-grass" points="0,-16 32,0 0,16 -32,0"/>';
export const House = ({ style, lv, viewBox = '-48 -88 96 112', className }: { style: HouseStyle; lv: number; viewBox?: string; className?: string }) => (
  <Svg viewBox={viewBox} className={className} markup={GRASS + houseSVG(style, lv)} />
);
export const ItemArt = ({ id, g = 0, ground = true, viewBox = '-48 -132 96 152', className }: { id: ItemId; g?: number; ground?: boolean; viewBox?: string; className?: string }) => (
  <Svg viewBox={viewBox} className={className} markup={(ground ? GRASS : '') + itemSVG(id, g)} />
);

/** Bản đồ thành phố. Có onPick thì các lô đất bấm được (chuột hoặc Enter/Space). */
export function City({ owner, onPick, className }: { owner: CityOwner; onPick?: (slot: number) => void; className?: string }) {
  const pick = !!onPick;
  const html = useMemo(() => plotSVG(owner, pick), [owner, pick]);
  const slotOf = (t: EventTarget) => (t as Element).closest?.('[data-slot]')?.getAttribute('data-slot');
  const click = (e: MouseEvent) => {
    const s = slotOf(e.target);
    if (s != null && onPick) onPick(Number(s));
  };
  const key = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const s = slotOf(e.target);
    if (s != null && onPick) { e.preventDefault(); onPick(Number(s)); }
  };
  return <div className={className ?? 'scene'} onClick={click} onKeyDown={key} dangerouslySetInnerHTML={{ __html: html }} />;
}
