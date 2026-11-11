import { Fragment } from 'react';
import { ACTS, REASONS, RECALL_PASS, type SessionLog } from '@tptl/shared';
import { Pill, tableCls as t } from '../components/ui';
import { errorMessage } from '../lib/api';
import { dmy, hm } from '../lib/format';

/** Tóm tắt các lớp bằng chứng của một phiên đã hoàn thành. */
function evidence(r: SessionLog): string {
  const result = { ok: 'Kết quả đạt', flag: 'Kết quả đáng ngờ', sent: 'Kết quả chờ xem', none: 'Không nộp kết quả' }[r.resultStatus];
  const parts = [r.mode === 'screen'
    ? (r.review ? (r.review === 'ok' ? 'Duyệt: đạt' : 'Duyệt: không đạt') : result)
    : r.verified ? (r.review === 'ok' ? 'Duyệt: đạt' : 'Ảnh khớp') : r.proofStatus === 'fail' ? 'Ảnh chưa khớp' : 'Chưa xác minh'];
  if (r.recallScore != null) parts.push(`Nhớ lại ${r.recallScore}${r.recallScore >= RECALL_PASS ? '' : ' (chưa khớp)'}`);
  else if (r.recallVerdict === 'cho_duyet') parts.push('Nhớ lại chờ xem');
  if (r.spotResult) parts.push(r.spotResult === 'ok' ? 'Trực tiếp khớp' : 'Trực tiếp không khớp');
  return parts.join(' · ');
}

export function LogTable({ logs, error }: { logs: SessionLog[] | undefined; error?: unknown }) {
  if (error) return <p className="text-[13px] text-muted">{errorMessage(error)}</p>;
  if (!logs) return <p className="text-[13px] text-muted">Đang tải…</p>;
  if (!logs.length) return <p className="text-[13px] text-muted">Chưa có phiên nào được ghi.</p>;
  return (
    <div className={t.wrap}>
      <table className={t.table}>
        <thead>
          <tr>{['Ngày', 'Hoạt động', 'Đăng ký', 'Thực hiện', 'Kết quả', 'Xao nhãng', 'Điểm', 'Bằng chứng'].map((h) => <th key={h} className={t.th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {logs.map((r) => (
            <Fragment key={r.id}>
              <tr>
                <td className={t.td}>{dmy(r.day)} {hm(r.endedAt ?? r.startedAt)}</td>
                <td className={t.td}>{ACTS[r.act]?.n ?? r.act}</td>
                <td className={t.td}>{Math.round(r.plannedSec / 60)} ph</td>
                <td className={t.td}>{Math.round(r.activeSec / 60)} ph</td>
                <td className={t.td}>
                  {r.status === 'done' ? <Pill tone="good">Hoàn thành</Pill> : <Pill tone="bad">Bỏ cuộc</Pill>}
                  {r.reason && <span className="text-[13px] text-muted"> {REASONS[r.reason] ?? r.reason}</span>}
                </td>
                <td className={t.td}>{r.dist + r.missed}</td>
                <td className={t.td}>{r.focus ?? '–'}</td>
                <td className={t.td + ' text-[13px]'}>{r.status === 'done' ? evidence(r) : '–'}</td>
              </tr>
              {r.note && <tr><td colSpan={8} className={t.td + ' !text-left !whitespace-normal text-[13px] text-muted'}>“{r.note}”</td></tr>}
              {r.recallQuestion && r.recallAnswer && (
                <tr><td colSpan={8} className={t.td + ' !text-left !whitespace-normal text-[13px] text-muted'}>Hỏi lại: {r.recallQuestion} Trả lời: “{r.recallAnswer}”{r.recallReason ? ` (${r.recallReason})` : ''}</td></tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
