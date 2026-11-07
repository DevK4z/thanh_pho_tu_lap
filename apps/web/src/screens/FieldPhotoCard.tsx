/* Ảnh hiện trường cho vận động, chăm cây: lúc bắt đầu (5 phút đầu), giữa phiên (30%–80% thời gian) và lúc kết thúc.
   Giờ chụp do máy chủ ghi, vị trí làm tròn khoảng 100 m; trưởng nhóm duyệt. */
import { useEffect, useRef, useState } from 'react';
import { FIELD_MID_FROM, FIELD_MID_TO, FIELD_START_SECONDS, type ActiveSession, type FieldPhoto, type PhotoKind } from '@tptl/shared';
import { Button, Card, Pill, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { hm, mmss } from '../lib/format';
import { getGeo, toFieldJpeg } from '../lib/photo';

const LABEL: Record<PhotoKind, string> = { start: 'Ảnh bắt đầu', mid: 'Ảnh giữa phiên', end: 'Ảnh kết thúc' };
/** Thời gian tạm ngưng giám sát rời trang khi mở camera (chăm cây phải giữ ứng dụng mở). */
const CAMERA_PAUSE_MS = 120_000;

export function windowOf(s: ActiveSession, k: PhotoKind): [number, number] {
  const t0 = s.startedAt, len = s.plannedSec * 1000;
  return k === 'start' ? [t0, t0 + FIELD_START_SECONDS * 1000] : k === 'mid' ? [t0 + FIELD_MID_FROM * len, t0 + FIELD_MID_TO * len] : [t0 + len, Infinity];
}

/**
 * @param kinds  các ảnh chụp được ở màn này (đang chạy: bắt đầu và giữa phiên; bước xác nhận: kết thúc khi chưa bật kiểm tra tự động)
 * @param pause, resume  tạm ngưng giám sát trong lúc mở camera
 * @param refresh  đổi giá trị để tải lại danh sách ảnh (ví dụ sau khi gửi ảnh có mã thử thách)
 */
export function FieldPhotoCard({ s, kinds, pause, resume, refresh }: { s: ActiveSession; kinds: PhotoKind[]; pause?: (ms: number) => void; resume?: () => void; refresh?: unknown }) {
  const toast = useToast();
  const [photos, setPhotos] = useState<FieldPhoto[]>([]);
  const [busy, setBusy] = useState<PhotoKind | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const input = useRef<HTMLInputElement>(null);
  const want = useRef<PhotoKind | null>(null);
  const has = (k: PhotoKind) => photos.find((p) => p.kind === k);
  const open = (k: PhotoKind) => { const [a, b] = windowOf(s, k); return now >= a && now <= b; };

  useEffect(() => { api<FieldPhoto[]>('GET', `/sessions/${s.id}/photos`).then(setPhotos, () => {}); }, [s.id, refresh]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // Nhắc khi tới giờ chụp ảnh giữa phiên (nếu đang mở ứng dụng).
  const midOpen = kinds.includes('mid') && open('mid') && !has('mid');
  useEffect(() => { if (midOpen && !document.hidden) toast('Đến giờ chụp ảnh giữa phiên.'); }, [midOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  function capture(k: PhotoKind) {
    want.current = k;
    pause?.(CAMERA_PAUSE_MS);
    input.current?.click();
  }
  async function send(file: File) {
    const k = want.current;
    if (!k) return;
    setBusy(k);
    try {
      const [image, geo] = await Promise.all([toFieldJpeg(file), getGeo()]);
      setPhotos(await api<FieldPhoto[]>('POST', `/sessions/${s.id}/photos/${k}`, { image, ...(geo ?? {}) }));
      toast(`Đã lưu ${LABEL[k].toLowerCase()}${geo ? '' : ' (không có vị trí)'}.`);
    } catch (e) { toast(errorMessage(e)); }
    setBusy(null);
    resume?.();
    if (input.current) input.current.value = '';
  }

  const status = (k: PhotoKind) => {
    const p = has(k);
    if (p) return <span className="text-[13px]"><Pill tone="good">Đã chụp {hm(p.takenAt)}</Pill> {p.lat == null && <span className="text-muted">không có vị trí</span>}</span>;
    const [a, b] = windowOf(s, k);
    if (now < a) return <span className="text-[13px] text-muted">từ {hm(a)}{b !== Infinity ? ` đến ${hm(b)}` : ''}</span>;
    if (now > b) return <Pill tone="bad">Đã quá giờ</Pill>;
    return <span className="text-[13px] text-muted">{b === Infinity ? 'chụp ngay bây giờ' : `còn ${mmss((b - now) / 1000)}`}</span>;
  };

  return (
    <Card className="w-full max-w-xl text-left">
      <h3>Ảnh hiện trường</h3>
      <p className="text-[13px] text-muted">
        Chụp hoạt động (không cần chụp mặt) lúc bắt đầu, giữa phiên và lúc kết thúc. Giờ chụp do máy chủ ghi; vị trí làm tròn khoảng 100 m, chỉ trưởng nhóm xem được. Thiếu ảnh thì phiên chờ trưởng nhóm duyệt.
      </p>
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Chụp ảnh hiện trường" aria-hidden="true" tabIndex={-1}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) send(f); else resume?.(); }} />
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {(['start', 'mid', 'end'] as PhotoKind[]).map((k) => (
          <li key={k} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
            <div className="flex min-w-0 flex-col"><b>{LABEL[k]}</b>{status(k)}</div>
            {kinds.includes(k) && open(k) && (
              <Button variant={has(k) ? 'default' : 'primary'} disabled={!!busy} onClick={() => capture(k)}>
                {busy === k ? 'Đang gửi…' : has(k) ? 'Chụp lại' : 'Chụp ' + LABEL[k].toLowerCase()}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
