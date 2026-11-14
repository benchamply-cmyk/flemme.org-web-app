import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLE_BROUILLON, ecrireBrouillon, lireBrouillon, nettoyer, reprendreBrouillon } from '../src/site/brouillon.ts';

// Brouillon commencé sans compte sur /deleguer, repris une seule fois par le formulaire de l’app.
const memoire = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, m }; };

test('brouillon : seuls les champs connus, en texte court, sont gardés', () => {
  assert.deepEqual(nettoyer({ details: '  Mon CV  ', category: 'numerique', email: 'x@y.z', amount: 5, place: '' }), { details: 'Mon CV', category: 'numerique' });
  assert.equal(nettoyer({ details: 'a'.repeat(2000) }).details!.length, 1000);
  assert.equal(nettoyer({ place: 'b'.repeat(300) }).place!.length, 100);
  assert.deepEqual(nettoyer(null), {}); assert.deepEqual(nettoyer('texte'), {});
});

test('brouillon : écrit, relu, puis effacé à la reprise', () => {
  const s = memoire();
  ecrireBrouillon({ details: 'Réclamer un remboursement SNCF', mode: 'distance', formule: 'autre' }, s);
  assert.deepEqual(lireBrouillon(s), { details: 'Réclamer un remboursement SNCF', mode: 'distance', formule: 'autre' });
  assert.deepEqual(reprendreBrouillon(s).details, 'Réclamer un remboursement SNCF');
  assert.equal(s.m.has(CLE_BROUILLON), false);
  assert.deepEqual(reprendreBrouillon(s), {});
  // Brouillon vide : rien n’est gardé ; contenu illisible : ignoré.
  ecrireBrouillon({ details: '   ' }, s); assert.equal(s.m.has(CLE_BROUILLON), false);
  s.setItem(CLE_BROUILLON, '{pas du json'); assert.deepEqual(lireBrouillon(s), {});
});
