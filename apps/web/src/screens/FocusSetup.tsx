import { useState } from 'react';
import {
  ACTS, ACT_KEYS, DURS, GRACE_SECONDS, LIMITS, MAX_MINUTES, MIN_MINUTES, STUDY_CHECK_SECONDS, TIERS,
  dkey, tierFor, type ActKey, type ActiveSession, type Player, type RecallDue,
} from '@tptl/shared';
import { Icon } from '../components/Icons';
import { Banner, Button, Card, Check, Chip, Eyebrow, Field, Grid, inputCls, Option, useToast } from '../components/ui';
import { enterFullscreen, exitFullscreen, fullscreenSupported } from '../focus/useAntiCheat';
import { api, errorMessage } from '../lib/api';
import { ParticipantCodeCard } from './ParticipantCodeCard';
import { RecallCard } from './RecallCard';

const PREP = {
  fullscreen: [
    'Điện thoại đã cất xa tầm tay và tắt âm',
    'Đã đóng các tab và ứng dụng không cần cho phiên này',
    `Tôi hiểu phiên chạy toàn màn hình; đổi tab, click ra ngoài hoặc thoát toàn màn hình quá ${GRACE_SECONDS} giây là thất bại và mất chuỗi`,
  ],
  checks: [
    'Đã mở sẵn tài liệu cần dùng và đóng mạng xã hội, trò chơi',
    'Đã bật âm lượng để nghe tiếng báo kiểm tra hiện diện',
    `Tôi hiểu sẽ có câu kiểm tra hiện diện ngẫu nhiên và phải quay lại trả lời trong ${STUDY_CHECK_SECONDS} giây`,
  ],
  visible: [
    'Điện thoại đang bật Không làm phiền và còn đủ pin cho cả phiên',
    'Đã chuẩn bị đủ vật dụng cho hoạt động',
    `Tôi hiểu phải giữ ứng dụng mở và màn hình sáng; thoát ứng dụng hoặc tắt màn hình quá ${GRACE_SECONDS} giây là thất bại và mất chuỗi`,
  ],
  none: [
    'Tôi sẽ chuyển điện thoại sang Không làm phiền và cất đi ngay sau khi bấm bắt đầu',
    'Đã chuẩn bị đủ vật dụng cho hoạt động',
    'Tôi hiểu rằng quay lại sớm hoặc dừng giữa chừng là thất bại và mất chuỗi',
  ],
};

const WATCH_LABEL = {
  fullscreen: 'Trên máy · toàn màn hình, giám sát rời màn hình',
  checks: 'Trên máy · được mở tài liệu, có kiểm tra hiện diện',
  visible: 'Ngoài màn hình · giữ ứng dụng mở, màn hình sáng',
  none: 'Ngoài màn hình · cất điện thoại',
};

export function FocusSetup({ gid, player, recall, onRecallDone, onStart }: { gid: string; player: Player; recall: RecallDue | null; onRecallDone: () => void; onStart: (s: ActiveSession) => void }) {
  const toast = useToast();
  const [act, setAct] = useState<ActKey>('deep');
  const [dur, setDur] = useState<number | ''>(25);
  const [goal, setGoal] = useState('');
  const [checks, setChecks] = useState([false, false, false]);
  const [busy, setBusy] = useState(false);
  const canFullscreen = fullscreenSupported();
  const a = ACTS[act];
  // Chỉ chế độ tập trung tuyệt đối cần toàn màn hình.
  const screenMode = a.watch === 'fullscreen';
  const min = Number(dur) || 0;
  const tier = tierFor(min);
  const validDur = Number.isInteger(min) && min >= MIN_MINUTES && min <= MAX_MINUTES;
  // Chỉ phiên trên máy cần toàn màn hình; hoạt động ngoài màn hình thì người dùng cất máy đi.
  const ok = checks.every(Boolean) && validDur && (!screenMode || canFullscreen);

  async function begin() {
    if (!validDur) { toast(`Thời gian cam kết cần từ ${MIN_MINUTES} đến ${MAX_MINUTES} phút.`); return; }
    setBusy(true);
    // Ảnh hiện trường kèm vị trí: xin quyền ngay trong cú bấm để không hỏi giữa phiên.
    if (a.field && 'geolocation' in navigator) navigator.geolocation.getCurrentPosition(() => {}, () => {}, { timeout: 10_000 });
    // Xin quyền thông báo ngay trong cú bấm, để câu kiểm tra hiện diện báo được cả khi đang ở ứng dụng khác.
    if (a.watch === 'checks' && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
    // Bật toàn màn hình trước, ngay trong cú bấm của người dùng (trình duyệt chỉ cho phép lúc này).
    if (screenMode) {
      try {
        await enterFullscreen();
      } catch {
        toast('Không bật được chế độ toàn màn hình. Hãy cho phép toàn màn hình rồi thử lại.');
        setBusy(false);
        return;
      }
    }
    try {
      onStart(await api<ActiveSession>('POST', `/groups/${gid}/sessions`, { act, minutes: min, goal: goal.trim(), day: dkey(Date.now()) }));
    } catch (e) {
      exitFullscreen();
      toast(errorMessage(e));
      setBusy(false);
    }
  }

  if (!player.participantCode) {
    return (
      <section className="flex flex-col gap-3.5">
        <div><Eyebrow>Đăng ký phiên</Eyebrow><h2>Cần mã cá nhân trước</h2></div>
        <p className="text-muted">Mỗi phiên phải gắn với mã cá nhân để kết quả ghép đúng với phiếu khảo sát. Nhập mã thầy cô cấp để bắt đầu.</p>
        <ParticipantCodeCard gid={gid} player={player} />
      </section>
    );
  }

  if (recall) {
    return (
      <section className="flex flex-col gap-3.5">
        <div><Eyebrow>Đăng ký phiên</Eyebrow><h2>Trả lời câu hỏi trước đã</h2></div>
        <RecallCard key={recall.sid} recall={recall} onDone={onRecallDone} />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3.5">
      <div><Eyebrow>Đăng ký phiên</Eyebrow><h2>Cam kết trước, tập trung sau</h2></div>
      {!canFullscreen && screenMode && (
        <Banner tone="bad">
          Trình duyệt này không hỗ trợ chế độ toàn màn hình (thường gặp trên iPhone và iPad), nên chưa bắt đầu được phiên trên máy.
          Hãy dùng máy tính hoặc điện thoại Android với Chrome, hoặc chọn một hoạt động ngoài màn hình.
        </Banner>
      )}
      <Card className="border-lamp">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
          <div className="flex items-center gap-2">
            <Icon name="fire" className="size-8" />
            <div><Eyebrow>Chuỗi hiện tại</Eyebrow><b className="text-lg">{player.currentStreak} phiên</b></div>
          </div>
          <div>
            <Eyebrow>Chuỗi dài nhất</Eyebrow>
            <b className="text-lg">{player.bestStreak} phiên</b>
          </div>
        </div>
        <p className="text-[13px] text-muted">
          Hoàn thành phiên này để nâng chuỗi lên {player.currentStreak + 1} và nhận một công trình. Một phiên thất bại sẽ đưa chuỗi về 0.
        </p>
      </Card>
      <Card>
        <h3>1. Chọn hoạt động</h3>
        <Grid cols={3}>
          {ACT_KEYS.map((k) => (
            <Option key={k} pressed={act === k} onClick={() => { setAct(k); setChecks([false, false, false]); }} title={ACTS[k].n}
              sub={WATCH_LABEL[ACTS[k].watch]} />
          ))}
        </Grid>
        <p className="text-[13px] text-muted">{a.d}</p>
      </Card>
      <Card>
        <h3>2. Đăng ký thời gian tối thiểu</h3>
        <div className="flex flex-wrap gap-2.5">{DURS.map((m) => <Chip key={m} pressed={min === m} onClick={() => setDur(m)}>{m} phút</Chip>)}</div>
        <Field label={`Hoặc nhập số phút (${MIN_MINUTES}–${MAX_MINUTES})`} className="max-w-[220px]">
          <input type="number" className={inputCls} min={MIN_MINUTES} max={MAX_MINUTES} value={dur} onChange={(e) => setDur(e.target.value === '' ? '' : Number(e.target.value))} />
        </Field>
        <p className="text-[13px] text-muted">
          {tier ? `Với ${min} phút, bạn còn nhận công trình hạng “${TIERS[tier - 1].n}”. ` + (tier < 4 ? `Hạng cao hơn mở ở ${TIERS[tier].min} phút.` : 'Đây là hạng cao nhất.') : `Cần tối thiểu ${MIN_MINUTES} phút.`}
          {' '}Đã bấm bắt đầu thì không đổi được thời gian.
        </p>
      </Card>
      <Card>
        <h3>3. Mục tiêu của phiên</h3>
        <Field label={a.gl + ' (không bắt buộc)'}>
          <input className={inputCls} value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={LIMITS.goal} placeholder={a.ph} />
        </Field>
      </Card>
      <Card>
        <h3>4. Chuẩn bị</h3>
        <div>
          {PREP[a.watch].map((c, i) => <Check key={act + i} checked={checks[i]} onChange={(v) => setChecks((x) => x.map((y, j) => (j === i ? v : y)))}>{c}</Check>)}
        </div>
        {a.field && (
          <p className="text-[13px] text-muted">
            Phiên này cần 3 ảnh hiện trường: lúc bắt đầu (trong 5 phút đầu), giữa phiên và lúc kết thúc. Ứng dụng xin quyền vị trí để ghi kèm ảnh
            (làm tròn khoảng 100 m, chỉ trưởng nhóm xem); không cho phép thì ảnh vẫn gửi được nhưng không có vị trí.
          </p>
        )}
        {a.watch === 'visible' && !navigator.wakeLock && (
          <Banner tone="bad">Trình duyệt này không giữ được màn hình sáng. Hãy tắt tự khóa màn hình trong cài đặt máy trước khi bắt đầu, nếu không máy tự khóa sẽ làm phiên thất bại.</Banner>
        )}
        <div><Button variant="primary" big disabled={!ok || busy} onClick={begin}>{screenMode ? 'Vào toàn màn hình và bắt đầu' : 'Cam kết'} {min || '…'} phút{screenMode ? '' : ' và bắt đầu'}</Button></div>
      </Card>
    </section>
  );
}
