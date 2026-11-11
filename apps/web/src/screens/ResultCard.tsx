/* Chấm kết quả thay vì chấm thời gian (phiên trên máy): cuối phiên nộp ảnh chụp, ảnh màn hình (dán bằng Ctrl+V) hoặc đoạn đã làm.
   Gemini đối chiếu với mục tiêu đã đăng ký và xem lượng việc có tương xứng với thời gian không. */
import { useRef, useState, type ClipboardEvent } from 'react';
import { LIMITS, RESULT_TRIES, type ActiveSession, type ResultState } from '@tptl/shared';
import { Banner, Button, Card, Field, inputCls, Pill, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { toJpegBase64 } from '../lib/photo';

export function ResultCard({ s, onChange }: { s: ActiveSession; onChange: (r: ResultState) => void }) {
  const toast = useToast();
  const r = s.result;
  const [text, setText] = useState(r.text);
  const [image, setImage] = useState<{ b64: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const done = r.status === 'ok';
  const noTries = r.tries >= RESULT_TRIES;

  async function pick(file: File) {
    try {
      const b64 = await toJpegBase64(file);
      setImage({ b64, url: 'data:image/jpeg;base64,' + b64 });
    } catch (e) { toast(errorMessage(e)); }
  }
  /** Dán ảnh chụp màn hình (Win+Shift+S rồi Ctrl+V) thẳng vào thẻ. */
  function onPaste(e: ClipboardEvent) {
    const f = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'))?.getAsFile();
    if (f) { e.preventDefault(); pick(f); }
  }
  async function submit() {
    setBusy(true);
    try {
      onChange(await api<ResultState>('POST', `/sessions/${s.id}/result`, { text: text.trim(), ...(image ? { image: image.b64 } : {}) }));
      setImage(null);
    } catch (e) { toast(errorMessage(e)); }
    setBusy(false);
  }

  const pill = r.status === 'ok' ? <Pill tone="good">Đạt</Pill> : r.status === 'flag' ? <Pill tone="bad">Đáng ngờ</Pill> : r.status === 'sent' ? <Pill tone="warn">Chờ trưởng nhóm xem</Pill> : <Pill tone="warn">Chưa nộp</Pill>;

  return (
    <Card>
      <div onPaste={onPaste} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <h3>Nộp kết quả của phiên</h3>
          {pill}
        </div>
        <p className="text-[13px] text-muted">
          Mục tiêu bạn đã đăng ký: <b className="text-ink">{s.goal || '(không ghi)'}</b>. Hãy nộp thứ bạn làm ra: đoạn đã viết, bài đã giải, ghi chép đã làm.
          Kết quả được đối chiếu với mục tiêu và với {Math.round(s.plannedSec / 60)} phút cam kết. Phiên chỉ được xác minh khi kết quả đạt.
        </p>
        {r.status !== 'none' && r.reason && (
          r.status === 'flag'
            ? <Banner tone="bad"><span className="text-[13px]">{r.reason}{r.score != null ? ` (${r.score}/100)` : ''}{noTries ? ' Đã hết lượt nộp.' : ' Bạn có thể bổ sung rồi nộp lại.'}</span></Banner>
            : <p className="text-[13px]">{r.reason}{r.score != null ? ` (${r.score}/100)` : ''}</p>
        )}
        {!done && !noTries && (
          <>
            <Field label="Dán đoạn đã viết hoặc tóm tắt việc đã làm">
              <textarea className={inputCls + ' min-h-[110px] resize-y'} maxLength={LIMITS.resultText} value={text} onChange={(e) => setText(e.target.value)}
                placeholder="Ví dụ: đã giải câu 1–12 phần đạo hàm, câu 9 dùng quy tắc chuỗi…" />
            </Field>
            <div className="flex flex-wrap items-center gap-2.5">
              <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Chọn ảnh kết quả" aria-hidden="true" tabIndex={-1}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }} />
              <Button onClick={() => input.current?.click()}>{image ? 'Đổi ảnh' : 'Chụp hoặc chọn ảnh'}</Button>
              <span className="text-[13px] text-muted">Trên máy tính: chụp màn hình (Win+Shift+S) rồi bấm Ctrl+V vào thẻ này.</span>
            </div>
            {image && <img src={image.url} alt="Ảnh kết quả sẽ nộp" className="max-h-56 w-auto self-start rounded-lg border border-line" />}
            {!image && r.hasImage && <p className="text-[13px] text-muted">Đã có ảnh nộp lần trước; nộp lại chỉ văn bản thì ảnh cũ vẫn được dùng.</p>}
            <div className="flex flex-wrap items-center gap-2.5">
              <Button variant="primary" disabled={busy || (!text.trim() && !image)} onClick={submit}>{busy ? 'Đang chấm kết quả…' : r.status === 'none' ? 'Nộp kết quả' : 'Nộp lại'}</Button>
              <span className="text-[13px] text-muted">Đã nộp {r.tries}/{RESULT_TRIES} lần.</span>
            </div>
          </>
        )}
        <p className="text-[13px] text-muted">Ảnh và đoạn văn được gửi đến Gemini của Google để đối chiếu, và lưu để trưởng nhóm xem (ảnh tự xóa sau 45 ngày).</p>
      </div>
    </Card>
  );
}
