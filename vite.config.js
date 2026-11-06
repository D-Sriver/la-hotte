import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // En dev, `npm run preview` (wrangler) sert front + API ensemble.
  server: { proxy: { '/api': 'http://localhost:8788' } },
  build: {
    rollupOptions: {
      output: {
        // React et GSAP changent rarement : fichiers à part, gardés en cache d'une version à l'autre.
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          if (/node_modules\/(gsap|@gsap)\//.test(id)) return 'gsap';
          return undefined;
        },
      },
    },
  },
});
