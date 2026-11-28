import { useState } from 'react';
import { DAILY_GOALS, HKEYS, HST, LIMITS, PARTICIPANT_RE, type HouseStyle, type Player } from '@tptl/shared';
import { House } from '../components/Svg';
import { Button, Card, Chip, Eyebrow, Field, Grid, inputCls, Option, useToast } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { usePatchMyPlayer } from '../lib/queries';

/** personal: nhóm riêng của tài khoản khách, không cần mã cá nhân (mã chỉ dùng để ghép với phiếu khảo sát của nhóm thật). */
export function Onboard({ gid, defaultName, onCreated, personal = false }: { gid: string; defaultName: string; onCreated: () => void; personal?: boolean }) {
  const toast = useToast();
  const patch = usePatchMyPlayer(gid);
  const [name, setName] = useState(defaultName);
  const [style, setStyle] = useState<HouseStyle>('san');
  const [goal, setGoal] = useState(30);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    const n = name.trim();
    if (!n) { toast('Hãy nhập tên hiển thị.'); return; }
    const pc = code.trim().toUpperCase();
    if (!personal && !PARTICIPANT_RE.test(pc)) { toast('Hãy nhập mã cá nhân thầy cô cấp (chữ không dấu, số, dấu gạch), ví dụ T0-015.'); return; }
    setBusy(true);
    try {
      patch(await api<Player>('POST', `/groups/${gid}/players`, { name: n, style, dailyGoal: goal, ...(personal ? {} : { participantCode: pc }) }));
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
      {personal ? (
        <p className="-mt-1 text-[13px] text-muted">Đây là nhóm riêng của bạn để dùng thử. Khi có mã mời của lớp, bấm “Đổi nhóm” ở góc trên để vào nhóm của lớp.</p>
      ) : (
        <>
          <Field label="Mã cá nhân">
            <input className={inputCls + ' max-w-[220px] uppercase'} value={code} onChange={(e) => setCode(e.target.value)} maxLength={LIMITS.participantCode} placeholder="VD: T0-015" autoComplete="off" />
          </Field>
          <p className="-mt-2 text-[13px] text-muted">Mã do thầy cô cấp, dùng để ghép kết quả với phiếu khảo sát. Nhập sai thì nhờ trưởng nhóm sửa.</p>
        </>
      )}
      <div>
        <Eyebrow className="mb-2">Kiểu nhà</Eyebrow>
        <Grid>
          {HKEYS.map((k) => (
            <Option key={k} pressed={style === k} onClick={() => setStyle(k)} title={HST[k].n}>
              <House style={k} lv={4} className="max-h-[150px] w-full rounded-lg bg-(--sea1)" />
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
