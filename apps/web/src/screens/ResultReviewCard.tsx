/* Trưởng nhóm xem kết quả của các phiên trên máy trong 14 ngày: đối chiếu với mục tiêu, duyệt Đạt hoặc Không đạt. */
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ResultReview, ResultReviewItem } from '@tptl/shared';
import { Button, Card, Pill, useToast } from '../components/ui';
import { api, apiBlob, errorMessage } from '../lib/api';
import { dmy } from '../lib/format';
import { qk } from '../lib/queries';

function ResultImage({ sid, name }: { sid: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u = '';
    apiBlob(`/sessions/${sid}/photos/result`).then((b) => { u = URL.createObjectURL(b); setUrl(u); }, () => setUrl(''));
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [sid]);
  if (url === null) return <p className="text-[13px] text-muted">Đang tải ảnh…</p>;
  if (!url) return <p className="text-[13px] text-muted">Không còn ảnh (có thể đã quá hạn lưu).</p>;
  return <img src={url} alt={`Ảnh kết quả của ${name}`} className="max-h-80 w-auto rounded-lg border border-line" />;
}

function Item({ gid, it }: { gid: string; it: ResultReviewItem }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  async function review(result: 'ok' | 'no') {
    try {
      await api('POST', `/groups/${gid}/field/${it.sid}`, { result });
      await Promise.all([qc.invalidateQueries({ queryKey: qk.results(gid) }), qc.invalidateQueries({ queryKey: qk.group(gid) })]);
    } catch (e) { toast(errorMessage(e)); }
  }
  const status = it.review
    ? <Pill tone={it.review === 'ok' ? 'good' : 'bad'}>{it.review === 'ok' ? 'Đã duyệt: Đạt' : 'Đã duyệt: Không đạt'}</Pill>
    : it.resultStatus === 'ok' ? <Pill tone="good">AI: đạt</Pill>
      : it.resultStatus === 'flag' ? <Pill tone="bad">AI: đáng ngờ</Pill>
        : it.resultStatus === 'sent' ? <Pill tone="warn">Chờ duyệt</Pill> : <Pill>Không nộp</Pill>;
  return (
    <li className="grid gap-2 border-t border-line pt-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 text-sm">
          <b>{it.name}</b> <span className="text-muted">({it.participantCode ?? 'chưa có mã'})</span>
          <div className="text-[13px] text-muted">{dmy(it.day)} · {it.actName} · {it.minutes} phút{it.resultScore != null ? ` · AI chấm ${it.resultScore}/100` : ''}</div>
          <div className="text-[13px]">Mục tiêu: <b>{it.goal || '(không ghi)'}</b></div>
          {it.resultReason && <div className="text-[13px] text-muted">Nhận xét: {it.resultReason}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status}
          {(it.resultText || it.hasImage) && <Button onClick={() => setShow((v) => !v)}>{show ? 'Ẩn kết quả' : 'Xem kết quả'}</Button>}
          {!it.self && <><Button onClick={() => review('ok')}>Đạt</Button><Button onClick={() => review('no')}>Không đạt</Button></>}
        </div>
      </div>
      {it.self && <p className="text-[13px] text-muted">Phiên của bạn do quản trị viên khác duyệt.</p>}
      {show && (
        <div className="grid gap-2 rounded-lg bg-surface2 p-2.5">
          {it.resultText && <p className="whitespace-pre-wrap text-sm">{it.resultText}</p>}
          {it.hasImage && <ResultImage sid={it.sid} name={it.name} />}
        </div>
      )}
    </li>
  );
}

export function ResultReviewCard({ gid }: { gid: string }) {
  const q = useQuery({ queryKey: qk.results(gid), queryFn: () => api<ResultReview>('GET', `/groups/${gid}/results`) });
  const items = q.data?.items ?? [];
  const waiting = items.filter((i) => !i.verified && !i.review).length;
  return (
    <Card>
      <h3>Kết quả phiên trên máy (14 ngày)</h3>
      <p className="text-[13px] text-muted">
        Chấm kết quả thay vì chấm thời gian: cuối phiên học sinh nộp ảnh hoặc đoạn đã làm, AI đối chiếu với mục tiêu và số phút. Kết quả đạt thì phiên tự được xác minh;
        kết quả đáng ngờ hoặc chưa chấm được thì chờ bạn duyệt. Đạt thì phút được tính vào giai đoạn nhà và điểm nhóm.
      </p>
      {q.isError ? <p className="text-[13px] text-muted">{errorMessage(q.error)}</p>
        : !q.data ? <p className="text-[13px] text-muted">Đang tải…</p>
          : !items.length ? <p className="text-[13px] text-muted">Chưa có phiên trên máy nào trong 14 ngày.</p>
            : (
              <>
                <p className="text-sm">{waiting ? <b>{waiting} phiên đang chờ duyệt.</b> : 'Không có phiên nào chờ duyệt.'}</p>
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">{items.map((it) => <Item key={it.sid} gid={gid} it={it} />)}</ul>
              </>
            )}
    </Card>
  );
}
