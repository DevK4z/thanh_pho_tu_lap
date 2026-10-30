import { Layout } from './components/Layout';
import { Button, Card, Muted } from './components/ui';
import { Who } from './components/Who';
import { errorMessage } from './lib/api';
import { useMe } from './lib/queries';
import { GroupApp } from './screens/GroupApp';
import { GroupPicker } from './screens/GroupPicker';
import { Login } from './screens/Login';

/** Đăng nhập → chọn nhóm → vào nhóm. */
export function App() {
  const me = useMe();
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
  if (!me.data.currentGroupId) return <Layout who={<Who me={me.data} group={null} />}><GroupPicker me={me.data} /></Layout>;
  return <GroupApp key={me.data.currentGroupId} me={me.data} gid={me.data.currentGroupId} />;
}
