import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { Button, Card, Muted } from './components/ui';
import { Who } from './components/Who';
import { errorMessage } from './lib/api';
import { useMe } from './lib/queries';
import { AdminReport } from './screens/AdminReport';
import { GroupApp } from './screens/GroupApp';
import { GroupPicker } from './screens/GroupPicker';
import { Login } from './screens/Login';

/** Đăng nhập → chọn nhóm → vào nhóm. Quản trị viên ứng dụng mở báo cáo ở địa chỉ #bao-cao. */
export function App() {
  const me = useMe();
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const f = () => setHash(location.hash);
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  if (me.isPending) return <Layout><Card><Muted>Đang mở thành phố…</Muted></Card></Layout>;
  if (me.isError) {
    return (
      <Layout>
        <Card>
          <h2>Không kết nối được máy chủ</h2>
          <Muted>{errorMessage(me.error)}</Muted>
          <div><Button onClick={() => me.refetch()}>Thử lại</Button></div>
        </Card>
      </Layout>
    );
  }
  if (!me.data) return <Layout><Login /></Layout>;
  if (hash === '#bao-cao' && me.data.isAdmin) {
    return <Layout who={<Who me={me.data} group={null} />}><AdminReport onBack={() => { location.hash = ''; }} /></Layout>;
  }
  if (!me.data.currentGroupId) return <Layout who={<Who me={me.data} group={null} />}><GroupPicker me={me.data} /></Layout>;
  return <GroupApp key={me.data.currentGroupId} me={me.data} gid={me.data.currentGroupId} />;
}
