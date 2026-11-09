/* Trưởng nhóm duyệt ảnh hiện trường của phiên vận động, chăm cây trong 14 ngày. */
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ACTS, type FieldReview, type FieldReviewItem, type PhotoKind } from '@tptl/shared';
import { Button, Card, Pill, useToast } from '../components/ui';
import { api, apiBlob, errorMessage } from '../lib/api';
import { dmy, hm } from '../lib/format';
import { distanceM } from '../lib/photo';
import { qk } from '../lib/queries';

const LABEL: Record<PhotoKind, string> = { start: 'Bắt đầu', mid: 'Giữa phiên', end: 'Kết thúc (có mã)' };

function Photos({ it }: { it: FieldReviewItem }) {
  const [urls, setUrls] = useState<Partial<Record<PhotoKind, string>>>({});
  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    for (const p of it.photos) {
      apiBlob(`/sessions/${it.sid}/photos/${p.kind}`).then((b) => {
        const u = URL.createObjectURL(b);
        made.push(u);
        if (alive) setUrls((x) => ({ ...x, [p.kind]: u }));
      }, () => {});
    }
    return () => { alive = false; made.forEach((u) => URL.revokeObjectURL(u)); };
  }, [it.sid, it.photos]);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {(it.photos.some((p) => p.kind === 'mid') ? ['start', 'mid', 'end'] as PhotoKind[] : ['start', 'end'] as PhotoKind[]).map((k) => {
        const p = it.photos.find((x) => x.kind === k);
        return (
          <figure key={k} className="m-0 flex flex-col gap-1 text-[12px]">
            {p && urls[k] ? <img src={urls[k]} alt={`${LABEL[k]} của ${it.name}`} className="aspect-[4/3] w-full rounded-lg object-cover" />
              : <div className="grid aspect-[4/3] place-items-center rounded-lg bg-surface2 text-muted">{p ? 'Đang tải…' : 'Không có ảnh'}</div>}
            <figcaption>
              <b>{LABEL[k]}</b>{p && <> · {hm(p.takenAt)}</>}
              {p?.lat != null && p.lng != null && <> · <a className="underline" href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`} target="_blank" rel="noreferrer">vị trí</a></>}
              {p && p.lat == null && <span className="text-muted"> · không có vị trí</span>}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

function Item({ gid, it }: { gid: string; it: FieldReviewItem }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const geo = (k: PhotoKind) => { const p = it.photos.find((x) => x.kind === k); return p && p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null; };
  const a = geo('start'), b = geo('end');
  async function review(result: 'ok' | 'no') {
    try {
      await api('POST', `/groups/${gid}/field/${it.sid}`, { result });
      await Promise.all([qc.invalidateQueries({ queryKey: qk.field(gid) }), qc.invalidateQueries({ queryKey: qk.group(gid) })]);
    } catch (e) { toast(errorMessage(e)); }
  }
  return (
    <li className="grid gap-2 border-t border-line pt-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 text-sm">
          <b>{it.name}</b> <span className="text-muted">({it.participantCode ?? 'chưa có mã'})</span>
          <div className="text-[13px] text-muted">
            {dmy(it.day)} · {ACTS[it.act].n} · {it.minutes} phút · {it.photos.filter((p) => p.kind !== 'mid').length}/2 ảnh
            {a && b ? ` · đầu và cuối cách nhau khoảng ${Math.round(distanceM(a, b))} m` : ''}
            {it.proofCode ? ` · mã xác thực ${it.proofCode}` : ''}{it.proofStatus === 'ok' ? ' (AI xác nhận khớp)' : it.proofStatus === 'fail' ? ' (AI báo chưa khớp)' : ''}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {it.review ? <Pill tone={it.review === 'ok' ? 'good' : 'bad'}>{it.review === 'ok' ? 'Đã duyệt: Đạt' : 'Đã duyệt: Không đạt'}</Pill>
            : <Pill tone={it.verified ? 'good' : 'warn'}>{it.verified ? 'Tự động xác minh' : 'Chờ duyệt'}</Pill>}
          <Button onClick={() => setShow((v) => !v)}>{show ? 'Ẩn ảnh' : 'Xem ảnh'}</Button>
          {!it.self && <><Button onClick={() => review('ok')}>Đạt</Button><Button onClick={() => review('no')}>Không đạt</Button></>}
        </div>
      </div>
      {it.self && <p className="text-[13px] text-muted">Phiên của bạn do quản trị viên khác duyệt.</p>}
      {show && <Photos it={it} />}
    </li>
  );
}

export function FieldReviewCard({ gid }: { gid: string }) {
  const q = useQuery({ queryKey: qk.field(gid), queryFn: () => api<FieldReview>('GET', `/groups/${gid}/field`) });
  const items = q.data?.items ?? [];
  const waiting = items.filter((i) => !i.verified && !i.review).length;
  return (
    <Card>
      <h3>Ảnh hiện trường (vận động, chăm cây · 14 ngày)</h3>
      <p className="text-[13px] text-muted">
        Phiên có ảnh bắt đầu và ảnh kết thúc khớp mã xác thực được xác minh tự động. Phiên thiếu ảnh hoặc chưa kiểm tra được mã chờ bạn duyệt (đối chiếu mã trong ảnh kết thúc với mã ghi ở dòng trên):
        Đạt thì phút được tính vào giai đoạn nhà và điểm nhóm. Ảnh tự xóa sau 45 ngày.
      </p>
      {q.isError ? <p className="text-[13px] text-muted">{errorMessage(q.error)}</p>
        : !q.data ? <p className="text-[13px] text-muted">Đang tải…</p>
          : !items.length ? <p className="text-[13px] text-muted">Chưa có phiên vận động hay chăm cây nào trong 14 ngày.</p>
            : (
              <>
                <p className="text-sm">{waiting ? <b>{waiting} phiên đang chờ duyệt.</b> : 'Không có phiên nào chờ duyệt.'}</p>
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">{items.map((it) => <Item key={it.sid} gid={gid} it={it} />)}</ul>
              </>
            )}
    </Card>
  );
}
