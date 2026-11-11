import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendDictation, budgetLabel, filterTasks, tarif, validateRequest } from '../src/apercu/logique.ts';

// Les montants formatés par Intl contiennent des espaces insécables : on les normalise pour comparer.
const plain = (s: string | undefined) => s?.replace(/\s/g, ' ');

test('aperçu · tarif : 12 % ajoutés pour le client, 13 % retenus au Brigadier (option B)', () => {
  const t = tarif('40');
  assert.equal(plain(t?.forfait), '40,00 €');
  assert.equal(plain(t?.frais), '4,80 €');
  assert.equal(plain(t?.total), '44,80 €');
  assert.equal(plain(t?.recu), '34,80 €');
  assert.equal(t?.taux, '12 % + 13 %');
  assert.equal(plain(tarif('12,5')?.total), '14,00 €');
  assert.equal(tarif(''), null);
  assert.equal(tarif('0'), null);
  assert.equal(tarif('abc'), null);
});

test('aperçu · budget affiché : montant libre, sinon fourchette, sinon « À discuter »', () => {
  assert.equal(plain(budgetLabel({ budget: '35' })), '35,00 €');
  assert.equal(budgetLabel({ budget: '', range: '50 à 200 €' }), '50 à 200 €');
  assert.equal(budgetLabel({}), 'À discuter');
});

test('aperçu · contrôle du dépôt', () => {
  const ok = { title: 'CV', description: 'Le remettre au propre', category: 'Administratif', mode: 'À distance' };
  assert.equal(validateRequest(ok), '');
  assert.match(validateRequest({ ...ok, title: ' ' }), /Titre/);
  assert.match(validateRequest({ ...ok, category: '' }), /catégorie/);
  assert.match(validateRequest({ ...ok, delay: 'Autre', otherDelay: '' }), /délai/);
  assert.match(validateRequest({ ...ok, mode: 'Sur place', city: '' }), /ville/);
  assert.match(validateRequest({ ...ok, budget: '20', range: '10 à moins de 50 €' }), /pas les deux/);
  assert.match(validateRequest(ok, [{ size: 11 * 1024 * 1024 }]), /10 Mo/);
});

test('aperçu · recherche, filtres et tri sans modifier la liste', () => {
  const tasks = [
    { title: 'CV', description: 'Word', category: 'Administratif', place: 'À distance', delay: '3 jours', rank: 3, price: 40 },
    { title: 'Bibliothèque', description: 'Montage', category: 'Maison', place: 'Lyon · Croix-Rousse', delay: 'Demain', rank: 2, price: null },
    { title: 'Photos', description: 'Tri', category: 'Numérique', place: 'À distance', delay: '1 semaine', rank: 7, price: 75 },
  ];
  const copy = structuredClone(tasks);
  assert.deepEqual(filterTasks(tasks, {}).map(t => t.title), ['Bibliothèque', 'CV', 'Photos']);
  assert.deepEqual(filterTasks(tasks, { sort: 'budget' }).map(t => t.title), ['CV', 'Photos', 'Bibliothèque']);
  assert.deepEqual(filterTasks(tasks, { city: ' lyon ' }).map(t => t.title), ['Bibliothèque']);
  assert.deepEqual(filterTasks(tasks, { price: 'À discuter' }).map(t => t.title), ['Bibliothèque']);
  assert.deepEqual(filterTasks(tasks, { price: 'Moins de 50 €' }).map(t => t.title), ['CV']);
  assert.deepEqual(filterTasks(tasks, { q: 'WORD' }).map(t => t.title), ['CV']);
  assert.deepEqual(tasks, copy);
});

test('aperçu · dictée : la transcription s’ajoute à la fin', () => {
  assert.equal(appendDictation('', 'Bonjour'), 'Bonjour');
  assert.equal(appendDictation('Mon texte\n', 'Suite'), 'Mon texte\nSuite');
});
