/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Đường dẫn tương đối để chạy được ở cả tên miền gốc lẫn thư mục con của GitHub Pages.
  base: './',
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  test: { environment: 'jsdom' },
});
