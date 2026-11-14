import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Vitrine sans « .html » (plan d’adresses validé par Ben le 14/11/2026, PR 2) :
// chaque page publique est servie à son adresse courte et l’ancienne adresse y renvoie en 301.
const lire = (chemin: string) => readFileSync(new URL('../' + chemin, import.meta.url), 'utf8');
const PAGES = ['concept', 'deleguer', 'resoudre', 'premium', 'faq', 'contact', 'mentions', 'confidentialite'];
const regles = [...lire('../../netlify.toml').matchAll(/\[\[redirects\]\]\s*from = "([^"]+)"\s*to = "([^"]+)"\s*status = (\d+)(\s*force = true)?/g)]
  .map(m => ({ from: m[1], to: m[2], status: m[3], force: !!m[4] }));

test('vitrine : aucun lien interne vers une page en .html', () => {
  const fichiers = [...readdirSync(new URL('../', import.meta.url)).filter(f => f.endsWith('.html')), 'src/site/entete.html', 'src/site/pied.html', 'public/404.html'];
  for (const f of fichiers) {
    const liens = [...lire(f).matchAll(/href="(?:\.?\/)?([a-z-]+)\.html/g)].map(m => m[1]).filter(n => !['app', 'admin', 'apercu', 'beta'].includes(n));
    assert.deepEqual(liens, [], f);
  }
});

test('vitrine : chaque ancienne adresse en .html renvoie en 301 vers l’adresse courte', () => {
  const attendu: Record<string, string> = { '/index.html': '/', '/comment-ca-marche.html': '/concept', '/deleguer-une-flemme.html': '/deleguer' };
  for (const p of PAGES) attendu[`/${p}.html`] = '/' + p;
  for (const [from, to] of Object.entries(attendu)) {
    const r = regles.find(x => x.from === from);
    assert.ok(r, 'règle manquante pour ' + from);
    assert.deepEqual([r.to, r.status, r.force], [to, '301', true], from);
  }
});

test('vitrine : le sitemap ne liste que des adresses courtes, toutes servies par un fichier', () => {
  const locs = [...lire('public/sitemap.xml').matchAll(/<loc>https:\/\/flemme\.org\/([^<]*)<\/loc>/g)].map(m => m[1]);
  assert.deepEqual(locs.filter(l => l.endsWith('.html')), []);
  const fichiers = readdirSync(new URL('../', import.meta.url));
  for (const l of locs.filter(Boolean)) assert.ok(fichiers.includes(l + '.html'), l);
});
