/* Trưởng nhóm: mã mời để học sinh vào nhóm, và mã cá nhân của từng thành viên để ghép với dữ liệu khảo sát. */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LIMITS, PARTICIPANT_RE, type GroupDetail, type Player } from '@tptl/shared';
import { Button, Card, inputCls, Pill, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { qk } from '../lib/queries';

function CodeRow({ gid, p }: { gid: string; p: Player }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [v, setV] = useState(p.participantCode ?? '');
  const [busy, setBusy] = useState(false);
  const code = v.trim().toUpperCase();
  const changed = code !== (p.participantCode ?? '');

  async function save() {
    if (!PARTICIPANT_RE.test(code)) { toast('Mã cá nhân chỉ gồm chữ không dấu, số, dấu gạch ngang, gạch dưới, dấu chấm.'); return; }
    setBusy(true);
    try {
      await api('PATCH', `/groups/${gid}/players/${p.id}/participant`, { participantCode: code });
      await qc.invalidateQueries({ queryKey: qk.group(gid) });
      toast(`Đã lưu mã ${code} cho ${p.name}.`);
    } catch (e) { toast(errorMessage(e)); }
    setBusy(false);
  }

  return (
    <li className="flex flex-wrap items-center gap-2.5 border-t border-line pt-2.5">
      <span className="min-w-0 flex-[1_1_140px] font-semibold">{p.name}</span>
      {!p.participantCode && <Pill tone="warn">Chưa có mã</Pill>}
      <div className="w-40 flex-none">
        <input className={inputCls + ' uppercase'} value={v} onChange={(e) => setV(e.target.value)} maxLength={LIMITS.participantCode} aria-label={`Mã cá nhân của ${p.name}`} placeholder="VD: T0-015" />
      </div>
      <Button disabled={!changed || !code || busy} onClick={save}>Lưu</Button>
    </li>
  );
}

export function GroupAccessCard({ gid, detail }: { gid: string; detail: GroupDetail }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const code = detail.group.inviteCode;
  const missing = detail.players.filter((p) => !p.participantCode).length;

  async function renew() {
    if (!window.confirm('Đổi mã mời? Mã cũ sẽ hết hiệu lực; thành viên đang ở trong nhóm không bị ảnh hưởng.')) return;
    setBusy(true);
    try {
      await api('POST', `/groups/${gid}/invite`);
      await qc.invalidateQueries({ queryKey: qk.group(gid) });
      toast('Đã đổi mã mời.');
    } catch (e) { toast(errorMessage(e)); }
    setBusy(false);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(code ?? ''); toast('Đã chép mã mời.'); } catch { toast('Không chép được, hãy chép tay mã trên màn hình.'); }
  }

  return (
    <Card>
      <h3>Mã mời và mã cá nhân</h3>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-hud text-[34px] tracking-[.25em] text-ptitle" aria-label="Mã mời">{code ?? '–'}</span>
        <Button onClick={copy} disabled={!code}>Chép mã</Button>
        <Button onClick={renew} disabled={busy}>Đổi mã mời</Button>
      </div>
      <p className="text-[13px] text-muted">
        Gửi mã này cho học sinh trong nhóm. Ai có mã đều vào được, nên chỉ gửi trong lớp; nếu lỡ lộ, bấm “Đổi mã mời”.
        Khi vào nhóm, học sinh phải nhập mã cá nhân để dữ liệu ghép được với phiếu khảo sát. Mã cá nhân sai thì sửa ở đây.
      </p>
      {detail.players.length > 0 && (
        <>
          <p className="text-sm">{missing ? <b>{missing} thành viên chưa có mã cá nhân.</b> : 'Mọi thành viên đã có mã cá nhân.'}</p>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {detail.players.map((p) => <CodeRow key={p.id + (p.participantCode ?? '')} gid={gid} p={p} />)}
          </ul>
        </>
      )}
    </Card>
  );
}
