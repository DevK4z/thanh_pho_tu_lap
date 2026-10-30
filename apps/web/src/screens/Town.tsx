import { HST, ITEMS, SLOTS, TIERS, dkey, emptyDay, keysBack, levelOf, metrics, popOf, streakOf, sumDays, type GroupDetail, type Player } from '@tptl/shared';
import { Icon, type IconName } from '../components/Icons';
import { City, House, ItemArt } from '../components/Svg';
import { Banner, Button, Meter } from '../components/ui';
import { fmtMin, num, pct } from '../lib/format';
import type { Tab } from './GroupApp';

export function Town({ detail, player: me, onTab, onReward }: { detail: GroupDetail; player: Player; onTab: (t: Tab) => void; onReward: () => void }) {
  const L = levelOf(me.totalFocusMin);
  const today = me.days[dkey(Date.now())] ?? emptyDay();
  const m = metrics(sumDays(me.days, keysBack(30)), 30, me.createdAt);
  const hs = HST[me.style] ?? HST.ngoi;
  const np = me.pending.length;
  const doneMin = Math.round(today.cs / 60);
  const stats: [IconName, string, string | number][] = [
    ['pop', 'Dân số', popOf(me.plot)], ['min', 'Phút tập trung', Math.round(me.totalFocusMin)], ['disc', 'Kỷ luật', num(m.disc)],
    ['focus', 'Tập trung sâu', num(m.focus)], ['ok', 'Cam kết', pct(m.comp)],
  ];
  const tools: [IconName, string, () => void, boolean?][] = [
    ['build', 'Xây dựng', onReward, !np], ['timer', 'Tập trung', () => onTab('focus')], ['chart', 'Tiến bộ', () => onTab('mine')], ['group', 'Cả nhóm', () => onTab('group')],
  ];

  return (
    <section className="flex flex-col gap-3.5">
      <div className="pk hudtop">
        <div className="lvbadge" title="Giai đoạn nhà">{L.lv}</div>
        <div><h2 className="ptitle">Thành phố của {me.name}</h2><p className="psub">{hs.n} · {L.n}</p></div>
      </div>
      <div className="pk statbar">
        {stats.map(([ic, label, v]) => <div key={label} className="stat"><Icon name={ic} /><div><span>{label}</span><b>{v}</b></div></div>)}
      </div>
      {np > 0 && (
        <Banner className="flex flex-wrap items-center justify-between gap-2.5">
          <span>Bạn có {np} phần thưởng chưa đặt lên bản đồ.</span>
          <Button variant="lamp" onClick={onReward}>Chọn công trình</Button>
        </Banner>
      )}
      <div className="game">
        <nav className="pk tool" aria-label="Công cụ">
          {tools.map(([ic, label, fn, off], i) => (
            <button key={label} type="button" className={'tbtn' + (i === 0 ? ' on' : '')} onClick={fn} disabled={off} style={off ? { opacity: 0.55, cursor: 'default' } : undefined}>
              <Icon name={ic} />{label}{i === 0 && np > 0 && <i>{np}</i>}
            </button>
          ))}
        </nav>
        <City owner={me} />
        <aside className="pk info">
          <div className="ipill">{hs.n}</div>
          <div className="ihouse"><House style={me.style} lv={L.lv} viewBox="-60 -118 120 150" /></div>
          <div className="stars">
            <span>Giai đoạn {L.lv}/5</span>
            {[1, 2, 3, 4, 5].map((k) => <Icon key={k} name="star" style={{ fill: k <= L.lv ? '#f6b21b' : 'var(--pkline)' }} />)}
          </div>
          {L.next ? (
            <div>
              <Meter value={me.totalFocusMin - L.at} max={L.next.at - L.at} label="Tiến độ lên giai đoạn tiếp theo" />
              <p className="mt-1.5 text-[13px] text-muted">Còn {fmtMin(L.next.at - me.totalFocusMin)} để lên “{L.next.n}”.</p>
            </div>
          ) : <p className="text-[13px] text-muted">Nhà của bạn đã hoàn thiện.</p>}
          <div className="irow"><span>Hôm nay</span><b>{doneMin} / {me.dailyGoal} phút</b></div>
          <div className="irow"><span>Chuỗi ngày liên tiếp</span><b>{streakOf(me.days)} ngày</b></div>
          <div className="irow"><span>Công trình đã xây</span><b>{me.plot.length} / {SLOTS.length}</b></div>
          <div className="irow"><span>Tổng tích lũy</span><b>{fmtMin(me.totalFocusMin)}</b></div>
          <button type="button" className="gbtn y" onClick={() => onTab('focus')}>▶ Bắt đầu tập trung</button>
          <button type="button" className="gbtn t" onClick={onReward} disabled={!np}>Chọn công trình{np ? ` (${np})` : ''}</button>
        </aside>
      </div>
      <div className="pk dock">
        <h3>Kho công trình</h3>
        <div className="dockrow">
          {ITEMS.map((i) => (
            <div key={i.id} className="dk">
              <ItemArt id={i.id} ground={false} viewBox="-48 -118 96 140" />
              <b>{i.n}</b><small>hạng {TIERS[i.t - 1].n} · {TIERS[i.t - 1].min} phút</small>
            </div>
          ))}
        </div>
      </div>
      <div className="pk p-3.5">
        <div className="mb-2.5">
          <h3 className="font-hud text-[22px] uppercase text-ptitle">Khu phố {detail.group.name}</h3>
          <p className="text-[13px] text-muted">Thành phố của {detail.players.length} thành viên, xếp theo tiến độ xây dựng.</p>
        </div>
        <div className="townhouses">
          {detail.players.map((p) => (
            <div key={p.id} className="thouse">
              <City owner={p} className="contents" />
              <div><b>{p.name}{p.id === me.id ? ' (bạn)' : ''}</b><span className="text-muted">{levelOf(p.totalFocusMin).n} · {p.plot.length} công trình</span></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
