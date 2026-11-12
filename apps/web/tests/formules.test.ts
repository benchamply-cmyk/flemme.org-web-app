import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORMULES, formuleDepuisHash, titreAvecFormule } from '../src/formules.ts';

test('formules : lecture du lien de la vitrine', () => {
  assert.equal(formuleDepuisHash('#deposer-autre'), 'autre');
  assert.equal(formuleDepuisHash('#deposer-devis'), 'devis');
  assert.equal(formuleDepuisHash('#deposer'), null);
  assert.equal(formuleDepuisHash(''), null);
});

test('formules : préfixe ajouté une seule fois, titre limité à 100 caractères', () => {
  assert.equal(titreAvecFormule('  Trier mes photos ', 'autre'), 'Autre service · Trier mes photos');
  assert.equal(titreAvecFormule('Demande de devis · Succession', 'devis'), 'Demande de devis · Succession');
  assert.equal(titreAvecFormule('Mon CV', null), 'Mon CV');
  const long = titreAvecFormule('x'.repeat(100), 'devis');
  assert.equal(long.length, 100);
  assert.ok(long.startsWith(FORMULES.devis.prefixe));
});
