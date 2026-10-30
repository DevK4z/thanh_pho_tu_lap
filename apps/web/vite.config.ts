/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Đường dẫn tương đối để chạy được ở cả tên miền gốc lẫn thư mục con của GitHub Pages.
  base: './',
  plugins: [react(), tailwindcss()],
  // Khi phát triển, /api được chuyển tiếp sang API nên trình duyệt chỉ làm việc với một địa chỉ (không vướng CORS),
  // mở bằng localhost, 127.0.0.1 hay IP mạng LAN đều được.
  server: { port: 5173, host: true, proxy: { '/api': process.env.API_PROXY_TARGET || 'http://127.0.0.1:8787' } },
  test: { environment: 'jsdom' },
});
