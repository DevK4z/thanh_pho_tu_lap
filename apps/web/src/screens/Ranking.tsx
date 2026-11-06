/* Dashboard điểm: tổng điểm của nhóm, phần trăm đóng góp của từng thành viên và bảng xếp hạng các nhóm. */
import { useState } from 'react';
import { POINTS_PER_SESSION, type RankRange } from '@tptl/shared';
import { BigNumber, Button, Card, Chip, Eyebrow, Grid, Meter, Muted } from '../components/ui';
import { errorMessage } from '../lib/api';
import { fmtMin } from '../lib/format';
import { useRanking } from '../lib/queries';

const RANGES: [RankRange, string][] = [['week', '7 ngày gần nhất'], ['all', 'Từ đầu đến nay']];
const MEDAL = ['#f6b21b', '#9aa7b4', '#c9803a'];

export function Ranking({ meId }: { meId: string | null }) {
  const [range, setRange] = useState<RankRange>('week');
  const q = useRanking(range);
  const d = q.data;
  const mine = d?.groups.find((g) => g.id === d.myGroupId) ?? null;
  const top = d?.groups[0]?.points ?? 0;

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div><Eyebrow>Điểm nhóm · cập nhật khi có phiên hoàn thành</Eyebrow><h2>Xếp hạng</h2></div>
        <div className="flex gap-2" role="group" aria-label="Kỳ tính điểm">
          {RANGES.map(([k, label]) => <Chip key={k} pressed={range === k} onClick={() => setRange(k)}>{label}</Chip>)}
        </div>
      </div>

      {q.isError && (
        <Card><h3>Chưa đọc được bảng xếp hạng</h3><Muted>{errorMessage(q.error)}</Muted><div><Button onClick={() => q.refetch()}>Thử lại</Button></div></Card>
      )}
      {!d && !q.isError && <Card><Muted>Đang tải bảng xếp hạng…</Muted></Card>}

      {d && (
        <>
          {mine ? (
            <Grid cols={3}>
              <Card>
                <Eyebrow>Tổng điểm nhóm {mine.name}</Eyebrow>
                <BigNumber>{mine.points}</BigNumber>
                <p className="text-[13px] text-muted">{fmtMin(mine.minutes)} · {mine.sessions} phiên đã xác minh</p>
              </Card>
              <Card>
                <Eyebrow>Thứ hạng</Eyebrow>
                <BigNumber>#{mine.rank}<span className="text-[22px]"> / {d.groups.length}</span></BigNumber>
                <p className="text-[13px] text-muted">{mine.rank === 1 ? 'Nhóm đang dẫn đầu.' : `Cách hạng nhất ${top - mine.points} điểm.`}</p>
              </Card>
              <Card>
                <Eyebrow>Trung bình mỗi thành viên</Eyebrow>
                <BigNumber>{mine.perMember}</BigNumber>
                <p className="text-[13px] text-muted">{mine.contributors} / {mine.members} thành viên có điểm</p>
              </Card>
            </Grid>
          ) : (
            <Card><h3>Bạn chưa ở nhóm nào</h3><Muted>Hãy lập hoặc tham gia một nhóm để điểm của bạn được cộng vào bảng xếp hạng.</Muted></Card>
          )}

          {mine && (
            <Card>
              <h3>Đóng góp của từng thành viên</h3>
              {d.contributions.some((c) => c.share != null) ? (
                <ol className="m-0 flex list-none flex-col gap-3 p-0">
                  {d.contributions.map((c) => (
                    <li key={c.playerId} className="grid gap-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="font-semibold">{c.name}{c.playerId === meId ? ' (bạn)' : ''}</span>
                        <span className="tabular-nums text-muted"><b className="text-ink">{c.share ?? 0}%</b> · {c.points} điểm</span>
                      </div>
                      <Meter value={c.share ?? 0} max={100} label={`${c.name} đóng góp ${c.share ?? 0}% điểm của nhóm`} />
                      <span className="text-[12px] text-muted">{fmtMin(c.minutes)} · {c.sessions} phiên</span>
                    </li>
                  ))}
                </ol>
              ) : <Muted>Chưa có phiên nào được xác minh trong kỳ này. Điểm của nhóm bắt đầu từ phiên đã xác minh đầu tiên.</Muted>}
              <p className="text-[13px] text-muted">Phần trăm đóng góp = điểm của thành viên chia cho tổng điểm nhóm trong cùng kỳ.</p>
            </Card>
          )}

          <Card>
            <h3>Bảng xếp hạng các nhóm</h3>
            {d.groups.length ? (
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {d.groups.map((g) => {
                  const you = g.id === d.myGroupId;
                  return (
                    <li key={g.id} className={'grid gap-1.5 rounded-xl border p-3 ' + (you ? 'border-lamp bg-surface2' : 'border-line')} aria-current={you ? 'true' : undefined}>
                      <div className="flex items-center gap-3">
                        <span className="grid size-8 flex-none place-items-center rounded-full text-sm font-bold text-white tabular-nums"
                          style={{ background: g.rank <= 3 ? MEDAL[g.rank - 1] : '#8a94a0' }}>{g.rank}</span>
                        <div className="min-w-0 flex-1">
                          <b className="block truncate">{g.name}{you ? ' (nhóm bạn)' : ''}</b>
                          <span className="text-[12px] text-muted">{g.members} thành viên · {g.contributors} có điểm · {g.perMember} điểm/người</span>
                        </div>
                        <b className="text-lg tabular-nums">{g.points}</b>
                      </div>
                      <Meter value={g.points} max={Math.max(1, top)} label={`${g.name}: ${g.points} điểm`} />
                    </li>
                  );
                })}
              </ol>
            ) : <Muted>Chưa có nhóm nào.</Muted>}
            <p className="text-[13px] text-muted">
              Cách tính: chỉ phiên đã xác minh mới có điểm, gồm 1 điểm mỗi phút cộng {POINTS_PER_SESSION} điểm mỗi phiên. Phiên chưa xác minh, phiên bỏ cuộc và phiên kiểm tra trực tiếp không khớp không có điểm. Nhóm bằng điểm thì đồng hạng.
            </p>
          </Card>
        </>
      )}
    </section>
  );
}
