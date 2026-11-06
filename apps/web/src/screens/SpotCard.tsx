/* Lớp 4: bốc thăm phiên để hỏi trực tiếp tại buổi sinh hoạt CLB. Chỉ trưởng nhóm và quản trị viên ứng dụng thấy. */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ACTS, weekKey, type SpotDraw, type SpotResult } from '@tptl/shared';
import { Button, Card, Pill, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { dmy } from '../lib/format';
import { qk, useSpot } from '../lib/queries';

export function SpotCard({ gid }: { gid: string }) {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useSpot(gid);
  const [busy, setBusy] = useState(false);
  const d = q.data;
  const thisWeek = d?.week === weekKey();

  async function draw() {
    setBusy(true);
    try {
      qc.setQueryData<SpotDraw>(qk.spot(gid), await api<SpotDraw>('POST', `/groups/${gid}/spot/draw`));
      toast('Đã bốc thăm phiên kiểm tra cho tuần này.');
    } catch (e) { toast(errorMessage(e)); }
    setBusy(false);
  }
  async function mark(sid: string, result: SpotResult) {
    try {
      await api('POST', `/groups/${gid}/spot/${sid}`, { result });
      qc.setQueryData<SpotDraw>(qk.spot(gid), (x) => x && { ...x, rows: x.rows.map((r) => ({ ...r, picks: r.picks.map((p) => (p.sid === sid ? { ...p, result } : p)) })) });
      qc.invalidateQueries({ queryKey: qk.group(gid) });
    } catch (e) { toast(errorMessage(e)); }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0 flex-[1_1_300px]">
          <h3>Kiểm tra trực tiếp</h3>
          <p className="text-[13px] text-muted">
            Bốc ngẫu nhiên 1–2 phiên đã hoàn thành trong 7 ngày của mỗi thành viên. Tại buổi sinh hoạt, mời thành viên kể lại phiên đó trong khoảng 1 phút rồi bấm Khớp hoặc Không khớp.
            Thành viên không biết trước phiên nào được hỏi.
          </p>
        </div>
        <Button variant="primary" disabled={busy} onClick={draw}>{busy ? 'Đang bốc thăm…' : thisWeek ? 'Bốc thăm lại' : 'Bốc thăm tuần này'}</Button>
      </div>
      {q.isError && <p className="text-[13px] text-muted">{errorMessage(q.error)}</p>}
      {d && !d.week && <p className="text-[13px] text-muted">Chưa bốc thăm lần nào.</p>}
      {d?.week && (
        <>
          <p className="text-[13px] text-muted">
            Lượt bốc tuần {dmy(d.week)}{thisWeek ? '' : ' (tuần trước)'}. “Không khớp” trừ số phút của phiên khỏi giai đoạn nhà, phiên mất điểm nhóm và độ tin cậy giảm mạnh. Bốc lại chỉ thay các phiên chưa chấm.
          </p>
          {d.rows.map((r) => (
            <div key={r.playerId} className="grid gap-2 border-t border-line pt-2.5">
              <b>{r.name}</b>
              {r.self && <p className="text-[13px] text-muted">Phiên của bạn do trưởng nhóm hoặc quản trị viên khác kiểm tra.</p>}
              {!r.self && !r.picks.length && <p className="text-[13px] text-muted">Không có phiên hoàn thành trong 7 ngày.</p>}
              {r.picks.map((p) => (
                <div key={p.sid} className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="min-w-0 flex-[1_1_260px] text-sm">
                    <span className="text-[13px] text-muted">{dmy(p.day)} · {ACTS[p.act]?.n ?? p.act} · {p.minutes} phút · {p.verified ? 'đã xác minh' : 'chưa xác minh'}</span>
                    {p.goal && <p>Mục tiêu: {p.goal}</p>}
                    {p.note && <p className="text-[13px]">Ghi chú: “{p.note}”</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {p.result && <Pill tone={p.result === 'ok' ? 'good' : 'bad'}>{p.result === 'ok' ? 'Khớp' : 'Không khớp'}</Pill>}
                    <Button onClick={() => mark(p.sid, 'ok')}>Khớp</Button>
                    <Button onClick={() => mark(p.sid, 'no')}>Không khớp</Button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </Card>
  );
}
