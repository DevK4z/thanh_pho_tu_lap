import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { Button, Card, Muted } from './components/ui';
import { Who } from './components/Who';
import { errorMessage } from './lib/api';
import { useMe } from './lib/queries';
import { useServerReady, type ServerState } from './lib/wake';
import { AdminReport } from './screens/AdminReport';
import { GroupApp } from './screens/GroupApp';
import { GroupPicker } from './screens/GroupPicker';
import { Login } from './screens/Login';

/** Màn chờ trong lúc đánh thức máy chủ; quá 1,5 giây mới hiện để lần mở bình thường không bị nháy. */
function WakeCard({ state, onRetry }: { state: ServerState; onRetry: () => void }) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setSec(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
  }, [state]);
  if (state === 'down') {
    return (
      <Card>
        <h2>Không kết nối được máy chủ</h2>
        <Muted>Máy chủ chưa phản hồi sau hơn 2 phút. Kiểm tra mạng rồi thử lại; nếu vẫn lỗi, hãy báo trưởng nhóm.</Muted>
        <div><Button onClick={onRetry}>Thử lại</Button></div>
      </Card>
    );
  }
  if (sec < 2) return <Card><Muted>Đang mở thành phố…</Muted></Card>;
  return (
    <Card>
      <h2>Đang khởi động máy chủ…</h2>
      <Muted>Máy chủ miễn phí ngủ khi không có ai dùng, lần mở đầu tiên mất khoảng 1 phút. Trang sẽ tự vào khi máy chủ sẵn sàng ({sec} giây).</Muted>
    </Card>
  );
}

/** Đăng nhập → chọn nhóm → vào nhóm. Quản trị viên ứng dụng mở báo cáo ở địa chỉ #bao-cao. */
export function App() {
  // Gọi máy chủ ngay khi mở trang để đánh thức; chỉ đọc tài khoản khi máy chủ đã sẵn sàng.
  const server = useServerReady();
  const me = useMe(server.state === 'ready');
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const f = () => setHash(location.hash);
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  if (server.state !== 'ready') return <Layout><WakeCard state={server.state} onRetry={server.retry} /></Layout>;
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
