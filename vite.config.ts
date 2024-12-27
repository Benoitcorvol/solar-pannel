import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api/solar': {
        target: 'https://solar.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => {
          const [pathOnly, query] = path.split('?');
          const newPath = pathOnly.replace(/^\/api\/solar/, '/v1');
          return query ? `${newPath}?${query}` : newPath;
        }
      }
    }
  }
});
