import { useState } from 'react';
import { ACTS, REASONS, REASON_KEYS, type ActiveSession, type QuitReason } from '@tptl/shared';
import { Banner, Button, Card, Chip, Eyebrow, Modal, Option, Stat3, useToast } from '../components/ui';
import { useFocusRun, type RunMeasures } from '../focus/useFocusRun';
import { api, errorMessage } from '../lib/api';
import { hm, mmss } from '../lib/format';

export type { RunMeasures };
const CIRC = 2 * Math.PI * 90;

export function FocusRun({ s, onFinish, onQuit }: { s: ActiveSession; onFinish: (m: RunMeasures) => void; onQuit: () => void }) {
  const toast = useToast();
  const run = useFocusRun(s, onFinish, toast);
  const [quitAsk, setQuitAsk] = useState(false);
  const [reason, setReason] = useState<QuitReason | null>(null);
  const [busy, setBusy] = useState(false);
  const a = ACTS[s.act];

  async function quit() {
    if (!reason) return;
    setBusy(true);
    const m = run.measures();
    run.stop();
    try {
      await api('POST', `/sessions/${s.id}/quit`, { reason, awaySec: Math.round(m.awaySec), dist: m.dist });
      toast('Đã ghi nhận bỏ cuộc. Lần sau cố gắng lại nhé.');
      onQuit();
    } catch (e) { toast(errorMessage(e)); setBusy(false); }
  }

  return (
    <Card as="section" className="items-center text-center">
      <div>
        <Eyebrow>{a.n} · cam kết {Math.round(s.plannedSec / 60)} phút</Eyebrow>
        {s.goal && <p className="mt-1.5">{s.goal}</p>}
      </div>
      <div className="ringbox">
        <svg viewBox="0 0 220 220" aria-hidden="true">
          <circle className="rtrack" cx="110" cy="110" r="90" />
          <circle className="rbar" cx="110" cy="110" r="90" strokeDasharray={CIRC.toFixed(1)} strokeDashoffset={(CIRC * (run.left / s.plannedSec)).toFixed(1)} transform="rotate(-90 110 110)" />
        </svg>
        <div className="rtime"><b>{mmss(run.left)}</b><span>còn lại</span></div>
      </div>
      {s.mode === 'screen' ? (
        <div className="w-full max-w-xl">
          <p className="text-muted">Giữ trang này ở phía trước. Điện thoại cần ở xa tầm tay.</p>
          <Stat3 items={[[run.dist, 'lần rời trang'], [run.qc + '/' + run.qa, 'câu kiểm tra đúng'], [Math.round(run.awayNow) + ' giây', 'tổng thời gian rời']]} />
          {run.awayNote && <Banner tone="bad">{run.awayNote}</Banner>}
        </div>
      ) : (
        <Banner className="text-left">
          <b>Hãy cất điện thoại.</b> Bạn có thể thoát khỏi ứng dụng. Quay lại sau <b>{hm(s.startedAt + s.plannedSec * 1000)}</b> để trả lời câu hỏi xác nhận và nhận công trình.
        </Banner>
      )}
      <div><Button variant="ghost" onClick={() => setQuitAsk(true)}>Dừng phiên (tính là bỏ cuộc)</Button></div>

      {run.check && !quitAsk && (
        <Modal label="Kiểm tra hiện diện">
          <div>
            <Eyebrow>Kiểm tra hiện diện · còn {run.checkLeft} giây</Eyebrow>
            <h3 className="mt-1.5">{run.check.q.q}</h3>
          </div>
          {run.check.q.o.map((o, i) => <Option key={i} title={o} onClick={() => run.answer(i)} />)}
          <p className="text-[13px] text-muted">Không trả lời kịp sẽ được ghi nhận là không phản hồi.</p>
        </Modal>
      )}
      {quitAsk && (
        <Modal label="Dừng phiên" onClose={() => setQuitAsk(false)}>
          <h3>Dừng phiên sớm?</h3>
          <p className="text-[13px] text-muted">Phiên sẽ được ghi nhận là bỏ cuộc và không nhận công trình. Chọn lý do để giúp nhóm hiểu vì sao các phiên bị dừng.</p>
          <div className="flex flex-wrap gap-2.5">
            {REASON_KEYS.filter((k) => k !== 'closed').map((k) => <Chip key={k} pressed={reason === k} onClick={() => setReason(k)}>{REASONS[k]}</Chip>)}
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button onClick={() => setQuitAsk(false)}>Tiếp tục phiên</Button>
            <Button variant="danger" disabled={!reason || busy} onClick={quit}>Xác nhận bỏ cuộc</Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}
