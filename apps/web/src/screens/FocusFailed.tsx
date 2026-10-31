import { REASONS } from '@tptl/shared';
import { Icon } from '../components/Icons';
import { Button, Card, Eyebrow, KV } from '../components/ui';
import { CAUSE_LABEL } from '../focus/useAntiCheat';
import { WarningLog, type FailInfo } from './FocusRun';

export function FocusFailed({ info, onRetry, onTown }: { info: FailInfo; onRetry: () => void; onTown: () => void }) {
  const st = info.stats;
  const total = st ? st.tasksDone + st.tasksFailed : 0;
  return (
    <section className="flex flex-col gap-3.5">
      <Card className="border-bad">
        <div className="flex items-start gap-3">
          <Icon name="fire" className="size-10 flex-none opacity-40 grayscale" />
          <div>
            <Eyebrow>{info.kind === 'violation' ? 'Phiên thất bại' : 'Đã dừng phiên'}</Eyebrow>
            <h2 className="text-bad">{info.kind === 'violation' ? 'Bạn đã mất tập trung!' : 'Phiên đã được ghi nhận là thất bại'}</h2>
            <p className="mt-1.5 text-muted">
              {info.kind === 'violation' ? CAUSE_LABEL[info.cause!] + ' quá thời gian ân hạn.' : 'Lý do: ' + REASONS[info.reason!] + '.'}
              {' '}{info.lostStreak > 0 ? `Chuỗi ${info.lostStreak} phiên thành công đã về 0.` : 'Phiên này không nhận thưởng.'}
            </p>
          </div>
        </div>
        {st && (
          <KV rows={[
            ['Chuỗi hiện tại', st.currentStreak + ' phiên'],
            ['Chuỗi dài nhất', st.bestStreak + ' phiên'],
            ['Thành công / thất bại', `${st.tasksDone} / ${st.tasksFailed}`],
            ['Tỷ lệ hoàn thành', total ? Math.round((100 * st.tasksDone) / total) + '%' : '–'],
          ]} />
        )}
        <div className="flex flex-wrap gap-2.5">
          <Button variant="primary" onClick={onRetry}>Thử lại phiên mới</Button>
          <Button onClick={onTown}>Về thành phố</Button>
        </div>
      </Card>
      {info.log.length > 0 && (
        <Card>
          <h3>Nhật ký cảnh báo của phiên</h3>
          <WarningLog log={info.log} />
        </Card>
      )}
    </section>
  );
}
