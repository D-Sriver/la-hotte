import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Précharge les deux polices du premier écran (texte courant, chiffres du compte à rebours) :
// elles arrivent en même temps que le CSS au lieu d'attendre qu'il soit lu.
const preloadFonts = () => ({
  name: 'preload-fonts',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      if (!ctx.bundle) return html;
      const fonts = Object.keys(ctx.bundle).filter((file) =>
        /(onest-latin-400|unbounded-latin-800)-normal-[\w-]+\.woff2$/.test(file),
      );
      return {
        html,
        tags: fonts.map((file) => ({
          tag: 'link',
          attrs: { rel: 'preload', href: `/${file}`, as: 'font', type: 'font/woff2', crossorigin: '' },
          injectTo: 'head',
        })),
      };
    },
  },
});

export default defineConfig({
  plugins: [react(), preloadFonts()],
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
