import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Trois pages : la vitrine (index.html), le parcours de l’app (app.html) et l’admin de l’équipe (admin.html).
// Les règles métier viennent de ../mobile/src : Vite doit pouvoir lire ce dossier.
export default defineConfig({
  plugins: [react()],
  // Sans cela, Vite lirait apps/mobile/tsconfig.json pour domain.ts, qui étend une config Expo absente ici.
  tsconfig: './tsconfig.json',
  server: { fs: { allow: ['..'] } },
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        app: fileURLToPath(new URL('./app.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
      },
    },
  },
});
