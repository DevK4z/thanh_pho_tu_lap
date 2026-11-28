import { useState } from 'react';
import type { GroupInfo, Me } from '@tptl/shared';
import { errorMessage } from '../lib/api';
import { useGroupMembership, useSignOut } from '../lib/queries';
import { Icon } from './Icons';
import { Button, LinkButton, Modal, Pill, useToast } from './ui';

const PROVIDER = { google: 'Google', facebook: 'Facebook', guest: 'Khách' } as const;

/** Góc trên bên phải: tên, cách đăng nhập, nhóm, nút đổi nhóm và đăng xuất (ẩn khi đang trong phiên). */
export function Who({ me, group, isOwner, locked, streak }: { me: Me; group: GroupInfo | null; isOwner?: boolean; locked?: boolean; streak?: number }) {
  const toast = useToast();
  const signOut = useSignOut();
  const { leave } = useGroupMembership();
  const [ask, setAsk] = useState(false);

  function logout() {
    if (me.provider === 'guest') setAsk(true);
    else signOut.mutate();
  }
  function switchGroup() {
    leave.mutate(undefined, { onSuccess: () => toast('Đã rời nhóm. Tiến độ trong nhóm cũ vẫn được giữ.'), onError: (e) => toast(errorMessage(e)) });
  }

  return (
    <div className="flex flex-col items-end gap-0.5 text-right text-[13px] text-muted">
      <div className="flex items-center gap-2">
        {streak != null && (
          <span title="Chuỗi phiên thành công liên tiếp" className={'flex items-center gap-1 rounded-full border px-2 py-0.5 font-bold tabular-nums ' + (streak ? 'border-[#ffb37a] bg-[color-mix(in_srgb,#ff7a29_12%,var(--surface))] text-[color-mix(in_srgb,#ff7a29_75%,var(--ink))]' : 'border-line text-muted')}>
            <Icon name="fire" className={'size-4' + (streak ? ' flame' : ' grayscale')} />
            <span className="sr-only">Chuỗi</span>{streak}
          </span>
        )}
        {me.avatarUrl ? <img src={me.avatarUrl} alt="" className="size-7 rounded-full ring-2 ring-surface shadow-(--shadow-sm)" referrerPolicy="no-referrer" /> : (
          <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-linear-to-br from-pine to-[color-mix(in_srgb,var(--pine)_50%,var(--lamp))] text-[13px] font-bold text-pine-ink uppercase">{me.name.trim().charAt(0) || '?'}</span>
        )}
        <b className="text-ink">{me.name}</b> <Pill>{PROVIDER[me.provider]}</Pill>
      </div>
      {group && <div>{group.personal ? 'Nhóm riêng (dùng thử)' : <>Nhóm {group.name}{isOwner ? ' · trưởng nhóm' : me.isAdmin ? ' · quản trị viên' : ''}</>}</div>}
      {!locked && (
        <div className="flex gap-3">
          {me.isAdmin && <LinkButton onClick={() => { location.hash = location.hash === '#bao-cao' ? '' : '#bao-cao'; }}>{location.hash === '#bao-cao' ? 'Về ứng dụng' : 'Báo cáo'}</LinkButton>}
          {me.currentGroupId && <LinkButton onClick={switchGroup} disabled={leave.isPending}>Đổi nhóm</LinkButton>}
          <LinkButton onClick={logout}>Đăng xuất</LinkButton>
        </div>
      )}
      {ask && (
        <Modal label="Đăng xuất" onClose={() => setAsk(false)}>
          <h3>Đăng xuất tài khoản khách?</h3>
          <p className="text-[13px] text-muted">Tài khoản khách không có mật khẩu. Sau khi đăng xuất, bạn sẽ không vào lại được thành phố và tiến độ hiện tại.</p>
          <div className="flex flex-wrap gap-2.5">
            <Button onClick={() => setAsk(false)}>Ở lại</Button>
            <Button variant="danger" onClick={() => { setAsk(false); signOut.mutate(); }}>Vẫn đăng xuất</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
