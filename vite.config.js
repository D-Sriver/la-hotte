import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // En dev, `npm run preview` (wrangler) sert front + API ensemble.
  server: { proxy: { '/api': 'http://localhost:8788' } },
});
