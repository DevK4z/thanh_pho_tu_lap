import { useState, type FormEvent } from 'react';
import { INVITE_LENGTH, LIMITS, normalizeCode, type Me } from '@tptl/shared';
import { Button, Card, Field, Grid, Heading, inputCls, Muted, Option, useToast } from '../components/ui';
import { errorMessage } from '../lib/api';
import { dmyFull } from '../lib/format';
import { useConfig, useGroupMembership, useGroups } from '../lib/queries';

/** Vào nhóm bằng mã mời. Chỉ quản trị viên ứng dụng (hoặc mọi người, nếu máy chủ cho phép) mới lập được nhóm và thấy danh sách nhóm. */
export function GroupPicker({ me }: { me: Me }) {
  const toast = useToast();
  const config = useConfig();
  const groups = useGroups(me.isAdmin);
  const { create, join, joinCode } = useGroupMembership();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const canCreate = me.isAdmin || config.data?.groupCreation === 'open';
  const list = groups.data ?? [];
  const busy = create.isPending || join.isPending || joinCode.isPending;
  const codeOk = normalizeCode(code).length === INVITE_LENGTH;

  function submitCreate(e: FormEvent) {
    e.preventDefault();
    const n = name.trim().replace(/\s+/g, ' ');
    if (!n) { toast('Hãy đặt tên cho nhóm.'); return; }
    create.mutate(n, { onSuccess: () => toast(`Đã lập nhóm “${n}”. Xem mã mời trong tab Quản trị.`), onError: (e) => toast(errorMessage(e)) });
  }
  function submitCode(e: FormEvent) {
    e.preventDefault();
    if (!codeOk) { toast(`Mã mời gồm ${INVITE_LENGTH} ký tự.`); return; }
    joinCode.mutate(normalizeCode(code), { onSuccess: () => toast('Đã vào nhóm.'), onError: (e) => toast(errorMessage(e)) });
  }

  return (
    <section className="flex flex-col gap-3.5">
      <Heading eyebrow={'Xin chào, ' + me.name} title="Vào nhóm"
        sub="Nhập mã mời do thầy cô hoặc trưởng nhóm gửi. Bạn có thể đổi nhóm sau; tiến độ ở mỗi nhóm được giữ lại, nhưng cần mã mời để quay lại." />
      <Grid>
        <Card>
          <div>
            <h3>Nhập mã mời</h3>
            <Muted small className="mt-1">Mã gồm {INVITE_LENGTH} ký tự, không phân biệt chữ hoa, chữ thường.</Muted>
          </div>
          <form className="flex flex-col gap-3.5" onSubmit={submitCode}>
            <Field label="Mã mời">
              <input className={inputCls + ' font-hud text-2xl tracking-[.3em] uppercase'} value={code} onChange={(e) => setCode(e.target.value)} maxLength={12}
                autoComplete="off" autoCapitalize="characters" placeholder="VD: K7MQ2X" />
            </Field>
            <div><Button type="submit" variant="primary" disabled={!codeOk || busy}>{joinCode.isPending ? 'Đang vào nhóm…' : 'Vào nhóm'}</Button></div>
          </form>
        </Card>
        {canCreate && (
          <Card>
            <div>
              <h3>Lập nhóm mới</h3>
              <Muted small className="mt-1">Bạn sẽ là trưởng nhóm. Sau khi lập, mã mời hiện trong tab Quản trị để gửi cho học sinh.</Muted>
            </div>
            <form className="flex flex-col gap-3.5" onSubmit={submitCreate}>
              <Field label="Tên nhóm">
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.groupName} placeholder="Ví dụ: Lớp 10A1 đọc sách" />
              </Field>
              <div><Button type="submit" variant="primary" disabled={busy}>{create.isPending ? 'Đang lập nhóm…' : 'Lập nhóm'}</Button></div>
            </form>
          </Card>
        )}
      </Grid>
      {me.isAdmin && (
        <Card>
          <div>
            <h3>Tất cả nhóm</h3>
            <Muted small className="mt-1">Chỉ quản trị viên ứng dụng thấy danh sách này. Bấm một nhóm để vào với quyền quản trị.</Muted>
          </div>
          {groups.isPending ? <Muted small>Đang tải…</Muted> : groups.isError ? <Muted small>{errorMessage(groups.error)}</Muted> : !list.length ? <Muted small>Chưa có nhóm nào.</Muted> : (
            <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
              {list.map((g) => (
                <li key={g.id} className="flex flex-col">
                  <Option title={g.name} disabled={busy} onClick={() => join.mutate(g.id, { onError: (e) => toast(errorMessage(e)) })}
                    sub={`Mã mời ${g.inviteCode} · trưởng nhóm ${g.ownerName} · ${g.members} thành viên · lập ngày ${dmyFull(g.createdAt)}`} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </section>
  );
}
