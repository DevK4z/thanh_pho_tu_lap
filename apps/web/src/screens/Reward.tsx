import { useState } from 'react';
import { ITEMS, LV, TIERS, type ItemId, type Player, type SessionResult } from '@tptl/shared';
import { City, ItemArt } from '../components/Svg';
import { Card, Eyebrow, Stat3, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { usePatchMyPlayer } from '../lib/queries';

export function Reward({ gid, player, result: r, onAllPlaced }: { gid: string; player: Player; result: SessionResult | null; onAllPlaced: () => void }) {
  const toast = useToast();
  const patch = usePatchMyPlayer(gid);
  const [item, setItem] = useState<ItemId | null>(null);
  const [busy, setBusy] = useState(false);
  const pend = player.pending[0];
  const avail = ITEMS.filter((i) => i.t <= pend.t);

  async function place(slot: number) {
    if (!item || busy) return;
    setBusy(true);
    try {
      const p = await api<Player>('POST', `/groups/${gid}/plot`, { item, slot });
      patch(p);
      toast('Đã xây ' + ITEMS.find((x) => x.id === item)!.n + ' trong thành phố.');
      setItem(null);
      if (!p.pending.length) onAllPlaced();
    } catch (e) { toast(errorMessage(e)); }
    setBusy(false);
  }

  return (
    <section className="flex flex-col gap-3.5">
      {r && (
        <Card>
          <Eyebrow>Kết quả phiên</Eyebrow>
          <h2>Hoàn thành {r.minutes} phút</h2>
          <Stat3 items={[[r.focus, 'điểm tập trung'], [r.qc + '/' + r.qa, 'câu đúng'], [r.mode === 'screen' ? r.dist + r.missed : '–', 'xao nhãng']]} />
          {r.newLv > r.prevLv && <p><b>Nhà của bạn lên giai đoạn mới: {LV[r.newLv - 1].n}.</b></p>}
          {r.shiny && <p>Điểm tập trung từ 85 trở lên nên công trình được mạ vàng.</p>}
        </Card>
      )}
      <Card>
        <div>
          <Eyebrow>Phần thưởng hạng “{TIERS[pend.t - 1].n}” · {pend.m} phút{player.pending.length > 1 ? ` · còn ${player.pending.length} phần thưởng` : ''}</Eyebrow>
          <h2>Chọn một công trình</h2>
        </div>
        <div className="itemgrid">
          {avail.map((i) => (
            <button key={i.id} type="button" className="itm" aria-pressed={item === i.id} onClick={() => setItem(i.id)}>
              <ItemArt id={i.id} g={pend.g} />
              {i.n}<small>hạng {TIERS[i.t - 1].n}</small>
            </button>
          ))}
        </div>
        <p className="text-[13px] text-muted">
          {item ? 'Bấm vào một lô đất nét đứt trên bản đồ để xây. Lô viền đỏ đang có công trình và sẽ bị thay.' : 'Hạng cao hơn mở thêm công trình. Càng cam kết lâu, công trình càng hiếm.'}
        </p>
      </Card>
      <City owner={player} onPick={item ? place : undefined} />
    </section>
  );
}
