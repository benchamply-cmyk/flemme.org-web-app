import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { supabaseConfigProblem } from './src/supabaseConfig.ts';

// Quatre pages : la vitrine (index.html), le parcours de l’app (app.html), l’admin de l’équipe (admin.html)
// et l’aperçu isolé de la future interface (apercu.html).
// Les règles métier et l’état de l’app viennent de ../../packages/shared : Vite doit pouvoir lire ce dossier.
export default defineConfig(({ command, mode }) => {
  // VITE_SUPABASE_* viennent de .env en local, des variables d’environnement Netlify en ligne.
  // Au build, une configuration à moitié remplie ou une clé secrète arrête tout : rien n’est publié.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const problem = supabaseConfigProblem(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
  if (problem && command === 'build') throw new Error(problem);
  return {
    plugins: [react()],
    // Toujours la config TypeScript du site, y compris pour les fichiers de packages/shared.
    tsconfig: './tsconfig.json',
    server: { fs: { allow: ['../..'] } },
    build: {
      rollupOptions: {
        input: {
          index: fileURLToPath(new URL('./index.html', import.meta.url)),
          app: fileURLToPath(new URL('./app.html', import.meta.url)),
          admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
          apercu: fileURLToPath(new URL('./apercu.html', import.meta.url)),
        },
      },
    },
  };
});
