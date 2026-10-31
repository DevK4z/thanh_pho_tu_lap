/* Báo cáo cho quản trị viên ứng dụng: tỷ lệ hoàn thành và bỏ cuộc của từng người ở mọi nhóm. */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dkey, type AdminReport as Report, type AdminReportRow } from '@tptl/shared';
import { BigNumber, Button, Card, Chip, Eyebrow, Grid, inputCls, Muted, Pill, tableCls as t, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { dmy, pct } from '../lib/format';

const PERIODS: [number | null, string][] = [[7, '7 ngày'], [30, '30 ngày'], [90, '90 ngày'], [null, 'Từ đầu']];
const PROVIDER = { google: 'Google', facebook: 'Facebook', guest: 'Khách' } as const;
type SortKey = 'group' | 'completion' | 'quit' | 'registered';

function exportCSV(r: Report) {
  const head = ['Tên', 'Nhóm', 'Đăng nhập', 'Email', 'Phiên đăng ký', 'Hoàn thành', 'Bỏ cuộc', 'Đang chạy', 'Tỷ lệ hoàn thành', 'Tỷ lệ bỏ cuộc', 'Phút đăng ký', 'Phút hoàn thành', 'Tỷ lệ thời gian', 'Chuỗi hiện tại', 'Chuỗi dài nhất', 'Vàng', 'Gỗ', 'Ngày tham gia', 'Hoạt động gần nhất'];
  const p = (v: number | null) => (v == null ? '' : Math.round(v * 1000) / 10 + '%');
  const rows = r.rows.map((x) => [x.name, x.groupName, PROVIDER[x.provider], x.email ?? '', x.registered, x.done, x.failed, x.active, p(x.completionRate), p(x.quitRate), x.plannedMin, x.doneMin, p(x.timeRate), x.currentStreak, x.bestStreak, x.gold, x.wood, dkey(x.createdAt), x.lastAt ? dkey(x.lastAt) : '']);
  const csv = '﻿' + [head, ...rows].map((row) => row.map((c) => { const s = String(c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `bao-cao-hoan-thanh-${r.days ? r.days + '-ngay' : 'tu-dau'}-${dkey(Date.now())}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}

/** Tỷ lệ kèm thanh nhỏ; tô màu theo ngưỡng giống bảng nhóm (hoàn thành từ 75% là tốt, bỏ cuộc trên 20% là cần chú ý). */
function RateCell({ v, kind }: { v: number | null; kind: 'good-high' | 'good-low' }) {
  if (v == null) return <span className="text-muted">–</span>;
  const ok = kind === 'good-high' ? v >= 0.75 : v <= 0.2;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-block h-1.5 w-14 overflow-hidden rounded-full bg-surface2"><i className={'block h-full ' + (ok ? 'bg-good' : 'bg-warn')} style={{ width: Math.round(v * 100) + '%' }} /></span>
      <b className={ok ? 'text-good' : 'text-warn'}>{pct(v)}</b>
    </span>
  );
}

export function AdminReport({ onBack }: { onBack: () => void }) {
  const toast = useToast();
  const [days, setDays] = useState<number | null>(30);
  const [group, setGroup] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('group');
  const report = useQuery({
    queryKey: ['admin-report', days],
    queryFn: () => api<Report>('GET', '/admin/report' + (days ? '?days=' + days : '')),
  });
  const r = report.data;
  const groups = useMemo(() => [...new Set(r?.rows.map((x) => x.groupName) ?? [])].sort(), [r]);
  const rows = useMemo(() => {
    const k = q.trim().toLowerCase();
    const list = (r?.rows ?? []).filter((x) => (!group || x.groupName === group) && (!k || x.name.toLowerCase().includes(k) || (x.email ?? '').toLowerCase().includes(k)));
    const by: Record<SortKey, (a: AdminReportRow, b: AdminReportRow) => number> = {
      group: (a, b) => a.groupName.localeCompare(b.groupName) || a.name.localeCompare(b.name),
      completion: (a, b) => (b.completionRate ?? -1) - (a.completionRate ?? -1),
      quit: (a, b) => (b.quitRate ?? -1) - (a.quitRate ?? -1),
      registered: (a, b) => b.registered - a.registered,
    };
    return list.sort(by[sort]);
  }, [r, group, q, sort]);

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div><Eyebrow>Dành cho quản trị viên ứng dụng · mọi nhóm</Eyebrow><h2>Báo cáo hoàn thành nhiệm vụ</h2></div>
        <div className="flex flex-wrap gap-2.5">
          <Button onClick={onBack}>← Về ứng dụng</Button>
          <Button variant="primary" disabled={!r} onClick={() => { exportCSV(r!); toast('Đã tải file CSV.'); }}>Xuất CSV</Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2.5">{PERIODS.map(([d, l]) => <Chip key={l} pressed={days === d} onClick={() => setDays(d)}>{l}</Chip>)}</div>

      {report.isError && <Card><h3>Không tải được báo cáo</h3><Muted>{errorMessage(report.error)}</Muted></Card>}
      {!r && !report.isError && <Card><Muted>Đang tổng hợp…</Muted></Card>}
      {r && (
        <>
          <Grid cols={3}>
            <Card><Eyebrow>Tỷ lệ hoàn thành chung</Eyebrow><BigNumber>{pct(r.totals.completionRate)}</BigNumber><p className="text-[13px] text-muted">{r.totals.done} / {r.totals.done + r.totals.failed} phiên đã kết thúc</p></Card>
            <Card><Eyebrow>Tỷ lệ bỏ cuộc chung</Eyebrow><BigNumber>{pct(r.totals.quitRate)}</BigNumber><p className="text-[13px] text-muted">{r.totals.failed} phiên thất bại hoặc bỏ cuộc</p></Card>
            <Card><Eyebrow>Quy mô</Eyebrow><BigNumber>{r.totals.players}<span className="text-[22px]"> người</span></BigNumber><p className="text-[13px] text-muted">{r.totals.groups} nhóm · {r.totals.registered} phiên đăng ký{r.totals.active ? ` · ${r.totals.active} đang chạy` : ''}</p></Card>
          </Grid>
          <Card>
            <div className="flex flex-wrap items-end gap-2.5">
              <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-sm font-semibold">Tìm theo tên hoặc email<input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ví dụ: An" /></label>
              <label className="flex min-w-[160px] flex-col gap-1 text-sm font-semibold">Nhóm
                <select className={inputCls} value={group} onChange={(e) => setGroup(e.target.value)}><option value="">Tất cả nhóm</option>{groups.map((g) => <option key={g}>{g}</option>)}</select>
              </label>
              <label className="flex min-w-[160px] flex-col gap-1 text-sm font-semibold">Sắp xếp
                <select className={inputCls} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                  <option value="group">Theo nhóm, tên</option><option value="completion">Hoàn thành cao trước</option><option value="quit">Bỏ cuộc cao trước</option><option value="registered">Đăng ký nhiều trước</option>
                </select>
              </label>
            </div>
            <p className="text-[13px] text-muted">
              Tỷ lệ hoàn thành = phiên hoàn thành ÷ phiên đã đăng ký và đã kết thúc; tỷ lệ bỏ cuộc = phiên thất bại (tự dừng, rời màn hình, đóng trang) ÷ cùng mẫu số. Phiên đang chạy chưa tính.
              Tỷ lệ thời gian = số phút của các phiên hoàn thành ÷ số phút đã đăng ký. {r.days ? `Tính các phiên bắt đầu trong ${r.days} ngày gần nhất.` : 'Tính từ đầu đến nay.'}
            </p>
            <div className={t.wrap}>
              <table className={t.table}>
                <thead><tr>{['Thành viên', 'Nhóm', 'Đăng ký', 'Hoàn thành', 'Bỏ cuộc', 'Tỷ lệ hoàn thành', 'Tỷ lệ bỏ cuộc', 'Phút HT / ĐK', 'Tỷ lệ thời gian', 'Chuỗi', 'Lần cuối'].map((h) => <th key={h} className={t.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {rows.map((x) => (
                    <tr key={x.playerId}>
                      <td className={t.td}><b>{x.name}</b> <Pill>{PROVIDER[x.provider]}</Pill>{x.email && <div className="text-xs text-muted">{x.email}</div>}</td>
                      <td className={t.td}>{x.groupName}</td>
                      <td className={t.td}>{x.registered}{x.active ? <span className="text-muted"> ({x.active} đang chạy)</span> : ''}</td>
                      <td className={t.td}>{x.done}</td>
                      <td className={t.td}>{x.failed}</td>
                      <td className={t.td}><RateCell v={x.completionRate} kind="good-high" /></td>
                      <td className={t.td}><RateCell v={x.quitRate} kind="good-low" /></td>
                      <td className={t.td}>{x.doneMin} / {x.plannedMin}</td>
                      <td className={t.td}>{pct(x.timeRate)}</td>
                      <td className={t.td}>{x.currentStreak} <span className="text-muted">(cao nhất {x.bestStreak})</span></td>
                      <td className={t.td}>{x.lastAt ? dmy(dkey(x.lastAt)) : '–'}</td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td className={t.td} colSpan={11}><span className="text-muted">Không có ai khớp bộ lọc.</span></td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </section>
  );
}
