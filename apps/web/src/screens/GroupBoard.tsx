import { REASONS, delta, keysBack, metrics, sumDays, emptyDay, type GroupDetail, type QuitReason } from '@tptl/shared';
import { Legend, LineChart } from '../components/Charts';
import { BigNumber, Card, Eyebrow, Grid, KV, Meter, Pill, Trend, tableCls as t } from '../components/ui';
import { num, pct } from '../lib/format';

/** Tổng hợp cả nhóm cho tuần thứ `off` tính lùi từ tuần này (0 = 7 ngày gần nhất). */
function groupWeek(d: GroupDetail, off: number) {
  const keys = keysBack(7, 7 * off);
  const T = { ...emptyDay(), act: 0 };
  const act: string[] = [];
  const discs: number[] = [];
  for (const p of d.players) {
    const s = sumDays(p.days, keys);
    for (const f of Object.keys(T) as (keyof typeof T)[]) T[f] += s[f];
    if (s.s > 0) act.push(p.id);
    const m = metrics(s, 7, p.createdAt);
    if (m.disc != null) discs.push(m.disc);
  }
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  return {
    T, act, discs, n: d.players.length, hours: T.cs / 3600,
    disc: discs.length ? Math.round(avg(discs)) : null,
    comp: T.s ? T.c / T.s : null,
    quit: T.s ? T.q / T.s : null,
    focus: T.fn ? Math.round(T.fs / T.fn) : null,
  };
}

export function GroupBoard({ detail }: { detail: GroupDetail }) {
  if (!detail.players.length) {
    return <Card as="section"><h2>Chưa có thành viên</h2><p className="text-muted">Khi có người tạo nhà và hoàn thành phiên, số liệu cả nhóm sẽ hiện ở đây.</p></Card>;
  }
  const w = [5, 4, 3, 2, 1, 0].map((o) => groupWeek(detail, o));
  const cur = w[5], prv = w[4];
  const ret = prv.act.length ? cur.act.filter((id) => prv.act.includes(id)).length / prv.act.length : null;
  const qr: Partial<Record<QuitReason, number>> = {};
  for (const p of detail.players) for (const [k, v] of Object.entries(p.quitReasons) as [QuitReason, number][]) qr[k] = (qr[k] ?? 0) + v;
  const qk = (Object.keys(qr) as QuitReason[]).sort((a, b) => qr[b]! - qr[a]!);
  const qtot = qk.reduce((s, k) => s + qr[k]!, 0);
  const df = delta(cur.focus, prv.focus);
  const crit = [
    { k: 'Hoàn thành đúng cam kết', v: pct(cur.comp), t: 'từ 75%', ok: cur.comp != null && cur.comp >= 0.75 },
    { k: 'Tỷ lệ bỏ cuộc', v: pct(cur.quit), t: 'không quá 20%', ok: cur.quit != null && cur.quit <= 0.2 },
    { k: 'Điểm tập trung trung bình', v: num(cur.focus), t: 'từ 70', ok: cur.focus != null && cur.focus >= 70 },
    { k: 'Giữ chân (hoạt động cả hai tuần)', v: pct(ret), t: 'từ 60%', ok: ret != null && ret >= 0.6 },
    { k: 'Xu hướng tập trung so với tuần trước', v: df == null ? '–' : (df >= 0 ? '+' : '') + Math.round(df), t: 'không giảm', ok: df != null && df >= 0 },
  ];
  const okN = crit.filter((c) => c.ok).length;
  const verdict = cur.T.s < 10
    ? { t: 'Chưa đủ dữ liệu', c: 'warn' as const, d: `Cần ít nhất 10 phiên được đăng ký trong 7 ngày để đánh giá. Hiện có ${cur.T.s} phiên.` }
    : okN >= 4 ? { t: 'Chương trình đang hiệu quả', c: 'good' as const, d: `Đạt ${okN}/5 tiêu chí tham khảo.` }
      : okN >= 3 ? { t: 'Hiệu quả một phần', c: 'warn' as const, d: `Đạt ${okN}/5 tiêu chí. Xem các tiêu chí chưa đạt để điều chỉnh.` }
        : { t: 'Cần điều chỉnh', c: 'bad' as const, d: `Chỉ đạt ${okN}/5 tiêu chí tham khảo.` };
  const bands = ([['Dưới 40', 0, 39], ['40–59', 40, 59], ['60–79', 60, 79], ['Từ 80', 80, 100]] as const).map(([l, a, b]) => [l, cur.discs.filter((x) => x >= a && x <= b).length] as const);
  const mx = Math.max(1, ...bands.map((b) => b[1]));

  return (
    <section className="flex flex-col gap-3.5">
      <div><Eyebrow>Nhóm {detail.group.name} · 7 ngày gần nhất</Eyebrow><h2>Bảng nhóm</h2></div>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div><Eyebrow>Đánh giá tự động (tham khảo)</Eyebrow><h2>{verdict.t}</h2></div>
          <Pill tone={verdict.c}>{okN}/5 tiêu chí</Pill>
        </div>
        <p className="text-muted">{verdict.d}</p>
        <div className={t.wrap}>
          <table className={t.table}>
            <thead><tr>{['Tiêu chí', 'Hiện tại', 'Ngưỡng', 'Kết quả'].map((h) => <th key={h} className={t.th}>{h}</th>)}</tr></thead>
            <tbody>
              {crit.map((c) => (
                <tr key={c.k}>
                  <td className={t.td}>{c.k}</td><td className={t.td}>{c.v}</td><td className={t.td}>{c.t}</td>
                  <td className={t.td}><Pill tone={c.ok ? 'good' : 'warn'}>{c.ok ? 'Đạt' : 'Chưa đạt'}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Grid cols={3}>
        <Card><Eyebrow>Kỷ luật tự thân (TB)</Eyebrow><BigNumber>{num(cur.disc)}</BigNumber><Trend d={delta(cur.disc, prv.disc)} /></Card>
        <Card><Eyebrow>Tập trung sâu (TB)</Eyebrow><BigNumber>{num(cur.focus)}</BigNumber><Trend d={df} /></Card>
        <Card>
          <Eyebrow>Hoạt động tuần này</Eyebrow>
          <BigNumber>{cur.act.length}<span className="text-[22px]"> / {cur.n}</span></BigNumber>
          <p className="text-[13px] text-muted">{cur.hours.toFixed(1)} giờ tập trung hoàn thành</p>
        </Card>
      </Grid>
      <Card>
        <h3>Cam kết và bỏ cuộc (tuần này)</h3>
        <KV rows={[
          ['Phiên đã đăng ký', cur.T.s], ['Hoàn thành đủ thời gian', `${cur.T.c} (${pct(cur.comp)})`], ['Bỏ cuộc', `${cur.T.q} (${pct(cur.quit)})`],
          ['Lần rời trang', cur.T.dn], ['Câu kiểm tra không phản hồi', cur.T.ms], ['Trả lời đúng', pct(cur.T.qa ? cur.T.qc / cur.T.qa : null)],
        ]} />
      </Card>
      <Card>
        <h3>Xu hướng 6 tuần</h3>
        <div className="chart">
          <LineChart labels={['T-5', 'T-4', 'T-3', 'T-2', 'T-1', 'Tuần này']} label="Xu hướng điểm tập trung, tỷ lệ hoàn thành và tỷ lệ bỏ cuộc trong 6 tuần"
            series={[
              { vals: w.map((x) => x.focus), cls: 's1' },
              { vals: w.map((x) => (x.comp == null ? null : Math.round(x.comp * 100))), cls: 's2' },
              { vals: w.map((x) => (x.quit == null ? null : Math.round(x.quit * 100))), cls: 's3' },
            ]} />
        </div>
        <Legend items={[['s1', 'Điểm tập trung TB'], ['s2', 'Hoàn thành (%)'], ['s3', 'Bỏ cuộc (%)']]} />
      </Card>
      <Grid>
        <Card>
          <h3>Phân bố điểm kỷ luật</h3>
          <div className="grid grid-cols-[90px_1fr_28px] items-center gap-x-3 gap-y-[7px] text-sm">
            {bands.map(([l, v]) => [<span key={l + 'l'} className="text-muted">{l}</span>, <Meter key={l + 'm'} value={v} max={mx} />, <b key={l + 'v'} className="text-right">{v}</b>])}
          </div>
          <p className="text-[13px] text-muted">Số thành viên có phiên trong tuần, theo mức điểm.</p>
        </Card>
        <Card>
          <h3>Vì sao dừng phiên (từ đầu đến nay)</h3>
          {qtot ? <KV rows={qk.map((k) => [REASONS[k] ?? k, `${qr[k]} (${Math.round((100 * qr[k]!) / qtot)}%)`])} /> : <p className="text-[13px] text-muted">Chưa có phiên nào bị bỏ cuộc.</p>}
        </Card>
      </Grid>
    </section>
  );
}
