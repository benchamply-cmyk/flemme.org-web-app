// Mode « site en construction » (demande de Ben du 21/11/2026) : en production seulement,
// les pages de la vitrine renvoient vers /bientot/. Activé par FLEMME_MODE_BIENTOT=1
// (netlify.toml, [context.production.environment]) ; sans cette variable, rien ne change.
// Les règles sont écrites dans dist/_redirects, lu par Netlify avant celles de netlify.toml.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Pages publiques de la vitrine. Restent ouverts : /bientot/, /connexion et l'espace
// connecté (création de compte), /admin, les pages légales (/mentions, /confidentialite, /cgu, /cgv).
export const PAGES_VITRINE = ['/', '/concept', '/deleguer', '/resoudre', '/services', '/services/*', '/premium', '/faq', '/contact', '/apercu', '/apercu.html'];

export function reglesBientot() {
  return PAGES_VITRINE.map((page) => `${page.padEnd(16)} /bientot/  302!`).join('\n') + '\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.env.FLEMME_MODE_BIENTOT !== '1') {
    console.log('Mode /bientot : inactif.');
  } else {
    const cible = new URL('../dist/_redirects', import.meta.url);
    const avant = existsSync(cible) ? readFileSync(cible, 'utf8') : '';
    writeFileSync(cible, '# Mode /bientot (FLEMME_MODE_BIENTOT=1)\n' + reglesBientot() + avant);
    console.log(`Mode /bientot : actif, ${PAGES_VITRINE.length} pages renvoyées vers /bientot/.`);
  }
}
