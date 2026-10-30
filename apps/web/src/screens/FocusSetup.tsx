import { useState } from 'react';
import { ACTS, ACT_KEYS, DURS, LIMITS, MAX_MINUTES, MIN_MINUTES, TIERS, dkey, tierFor, type ActKey, type ActiveSession } from '@tptl/shared';
import { Button, Card, Check, Chip, Eyebrow, Field, Grid, inputCls, Option, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';

const PREP = {
  screen: ['Điện thoại đã cất xa tầm tay và tắt âm', 'Đã đóng các tab và ứng dụng không cần cho phiên này', 'Tôi hiểu rằng rời trang hoặc dừng giữa chừng sẽ được ghi nhận'],
  offline: ['Tôi sẽ chuyển điện thoại sang Không làm phiền và cất đi ngay sau khi bấm bắt đầu', 'Đã chuẩn bị đủ vật dụng cho hoạt động', 'Tôi hiểu rằng quay lại sớm hoặc dừng giữa chừng sẽ được ghi nhận là bỏ cuộc'],
};

export function FocusSetup({ gid, onStart }: { gid: string; onStart: (s: ActiveSession) => void }) {
  const toast = useToast();
  const [act, setAct] = useState<ActKey>('read');
  const [dur, setDur] = useState<number | ''>(25);
  const [goal, setGoal] = useState('');
  const [checks, setChecks] = useState([false, false, false]);
  const [busy, setBusy] = useState(false);
  const a = ACTS[act];
  const min = Number(dur) || 0;
  const tier = tierFor(min);
  const validDur = Number.isInteger(min) && min >= MIN_MINUTES && min <= MAX_MINUTES;
  const ok = checks.every(Boolean) && validDur;

  async function begin() {
    if (!validDur) { toast(`Thời gian cam kết cần từ ${MIN_MINUTES} đến ${MAX_MINUTES} phút.`); return; }
    setBusy(true);
    try {
      onStart(await api<ActiveSession>('POST', `/groups/${gid}/sessions`, { act, minutes: min, goal: goal.trim(), day: dkey(Date.now()) }));
    } catch (e) { toast(errorMessage(e)); setBusy(false); }
  }

  return (
    <section className="flex flex-col gap-3.5">
      <div><Eyebrow>Đăng ký phiên</Eyebrow><h2>Cam kết trước, tập trung sau</h2></div>
      <Card>
        <h3>1. Chọn hoạt động</h3>
        <Grid cols={3}>
          {ACT_KEYS.map((k) => (
            <Option key={k} pressed={act === k} onClick={() => { setAct(k); setChecks([false, false, false]); }} title={ACTS[k].n}
              sub={ACTS[k].mode === 'screen' ? 'Trên máy · theo dõi rời trang' : 'Ngoài màn hình · cất điện thoại'} />
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
          {tier ? `Với ${min} phút, bạn nhận công trình hạng “${TIERS[tier - 1].n}”. ` + (tier < 4 ? `Hạng cao hơn mở ở ${TIERS[tier].min} phút.` : 'Đây là hạng cao nhất.') : `Cần tối thiểu ${MIN_MINUTES} phút để nhận công trình.`}
          {' '}Đã bấm bắt đầu thì không đổi được thời gian; dừng sớm tính là bỏ cuộc.
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
        <div><Button variant="primary" big disabled={!ok || busy} onClick={begin}>Cam kết {min || '…'} phút và bắt đầu</Button></div>
      </Card>
    </section>
  );
}
