import { useState } from 'react';
import { REASONS, RECALL_PASS, delta, keysBack, metrics, sumDays, trustOf, type Metrics, type Player, type QuitReason } from '@tptl/shared';
import { BarChart, LineChart } from '../components/Charts';
import { BigNumber, Button, Card, Chip, Eyebrow, Grid, KV, Meter, Pill, Trend } from '../components/ui';
import { dmy, fmtMin, num, pct } from '../lib/format';
import { useLogs } from '../lib/queries';
import type { Tab } from './GroupApp';
import { LogTable } from './LogTable';

function personalNote(cur: Metrics, prv: Metrics, n: number) {
  if (!cur.s) return `Chưa có phiên nào trong ${n} ngày qua. Hãy đăng ký một phiên ngắn để giữ nhịp.`;
  const t: string[] = [];
  const dd = delta(cur.disc, prv.disc), df = delta(cur.focus, prv.focus);
  if (dd != null) t.push(dd >= 3 ? `Kỷ luật tăng ${Math.round(dd)} điểm so với kỳ trước.` : dd <= -3 ? `Kỷ luật giảm ${Math.round(-dd)} điểm so với kỳ trước.` : 'Kỷ luật giữ ổn định so với kỳ trước.');
  if (df != null) t.push(df >= 3 ? `Điểm tập trung tăng ${Math.round(df)} điểm.` : df <= -3 ? `Điểm tập trung giảm ${Math.round(-df)} điểm.` : 'Điểm tập trung giữ ổn định.');
  if (cur.comp != null && cur.comp < 0.6) t.push('Tỷ lệ hoàn thành cam kết còn thấp. Thử đăng ký thời gian ngắn hơn để giữ trọn lời hứa.');
  else if (cur.comp != null && cur.comp >= 0.9) t.push('Bạn giữ cam kết rất tốt. Có thể tăng dần thời gian mỗi phiên.');
  if (cur.dn + cur.ms >= 3 && cur.c > 0) t.push('Số lần xao nhãng đang nhiều. Kiểm tra lại việc cất điện thoại và đóng các tab không cần.');
  if (!t.length) t.push('Cần thêm dữ liệu từ kỳ trước để so sánh tiến bộ.');
  return t.join(' ');
}

export function Mine({ gid, player: me, onTab }: { gid: string; player: Player; onTab: (t: Tab) => void }) {
  const [n, setN] = useState(7);
  const logs = useLogs(gid, me.id);
  const cur = metrics(sumDays(me.days, keysBack(n)), n, me.createdAt);
  const prv = metrics(sumDays(me.days, keysBack(n, n)), n, me.createdAt);
  const trust = trustOf(cur);
  const k14 = keysBack(14);
  const mins = k14.map((k) => Math.round((me.days[k]?.cs ?? 0) / 60));
  const foc = k14.map((k) => { const d = me.days[k]; return d && d.fn ? Math.round(d.fs / d.fn) : null; });
  const qr = me.quitReasons;
  const qk = (Object.keys(qr) as QuitReason[]).sort((a, b) => (qr[b] ?? 0) - (qr[a] ?? 0));

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <div><Eyebrow>Bảng của {me.name}</Eyebrow><h2>Tiến bộ của tôi</h2></div>
      <div className="flex flex-wrap gap-2.5">{[7, 30, 90].map((p) => <Chip key={p} pressed={n === p} onClick={() => setN(p)}>{p} ngày</Chip>)}</div>
    </div>
  );
  if (!cur.s && !prv.s && !Object.keys(me.days).length) {
    return (
      <section className="flex flex-col gap-3.5">
        {header}
        <Card>
          <h3>Chưa có phiên nào</h3>
          <p className="text-muted">Hoàn thành phiên đầu tiên để thấy điểm kỷ luật, điểm tập trung và xu hướng tiến bộ ở đây.</p>
          <div><Button variant="primary" onClick={() => onTab('focus')}>Đăng ký phiên đầu tiên</Button></div>
        </Card>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-3.5">
      {header}
      <Grid>
        <Card><Eyebrow>Kỷ luật tự thân</Eyebrow><BigNumber>{num(cur.disc)}</BigNumber><Meter value={cur.disc ?? 0} label="Điểm kỷ luật" /><Trend d={delta(cur.disc, prv.disc)} /></Card>
        <Card><Eyebrow>Tập trung sâu</Eyebrow><BigNumber>{num(cur.focus)}</BigNumber><Meter value={cur.focus ?? 0} label="Điểm tập trung" /><Trend d={delta(cur.focus, prv.focus)} /></Card>
      </Grid>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <Eyebrow>Độ tin cậy ({n} ngày)</Eyebrow>
          {trust != null && trust < 60 && <Pill tone="warn">Cần cải thiện</Pill>}
        </div>
        <BigNumber>{num(trust)}</BigNumber>
        <Meter value={trust ?? 0} label="Độ tin cậy" />
        <Trend d={delta(trust, trustOf(prv))} />
        <KV rows={[
          ['Phiên hoàn thành có xác minh', `${cur.vf} / ${cur.vf + cur.uv}`],
          ['Câu hỏi nhớ lại khớp', `${cur.rc} / ${cur.rq}`],
          ['Kiểm tra trực tiếp', `${cur.so} khớp · ${cur.sn} không khớp`],
          ['Phút chưa xác minh (tổng)', fmtMin(me.unverifiedMin)],
        ]} />
        <p className="text-[13px] text-muted">
          Độ tin cậy = 40% phiên có xác minh (ảnh khớp mã thử thách, hoặc kết quả phiên trên máy đạt khi đối chiếu với mục tiêu) + 30% câu nhớ lại đạt từ {RECALL_PASS} điểm + 30% kiểm tra trực tiếp khớp,
          chỉ tính các phần có dữ liệu; trừ 15 điểm mỗi lần không khớp. Phút chưa xác minh không tính vào giai đoạn nhà và điểm nhóm. Tự khai chưa làm đủ không trừ độ tin cậy.
        </p>
      </Card>
      <Card>
        <h3>Nhiệm vụ (từ đầu đến nay)</h3>
        <KV rows={[
          ['Chuỗi phiên hiện tại', me.currentStreak], ['Chuỗi dài nhất', me.bestStreak],
          ['Phiên thành công', me.tasksDone], ['Phiên thất bại', me.tasksFailed],
          ['Tỷ lệ hoàn thành', me.tasksDone + me.tasksFailed ? Math.round((100 * me.tasksDone) / (me.tasksDone + me.tasksFailed)) + '%' : '–'],
        ]} />
      </Card>
      <Grid>
        <Card>
          <h3>Tính cam kết ({n} ngày)</h3>
          <KV rows={[
            ['Phiên đã đăng ký', cur.s], ['Hoàn thành đủ thời gian', `${cur.c} (${pct(cur.comp)})`], ['Bỏ cuộc', `${cur.q} (${pct(cur.quitRate)})`],
            ['Thời gian thực hiện / đã đăng ký', pct(cur.kept)], ['Lần rời trang (xao nhãng)', cur.dn], ['Câu kiểm tra không phản hồi', cur.ms],
            ['Trả lời đúng', pct(cur.quiz)], ['Số ngày có hoạt động', `${cur.act} / ${n}`],
          ]} />
        </Card>
        <Card>
          <h3>Nhận xét</h3>
          <p>{personalNote(cur, prv, n)}</p>
          {qk.length > 0 && <div><Eyebrow className="mb-1.5">Lý do bỏ cuộc của bạn</Eyebrow><KV rows={qk.map((k) => [REASONS[k] ?? k, qr[k] + ' lần'])} /></div>}
        </Card>
      </Grid>
      <Card>
        <h3>14 ngày gần nhất</h3>
        <Grid>
          <div className="chart"><p className="text-[13px] text-muted">Số phút hoàn thành mỗi ngày</p><BarChart labels={k14.map(dmy)} vals={mins} label="Số phút hoàn thành mỗi ngày trong 14 ngày" /></div>
          <div className="chart"><p className="text-[13px] text-muted">Điểm tập trung trung bình mỗi ngày</p><LineChart labels={k14.map(dmy)} series={[{ vals: foc, cls: 's1' }]} label="Điểm tập trung theo ngày" /></div>
        </Grid>
      </Card>
      <Card><h3>Các phiên gần đây</h3><LogTable logs={logs.data} error={logs.error} /></Card>
      <Card as="details">
        <summary className="cursor-pointer text-sm font-semibold">Cách tính điểm</summary>
        <p className="text-[13px] text-muted">Kỷ luật tự thân = 40% tỷ lệ phiên hoàn thành + 30% tỷ lệ thời gian thực hiện so với thời gian đã đăng ký + 30% số ngày có hoạt động trên số ngày trong kỳ.</p>
        <p className="text-[13px] text-muted">Tập trung sâu (phiên trên máy) = tỷ lệ thời gian ở lại trang, trừ 3 điểm cho mỗi lần rời trang và 5 điểm cho mỗi câu kiểm tra không phản hồi, rồi nhân với hệ số từ 0,75 đến 1 theo tỷ lệ trả lời đúng. Phiên ngoài màn hình tính 60% theo câu trả lời đúng và 40% theo tự đánh giá. Phiên bỏ cuộc không có điểm tập trung nhưng tính vào tỷ lệ bỏ cuộc. Điểm do máy chủ tính.</p>
      </Card>
    </section>
  );
}
