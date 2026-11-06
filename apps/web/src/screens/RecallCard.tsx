/* Lớp 2: câu hỏi nhớ lại về phiên hôm trước. Phải trả lời trước khi bắt đầu phiên mới. */
import { useState } from 'react';
import { ACTS, LIMITS, MIN_RECALL_WORDS, RECALL_PASS, dkey, wordCount, type RecallDue, type RecallResult } from '@tptl/shared';
import { Button, Card, Eyebrow, Field, inputCls, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { dmy } from '../lib/format';

export function RecallCard({ recall, onDone }: { recall: RecallDue; onDone: () => void }) {
  const toast = useToast();
  const [question, setQuestion] = useState(recall.question);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const url = `/sessions/${recall.sid}/recall`;

  async function ask() {
    setBusy(true);
    try { setQuestion((await api<{ question: string }>('POST', url + '/question')).question); } catch (e) { toast(errorMessage(e)); }
    setBusy(false);
  }
  async function send(skip: boolean) {
    setBusy(true);
    try {
      const r = await api<RecallResult>('POST', url + '/answer', { answer: skip ? '' : answer, skip, day: dkey(Date.now()) });
      toast(skip ? 'Đã ghi nhận. Cảm ơn bạn đã trung thực.' : r.score == null ? 'Đã gửi câu trả lời.' : r.score >= RECALL_PASS ? 'Câu trả lời khớp với phiên hôm trước. Cảm ơn bạn!' : 'Câu trả lời chưa khớp với phiên hôm trước.');
      onDone();
    } catch (e) { toast(errorMessage(e)); setBusy(false); }
  }

  return (
    <Card>
      <div><Eyebrow>Câu hỏi nhớ lại</Eyebrow><h3>Phiên {ACTS[recall.act].n.toLowerCase()} ngày {dmy(recall.day)}</h3></div>
      {!question ? (
        <>
          <p className="text-[13px] text-muted">Trả lời một câu hỏi ngắn về phiên đó trước khi bắt đầu phiên mới. Câu trả lời giúp xác minh phiên và tính vào độ tin cậy.</p>
          <div><Button variant="primary" disabled={busy} onClick={ask}>{busy ? 'Đang chuẩn bị câu hỏi…' : 'Nhận câu hỏi'}</Button></div>
        </>
      ) : (
        <>
          <p><b>{question}</b></p>
          <Field label="Câu trả lời của bạn">
            <textarea className={inputCls + ' min-h-[84px] resize-y'} maxLength={LIMITS.recallAnswer} value={answer} onChange={(e) => setAnswer(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="primary" disabled={busy || wordCount(answer) < MIN_RECALL_WORDS} onClick={() => send(false)}>{busy ? 'Đang đối chiếu…' : 'Gửi câu trả lời'}</Button>
            <Button disabled={busy} onClick={() => send(true)}>Tôi không nhớ</Button>
          </div>
        </>
      )}
    </Card>
  );
}
