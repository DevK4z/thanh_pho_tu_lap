import { useState } from 'react';
import { HST, ITEMS, SLOTS, TIERS, dkey, emptyDay, keysBack, levelOf, metrics, popOf, streakOf, sumDays, trustOf, type GroupDetail, type Player } from '@tptl/shared';
import { Icon, type IconName } from '../components/Icons';
import { CityView } from '../components/CityView';
import { City, House, ItemArt } from '../components/Svg';
import { Banner, Button, Meter, Modal } from '../components/ui';
import { fmtMin, num, pct } from '../lib/format';
import type { Tab } from './GroupApp';
import { RecallCard } from './RecallCard';

export function Town({ detail, player: me, onTab, onReward, onRecallDone }: { detail: GroupDetail; player: Player; onTab: (t: Tab) => void; onReward: () => void; onRecallDone: () => void }) {
  const [visit, setVisit] = useState<Player | null>(null);
  const L = levelOf(me.totalFocusMin);
  const today = me.days[dkey(Date.now())] ?? emptyDay();
  const m = metrics(sumDays(me.days, keysBack(30)), 30, me.createdAt);
  const hs = HST[me.style] ?? HST.ngoi;
  const np = me.pending.length;
  const doneMin = Math.round(today.cs / 60);
  const stats: [IconName, string, string | number][] = [
    ['pop', 'Dân số', popOf(me.plot)], ['min', 'Phút đã xác minh', Math.round(me.totalFocusMin)], ['disc', 'Kỷ luật', num(m.disc)],
    ['focus', 'Tập trung sâu', num(m.focus)], ['ok', 'Cam kết', pct(m.comp)], ['shield', 'Tin cậy', num(trustOf(sumDays(me.days, keysBack(30))))],
  ];
  const total = me.tasksDone + me.tasksFailed;
  const resources: [IconName, string, string][] = [
    ['fire', 'Chuỗi phiên', String(me.currentStreak)],
    ['shield', 'Thành công / thất bại', `${me.tasksDone} / ${me.tasksFailed}` + (total ? ` (${Math.round((100 * me.tasksDone) / total)}%)` : '')],
  ];
  const built = new Map<string, number>();
  for (const p of me.plot) built.set(p.i, (built.get(p.i) ?? 0) + 1);
  const goalPct = Math.min(100, Math.round((100 * doneMin) / Math.max(1, me.dailyGoal)));

  return (
    <section className="flex flex-col gap-3.5">
      {np > 0 && (
        <Banner className="flex flex-wrap items-center justify-between gap-2.5">
          <span>Bạn có {np} phần thưởng chưa đặt lên bản đồ.</span>
          <Button variant="lamp" onClick={onReward}>Chọn công trình</Button>
        </Banner>
      )}

      {detail.recall && <RecallCard key={detail.recall.sid} recall={detail.recall} onDone={onRecallDone} />}

      {/* Màn hình game: tiêu đề, tài nguyên, thành phố, nút hành động */}
      <div className="pk overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 pt-2.5 pb-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="lvbadge" title="Giai đoạn nhà">{L.lv}</div>
            <div className="min-w-0"><h2 className="ptitle truncate">Thành phố của {me.name}</h2><p className="psub">{hs.n} · {L.n}</p></div>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Tài nguyên">
            {resources.map(([ic, label, v]) => (
              <div key={label} title={label} className="flex items-center gap-1.5 rounded-full border border-pkline bg-pk2 py-1 pr-3 pl-1.5">
                <Icon name={ic} className="size-6" />
                <span className="sr-only">{label}</span>
                <b className="text-[15px] tabular-nums text-ptitle">{v}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="px-2"><CityView owner={me} height="h-[460px] sm:h-[600px]" /></div>
        <div className="grid grid-cols-2 gap-2 p-2.5 sm:grid-cols-4">
          <button type="button" className="gbtn y" onClick={() => onTab('focus')}>▶ Bắt đầu tập trung</button>
          <button type="button" className="gbtn t" onClick={onReward} disabled={!np}>
            <Icon name="build" className="size-5" />Xây dựng{np ? ` (${np})` : ''}
          </button>
          <button type="button" className="tbtn !flex-row !justify-center gap-2 !text-sm" onClick={() => onTab('mine')}><Icon name="chart" className="!size-6" />Tiến bộ</button>
          <button type="button" className="tbtn !flex-row !justify-center gap-2 !text-sm" onClick={() => onTab('group')}><Icon name="group" className="!size-6" />Cả nhóm</button>
        </div>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[320px_minmax(0,1fr)]">
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
          <div className="irow"><span>Chuỗi ngày liên tiếp</span><b>{streakOf(me.days)} ngày</b></div>
          <div className="irow"><span>Công trình đã xây</span><b>{me.plot.length} / {SLOTS.length}</b></div>
          <div className="irow"><span>Tổng tích lũy</span><b>{fmtMin(me.totalFocusMin)}</b></div>
        </aside>
        <div className="flex min-w-0 flex-col gap-3.5">
          {/* Mục tiêu hôm nay dạng vòng tiến độ */}
          <div className="pk flex items-center gap-4 p-3.5">
            <svg viewBox="0 0 120 120" className="size-24 flex-none" aria-hidden="true">
              <circle cx="60" cy="60" r="50" fill="none" stroke="var(--pkline)" strokeWidth="12" />
              <circle cx="60" cy="60" r="50" fill="none" stroke="#f6b21b" strokeWidth="12" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 50} strokeDashoffset={2 * Math.PI * 50 * (1 - goalPct / 100)} transform="rotate(-90 60 60)" />
              <text x="60" y="58" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--ptitle)">{goalPct}%</text>
              <text x="60" y="80" textAnchor="middle" fontSize="12" fill="var(--psub)">hôm nay</text>
            </svg>
            <div className="min-w-0">
              <p className="font-hud text-[20px] uppercase text-ptitle">Mục tiêu hôm nay</p>
              <p className="irow !border-0 !p-0"><span>Đã tập trung</span><b>{doneMin} / {me.dailyGoal} phút</b></p>
              <p className="mt-1 text-[13px] text-muted">{goalPct >= 100 ? 'Đã đạt mục tiêu hôm nay. Tuyệt vời!' : `Còn ${me.dailyGoal - doneMin} phút nữa để đạt mục tiêu.`}</p>
            </div>
          </div>
          <div className="pk statbar">
            {stats.map(([ic, label, v]) => <div key={label} className="stat"><Icon name={ic} /><div><span>{label}</span><b>{v}</b></div></div>)}
          </div>
        </div>
      </div>

      <div className="pk dock">
        <h3>Kho công trình</h3>
        <div className="dockrow">
          {ITEMS.map((i) => {
            const n = built.get(i.id) ?? 0;
            return (
              <div key={i.id} className={'dk relative' + (n ? '' : ' opacity-60')}>
                {n > 0 && <span className="absolute top-1 right-1 rounded-full bg-[#e5483a] px-1.5 text-[11px] font-bold text-white">×{n}</span>}
                <ItemArt id={i.id} ground={false} viewBox="-48 -118 96 140" />
                <b>{i.n}</b><small>hạng {TIERS[i.t - 1].n} · {TIERS[i.t - 1].min} phút</small>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pk p-3.5">
        <div className="mb-2.5">
          <h3 className="font-hud text-[22px] uppercase text-ptitle">Khu phố {detail.group.name}</h3>
          <p className="text-[13px] text-muted">Thành phố của {detail.players.length} thành viên, xếp theo tiến độ xây dựng. Bấm vào một thành phố để tham quan.</p>
        </div>
        <div className="townhouses">
          {detail.players.map((p) => (
            <button key={p.id} type="button" className="thouse text-left transition hover:-translate-y-0.5 hover:shadow-lg" onClick={() => setVisit(p)}
              aria-label={`Tham quan thành phố của ${p.name}`}>
              <City owner={p} className="contents" />
              <div><b>{p.name}{p.id === me.id ? ' (bạn)' : ''}</b><span className="text-muted">{levelOf(p.totalFocusMin).n} · {p.plot.length} công trình</span></div>
            </button>
          ))}
        </div>
      </div>

      {visit && (
        <Modal wide label={`Thành phố của ${visit.name}`} onClose={() => setVisit(null)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2>Thành phố của {visit.name}{visit.id === me.id ? ' (bạn)' : ''}</h2>
              <p className="text-[13px] text-muted">
                {(HST[visit.style] ?? HST.ngoi).n} · {levelOf(visit.totalFocusMin).n} · {visit.plot.length} công trình · dân số {popOf(visit.plot)} · chuỗi {visit.currentStreak} phiên
              </p>
            </div>
            <Button onClick={() => setVisit(null)}>Đóng</Button>
          </div>
          <CityView owner={visit} height="h-[60vh] min-h-[360px]" />
        </Modal>
      )}
    </section>
  );
}
