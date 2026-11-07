/* Thành viên vào nhóm trước khi có mã cá nhân: tự nhập một lần, sau đó chỉ trưởng nhóm sửa được. */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LIMITS, PARTICIPANT_RE, type Player } from '@tptl/shared';
import { Banner, Button, inputCls, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { qk } from '../lib/queries';

export function ParticipantCodeCard({ gid, player }: { gid: string; player: Player }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  const code = v.trim().toUpperCase();

  async function save() {
    if (!PARTICIPANT_RE.test(code)) { toast('Mã cá nhân chỉ gồm chữ không dấu, số, dấu gạch ngang, gạch dưới, dấu chấm.'); return; }
    if (!window.confirm(`Lưu mã cá nhân ${code}? Sau khi lưu, chỉ trưởng nhóm sửa được.`)) return;
    setBusy(true);
    try {
      await api('PATCH', `/groups/${gid}/players/${player.id}/participant`, { participantCode: code });
      await qc.invalidateQueries({ queryKey: qk.group(gid) });
      toast('Đã lưu mã cá nhân.');
    } catch (e) { toast(errorMessage(e)); setBusy(false); }
  }

  return (
    <Banner className="flex flex-wrap items-center gap-2.5">
      <span className="min-w-0 flex-[1_1_260px]"><b>Bạn chưa có mã cá nhân.</b> Nhập mã thầy cô cấp (ví dụ T0-015) để kết quả của bạn được ghép đúng với phiếu khảo sát.</span>
      <div className="w-40 flex-none">
        <input className={inputCls + ' uppercase'} value={v} onChange={(e) => setV(e.target.value)} maxLength={LIMITS.participantCode} aria-label="Mã cá nhân" placeholder="VD: T0-015" />
      </div>
      <Button variant="lamp" disabled={!code || busy} onClick={save}>Lưu mã</Button>
    </Banner>
  );
}
