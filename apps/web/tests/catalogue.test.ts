import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATALOGUE, htmlCatalogue, htmlMoments, remplacerPrix } from '../src/site/catalogue.ts';

// Les prix sont écrits une seule fois (src/site/catalogue.ts) et insérés au build sur /services et l’accueil.
const lire = (f: string) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('catalogue : chaque service a un prix entier, un délai et un livrable', () => {
  assert.equal(CATALOGUE.length, 6);
  for (const f of CATALOGUE) for (const s of f.services) {
    assert.ok(Number.isInteger(s.prix) && s.prix > 0, s.nom);
    assert.ok(s.delai && s.recu, s.nom);
  }
});

test('catalogue : les pages ne recopient pas les prix, elles portent le repère du build', () => {
  assert.ok(lire('services.html').includes('<!--#catalogue-->'));
  assert.ok(lire('index.html').includes('<!--#catalogue-moments-->'));
  // Aucun prix écrit en dur (hors devis « à partir de 69 € », qui n’est pas un service du catalogue).
  for (const f of ['services.html', 'index.html']) assert.deepEqual(lire(f).match(/\d+&#8239;€/g)?.filter(x => x !== '69&#8239;€') ?? [], [], f);
});

test('catalogue : HTML complet (18 liens) et accueil (une carte et un lien par famille)', () => {
  assert.equal((htmlCatalogue().match(/data-service=/g) || []).length, 18);
  assert.equal((htmlMoments().match(/href="services#/g) || []).length, 6);
  assert.equal((htmlMoments().match(/<li class="moment"/g) || []).length, 6);
});

test('catalogue : les repères de prix de l’accueil sont tous connus', () => {
  const html = remplacerPrix(lire('index.html'));
  assert.ok(!html.includes('<!--#prix'));
  assert.ok(html.includes('15 à 89&#8239;€'));
});
