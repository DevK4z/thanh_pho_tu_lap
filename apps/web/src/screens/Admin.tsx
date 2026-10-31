import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ACTS, ACT_KEYS, LIMITS, delta, dkey, keysBack, metrics, sumDays, type ActKey, type GroupDetail, type GroupQuestion } from '@tptl/shared';
import { Button, Card, Eyebrow, Field, inputCls, Pill, tableCls as t, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { dmy, num, pct } from '../lib/format';
import { qk, useLogs, useQuestions } from '../lib/queries';
import { LogTable } from './LogTable';

function exportCSV(d: GroupDetail) {
  const keys = keysBack(365), k7 = keysBack(7);
  const rows: (string | number)[][] = [['Tên', 'Ngày tham gia', 'Vàng', 'Gỗ', 'Chuỗi hiện tại', 'Chuỗi dài nhất', 'Phiên thành công (tổng)', 'Phiên thất bại (tổng)', 'Tổng phút tập trung', 'Phiên đăng ký', 'Hoàn thành', 'Bỏ cuộc', 'Tỷ lệ hoàn thành', 'Lần rời trang', 'Không phản hồi', 'Trả lời đúng', 'Điểm tập trung TB', 'Điểm kỷ luật 7 ngày', 'Hoạt động gần nhất']];
  for (const p of d.players) {
    const a = metrics(sumDays(p.days, keys), 365, p.createdAt), w = metrics(sumDays(p.days, k7), 7, p.createdAt);
    rows.push([p.name, dkey(p.createdAt), p.gold, p.wood, p.currentStreak, p.bestStreak, p.tasksDone, p.tasksFailed, p.totalFocusMin, a.s, a.c, a.q, a.comp == null ? '' : Math.round(a.comp * 100) + '%', a.dn, a.ms, a.quiz == null ? '' : Math.round(a.quiz * 100) + '%', a.focus ?? '', w.disc ?? '', p.lastAt ? dkey(p.lastAt) : '']);
  }
  const csv = '﻿' + rows.map((r) => r.map((c) => { const s = String(c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `thanh-pho-tu-lap-${dkey(Date.now())}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}

export function Admin({ gid, detail }: { gid: string; detail: GroupDetail }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [sel, setSel] = useState<string | null>(null);
  const logs = useLogs(gid, sel);
  const questions = useQuestions(gid);
  const [form, setForm] = useState({ act: 'all' as ActKey | 'all', q: '', o: ['', '', '', ''], a: 0 });
  const [busy, setBusy] = useState(false);
  const k7 = keysBack(7), p7 = keysBack(7, 7);
  const rows = detail.players
    .map((p) => ({ p, m: metrics(sumDays(p.days, k7), 7, p.createdAt), pm: metrics(sumDays(p.days, p7), 7, p.createdAt) }))
    .sort((a, b) => b.m.cs - a.m.cs);
  const selected = detail.players.find((p) => p.id === sel);

  async function addQ() {
    const q = form.q.trim(), o = form.o.map((x) => x.trim());
    if (!q || o.some((x) => !x)) { toast('Cần nhập đủ câu hỏi và 4 đáp án.'); return; }
    setBusy(true);
    try {
      const created = await api<GroupQuestion>('POST', `/groups/${gid}/questions`, { act: form.act, q, o, a: form.a });
      qc.setQueryData<GroupQuestion[]>(qk.questions(gid), (x) => (x ?? []).concat([created]));
      setForm({ act: form.act, q: '', o: ['', '', '', ''], a: 0 });
      toast('Đã thêm câu hỏi.');
    } catch (e) { toast(errorMessage(e)); }
    setBusy(false);
  }
  async function delQ(id: string) {
    try {
      await api('DELETE', `/groups/${gid}/questions/${id}`);
      qc.setQueryData<GroupQuestion[]>(qk.questions(gid), (x) => (x ?? []).filter((q) => q.id !== id));
      toast('Đã xóa câu hỏi.');
    } catch (e) { toast(errorMessage(e)); }
  }

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div><Eyebrow>{detail.isOwner ? 'Dành cho trưởng nhóm' : 'Quản trị viên ứng dụng · trưởng nhóm: ' + detail.group.ownerName}</Eyebrow><h2>Quản trị nhóm {detail.group.name}</h2></div>
        <Button onClick={() => { exportCSV(detail); toast('Đã tải file CSV.'); }}>Xuất CSV</Button>
      </div>
      <Card>
        <h3>Từng thành viên (7 ngày)</h3>
        <p className="text-[13px] text-muted">Bấm vào một dòng để xem các phiên gần đây và ghi chú của thành viên.</p>
        <div className={t.wrap}>
          <table className={t.table}>
            <thead><tr>{['Thành viên', 'Chuỗi', 'TC/TB', 'Phút', 'Phiên', 'Hoàn thành', 'Bỏ cuộc', 'Xao nhãng', 'Tập trung', 'Kỷ luật', 'Xu hướng', 'Lần cuối'].map((h) => <th key={h} className={t.th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(({ p, m, pm }) => {
                const tr = delta(m.disc, pm.disc);
                const risk = !m.s || (m.comp != null && m.comp < 0.5);
                return (
                  <tr key={p.id} className="cursor-pointer hover:[&>td]:bg-surface2" onClick={() => setSel(p.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSel(p.id)}>
                    <td className={t.td}>{p.name}{risk && <> <Pill tone="warn">Cần chú ý</Pill></>}</td>
                    <td className={t.td}>{p.currentStreak}</td><td className={t.td}>{p.tasksDone}/{p.tasksFailed}</td>
                    <td className={t.td}>{Math.round(m.cs / 60)}</td><td className={t.td}>{m.s}</td><td className={t.td}>{pct(m.comp)}</td><td className={t.td}>{m.q}</td>
                    <td className={t.td}>{m.dn + m.ms}</td><td className={t.td}>{num(m.focus)}</td><td className={t.td}>{num(m.disc)}</td>
                    <td className={t.td}>{tr == null ? '–' : tr >= 3 ? '▲ +' + Math.round(tr) : tr <= -3 ? '▼ ' + Math.round(tr) : '–'}</td>
                    <td className={t.td}>{p.lastAt ? dmy(dkey(p.lastAt)) : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {selected && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2.5"><h3>Các phiên gần đây của {selected.name}</h3><Button onClick={() => setSel(null)}>Đóng</Button></div>
          <LogTable logs={logs.data} error={logs.error} />
        </Card>
      )}
      <Card>
        <div>
          <h3>Ngân hàng câu hỏi</h3>
          <p className="text-[13px] text-muted">Câu hỏi của nhóm (ví dụ nội dung cuốn sách đang đọc) được trộn cùng các câu có sẵn, dùng cho kiểm tra hiện diện giữa phiên và xác nhận cuối phiên. Chọn “Tất cả hoạt động” để câu hỏi xuất hiện ở mọi phiên. Đáp án chỉ lưu trên máy chủ.</p>
        </div>
        <Field label="Áp dụng cho">
          <select className={inputCls} value={form.act} onChange={(e) => setForm({ ...form, act: e.target.value as ActKey | 'all' })}>
            <option value="all">Tất cả hoạt động</option>
            {ACT_KEYS.map((k) => <option key={k} value={k}>{ACTS[k].n}</option>)}
          </select>
        </Field>
        <Field label="Câu hỏi"><input className={inputCls} maxLength={LIMITS.question} value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} /></Field>
        {form.o.map((o, i) => (
          <Field key={i} label={'Đáp án ' + 'ABCD'[i]}>
            <input className={inputCls} maxLength={LIMITS.option} value={o} onChange={(e) => setForm({ ...form, o: form.o.map((x, j) => (j === i ? e.target.value : x)) })} />
          </Field>
        ))}
        <Field label="Đáp án đúng">
          <select className={inputCls} value={form.a} onChange={(e) => setForm({ ...form, a: Number(e.target.value) })}>
            {[0, 1, 2, 3].map((i) => <option key={i} value={i}>{'ABCD'[i]}</option>)}
          </select>
        </Field>
        <div><Button variant="primary" disabled={busy} onClick={addQ}>Thêm câu hỏi</Button></div>
        <div>
          <Eyebrow className="mb-1.5">Câu hỏi đã thêm ({questions.data?.length ?? 0})</Eyebrow>
          {questions.data?.length ? (
            <div className="flex flex-col gap-3.5">
              {questions.data.map((q) => (
                <div key={q.id} className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <Pill>{q.act === 'all' ? 'Tất cả' : ACTS[q.act]?.n ?? q.act}</Pill> {q.q}
                    <br /><span className="text-[13px] text-muted">Đúng: {q.o[q.a]}</span>
                  </div>
                  <Button variant="danger" onClick={() => delQ(q.id)}>Xóa</Button>
                </div>
              ))}
            </div>
          ) : <p className="text-[13px] text-muted">{questions.isPending ? 'Đang tải…' : 'Chưa có câu hỏi riêng của nhóm.'}</p>}
        </div>
      </Card>
    </section>
  );
}
