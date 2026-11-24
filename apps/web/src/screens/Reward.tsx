import { useState, type CSSProperties } from 'react';
import { ITEMS, LV, TIERS, type ItemId, type Player, type SessionResult } from '@tptl/shared';
import { Icon } from '../components/Icons';
import { CityView } from '../components/CityView';
import { ItemArt } from '../components/Svg';
import { Card, Confetti, CountUp, Eyebrow, Stat3, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { usePatchMyPlayer } from '../lib/queries';

/** Màu hạng công trình (token --t1…--t4) cho thẻ và nhãn. */
const tierStyle = (t: number) => ({ ['--tc' as string]: `var(--t${t})` }) as CSSProperties;

export function Reward({ gid, player, result: r, onAllPlaced }: { gid: string; player: Player; result: SessionResult | null; onAllPlaced: () => void }) {
  const toast = useToast();
  const patch = usePatchMyPlayer(gid);
  const [item, setItem] = useState<ItemId | null>(null);
  const [busy, setBusy] = useState(false);
  const pend = player.pending[0];
  const avail = ITEMS.filter((i) => i.t <= pend.t);
  const tier = TIERS[pend.t - 1];
  const levelUp = !!r && r.newLv > r.prevLv;

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
      {r && <Confetti count={levelUp || r.shiny ? 110 : 70} />}
      {r && (
        <Card className="reward-hero items-center text-center">
          <div className="pop-in grid size-20 place-items-center rounded-full bg-linear-to-b from-[#ffe07a] to-[#f6ac14] shadow-[0_8px_24px_rgba(246,172,20,.45),inset_0_2px_0_rgba(255,255,255,.6)]">
            <Icon name="group" className="size-11 drop-shadow-[0_2px_0_rgba(0,0,0,.2)]" />
          </div>
          <div>
            <Eyebrow>Kết quả phiên</Eyebrow>
            <h2 className="text-[28px]">Hoàn thành {r.minutes} phút</h2>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xl font-bold">
            <span className="flex items-center gap-1.5 rounded-full border border-[#ffb37a] bg-[color-mix(in_srgb,#ff7a29_10%,var(--surface))] px-3 py-1 text-base">
              <Icon name="fire" className="flame size-6" />Chuỗi {r.stats.currentStreak} phiên
            </span>
          </div>
          <div className="w-full max-w-md">
            <Stat3 items={[[<CountUp key="f" to={r.focus} />, 'điểm tập trung'], [r.qc + '/' + r.qa, 'câu đúng'], [r.mode === 'screen' ? <CountUp key="w" to={r.dist + r.missed} delay={150} /> : '–', 'cảnh báo']]} />
          </div>
          {levelUp && (
            <div className="levelup pop-in flex w-full max-w-md items-center gap-3 text-left" style={{ animationDelay: '.35s' }}>
              <Icon name="sparkle" className="size-9 flex-none" />
              <p><b>Nhà của bạn lên giai đoạn mới: {LV[r.newLv - 1].n}.</b></p>
            </div>
          )}
          {r.shiny && (
            <p className="shiny flex items-center gap-2 rounded-xl border border-[#efbd35] bg-[color-mix(in_srgb,#efbd35_14%,var(--surface))] px-3 py-2 text-sm">
              <Icon name="star" className="size-5 flex-none fill-[#efbd35]" />Điểm tập trung từ 85 trở lên nên công trình được mạ vàng.
            </p>
          )}
          {!r.verified && <p className="max-w-md text-[13px] text-muted">Phiên này chưa xác minh: bạn vẫn nhận công trình, nhưng {r.minutes} phút không tính vào giai đoạn nhà và không có điểm nhóm.</p>}
        </Card>
      )}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Eyebrow>Phần thưởng hạng “{tier.n}” · {pend.m} phút{player.pending.length > 1 ? ` · còn ${player.pending.length} phần thưởng` : ''}</Eyebrow>
            <h2>Chọn một công trình</h2>
          </div>
          <span className="tier-tag" style={tierStyle(pend.t)}>{'★'.repeat(pend.t)} {tier.n}</span>
        </div>
        <div className="itemgrid">
          {avail.map((i, k) => (
            <button key={i.id} type="button" data-tier={i.t} style={{ animationDelay: k * 45 + 'ms' }}
              className={'itm pop-in' + (pend.g ? ' shiny' : '')} aria-pressed={item === i.id} onClick={() => setItem(i.id)}>
              <ItemArt id={i.id} g={pend.g} />
              {i.n}<small>hạng {TIERS[i.t - 1].n}</small>
            </button>
          ))}
        </div>
        <p className={'rounded-lg px-3 py-2 text-[13px] transition-colors ' + (item ? 'bg-[color-mix(in_srgb,var(--lamp)_14%,var(--surface))] text-ink' : 'text-muted')}>
          {item ? 'Bấm vào một lô đất trên bản đồ để xây: lô vàng là đất trống, lô đỏ đang có công trình và sẽ bị thay.' : 'Hạng cao hơn mở thêm công trình. Càng cam kết lâu, công trình càng hiếm.'}
        </p>
      </Card>
      <CityView owner={player} onPick={item ? place : undefined} />
    </section>
  );
}
