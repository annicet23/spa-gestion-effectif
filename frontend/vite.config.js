import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Cette règle va intercepter toutes les requêtes qui commencent par '/api'
      // et les rediriger vers votre backend qui tourne sur http://localhost:3000
      '/api': {
        target: 'http://localhost:3000', // <-- Le port de votre backend
        changeOrigin: true, // Important pour les requêtes inter-origines

      },

    }
  }
});