# Thành Phố Tự Lập

Mini app cho CLB rèn luyện kỷ luật tự thân và khả năng tập trung sâu, trình bày như một game xây thành phố đẳng cự.

## Tính năng

- Đăng nhập bằng Google, Facebook hoặc tài khoản khách (chỉ cần nhập tên).
- Chọn lập nhóm mới hoặc tham gia nhóm có sẵn (nút tham gia bị khóa khi chưa có nhóm nào). Người lập nhóm là trưởng nhóm, có tab Quản trị. Đổi nhóm bất kỳ lúc nào; tiến độ ở mỗi nhóm được giữ lại.
- Đăng ký phiên tập trung (đọc sách giấy, học sâu trên máy, viết, vận động, chăm cây) với thời gian tối thiểu 5–180 phút.
- **Chống gian lận (phiên trên máy: học sâu, viết):** phiên chạy ở chế độ toàn màn hình. Đổi tab, thu nhỏ trình duyệt, click ra ngoài cửa sổ hoặc thoát toàn màn hình (kể cả bấm Escape) quá 3 giây là phiên thất bại và chuỗi về 0; quay lại kịp thì chỉ ghi cảnh báo. Có câu hỏi kiểm tra hiện diện ngẫu nhiên và câu hỏi xác nhận sau phiên. Hoạt động ngoài màn hình (đọc sách giấy, vận động, chăm cây) không giám sát rời màn hình vì người dùng cất máy đi; cuối phiên phải trả lời câu hỏi và xác nhận đã làm đủ thời gian. Dừng giữa chừng ở bất kỳ hoạt động nào cũng là thất bại và mất chuỗi.
- **Phần thưởng:** mỗi phiên hoàn thành nhận 50 vàng, 50 gỗ và một công trình (cam kết càng lâu công trình càng hiếm). Chuỗi phiên thành công liên tiếp nhân thưởng: ×2 từ chuỗi 5, ×3 từ chuỗi 10, ×3,5 từ chuỗi 15.
- Mỗi thành viên có thành phố riêng; theo dõi vàng, gỗ, chuỗi hiện tại, chuỗi dài nhất, số phiên thành công/thất bại.
- Bảng cá nhân, bảng cả nhóm (đánh giá hiệu quả chương trình), quản trị nhóm (từng thành viên, nhật ký, ngân hàng câu hỏi, xuất CSV).

## Kiến trúc

```text
apps/web         React 19 + Vite + TypeScript + Tailwind CSS 4 + TanStack Query
apps/api         Node.js REST API: Fastify 5 + Drizzle ORM + PostgreSQL (PGlite khi phát triển)
packages/shared  Hằng số game, kiểu dữ liệu API, công thức tính điểm (dùng chung web và API)
legacy/          Bản cũ một file HTML (tham khảo, có thể xóa)
```

**Máy chủ là nơi quyết định điểm số.** Trình duyệt chỉ báo những gì nó đo được (thời gian rời trang, số lần rời trang, câu trả lời, tự đánh giá). Máy chủ:

- giữ giờ bắt đầu phiên và từ chối hoàn thành trước khi hết thời gian cam kết;
- phát câu hỏi đã xáo phương án và **không bao giờ gửi đáp án** xuống trình duyệt, tự chấm đúng/sai;
- tự tính điểm tập trung, phần thưởng, hạng công trình; kiểm tra công trình được đặt có đúng hạng phần thưởng;
- tự tính chuỗi, hệ số nhân, vàng và gỗ; phiên thất bại đưa chuỗi về 0;
- mỗi người chỉ có một phiên đang chạy (ràng buộc trong database);
- mỗi khi phiên kết thúc, ghi một dòng `admin_report` vào log máy chủ (tỷ lệ hoàn thành, số lần thất bại, chuỗi, tài nguyên). Phía trình duyệt, `sendDataToAdmin` trong [apps/web/src/lib/adminReport.ts](apps/web/src/lib/adminReport.ts) in cùng bản tổng hợp ra console.

### Cấu trúc mã

```text
apps/api/src
  app.ts              tạo Fastify app: CORS, giới hạn tần suất, xác thực Bearer token, xử lý lỗi
  db/schema.ts        bảng: users, auth_sessions, groups, players, day_stats, focus_sessions, questions
  db/client.ts        kết nối PostgreSQL hoặc PGlite, tự chạy migration
  auth/identity.ts    xác minh Google ID token và Facebook access token
  questions.ts        ngân hàng câu hỏi mặc định, phát câu hỏi cho phiên
  routes/             auth, groups, sessions, admin
apps/api/drizzle      migration SQL (sinh bằng npm run db:generate)
apps/api/test         test tích hợp chạy trên PGlite trong bộ nhớ

apps/web/src
  App.tsx             đăng nhập → chọn nhóm → vào nhóm
  screens/            Login, GroupPicker, GroupApp (tab và luồng phiên), Town, FocusSetup, FocusRun,
                      FocusVerify, Reward, Mine, GroupBoard, Admin
  focus/useAntiCheat  toàn màn hình; giám sát visibilitychange, blur/focus, fullscreenchange; ân hạn 3 giây
  focus/useFocusRun   đếm ngược, câu kiểm tra hiện diện, giữ màn hình sáng
  game/iso.ts         vẽ thành phố đẳng cự thành SVG (sprite nhúng trong index.html)
  components/         ui.tsx (nút, thẻ, chip, modal, thông báo…), Charts, Svg, Who, Layout
  lib/                api.ts (fetch + token), queries.ts (hook dữ liệu), social.ts (SDK Google/Facebook)
  styles/             index.css (Tailwind + theme), tokens.css (màu sáng/tối), game.css (đồ họa game)
apps/web/test         test end-to-end: giao diện React thật gọi API thật
```

## Chạy trên máy

Cần Node.js 20 trở lên.

```bash
npm install
npm run dev          # API ở http://localhost:8787, web ở http://localhost:5173
```

Luôn chạy lệnh này ở **thư mục gốc** để bật cả API lẫn web. Mở http://localhost:5173; khi phát triển, Vite chuyển tiếp `/api` sang API nên mở bằng `127.0.0.1` hay IP mạng LAN (thử trên điện thoại cùng Wi‑Fi) cũng được.

Không cần cài PostgreSQL: khi `DATABASE_URL` để trống, API dùng PGlite (PostgreSQL nhúng) lưu ở `apps/api/.data/pglite`. Muốn dùng PostgreSQL thật: `docker compose up -d` rồi đặt `DATABASE_URL=postgres://tptl:tptl@localhost:5432/tptl` trong `apps/api/.env`.

Chỉ đăng nhập khách hoạt động cho tới khi cấu hình Google/Facebook (xem bên dưới). Biến môi trường mẫu: [apps/api/.env.example](apps/api/.env.example), [apps/web/.env.example](apps/web/.env.example).

```bash
npm test             # shared + API (PGlite) + end-to-end giao diện
npm run typecheck
npm run build
```

## REST API

Tất cả dưới `/api`, dữ liệu JSON, xác thực bằng header `Authorization: Bearer <token>`. Lỗi trả về `{ "error": { "code", "message" } }`, `message` hiển thị được cho người dùng. Kiểu dữ liệu chi tiết: [packages/shared/src/types.ts](packages/shared/src/types.ts).

| Phương thức | Đường dẫn | Việc |
| --- | --- | --- |
| GET | `/config` | Cách đăng nhập đang bật (Google client ID, Facebook app ID) |
| POST | `/auth/guest` `{ name }` | Tạo tài khoản khách, trả `{ token, me }` |
| POST | `/auth/google` `{ credential }` | Đăng nhập bằng Google ID token |
| POST | `/auth/facebook` `{ accessToken }` | Đăng nhập bằng Facebook access token |
| POST | `/auth/logout` | Hủy token hiện tại |
| GET / PATCH | `/me` | Hồ sơ; đổi tên hiển thị |
| GET | `/groups` | Danh sách nhóm |
| POST | `/groups` `{ name }` | Lập nhóm và vào nhóm (tên không trùng, không phân biệt hoa thường) |
| POST | `/groups/:gid/join` | Tham gia nhóm |
| POST | `/me/leave-group` | Rời nhóm (bị chặn khi đang có phiên) |
| GET | `/groups/:gid` | Nhóm, thành viên, số liệu theo ngày, phiên đang chạy của mình |
| POST | `/groups/:gid/players` `{ name, style, dailyGoal }` | Tạo nhà trong nhóm |
| POST | `/groups/:gid/sessions` `{ act, minutes, goal, day }` | Bắt đầu phiên, nhận câu hỏi (không kèm đáp án) |
| POST | `/sessions/:sid/checks` `{ index, choice }` | Trả lời câu kiểm tra hiện diện (`-1` là bỏ lỡ) |
| POST | `/sessions/:sid/complete` `{ awaySec, dist, self, note, confirmed, verify }` | Hoàn thành phiên: máy chủ chấm điểm, tăng chuỗi, cộng vàng và gỗ |
| POST | `/sessions/:sid/quit` `{ reason, awaySec, dist }` | Thất bại (bỏ cuộc, `violation` khi rời màn hình): chuỗi về 0 |
| POST | `/groups/:gid/plot` `{ item, slot }` | Đặt phần thưởng lên bản đồ |
| GET | `/groups/:gid/players/:pid/sessions` | Nhật ký phiên (chủ nhân hoặc trưởng nhóm) |
| GET / POST / DELETE | `/groups/:gid/questions[/:qid]` | Ngân hàng câu hỏi của nhóm (trưởng nhóm) |

## Triển khai

Giao diện là trang tĩnh (GitHub Pages); API cần một máy chủ Node.js và PostgreSQL.

1. **API + database trên Render**: Dashboard > New > Blueprint > chọn repo này ([render.yaml](render.yaml) tạo dịch vụ `tptl-api` từ [apps/api/Dockerfile](apps/api/Dockerfile) và database `tptl-db`). Điền biến:
   - `WEB_ORIGIN`: địa chỉ trang web, ví dụ `https://ten-ban.github.io` (nhiều địa chỉ cách nhau bằng dấu phẩy).
   - `GOOGLE_CLIENT_ID`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` (xem bên dưới; bỏ trống thì nút tương ứng bị khóa).

   Gói miễn phí của Render sẽ ngủ khi không có ai dùng, lần mở đầu tiên chậm vài chục giây; database miễn phí có thời hạn. Có thể dùng nơi khác chạy được Docker (Railway, Fly.io, VPS) với cùng các biến.
2. **Web trên GitHub Pages**: Settings > Pages > Source: GitHub Actions. Settings > Secrets and variables > Actions > Variables: tạo `API_URL` = địa chỉ API (ví dụ `https://tptl-api.onrender.com`). Mỗi lần push lên `main`, [pages.yml](.github/workflows/pages.yml) build và triển khai; [ci.yml](.github/workflows/ci.yml) chạy kiểm tra kiểu, test và build.

### Đăng nhập Google

1. [Google Cloud Console](https://console.cloud.google.com) > APIs & Services > Credentials > Create credentials > OAuth client ID > loại **Web application**.
2. **Authorized JavaScript origins**: `http://localhost:5173` và `https://ten-ban.github.io`. Không cần redirect URI.
3. Đặt Client ID vào biến `GOOGLE_CLIENT_ID` của API. Giao diện tự lấy qua `/api/config`.

### Đăng nhập Facebook

1. [developers.facebook.com](https://developers.facebook.com) > My Apps > Create App, thêm sản phẩm **Facebook Login**.
2. Settings > Basic: thêm **App Domains** và **Site URL** (địa chỉ GitHub Pages). Facebook Login > Settings: bật **Login with the JavaScript SDK**, thêm tên miền vào **Allowed Domains for the JavaScript SDK**.
3. Đặt App ID và App Secret vào `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` của API. Chuyển app sang chế độ **Live** để người ngoài danh sách tester đăng nhập được.

## Thêm tính năng mới

- **Thay đổi database**: sửa [apps/api/src/db/schema.ts](apps/api/src/db/schema.ts), chạy `npm run db:generate -w @tptl/api` để sinh migration mới trong `apps/api/drizzle`. Migration tự chạy khi API khởi động.
- **Endpoint mới**: thêm vào file trong `apps/api/src/routes`, kiểm tra dữ liệu bằng `zod` qua `parse()`, khai báo kiểu phản hồi trong `packages/shared/src/types.ts` để web dùng chung.
- **Màn hình mới**: thêm component trong `apps/web/src/screens`, đọc dữ liệu qua hook trong `lib/queries.ts`, dựng giao diện bằng thành phần trong `components/ui.tsx` và lớp Tailwind (màu theo token: `bg-surface`, `text-muted`, `border-line`, `bg-pine`…).
- **Công thức điểm**: [packages/shared/src/metrics.ts](packages/shared/src/metrics.ts) (có test).

## Lưu ý

- Tài khoản khách gắn với trình duyệt (token trong localStorage). Đăng xuất hoặc xóa dữ liệu trình duyệt sẽ mất tài khoản; app hỏi xác nhận trước khi đăng xuất khách.
- Việc rời màn hình do trình duyệt phát hiện nên người rành kỹ thuật vẫn có thể chặn báo cáo này; thời gian phiên, câu hỏi, đáp án, điểm, chuỗi và phần thưởng thì do máy chủ quyết định.
- iPhone và iPad (Safari) không hỗ trợ Fullscreen API cho trang web, nên không bắt đầu được phiên trên máy ở các thiết bị này; vẫn dùng được các hoạt động ngoài màn hình.
- Phím Escape khi đang toàn màn hình do trình duyệt xử lý và không tới được trang, nên được phát hiện qua sự kiện `fullscreenchange`.
- Không đo chuyển động mắt/đầu; độ tập trung ước tính qua rời trang, câu hỏi kiểm tra và tự đánh giá.
