/* Ảnh hiện trường cho vận động, chăm cây: ảnh lúc bắt đầu (5 phút đầu) chụp ở đây; ảnh lúc kết thúc chụp kèm mã xác thực
   ở bước xác nhận. Giờ chụp do máy chủ ghi, vị trí làm tròn khoảng 100 m; trưởng nhóm duyệt. */
import { useEffect, useRef, useState } from 'react';
import { FIELD_PROOF_SECONDS, FIELD_START_SECONDS, type ActiveSession, type FieldPhoto } from '@tptl/shared';
import { Button, Card, Pill, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { hm, mmss } from '../lib/format';
import { getGeo, toFieldJpeg } from '../lib/photo';

/** Thời gian tạm ngưng giám sát rời trang khi mở camera (chăm cây phải giữ ứng dụng mở). */
const CAMERA_PAUSE_MS = 120_000;

/**
 * @param canCapture  chụp được ảnh bắt đầu ở màn này (màn đang chạy phiên)
 * @param pause, resume  tạm ngưng giám sát trong lúc mở camera
 * @param refresh  đổi giá trị để tải lại danh sách ảnh (ví dụ sau khi gửi ảnh có mã xác thực)
 */
export function FieldPhotoCard({ s, canCapture, pause, resume, refresh }: { s: ActiveSession; canCapture: boolean; pause?: (ms: number) => void; resume?: () => void; refresh?: unknown }) {
  const toast = useToast();
  const [photos, setPhotos] = useState<FieldPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const input = useRef<HTMLInputElement>(null);
  const start = photos.find((p) => p.kind === 'start');
  const end = photos.find((p) => p.kind === 'end');
  const startUntil = s.startedAt + FIELD_START_SECONDS * 1000;
  const endAt = s.startedAt + s.plannedSec * 1000;
  const startOpen = now <= startUntil;

  useEffect(() => { api<FieldPhoto[]>('GET', `/sessions/${s.id}/photos`).then(setPhotos, () => {}); }, [s.id, refresh]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  function capture() {
    pause?.(CAMERA_PAUSE_MS);
    input.current?.click();
  }
  async function send(file: File) {
    setBusy(true);
    try {
      const [image, geo] = await Promise.all([toFieldJpeg(file), getGeo()]);
      setPhotos(await api<FieldPhoto[]>('POST', `/sessions/${s.id}/photos/start`, { image, ...(geo ?? {}) }));
      toast(`Đã lưu ảnh bắt đầu${geo ? '' : ' (không có vị trí)'}.`);
    } catch (e) { toast(errorMessage(e)); }
    setBusy(false);
    resume?.();
    if (input.current) input.current.value = '';
  }

  const taken = (p: FieldPhoto) => <span className="text-[13px]"><Pill tone="good">Đã chụp {hm(p.takenAt)}</Pill> {p.lat == null && <span className="text-muted">không có vị trí</span>}</span>;

  return (
    <Card className="w-full max-w-xl text-left">
      <h3>Ảnh hiện trường</h3>
      <p className="text-[13px] text-muted">
        Chụp hoạt động (không cần chụp mặt) lúc bắt đầu và lúc kết thúc. Hết giờ, mã xác thực tự hiện ra: viết mã ra giấy, đặt cạnh hoạt động và chụp trong {FIELD_PROOF_SECONDS / 60} phút.
        Giờ chụp do máy chủ ghi; vị trí làm tròn khoảng 100 m, chỉ trưởng nhóm xem được. Thiếu ảnh thì phiên chờ trưởng nhóm duyệt.
      </p>
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Chụp ảnh hiện trường" aria-hidden="true" tabIndex={-1}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) send(f); else resume?.(); }} />
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        <li className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
          <div className="flex min-w-0 flex-col">
            <b>Ảnh bắt đầu</b>
            {start ? taken(start) : startOpen ? <span className="text-[13px] text-muted">còn {mmss((startUntil - now) / 1000)}</span> : <Pill tone="bad">Đã quá giờ</Pill>}
          </div>
          {canCapture && startOpen && (
            <Button variant={start ? 'default' : 'primary'} disabled={busy} onClick={capture}>{busy ? 'Đang gửi…' : start ? 'Chụp lại' : 'Chụp ảnh bắt đầu'}</Button>
          )}
        </li>
        <li className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
          <div className="flex min-w-0 flex-col">
            <b>Ảnh kết thúc (có mã xác thực)</b>
            {end ? taken(end) : <span className="text-[13px] text-muted">{now < endAt ? `mã hiện lúc ${hm(endAt)}, chụp trước ${hm(endAt + FIELD_PROOF_SECONDS * 1000)}` : 'chụp ở thẻ Bằng chứng ảnh phía trên'}</span>}
          </div>
        </li>
      </ul>
    </Card>
  );
}
