import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Deux pages : la vitrine (index.html) et le parcours de l’app (app.html).
// Les règles métier et l’état de l’app viennent de ../../packages/shared : Vite doit pouvoir lire ce dossier.
export default defineConfig({
  plugins: [react()],
  // Toujours la config TypeScript du site, y compris pour les fichiers de packages/shared.
  tsconfig: './tsconfig.json',
  server: { fs: { allow: ['../..'] } },
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        app: fileURLToPath(new URL('./app.html', import.meta.url)),
      },
    },
  },
});
