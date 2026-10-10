import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Runs at http://127.0.0.1:5173 ; /api calls are forwarded to the Express server on 127.0.0.1:4000.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: { '/api': 'http://127.0.0.1:4000' }
  }
});
