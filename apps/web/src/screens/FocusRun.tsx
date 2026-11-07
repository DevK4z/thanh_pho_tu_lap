import { useEffect, useRef, useState } from 'react';
import { ACTS, GRACE_SECONDS, REASONS, STUDY_CHECK_SECONDS, USER_REASON_KEYS, VERIFY_FOCUS, type ActiveSession, type Me, type QuitReason, type QuitResult, type TaskStats } from '@tptl/shared';
import { Banner, Button, Card, Chip, Eyebrow, Modal, Option, Stat3, useToast } from '../components/ui';
import { CAUSE_LABEL, enterFullscreen, exitFullscreen, useAntiCheat, type Cause, type Warning } from '../focus/useAntiCheat';
import { useFocusRun, type RunMeasures } from '../focus/useFocusRun';
import { sendDataToAdmin } from '../lib/adminReport';
import { FieldPhotoCard } from './FieldPhotoCard';
import { api, errorMessage } from '../lib/api';
import { hm, mmss } from '../lib/format';

export type { RunMeasures };
const CIRC = 2 * Math.PI * 90;

/** Thông tin hiển thị ở màn thất bại. */
export interface FailInfo {
  kind: 'violation' | 'quit';
  cause?: Cause;
  reason?: QuitReason;
  log: Warning[];
  lostStreak: number;
  stats: TaskStats | null;
}

/** Tiếng bíp ngắn: người dùng đã bấm bắt đầu phiên nên trình duyệt cho phép phát âm thanh. */
function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.value = 0.15;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.35);
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch { /* không phát được âm thanh thì vẫn còn tab nhấp nháy */ }
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Nhật ký cảnh báo trong phiên: mỗi lần rời màn hình, kể cả các lần quay lại kịp trong thời gian ân hạn. */
export function WarningLog({ log }: { log: Warning[] }) {
  if (!log.length) return <p className="text-[13px] text-muted">Chưa có cảnh báo nào. Giữ vững nhé!</p>;
  return (
    <ul className="flex flex-col gap-1.5 text-left text-[13px]">
      {log.map((w, i) => (
        <li key={i} className={'flex flex-wrap gap-x-2 rounded-lg border px-3 py-2 ' + (w.failed ? 'border-bad text-bad' : 'border-line')}>
          <b className="tabular-nums">{clock(w.at)}</b>
          <span>{CAUSE_LABEL[w.cause]}</span>
          <span className={w.failed ? '' : 'text-muted'}>· {w.sec.toFixed(1)} giây · {w.failed ? 'quá thời gian ân hạn, phiên thất bại' : 'quay lại kịp trong thời gian ân hạn'}</span>
        </li>
      ))}
    </ul>
  );
}

export function FocusRun({ me, s, onFinish, onFailed }: { me: Me; s: ActiveSession; onFinish: (m: RunMeasures) => void; onFailed: (f: FailInfo) => void }) {
  const toast = useToast();
  const [ended, setEnded] = useState(false);
  const [quitAsk, setQuitAsk] = useState(false);
  const [reason, setReason] = useState<QuitReason | null>(null);
  const [busy, setBusy] = useState(false);
  const a = ACTS[s.act];
  const fullscreen = a.watch === 'fullscreen';
  const studying = a.watch === 'checks';
  // Học trên máy chỉ có câu kiểm tra hiện diện: được đổi tab, mở ứng dụng khác nên không giám sát rời trang.
  const watched = a.watch === 'fullscreen' || a.watch === 'visible';
  const stopRun = useRef<() => void>(() => {});

  /** Gửi kết quả thất bại lên máy chủ rồi chuyển sang màn thất bại. */
  async function fail(info: Omit<FailInfo, 'lostStreak' | 'stats'>, m: RunMeasures) {
    setEnded(true);
    stopRun.current();
    exitFullscreen();
    const quitReason: QuitReason = info.kind === 'violation' ? 'violation' : info.reason!;
    try {
      const r = await api<QuitResult>('POST', `/sessions/${s.id}/quit`, { reason: quitReason, awaySec: Math.round(m.awaySec), dist: m.dist });
      sendDataToAdmin(me.id, 'failed', r.stats);
      onFailed({ ...info, lostStreak: r.lostStreak, stats: r.stats });
    } catch (e) {
      toast(errorMessage(e));
      onFailed({ ...info, lostStreak: 0, stats: null });
    }
  }

  const ac = useAntiCheat(watched && !ended, fullscreen, (cause, awaySec, log) => {
    toast('Bạn đã mất tập trung!');
    fail({ kind: 'violation', cause, log }, { awaySec, dist: log.length });
  });

  const run = useFocusRun(s, () => {
    setEnded(true);
    exitFullscreen();
    onFinish(ac.measures());
  }, toast, ac.isAway);
  stopRun.current = run.stop;

  async function quit() {
    if (!reason) return;
    setBusy(true);
    setQuitAsk(false);
    await fail({ kind: 'quit', reason, log: ac.log }, ac.measures());
  }

  // Học trên máy: có câu kiểm tra mà người học đang ở ứng dụng khác thì kêu, nhấp nháy tiêu đề tab và hiện thông báo hệ thống.
  useEffect(() => {
    if (!studying || !run.check) return;
    const title = document.title;
    const away = () => document.hidden || !document.hasFocus();
    let note: Notification | null = null;
    if (away()) {
      beep();
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          note = new Notification('Kiểm tra hiện diện', { body: `Quay lại trả lời trong ${STUDY_CHECK_SECONDS} giây.`, tag: 'tptl-check', requireInteraction: true });
          note.onclick = () => { window.focus(); note?.close(); };
        } catch { /* một số trình duyệt chỉ cho thông báo qua service worker */ }
      }
    }
    let k = 0;
    const id = setInterval(() => {
      k++;
      document.title = k % 2 ? '🔔 Kiểm tra hiện diện!' : title;
      if (k % 15 === 0 && away()) beep();
    }, 1000);
    return () => { clearInterval(id); document.title = title; note?.close(); };
  }, [studying, run.check?.index]); // eslint-disable-line react-hooks/exhaustive-deps

  const left = Math.ceil(ac.graceLeft);
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
      {watched ? (
        <div className="flex w-full max-w-xl flex-col gap-3">
          {!fullscreen && !run.awake && (
            <Banner tone="bad" className="text-left">Máy này không giữ được màn hình sáng. Hãy tắt tự khóa màn hình trong cài đặt, nếu không máy tự khóa sẽ làm phiên thất bại.</Banner>
          )}
          {fullscreen ? <p className="text-muted">Giữ trang này ở chế độ toàn màn hình. Đổi tab, click ra ngoài hoặc thoát toàn màn hình quá {GRACE_SECONDS} giây là phiên thất bại và mất chuỗi.</p> : (
            <p className="text-muted"><b>Giữ ứng dụng mở và úp điện thoại xuống.</b> Thoát ứng dụng hoặc tắt màn hình quá {GRACE_SECONDS} giây là phiên thất bại và mất chuỗi.</p>
          )}
          <Stat3 items={[[ac.log.length, 'cảnh báo'], fullscreen ? [run.qc + '/' + run.qa, 'câu kiểm tra đúng'] : [hm(s.startedAt + s.plannedSec * 1000), 'hết giờ lúc'], [ac.measures().awaySec.toFixed(1) + ' giây', 'đã rời màn hình']]} />
          <div>
            <Eyebrow className="mb-1.5 text-left">Nhật ký cảnh báo</Eyebrow>
            <WarningLog log={ac.log} />
          </div>
        </div>
      ) : studying ? (
        <div className="flex w-full max-w-xl flex-col gap-3">
          <p className="text-muted">
            <b>Bạn được mở tài liệu, Word, PDF hay trang tra cứu.</b> Thỉnh thoảng sẽ có câu kiểm tra hiện diện: máy kêu, tab nhấp nháy và hiện thông báo;
            quay lại trả lời trong {STUDY_CHECK_SECONDS} giây. Không phản hồi bị trừ điểm tập trung; dưới {VERIFY_FOCUS} điểm thì phiên chưa xác minh.
          </p>
          <Stat3 items={[[run.qc + '/' + run.qa, 'câu kiểm tra đúng'], [hm(s.startedAt + s.plannedSec * 1000), 'hết giờ lúc'], [Math.max(0, s.checks.length - run.qa), 'câu còn lại']]} />
        </div>
      ) : (
        <Banner className="text-left">
          <b>Hãy cất điện thoại.</b> Bạn có thể thoát khỏi ứng dụng. Quay lại sau <b>{hm(s.startedAt + s.plannedSec * 1000)}</b> để trả lời câu hỏi xác nhận và nhận công trình.
        </Banner>
      )}
      {a.field && <FieldPhotoCard s={s} kinds={['start', 'mid']} pause={ac.pause} resume={ac.resume} />}
      <div><Button variant="ghost" onClick={() => setQuitAsk(true)} disabled={busy}>Dừng phiên (tính là thất bại)</Button></div>

      {ac.away && (
        <div role="alertdialog" aria-live="assertive" aria-label="Cảnh báo mất tập trung"
          className="fixed inset-0 z-[70] grid place-items-center bg-[rgba(120,10,10,.88)] p-4 text-white">
          <div className="flex max-w-md flex-col items-center gap-3 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest">Cảnh báo</p>
            <h2 className="text-white">Bạn đang rời khỏi phiên!</h2>
            <p>{CAUSE_LABEL[ac.away.cause]}. Quay lại trong <b className="text-2xl tabular-nums">{left}</b> giây để không bị tính thất bại.</p>
            {ac.away.cause === 'fullscreen' && (
              <Button variant="lamp" big onClick={() => enterFullscreen().catch(() => toast('Không bật lại được toàn màn hình.'))}>Quay lại toàn màn hình</Button>
            )}
          </div>
        </div>
      )}
      {run.check && !quitAsk && !ac.away && (
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
          <p className="text-[13px] text-muted">Phiên sẽ tính là thất bại: không nhận thưởng và chuỗi phiên thành công về 0. Chọn lý do để giúp nhóm hiểu vì sao các phiên bị dừng.</p>
          <div className="flex flex-wrap gap-2.5">
            {USER_REASON_KEYS.map((k) => <Chip key={k} pressed={reason === k} onClick={() => setReason(k)}>{REASONS[k]}</Chip>)}
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button onClick={() => setQuitAsk(false)}>Tiếp tục phiên</Button>
            <Button variant="danger" disabled={!reason || busy} onClick={quit}>Xác nhận dừng</Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}
