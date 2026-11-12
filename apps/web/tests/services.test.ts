import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifierCatalogue, htmlCatalogue, htmlPiedFamilles, exemplesCarrousel, texte, type Catalogue } from '../src/site/services.ts';

const lire = () => JSON.parse(readFileSync(new URL('../contenu/services.json', import.meta.url), 'utf8'));

test('services : le fichier contenu/services.json est valide', () => {
  assert.deepEqual(verifierCatalogue(lire()), []);
});

test('services : catalogue rendu avec prix, familles, hors catalogue et pied de page', () => {
  const c: Catalogue = lire();
  const h = htmlCatalogue(c);
  assert.match(h, /Courrier de résiliation ou de changement<\/span><b>19 €<\/b>/);
  assert.match(h, /app\.html#deposer-autre/);
  assert.match(h, /À partir de 69 €\./);
  assert.equal((h.match(/<ul class="tarifs">/g) ?? []).length, c.familles.length);
  assert.equal((htmlPiedFamilles(c).match(/<a /g) ?? []).length, c.familles.length);
  assert.equal(exemplesCarrousel(c).length, c.familles.length);
});

test('services : visible false masque un service, une famille ou une carte', () => {
  const c: Catalogue = lire();
  c.familles[0].services[0].visible = false;
  c.familles[1].visible = false;
  c.horsCatalogue.devis.visible = false;
  c.urgence.visible = false;
  const h = htmlCatalogue(c);
  assert.doesNotMatch(h, /Courrier de résiliation/);
  assert.doesNotMatch(h, /SAV et réclamations/);
  assert.doesNotMatch(h, /deposer-devis/);
  assert.doesNotMatch(h, /Option urgence/);
  assert.doesNotMatch(htmlPiedFamilles(c), /SAV/);
});

test('services : erreurs de saisie signalées en clair', () => {
  const c = lire();
  c.familles[0].services[0].prix = '19 €';
  c.familles[2].couleur = 'rouge';
  c.familles[3].services = [];
  delete c.horsCatalogue.autres.lien;
  const pb = verifierCatalogue(c);
  assert.ok(pb.some(p => p.includes('services[1].prix') && p.includes('en chiffres')));
  assert.ok(pb.some(p => p.includes('couleur')));
  assert.ok(pb.some(p => p.includes('au moins un service')));
  assert.ok(pb.some(p => p.includes('autres.lien')));
});

test('services : HTML échappé et typographie française', () => {
  assert.equal(texte('<b>Pressé ?</b> 10 €'), '&lt;b&gt;Pressé\u202f?&lt;/b&gt; 10\u202f€');
});
