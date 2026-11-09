import { useState } from 'react';
import { ACTS, LIMITS, MIN_NOTE_WORDS, wordCount, type ActiveSession, type Me, type ProofState, type QuitResult, type SessionResult } from '@tptl/shared';
import { Button, Card, Check, Chip, Eyebrow, Field, inputCls, Option, useToast } from '../components/ui';
import { sendDataToAdmin } from '../lib/adminReport';
import { api, errorMessage } from '../lib/api';
import type { RunMeasures } from './FocusRun';
import { FieldPhotoCard } from './FieldPhotoCard';
import { ProofCard } from './ProofCard';

export function FocusVerify({ me, s, m, onDone, onHonest }: { me: Me; s: ActiveSession; m: RunMeasures; onDone: (r: SessionResult) => void; onHonest: () => void }) {
  const toast = useToast();
  const a = ACTS[s.act];
  const [ans, setAns] = useState<(number | null)[]>(() => s.verify.map(() => null));
  const [self, setSelf] = useState(0);
  const [note, setNote] = useState('');
  const [conf, setConf] = useState(false);
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<ProofState>(s.proof);
  const words = wordCount(note);
  const ready = ans.every((x) => x != null) && self > 0 && (s.mode !== 'offline' || conf) && (!a.needNote || words >= MIN_NOTE_WORDS);

  async function finish() {
    if (!ready) return;
    setBusy(true);
    try {
      const r = await api<SessionResult>('POST', `/sessions/${s.id}/complete`, {
        awaySec: Math.round(m.awaySec), dist: m.dist, self, note: note.trim(), confirmed: conf, verify: ans,
      });
      sendDataToAdmin(me.id, 'success', r.stats);
      onDone(r);
    } catch (e) { toast(errorMessage(e)); setBusy(false); }
  }

  /** Tự khai chưa làm đủ: phiên không có điểm nhưng giữ chuỗi và không trừ độ tin cậy. */
  async function honest() {
    setBusy(true);
    try {
      const r = await api<QuitResult>('POST', `/sessions/${s.id}/quit`, { awaySec: Math.round(m.awaySec), dist: m.dist, reason: 'honest' });
      sendDataToAdmin(me.id, 'failed', r.stats);
      toast('Cảm ơn bạn đã trung thực. Phiên được ghi là chưa hoàn thành; độ tin cậy không bị trừ.');
      onHonest();
    } catch (e) { toast(errorMessage(e)); setBusy(false); }
  }

  return (
    <section className="flex flex-col gap-3.5">
      <div>
        <Eyebrow>Hết giờ</Eyebrow>
        <h2>Xác nhận để nhận công trình</h2>
        <p className="mt-1.5 text-muted">Bạn đã hoàn thành {Math.round(s.plannedSec / 60)} phút cam kết. Trả lời các câu hỏi sau để xác nhận phiên.</p>
      </div>
      <ProofCard s={{ ...s, proof }} onChange={setProof} />
      {a.field && <FieldPhotoCard s={s} canCapture={false} refresh={proof.status + proof.tries} />}
      {s.verify.map((q, qi) => (
        <Card key={qi}>
          <h3>{q.q}</h3>
          {q.o.map((o, i) => <Option key={i} pressed={ans[qi] === i} title={o} onClick={() => setAns((x) => x.map((y, j) => (j === qi ? i : y)))} />)}
        </Card>
      ))}
      <Card>
        <h3>Bạn tập trung được mức nào?</h3>
        <div className="flex flex-wrap gap-2.5">{[1, 2, 3, 4, 5].map((n) => <Chip key={n} pressed={self === n} onClick={() => setSelf(n)}>{n}</Chip>)}</div>
        <p className="text-[13px] text-muted">
          1 là rất xao nhãng, 5 là hoàn toàn tập trung.
          {s.mode === 'offline' && ' Với hoạt động ngoài màn hình, điểm tập trung dựa trên câu trả lời và tự đánh giá này.'}
        </p>
        <Field label={a.needNote ? `Ghi 1–2 câu về điều bạn rút ra (ít nhất ${MIN_NOTE_WORDS} từ)` : 'Ghi chú ngắn về phiên (không bắt buộc)'}>
          <textarea className={inputCls + ' min-h-[84px] resize-y'} maxLength={LIMITS.note} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {a.needNote && <p className="text-[13px] text-muted">Đã viết {words} từ.</p>}
        {s.mode === 'offline' && <Check checked={conf} onChange={setConf}>Tôi xác nhận đã thực hiện đủ thời gian và không dùng điện thoại trong phiên.</Check>}
        <div className="flex flex-wrap gap-2.5">
          <Button variant="primary" big disabled={!ready || busy} onClick={finish}>{busy ? 'Đang chấm điểm…' : 'Hoàn thành phiên'}</Button>
          <Button disabled={busy} onClick={honest}>Tôi chưa làm đủ thời gian</Button>
        </div>
      </Card>
    </section>
  );
}
