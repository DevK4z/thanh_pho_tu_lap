/* Biểu tượng HUD và nút đăng nhập. */
import type { CSSProperties } from 'react';

const ICONS = {
  pop: '<circle cx="9" cy="8" r="4" fill="#ff9a3c"/><path d="M2 21c0-5 3-8 7-8s7 3 7 8z" fill="#ff9a3c"/><circle cx="17" cy="9" r="3.4" fill="#2f8cf0"/><path d="M12 21c0-4 2-6.5 5-6.5s6 2.5 6 6.5z" fill="#2f8cf0"/>',
  min: '<circle cx="12" cy="12" r="10" fill="#f6b21b" stroke="#c98a0a" stroke-width="1.5"/><path d="M12 6v6l4 2.5" stroke="#7a4f00" stroke-width="2" fill="none" stroke-linecap="round"/>',
  disc: '<polygon points="13,1 4,14 11,14 9,23 20,9 13,9" fill="#f7b92a" stroke="#c98a0a" stroke-width="1"/>',
  focus: '<circle cx="12" cy="12" r="10" fill="#e8f4ff" stroke="#2f8cf0" stroke-width="2"/><circle cx="12" cy="12" r="5.5" fill="#2f8cf0"/><circle cx="12" cy="12" r="2" fill="#fff"/>',
  ok: '<circle cx="12" cy="12" r="10" fill="#ffd54a" stroke="#c98a0a" stroke-width="1.5"/><path d="M7 12.5l3.5 3.5L17 9" stroke="#5a3b00" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  build: '<path d="M3 11L12 3l9 8v10H3z" fill="#2f8cf0"/><rect x="10" y="14" width="4" height="7" fill="#fff"/>',
  timer: '<circle cx="12" cy="13" r="9" fill="#2fb89e"/><path d="M12 8v5l3 2M9 2h6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>',
  chart: '<rect x="3" y="12" width="5" height="9" rx="1" fill="#2f8cf0"/><rect x="10" y="6" width="5" height="15" rx="1" fill="#f6b21b"/><rect x="17" y="9" width="4" height="12" rx="1" fill="#2fb89e"/>',
  group: '<path d="M6 4h12v6a6 6 0 0 1-12 0z" fill="#f6b21b"/><path d="M9 20h6M12 16v4" stroke="#c98a0a" stroke-width="2.5" stroke-linecap="round"/>',
  google: '<path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9z"/>',
  facebook: '<circle cx="12" cy="12" r="12" fill="#1877F2"/><path fill="#fff" d="M16.7 15.5l.5-3.5h-3.3V9.8c0-1 .5-1.9 2-1.9h1.5v-3s-1.4-.2-2.7-.2c-2.8 0-4.6 1.7-4.6 4.7V12H7v3.5h3.1V24h3.8v-8.5z"/>',
  star: '<polygon points="12,2 15,9 22,9.5 16.5,14 18.5,21.5 12,17.5 5.5,21.5 7.5,14 2,9.5 9,9"/>',
} as const;
export type IconName = keyof typeof ICONS;

export const Icon = ({ name, className, style }: { name: IconName; className?: string; style?: CSSProperties }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className} style={style} dangerouslySetInnerHTML={{ __html: ICONS[name] }} />
);
