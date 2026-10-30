/* Cấu hình Firebase cho bản chạy độc lập (GitHub Pages…).
   Lấy từ Firebase Console > Project settings > Your apps > Web app > SDK setup and configuration.
   Các giá trị này là thông tin công khai của web app, không phải khóa bí mật; quyền truy cập do firestore.rules quyết định.
   Để null thì app chạy chế độ thử: dữ liệu chỉ lưu trong trình duyệt và chỉ đăng nhập được bằng tài khoản khách. */
window.FIREBASE_CONFIG = null;
/* Ví dụ:
window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "ten-du-an.firebaseapp.com",
  projectId: "ten-du-an",
  storageBucket: "ten-du-an.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
*/
