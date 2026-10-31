import { useState } from 'react';
import type { GroupInfo, Me } from '@tptl/shared';
import { errorMessage } from '../lib/api';
import { useGroupMembership, useSignOut } from '../lib/queries';
import { Button, LinkButton, Modal, Pill, useToast } from './ui';

const PROVIDER = { google: 'Google', facebook: 'Facebook', guest: 'Khách' } as const;

/** Góc trên bên phải: tên, cách đăng nhập, nhóm, nút đổi nhóm và đăng xuất (ẩn khi đang trong phiên). */
export function Who({ me, group, isOwner, locked }: { me: Me; group: GroupInfo | null; isOwner?: boolean; locked?: boolean }) {
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
        {me.avatarUrl && <img src={me.avatarUrl} alt="" className="size-6 rounded-full" referrerPolicy="no-referrer" />}
        <b className="text-ink">{me.name}</b> <Pill>{PROVIDER[me.provider]}</Pill>
      </div>
      {group && <div>Nhóm {group.name}{isOwner ? ' · trưởng nhóm' : ''}</div>}
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
