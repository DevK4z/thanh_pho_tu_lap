import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ACTS, type ActiveSession, type Me, type SessionResult } from '@tptl/shared';
import { Button, Card, Muted, useToast } from '../components/ui';
import { Who } from '../components/Who';
import { Layout } from '../components/Layout';
import { api, ApiError, errorMessage } from '../lib/api';
import { qk, useGroup, useGroupMembership } from '../lib/queries';
import { Admin } from './Admin';
import { FocusFailed } from './FocusFailed';
import { FocusRun, type FailInfo, type RunMeasures } from './FocusRun';
import { FocusSetup } from './FocusSetup';
import { FocusVerify } from './FocusVerify';
import { GroupBoard } from './GroupBoard';
import { Mine } from './Mine';
import { Onboard } from './Onboard';
import { Ranking } from './Ranking';
import { Reward } from './Reward';
import { Town } from './Town';

export type Tab = 'town' | 'focus' | 'mine' | 'group' | 'rank' | 'admin';
/** Luồng phiên tập trung: đang chạy → xác nhận → nhận thưởng, hoặc đang chạy → thất bại. */
export type Flow =
  | { step: 'run'; s: ActiveSession }
  | { step: 'verify'; s: ActiveSession; m: RunMeasures }
  | { step: 'reward'; result: SessionResult | null }
  | { step: 'failed'; info: FailInfo };

export function GroupApp({ me, gid }: { me: Me; gid: string }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('town');
  const [flow, setFlow] = useState<Flow | null>(null);
  const inFlow = flow?.step === 'run' || flow?.step === 'verify';
  const q = useGroup(gid, !inFlow);
  const { leave } = useGroupMembership();
  const d = q.data;
  const player = d?.players.find((p) => p.id === d.meId) ?? null;
  const refresh = () => qc.invalidateQueries({ queryKey: qk.group(gid) });

  // Mở lại trang khi đang có phiên: phiên có giám sát là thất bại (đã rời trang), trừ khi đã tới bước xác nhận;
  // máy yếu có thể tải lại trang lúc mở camera. Phiên không giám sát chạy tiếp.
  const resumed = useRef(false);
  useEffect(() => {
    if (!d || resumed.current) return;
    resumed.current = true;
    const a = d.active;
    if (!a || flow) return;
    const over = Date.now() >= a.startedAt + a.plannedSec * 1000;
    if (ACTS[a.act].watch !== 'none' && !(over && a.proof.status !== 'none')) {
      api('POST', `/sessions/${a.id}/quit`, { reason: 'closed', awaySec: 0, dist: 0 })
        .then(() => { toast('Phiên trước bị đóng giữa chừng nên được tính là thất bại.'); refresh(); })
        .catch((e) => toast(errorMessage(e)));
      return;
    }
    setTab('focus');
    setFlow(over ? { step: 'verify', s: a, m: { awaySec: 0, dist: 0 } } : { step: 'run', s: a });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  // Đã đặt hết phần thưởng (kể cả từ thiết bị khác) thì thoát màn nhận thưởng.
  useEffect(() => {
    if (flow?.step === 'reward' && player && !player.pending.length) setFlow(null);
  }, [flow, player]);

  const who = <Who me={me} group={d?.group ?? null} isOwner={!!d?.isOwner} locked={inFlow} />;

  if (q.isError) {
    const gone = q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 403);
    return (
      <Layout who={who}>
        <Card>
          <h2>{gone ? 'Nhóm không còn tồn tại' : 'Chưa đọc được dữ liệu nhóm'}</h2>
          <Muted>{gone ? 'Hãy chọn hoặc lập nhóm khác.' : errorMessage(q.error)}</Muted>
          <div className="flex gap-2.5">
            {!gone && <Button onClick={() => q.refetch()}>Thử lại</Button>}
            <Button variant="primary" onClick={() => leave.mutate()}>Chọn nhóm khác</Button>
          </div>
        </Card>
      </Layout>
    );
  }
  if (!d) return <Layout who={who}><Card><Muted>Đang tải dữ liệu nhóm…</Muted></Card></Layout>;

  const tabs: [Tab, string][] = [['town', 'Thành phố'], ['focus', 'Tập trung'], ['mine', 'Của tôi'], ['group', 'Nhóm'], ['rank', 'Xếp hạng']];
  if (d.canManage) tabs.push(['admin', 'Quản trị']);
  const current: Tab = inFlow || flow?.step === 'failed' ? 'focus' : flow?.step === 'reward' ? 'town' : tab;
  function go(t: Tab) {
    if (inFlow) { toast('Bạn đang trong phiên cam kết.'); return; }
    if (flow?.step === 'failed') setFlow(null);
    if (flow?.step === 'reward' && t !== 'town') { toast('Hãy đặt công trình trước.'); return; }
    setTab(t);
  }
  const nav = (
    <nav className="mb-4 flex gap-1.5 overflow-x-auto border-b border-line pb-2" aria-label="Điều hướng">
      {tabs.map(([k, label]) => (
        <button key={k} type="button" onClick={() => go(k)} aria-current={current === k ? 'page' : undefined}
          className={'whitespace-nowrap rounded-[10px] px-[15px] py-[9px] text-sm font-semibold ' + (current === k ? 'bg-pine text-pine-ink' : 'text-muted hover:bg-surface2')}>
          {label}
        </button>
      ))}
    </nav>
  );

  let body;
  if (flow?.step === 'run') {
    body = <FocusRun me={me} s={flow.s} onFinish={(m) => setFlow({ step: 'verify', s: flow.s, m })} onFailed={(info) => { setFlow({ step: 'failed', info }); refresh(); }} />;
  } else if (flow?.step === 'verify') {
    body = <FocusVerify me={me} s={flow.s} m={flow.m} onDone={async (result) => { await refresh(); setFlow({ step: 'reward', result }); }} onHonest={async () => { await refresh(); setFlow(null); setTab('town'); }} />;
  } else if (flow?.step === 'failed') {
    body = <FocusFailed info={flow.info} onRetry={() => { setFlow(null); setTab('focus'); }} onTown={() => { setFlow(null); setTab('town'); }} />;
  } else if (!player && current !== 'group' && current !== 'rank' && !(current === 'admin' && d.canManage)) {
    // Chưa có nhà thì tạo nhà trước; riêng bảng nhóm và tab Quản trị vẫn mở được (trưởng nhóm, quản trị viên chưa chơi).
    body = <Onboard gid={gid} defaultName={me.name} onCreated={() => setTab('town')} />;
  } else if (flow?.step === 'reward' && player && player.pending.length) {
    body = <Reward gid={gid} player={player} result={flow.result} onAllPlaced={() => { setFlow(null); setTab('town'); }} />;
  } else if (current === 'town' && player) {
    body = <Town detail={d} player={player} onTab={go} onRecallDone={refresh} onReward={() => setFlow({ step: 'reward', result: null })} />;
  } else if (current === 'focus' && player) {
    body = <FocusSetup gid={gid} player={player} recall={d.recall} onRecallDone={refresh} onStart={(s) => setFlow({ step: 'run', s })} />;
  } else if (current === 'mine' && player) {
    body = <Mine gid={gid} player={player} onTab={go} />;
  } else if (current === 'admin' && d.canManage) {
    body = <Admin gid={gid} detail={d} isAppAdmin={me.isAdmin} onOpenReward={() => setFlow({ step: 'reward', result: null })} />;
  } else if (current === 'rank') {
    body = <Ranking meId={d.meId} />;
  } else {
    body = <GroupBoard detail={d} />;
  }

  return <Layout who={who} nav={nav}>{body}</Layout>;
}
