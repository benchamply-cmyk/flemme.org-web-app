import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { supabaseConfigProblem } from './src/supabaseConfig.ts';
import { estAdresseApp } from '../../packages/shared/src/adresses.ts';
import { htmlCatalogue, htmlMoments, htmlPoints, remplacerPrix } from './src/site/catalogue.ts';

// La vitrine (index.html et ses pages intérieures, maquette V0.3 ; chaque fichier porte le nom de son adresse : concept.html → /concept),
// la landing page (landing.html, 14/11/2026), le parcours de l’app (app.html),
// l’admin de l’équipe (admin.html) et l’aperçu isolé de la future interface (apercu.html).
const pages = ['index', 'landing', 'services', 'deleguer', 'concept', 'faq', 'contact', 'premium', 'resoudre', 'mentions', 'confidentialite', 'app', 'admin', 'apercu', 'beta'];
// En-tête et pied de page de la vitrine, écrits une fois dans src/site et insérés dans chaque page au build.
const morceau = (nom: string) => readFileSync(fileURLToPath(new URL(`./src/site/${nom}.html`, import.meta.url)), 'utf8').trim();
const habillage = { name: 'flemme-habillage', transformIndexHtml: (html: string) => remplacerPrix(html.replace('<!--#entete-->', morceau('entete')).replace('<!--#pied-->', morceau('pied'))
  // Catalogue des services (src/site/catalogue.ts, seule source des prix) : complet sur /services, une carte par famille sur l’accueil.
  .replace('<!--#catalogue-->', htmlCatalogue()).replace('<!--#catalogue-moments-->', htmlMoments()).replace('<!--#catalogue-points-->', htmlPoints())) };
// Adresses de l’espace connecté (/mon-espace, /flemme/123…) : app.html, comme les règles de netlify.toml en ligne.
type Requete = { url?: string };
const versApp = (req: Requete, _res: unknown, next: () => void) => {
  const u = new URL(req.url || '/', 'http://local');
  if (u.pathname !== '/app.html' && estAdresseApp(u.pathname)) req.url = '/app.html' + u.search;
  next();
};
const adresses = { name: 'flemme-adresses', configureServer: (s: { middlewares: { use: (f: typeof versApp) => void } }) => { s.middlewares.use(versApp); }, configurePreviewServer: (s: { middlewares: { use: (f: typeof versApp) => void } }) => { s.middlewares.use(versApp); } };
// Les règles métier et l’état de l’app viennent de ../../packages/shared : Vite doit pouvoir lire ce dossier.
export default defineConfig(({ command, mode }) => {
  // VITE_SUPABASE_* viennent de .env en local, des variables d’environnement Netlify en ligne.
  // Au build, une configuration à moitié remplie ou une clé secrète arrête tout : rien n’est publié.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const problem = supabaseConfigProblem(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
  if (problem && command === 'build') throw new Error(problem);
  return {
    plugins: [react(), habillage, adresses],
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
