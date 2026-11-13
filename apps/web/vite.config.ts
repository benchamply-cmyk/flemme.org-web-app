import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { supabaseConfigProblem } from './src/supabaseConfig.ts';

// La vitrine (index.html et ses pages intérieures, maquette V0.3), le parcours de l’app (app.html),
// l’admin de l’équipe (admin.html) et l’aperçu isolé de la future interface (apercu.html).
const pages = ['index', 'deleguer-une-flemme', 'espace-connecte', 'concept', 'comment-ca-marche', 'faq', 'contact', 'premium', 'resoudre', 'mentions', 'confidentialite', 'app', 'admin', 'apercu', 'beta'];
// En-tête et pied de page de la vitrine, écrits une fois dans src/site et insérés dans chaque page au build.
const morceau = (nom: string) => readFileSync(fileURLToPath(new URL(`./src/site/${nom}.html`, import.meta.url)), 'utf8').trim();
const habillage = { name: 'flemme-habillage', transformIndexHtml: (html: string) => html.replace('<!--#entete-->', morceau('entete')).replace('<!--#pied-->', morceau('pied')) };
// Les règles métier et l’état de l’app viennent de ../../packages/shared : Vite doit pouvoir lire ce dossier.
export default defineConfig(({ command, mode }) => {
  // VITE_SUPABASE_* viennent de .env en local, des variables d’environnement Netlify en ligne.
  // Au build, une configuration à moitié remplie ou une clé secrète arrête tout : rien n’est publié.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const problem = supabaseConfigProblem(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
  if (problem && command === 'build') throw new Error(problem);
  return {
    plugins: [react(), habillage],
    // Toujours la config TypeScript du site, y compris pour les fichiers de packages/shared.
    tsconfig: './tsconfig.json',
    server: { fs: { allow: ['../..'] } },
    build: {
      rollupOptions: {
        input: Object.fromEntries(pages.map(p => [p, fileURLToPath(new URL(`./${p}.html`, import.meta.url))])),
      },
    },
  };
});
