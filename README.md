# Thành Phố Tự Lập

Mini app cho CLB rèn luyện kỷ luật tự thân và khả năng tập trung sâu, trình bày như một game xây thành phố đẳng cự.

## Tính năng
- Đăng ký phiên tập trung (đọc sách, tập thể dục, trồng cây, học…) với thời gian tối thiểu linh hoạt; nhắc cất điện thoại.
- Theo dõi rời trang và câu hỏi kiểm tra ngẫu nhiên để tránh treo máy; câu hỏi xác nhận nội dung sau phiên.
- Hoàn thành phiên nhận công trình; cam kết càng lâu công trình càng hiếm. Mỗi thành viên có thành phố riêng, tự đặt tên và chọn kiểu nhà.
- Bảng cá nhân: điểm kỷ luật, điểm tập trung sâu, tỉ lệ hoàn thành, số lần bỏ cuộc, xao nhãng, xu hướng theo thời gian.
- Bảng cả nhóm: mức kỷ luật và tập trung chung, tỉ lệ bỏ cuộc, đánh giá hiệu quả chương trình; xuất CSV.

## Lưu ý kỹ thuật
- Toàn bộ ứng dụng nằm trong một file `index.html` (hình ảnh nhúng sẵn).
- Phần lưu dữ liệu, nhận diện người dùng và xuất file dùng các tính năng của Claude Artifact (`window.claude.use("db" | "user" | "downloads")`). Khi mở ngoài claude.ai (ví dụ GitHub Pages), giao diện vẫn hiển thị nhưng không lưu được dữ liệu; muốn chạy độc lập cần thay bằng backend riêng (Firebase, Supabase…).
- Không đo chuyển động mắt/đầu; độ tập trung ước tính qua rời trang, câu hỏi kiểm tra và tự đánh giá.

## Bản đang chạy
https://claude.ai/artifact/NBcC4gUpU8rxTyZCRirKKZ
