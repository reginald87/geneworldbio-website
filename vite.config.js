import { defineConfig } from 'vite';

export default defineConfig({
  server: { proxy: { '/api': 'http://localhost:8787', '/uploads': 'http://localhost:8787' } },
});
