import { useState, type FormEvent } from 'react';
import { LIMITS, type Me } from '@tptl/shared';
import { Button, Card, Field, Grid, Heading, inputCls, Muted, Option, useToast } from '../components/ui';
import { errorMessage } from '../lib/api';
import { dmyFull } from '../lib/format';
import { useGroupMembership, useGroups } from '../lib/queries';

/** Chọn lập nhóm mới hoặc tham gia nhóm có sẵn. Chưa có nhóm nào thì không tham gia được. */
export function GroupPicker({ me }: { me: Me }) {
  const toast = useToast();
  const groups = useGroups();
  const { create, join } = useGroupMembership();
  const [name, setName] = useState('');
  const [pick, setPick] = useState<string | null>(null);
  const list = groups.data ?? [];
  const picked = list.find((g) => g.id === pick) ?? null;
  const busy = create.isPending || join.isPending;

  function submitCreate(e: FormEvent) {
    e.preventDefault();
    const n = name.trim().replace(/\s+/g, ' ');
    if (!n) { toast('Hãy đặt tên cho nhóm.'); return; }
    if (list.some((g) => g.name.toLowerCase() === n.toLowerCase())) { toast(`Đã có nhóm “${n}”. Hãy tham gia nhóm đó hoặc đặt tên khác.`); return; }
    create.mutate(n, { onSuccess: () => toast(`Đã lập nhóm “${n}”.`), onError: (e) => toast(errorMessage(e)) });
  }
  function submitJoin() {
    if (!picked) { toast('Hãy chọn một nhóm để tham gia.'); return; }
    join.mutate(picked.id, { onSuccess: () => toast(`Đã tham gia nhóm “${picked.name}”.`), onError: (e) => toast(errorMessage(e)) });
  }

  return (
    <section className="flex flex-col gap-3.5">
      <Heading eyebrow={'Xin chào, ' + me.name} title="Chọn nhóm"
        sub="Mỗi nhóm có khu phố, bảng nhóm và ngân hàng câu hỏi riêng. Bạn có thể đổi nhóm sau; tiến độ ở mỗi nhóm được giữ lại." />
      <Grid>
        <Card>
          <div>
            <h3>Lập nhóm mới</h3>
            <Muted small className="mt-1">Bạn sẽ là trưởng nhóm, có thêm tab Quản trị để xem từng thành viên, xuất CSV và thêm câu hỏi.</Muted>
          </div>
          <form className="flex flex-col gap-3.5" onSubmit={submitCreate}>
            <Field label="Tên nhóm">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.groupName} placeholder="Ví dụ: Lớp 10A1 đọc sách" />
            </Field>
            <div><Button type="submit" variant="primary" disabled={busy}>{create.isPending ? 'Đang lập nhóm…' : 'Lập nhóm'}</Button></div>
          </form>
        </Card>
        <Card>
          <div>
            <h3>Tham gia nhóm có sẵn</h3>
            <Muted small className="mt-1">
              {groups.isPending ? 'Đang tải danh sách nhóm…' : groups.isError ? errorMessage(groups.error) : list.length ? `Chọn một trong ${list.length} nhóm đang hoạt động.` : 'Chưa có nhóm nào. Hãy lập nhóm đầu tiên.'}
            </Muted>
          </div>
          {list.length > 0 && (
            <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {list.map((g) => (
                <li key={g.id} className="flex flex-col">
                  <Option pressed={pick === g.id} onClick={() => setPick(g.id)} title={g.name}
                    sub={`Trưởng nhóm: ${g.ownerName} · ${g.members} thành viên · lập ngày ${dmyFull(g.createdAt)}`} />
                </li>
              ))}
            </ul>
          )}
          <div><Button variant="primary" disabled={!picked || busy} onClick={submitJoin}>{join.isPending ? 'Đang tham gia…' : 'Tham gia nhóm'}</Button></div>
        </Card>
      </Grid>
    </section>
  );
}
