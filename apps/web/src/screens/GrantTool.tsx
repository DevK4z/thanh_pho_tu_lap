/* Công cụ thử nghiệm của quản trị viên ứng dụng: cấp phần thưởng công trình cho một thành viên,
   để thử kho công trình và việc đặt công trình mà không phải chạy phiên tập trung. */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ITEMS, SLOTS, TIERS, type GrantResult, type GroupDetail } from '@tptl/shared';
import { Button, Card, Check, Chip, Eyebrow, Field, inputCls, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { qk } from '../lib/queries';

export function GrantTool({ gid, detail, onOpenReward }: { gid: string; detail: GroupDetail; onOpenReward: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [pid, setPid] = useState(detail.meId ?? detail.players[0]?.id ?? '');
  const [tier, setTier] = useState(4);
  const [count, setCount] = useState(3);
  const [shiny, setShiny] = useState(false);
  const [busy, setBusy] = useState(false);
  const target = detail.players.find((p) => p.id === pid);
  const isMe = !!target && target.id === detail.meId;

  if (!detail.players.length) {
    return <Card><h3>Công cụ thử nghiệm</h3><p className="text-[13px] text-muted">Nhóm chưa có ai tạo nhà để nhận công trình.</p></Card>;
  }

  async function grant() {
    if (!target) return;
    setBusy(true);
    try {
      const r = await api<GrantResult>('POST', `/groups/${gid}/players/${target.id}/grant`, { rewards: { tier, count, shiny } });
      await qc.invalidateQueries({ queryKey: qk.group(gid) });
      toast(`Đã cấp ${count} phần thưởng cho ${r.name}: hiện có ${r.pending} phần thưởng đang chờ.`);
    } catch (e) { toast(errorMessage(e)); }
    setBusy(false);
  }

  return (
    <Card className="border-lamp">
      <div>
        <Eyebrow>Chỉ quản trị viên ứng dụng thấy mục này</Eyebrow>
        <h3>Công cụ thử nghiệm: cấp công trình</h3>
        <p className="mt-1 text-[13px] text-muted">
          Dùng để thử kho công trình và đặt công trình lên bản đồ mà không phải chạy phiên. Phần thưởng được cấp vào hàng chờ của người nhận,
          họ chọn công trình trong kho và đặt lên bản đồ như phần thưởng thật. Mỗi lần cấp đều được ghi vào log máy chủ.
        </p>
      </div>
      <Field label="Người nhận">
        <select className={inputCls} value={pid} onChange={(e) => setPid(e.target.value)}>
          {detail.players.map((p) => <option key={p.id} value={p.id}>{p.name}{p.id === detail.meId ? ' (bạn)' : ''}</option>)}
        </select>
      </Field>
      {target && (
        <p className="text-[13px] text-muted">
          Hiện có: <b className="text-ink">{target.pending.length}</b> phần thưởng đang chờ · <b className="text-ink">{target.plot.length} / {SLOTS.length}</b> lô đã xây
        </p>
      )}
      <div className="flex flex-wrap gap-2.5">
        {TIERS.map((x) => <Chip key={x.t} pressed={tier === x.t} onClick={() => setTier(x.t)}>Hạng {x.n}</Chip>)}
      </div>
      <p className="text-[13px] text-muted">
        Hạng {TIERS[tier - 1].n} mở {ITEMS.filter((i) => i.t <= tier).length} công trình: {ITEMS.filter((i) => i.t <= tier).map((i) => i.n).join(', ')}.
      </p>
      <div className="flex flex-wrap items-end gap-3.5">
        <Field label="Số phần thưởng (1–20)" className="w-40">
          <input type="number" className={inputCls} min={1} max={20} value={count} onChange={(e) => setCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} />
        </Field>
        <Check checked={shiny} onChange={setShiny}>Mạ vàng (ngôi sao trên công trình)</Check>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Button variant="primary" disabled={busy || !target} onClick={grant}>{busy ? 'Đang cấp…' : 'Cấp cho ' + (target?.name ?? '…')}</Button>
        {isMe && target!.pending.length > 0 && <Button variant="lamp" onClick={onOpenReward}>Mở kho công trình ({target!.pending.length})</Button>}
      </div>
    </Card>
  );
}
