/* Nạp SDK đăng nhập của Google (Identity Services) và Facebook. Trình duyệt nhận credential/token,
   gửi lên API để máy chủ tự xác minh với Google/Facebook rồi cấp phiên đăng nhập. */

interface GoogleId {
  initialize(o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: 'popup' }): void;
  renderButton(el: HTMLElement, o: Record<string, unknown>): void;
}
interface FacebookSdk {
  init(o: Record<string, unknown>): void;
  login(cb: (r: { authResponse?: { accessToken: string } | null }) => void, o: { scope: string }): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
    FB?: FacebookSdk;
  }
}

const loading = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  let p = loading.get(src);
  if (!p) {
    p = new Promise<void>((ok, fail) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => ok();
      s.onerror = () => { loading.delete(src); fail(new Error('Không tải được thư viện đăng nhập. Kiểm tra mạng hoặc trình chặn quảng cáo.')); };
      document.head.appendChild(s);
    });
    loading.set(src, p);
  }
  return p;
}

/** Vẽ nút "Tiếp tục với Google" chính chủ vào el. */
export async function renderGoogleButton(el: HTMLElement, clientId: string, onCredential: (credential: string) => void) {
  await loadScript('https://accounts.google.com/gsi/client');
  const id = window.google!.accounts.id;
  id.initialize({ client_id: clientId, callback: (r) => onCredential(r.credential), ux_mode: 'popup' });
  el.innerHTML = '';
  id.renderButton(el, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', locale: 'vi', width: Math.min(400, el.clientWidth || 320) });
}

let fbReady: Promise<void> | null = null;
/** Mở hộp thoại Facebook Login; trả về access token, hoặc null nếu người dùng đóng hộp thoại. */
export async function facebookLogin(appId: string): Promise<string | null> {
  fbReady ??= loadScript('https://connect.facebook.net/vi_VN/sdk.js').then(() => {
    window.FB!.init({ appId, cookie: false, xfbml: false, version: 'v19.0' });
  });
  await fbReady;
  return new Promise((ok) => window.FB!.login((r) => ok(r.authResponse?.accessToken ?? null), { scope: 'public_profile,email' }));
}
