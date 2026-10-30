import { useState } from 'react';
import { DAILY_GOALS, HKEYS, HST, LIMITS, type HouseStyle, type Player } from '@tptl/shared';
import { House } from '../components/Svg';
import { Button, Card, Chip, Eyebrow, Field, Grid, inputCls, Option, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { usePatchMyPlayer } from '../lib/queries';

export function Onboard({ gid, defaultName, onCreated }: { gid: string; defaultName: string; onCreated: () => void }) {
  const toast = useToast();
  const patch = usePatchMyPlayer(gid);
  const [name, setName] = useState(defaultName);
  const [style, setStyle] = useState<HouseStyle>('san');
  const [goal, setGoal] = useState(30);
  const [busy, setBusy] = useState(false);

  async function create() {
    const n = name.trim();
    if (!n) { toast('Hãy nhập tên hiển thị.'); return; }
    setBusy(true);
    try {
      patch(await api<Player>('POST', `/groups/${gid}/players`, { name: n, style, dailyGoal: goal }));
      onCreated();
    } catch (e) { toast(errorMessage(e)); }
    setBusy(false);
  }

  return (
    <Card as="section">
      <div>
        <Eyebrow>Chào mừng</Eyebrow>
        <h2>Chọn khu đất đầu tiên</h2>
        <p className="mt-1.5 text-muted">Mỗi phiên tập trung hoàn thành cho bạn một công trình để xây nhà và phát triển thành phố của riêng bạn trong khu phố của nhóm.</p>
      </div>
      <Field label="Tên hiển thị trong nhóm">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.userName} placeholder="Tên hoặc biệt danh" />
      </Field>
      <div>
        <Eyebrow className="mb-2">Kiểu nhà</Eyebrow>
        <Grid>
          {HKEYS.map((k) => (
            <Option key={k} pressed={style === k} onClick={() => setStyle(k)} title={HST[k].n}>
              <House style={k} lv={4} className="max-h-[150px] w-full rounded-lg bg-[var(--sea1)]" />
            </Option>
          ))}
        </Grid>
      </div>
      <div>
        <Eyebrow className="mb-2">Mục tiêu tập trung mỗi ngày</Eyebrow>
        <div className="flex flex-wrap gap-2.5">
          {DAILY_GOALS.map((m) => <Chip key={m} pressed={goal === m} onClick={() => setGoal(m)}>{m} phút</Chip>)}
        </div>
        <p className="mt-1.5 text-[13px] text-muted">Chỉ dùng để theo dõi tiến độ trong ngày. Bạn vẫn đăng ký thời gian cho từng phiên riêng.</p>
      </div>
      <div><Button variant="primary" big disabled={busy} onClick={create}>Bắt đầu xây thành phố</Button></div>
    </Card>
  );
}
