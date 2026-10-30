import { defineConfig } from 'tsup';

// Gói @tptl/shared là mã TypeScript nguồn nên được đóng gói chung vào bản build.
export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node20',
  clean: true,
  noExternal: ['@tptl/shared'],
});
