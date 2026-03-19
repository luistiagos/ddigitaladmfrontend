import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  envPrefix: 'VITE_',
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
