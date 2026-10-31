import { useState } from 'react';
import {
  ACTS, ACT_KEYS, DURS, GRACE_SECONDS, LIMITS, MAX_MINUTES, MIN_MINUTES, TIERS,
  dkey, nextStreakTier, rewardFor, tierFor, type ActKey, type ActiveSession, type Player,
} from '@tptl/shared';
import { Icon } from '../components/Icons';
import { Banner, Button, Card, Check, Chip, Eyebrow, Field, Grid, inputCls, Option, useToast } from '../components/ui';
import { enterFullscreen, exitFullscreen, fullscreenSupported } from '../focus/useAntiCheat';
import { api, errorMessage } from '../lib/api';

const PREP = {
  screen: [
    'Điện thoại đã cất xa tầm tay và tắt âm',
    'Đã đóng các tab và ứng dụng không cần cho phiên này',
    `Tôi hiểu phiên chạy toàn màn hình; đổi tab, click ra ngoài hoặc thoát toàn màn hình quá ${GRACE_SECONDS} giây là thất bại và mất chuỗi`,
  ],
  offline: [
    'Tôi sẽ chuyển điện thoại sang Không làm phiền và cất đi ngay sau khi bấm bắt đầu',
    'Đã chuẩn bị đủ vật dụng cho hoạt động',
    'Tôi hiểu rằng quay lại sớm hoặc dừng giữa chừng là thất bại và mất chuỗi',
  ],
};

export function FocusSetup({ gid, player, onStart }: { gid: string; player: Player; onStart: (s: ActiveSession) => void }) {
  const toast = useToast();
  const [act, setAct] = useState<ActKey>('deep');
  const [dur, setDur] = useState<number | ''>(25);
  const [goal, setGoal] = useState('');
  const [checks, setChecks] = useState([false, false, false]);
  const [busy, setBusy] = useState(false);
  const canFullscreen = fullscreenSupported();
  const a = ACTS[act];
  const screenMode = a.mode === 'screen';
  const min = Number(dur) || 0;
  const tier = tierFor(min);
  const validDur = Number.isInteger(min) && min >= MIN_MINUTES && min <= MAX_MINUTES;
  // Chỉ phiên trên máy cần toàn màn hình; hoạt động ngoài màn hình thì người dùng cất máy đi.
  const ok = checks.every(Boolean) && validDur && (!screenMode || canFullscreen);
  const reward = rewardFor(player.currentStreak + 1);
  const next = nextStreakTier(player.currentStreak + 1);

  async function begin() {
    if (!validDur) { toast(`Thời gian cam kết cần từ ${MIN_MINUTES} đến ${MAX_MINUTES} phút.`); return; }
    setBusy(true);
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
            <Eyebrow>Hoàn thành phiên này nhận</Eyebrow>
            <div className="flex items-center gap-3 text-lg font-bold">
              <span className="flex items-center gap-1"><Icon name="gold" className="size-6" />+{reward.gold}</span>
              <span className="flex items-center gap-1"><Icon name="wood" className="size-6" />+{reward.wood}</span>
              {reward.mult > 1 && <span className="rounded-full bg-lamp px-2.5 py-0.5 text-sm text-lamp-ink">×{reward.mult}</span>}
            </div>
          </div>
        </div>
        <p className="text-[13px] text-muted">
          Mỗi phiên hoàn thành: {rewardFor(1).gold} vàng và {rewardFor(1).wood} gỗ, nhân ×2 từ chuỗi 5, ×3 từ chuỗi 10, ×3,5 từ chuỗi 15.
          {next ? ` Còn ${next.at - player.currentStreak - 1} phiên nữa sau phiên này để lên ×${String(next.mult).replace('.', ',')}.` : ' Bạn đang ở mức thưởng cao nhất.'}
          {' '}Một phiên thất bại sẽ đưa chuỗi về 0.
        </p>
      </Card>
      <Card>
        <h3>1. Chọn hoạt động</h3>
        <Grid cols={3}>
          {ACT_KEYS.map((k) => (
            <Option key={k} pressed={act === k} onClick={() => { setAct(k); setChecks([false, false, false]); }} title={ACTS[k].n}
              sub={ACTS[k].mode === 'screen' ? 'Trên máy · toàn màn hình, giám sát rời màn hình' : 'Ngoài màn hình · cất điện thoại'} />
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
          {PREP[a.mode].map((c, i) => <Check key={act + i} checked={checks[i]} onChange={(v) => setChecks((x) => x.map((y, j) => (j === i ? v : y)))}>{c}</Check>)}
        </div>
        <div><Button variant="primary" big disabled={!ok || busy} onClick={begin}>{screenMode ? 'Vào toàn màn hình và bắt đầu' : 'Cam kết'} {min || '…'} phút{screenMode ? '' : ' và bắt đầu'}</Button></div>
      </Card>
    </section>
  );
}
