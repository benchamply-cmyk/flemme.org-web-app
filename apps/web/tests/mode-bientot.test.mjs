import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGES_VITRINE, reglesBientot } from '../scripts/mode-bientot.mjs';

test('mode /bientot : la vitrine renvoie vers /bientot/, l’inscription et les pages légales restent ouvertes', () => {
  const regles = reglesBientot();
  assert.match(regles, /^\/\s+\/bientot\/\s+302!$/m);
  for (const ouverte of ['/bientot', '/connexion', '/mon-espace', '/admin', '/mentions', '/confidentialite', '/cgu', '/cgv']) {
    assert.ok(!PAGES_VITRINE.some((p) => p === ouverte || ouverte.startsWith(p.replace('*', ''))  && p !== '/'), ouverte);
  }
  assert.equal(regles.trim().split('\n').length, PAGES_VITRINE.length);
});
