import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { copyFileSync } from 'node:fs';

// Plugin: copia index.html → 404.html para SPA routing no GitHub Pages
const spaGithubPages = {
  name: 'spa-github-pages',
  closeBundle() {
    copyFileSync('docs/index.html', 'docs/404.html');
  },
};

export default defineConfig({
  plugins: [tailwindcss(), react(), spaGithubPages],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  envPrefix: 'VITE_',
  build: {
    outDir: 'docs',
  },
  server: {
    port: 5174,
    proxy: {
      '/admin': {
        target: 'https://digitalstoregames.pythonanywhere.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
