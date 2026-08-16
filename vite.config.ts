import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Vite build cho SPA React.
 * Worker (src/server) được wrangler bundle riêng, output SPA nằm ở dist/client
 * và được phục vụ qua Static Assets binding (xem wrangler.jsonc).
 */
export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'src/client'),
  publicDir: path.resolve(__dirname, 'public'),
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@client': path.resolve(__dirname, 'src/client'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/client'),
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5173,
    proxy: {
      // Khi chạy `npm run dev`, API được proxy sang `wrangler dev` (cổng 8787).
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
});
