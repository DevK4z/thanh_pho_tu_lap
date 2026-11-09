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
  // Gọi máy chủ ngay khi mở trang để đánh thức; trong lúc chờ, hiện dữ liệu lần trước nếu máy này đã có.
  const server = useServerReady();
  const me = useMe();
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const f = () => setHash(location.hash);
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  // Có dữ liệu lần trước thì vào ngay; chưa có (lần đầu trên máy này) mới phải chờ máy chủ.
  if (server.state !== 'ready' && !me.data) return <Layout><WakeCard state={server.state} onRetry={server.retry} /></Layout>;
  const offline = server.state !== 'ready' && (
    <div role="status" className="fixed top-2 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-[#1b3a33] px-4 py-1.5 text-[13px] font-semibold text-white shadow-lg">
      {server.state === 'down' ? 'Chưa kết nối được máy chủ. Đang hiện dữ liệu lần trước.' : 'Đang kết nối máy chủ… dữ liệu sẽ tự cập nhật.'}
    </div>
  );
  return <>{offline}{route()}</>;

  function route() {
    if (me.isPending) return <Layout><Card><Muted>Đang mở thành phố…</Muted></Card></Layout>;
    // Lỗi mạng mà vẫn có dữ liệu lần trước thì cứ hiện dữ liệu đó (thanh trạng thái phía trên đã báo).
    if (me.isError && !me.data) {
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
}
