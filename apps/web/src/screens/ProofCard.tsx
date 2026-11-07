/* Lớp 1: lấy mã thử thách, chụp ảnh và gửi kiểm tra. Ảnh được nén ở trình duyệt, gửi Gemini kiểm tra, ứng dụng không lưu lại. */
import { useEffect, useRef, useState } from 'react';
import { ACTS, PROOF_THING, PROOF_TRIES, VERIFY_FOCUS, type ActiveSession, type ProofState } from '@tptl/shared';
import { Banner, Button, Card, Field, inputCls, Pill, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { mmss } from '../lib/format';
import { getGeo, toFieldJpeg, toJpegBase64 } from '../lib/photo';

const PAGES_KEY = 'tptl-book-pages';

function readPages(): number {
  try { return Number(localStorage.getItem(PAGES_KEY)) || 100; } catch { return 100; }
}
function savePages(n: number) {
  try { localStorage.setItem(PAGES_KEY, String(n)); } catch { /* không lưu được thì lần sau hỏi lại */ }
}

function usePhotoCountdown(expiresAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return expiresAt ? Math.max(0, (expiresAt - now) / 1000) : 0;
}

export function ProofCard({ s, onChange }: { s: ActiveSession; onChange: (p: ProofState) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<'code' | 'photo' | null>(null);
  const [pages, setPages] = useState(readPages);
  const input = useRef<HTMLInputElement>(null);
  const p = s.proof;
  const left = usePhotoCountdown(p.status === 'ready' || p.status === 'fail' ? p.expiresAt : null);
  const need = s.mode === 'offline';
  const noTries = p.tries >= PROOF_TRIES;
  const thing = PROOF_THING[s.act];
  // Vận động, chăm cây: ảnh này cũng là ảnh kết thúc lưu cho trưởng nhóm duyệt, nên nén nhỏ và kèm vị trí.
  const field = ACTS[s.act].field;

  async function getCode() {
    setBusy('code');
    try {
      if (s.act === 'read') savePages(pages);
      onChange(await api<ProofState>('POST', `/sessions/${s.id}/proof/code`, s.act === 'read' ? { pages } : {}));
    } catch (e) { toast(errorMessage(e)); }
    setBusy(null);
  }
  async function send(file: File) {
    setBusy('photo');
    try {
      const [image, geo] = await Promise.all([field ? toFieldJpeg(file) : toJpegBase64(file), field ? getGeo() : null]);
      onChange(await api<ProofState>('POST', `/sessions/${s.id}/proof`, { image, ...(geo ?? {}) }));
    } catch (e) { toast(errorMessage(e)); }
    setBusy(null);
    if (input.current) input.current.value = '';
  }

  const pill = p.status === 'ok' ? <Pill tone="good">Đã xác minh</Pill> : p.status === 'fail' ? <Pill tone="bad">Chưa khớp</Pill> : <Pill tone="warn">Chưa xác minh</Pill>;
  const after = field
    ? 'Ảnh kết thúc khớp mã cùng ảnh bắt đầu và ảnh giữa phiên giúp phiên được xác minh ngay; thiếu thì phiên chờ trưởng nhóm duyệt.'
    : need
    ? 'Không có ảnh khớp, phiên vẫn hoàn thành nhưng ở trạng thái “chưa xác minh”: vẫn nhận công trình, số phút không tính vào giai đoạn nhà và không có điểm nhóm.'
    : `Phiên trên máy được xác minh qua theo dõi rời trang khi điểm tập trung từ ${VERIFY_FOCUS}. Ảnh giúp xác minh khi điểm thấp hơn.`;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h3>Bằng chứng ảnh{need ? '' : ' (không bắt buộc)'}</h3>
        {pill}
      </div>
      {p.status === 'ok' && <p className="text-[13px]">{p.reason || 'Ảnh khớp mã và đúng hoạt động.'}</p>}
      {p.status === 'na' && (
        <p className="text-[13px] text-muted">
          {field ? 'Hệ thống chưa bật kiểm tra mã tự động. Hãy chụp ảnh kết thúc ở thẻ Ảnh hiện trường bên dưới; trưởng nhóm sẽ duyệt.' : 'Hệ thống chưa bật kiểm tra ảnh tự động. Phiên vẫn hoàn thành được nhưng ở trạng thái “chưa xác minh”; hãy báo trưởng nhóm nếu thấy thông báo này.'}
        </p>
      )}
      {p.status === 'none' && (
        <>
          <p>
            Bấm lấy mã rồi viết mã ra giấy, đặt cạnh <b>{thing}</b> và chụp trong vòng 2 phút. Không cần chụp mặt. Ảnh được gửi đến Gemini của Google để kiểm tra, ứng dụng không lưu lại.
          </p>
          {s.act === 'read' && (
            <Field label="Sách của bạn dày khoảng bao nhiêu trang?" className="w-64">
              <input type="number" className={inputCls} min={1} max={5000} value={pages} onChange={(e) => setPages(Math.min(5000, Math.max(1, Number(e.target.value) || 1)))} />
            </Field>
          )}
          <div><Button variant="primary" disabled={!!busy} onClick={getCode}>{busy === 'code' ? 'Đang tạo mã…' : 'Lấy mã thử thách'}</Button></div>
        </>
      )}
      {(p.status === 'ready' || p.status === 'fail') && (
        <>
          {p.code && <p className="font-hud text-center text-[34px] tracking-wider text-ptitle" aria-label="Mã thử thách">{p.code}</p>}
          {p.page != null && <p className="text-center">Mở sách đến <b>trang {p.page}</b>, đặt tờ giấy có mã lên trang đó rồi chụp.</p>}
          <p className="text-[13px] text-muted" aria-live="polite">
            {left > 0 ? `Còn ${mmss(left)} để chụp.` : 'Mã đã hết hạn. Bấm “Lấy mã mới”.'} Đã dùng {p.tries}/{PROOF_TRIES} lần gửi ảnh.
          </p>
          {p.status === 'fail' && <Banner tone="bad"><span className="text-[13px]">Chưa khớp: {p.reason}{noTries ? ' Đã hết lượt thử.' : ''}</span></Banner>}
          {!noTries && (
            <div className="flex flex-wrap gap-2.5">
              <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Chụp ảnh bằng chứng" aria-hidden="true" tabIndex={-1}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) send(f); }} />
              <Button variant="primary" disabled={!!busy || left <= 0} onClick={() => input.current?.click()}>{busy === 'photo' ? 'Đang kiểm tra ảnh…' : 'Chụp ảnh bằng chứng'}</Button>
              <Button disabled={!!busy} onClick={getCode}>Lấy mã mới</Button>
            </div>
          )}
        </>
      )}
      {p.status !== 'ok' && <p className="text-[13px] text-muted">{after}</p>}
    </Card>
  );
}
