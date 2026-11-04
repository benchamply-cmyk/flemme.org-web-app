import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyCommand, createTask, money, visibleTask } from '../src/domain.ts';
import { FlemmeSession } from '../src/session.ts';
import { BUDGET_RANGES, CATEGORIES, DEADLINES, MODES, appendDictation, budgetText, canEdit, deadlineLabel, taskFields, taskInput } from '../src/parcours.ts';

const sql = readFileSync(new URL('../../../supabase/migrations/20261104120000_flemme_v2_parcours.sql', import.meta.url), 'utf8');
const owner = { id: 'o', name: 'Ondine' }, other = { id: 'b', name: 'Basile' }, at = '2026-11-04T10:00:00.000Z';
const form = { title: 'Remettre mon CV au propre', details: 'Une page', category: 'administratif', deadline: '1_semaine', mode: 'distance' };

test('parcours : mêmes codes que les contraintes de la migration', () => {
  for (const [column, list] of [['category', CATEGORIES], ['deadline', DEADLINES], ['budget_range', BUDGET_RANGES], ['work_mode', MODES]] as const) {
    const check = sql.match(new RegExp(`add column ${column} text check \\(${column} in \\(([^)]*)\\)`));
    assert.ok(check, column);
    assert.deepEqual(check[1].match(/'([^']+)'/g)!.map(s => s.slice(1, -1)), list.map(o => o.value), column);
  }
});

test('parcours : contrôles du formulaire de dépôt', () => {
  assert.throws(() => taskInput({ ...form, title: '' }), /titre et une description/);
  assert.throws(() => taskInput({ ...form, category: '' }), /catégorie/);
  assert.throws(() => taskInput({ ...form, deadline: 'autre' }), /Précise le délai/);
  assert.throws(() => taskInput({ ...form, amount: '40', budgetRange: '10_50' }), /pas les deux/);
  assert.throws(() => taskInput({ ...form, mode: 'sur_place' }), /ville ou un secteur/);
  assert.deepEqual(taskInput({ ...form, amount: '40,5', address: 'ignorée' }), {
    title: form.title, details: 'Une page', category: 'administratif', deadline: '1_semaine', deadlineNote: null,
    budget: 4050, budgetRange: null, mode: 'distance', place: 'À distance', address: null });
  const onsite = taskInput({ ...form, mode: 'les_deux', place: ' Lyon ', address: ' 3 rue X ', deadline: 'autre', deadlineNote: 'avant Noël', budgetRange: '50_200' });
  assert.equal(onsite.place, 'Lyon'); assert.equal(onsite.address, '3 rue X'); assert.equal(onsite.deadlineNote, 'avant Noël'); assert.equal(onsite.budget, null);
});

test('parcours : libellés, aller-retour formulaire et dictée', () => {
  const t = createTask('t', owner, taskInput({ ...form, mode: 'sur_place', place: 'Lyon', address: '3 rue X', amount: '1234,5' }), at);
  assert.equal(budgetText(t, money), money(123450));
  assert.equal(budgetText({ budget: null, budgetRange: '10_50' }, money), '10 à moins de 50 €');
  assert.equal(budgetText({ budget: null, budgetRange: null }, money), 'À discuter');
  assert.equal(deadlineLabel(t), '1 semaine');
  assert.equal(deadlineLabel({ deadline: 'autre', deadlineNote: 'avant Noël' }), 'avant Noël');
  assert.equal(deadlineLabel({ deadline: null }), 'Délai à discuter');
  assert.deepEqual(taskInput(taskFields(t, money)), taskInput({ ...form, mode: 'sur_place', place: 'Lyon', address: '3 rue X', amount: '1234,50' }));
  assert.equal(appendDictation('Bonjour  ', 'il faut monter un meuble'), 'Bonjour\nil faut monter un meuble');
  assert.equal(appendDictation('', 'texte'), 'texte');
});

test('parcours : modification et confidentialité (règles locales, mêmes que le serveur)', () => {
  let t = createTask('t', owner, taskInput({ ...form, mode: 'sur_place', place: 'Lyon', address: '3 rue X' }), at);
  assert.ok(canEdit(t, owner.id)); assert.ok(!canEdit(t, other.id));
  assert.equal(visibleTask(t, other).address, undefined);
  t = applyCommand(t, owner, 'edit', taskInput({ ...form, title: 'Nouveau titre' }), at);
  assert.equal(t.title, 'Nouveau titre'); assert.equal(t.address, null); assert.equal(t.history.at(-1)!.text, 'Demande modifiée');
  t = applyCommand(t, other, 'offer', { id: 'p', amount: 3000, slot: 'Samedi', scope: 'Tout' }, at);
  assert.ok(!canEdit(t, owner.id));
  assert.throws(() => applyCommand(t, owner, 'edit', taskInput(form), at), /ne peut plus être modifiée/);
  assert.throws(() => visibleTask({ ...t, review: 'pending' }, other), /inaccessible/);
});

test('parcours : brouillons de la démo, sans doublon, supprimés à l’envoi', async () => {
  let saved: unknown = null;
  const s = new FlemmeSession({ url: '', key: '', tokens: { get: async () => null, set: async () => {}, clear: async () => {} }, readDemo: async () => null, writeDemo: async v => { saved = v; } });
  await s.initialize();
  let id = '';
  await s.saveDraft({ kind: 'task', fields: { title: 'Brouillon' } }, d => { id = d.id; });
  await s.saveDraft({ id, kind: 'task', fields: { title: 'Brouillon repris' } }, () => {});
  assert.equal(s.getState().drafts.length, 1);
  assert.equal(s.getState().drafts[0].fields.title, 'Brouillon repris');
  assert.ok(saved);
  await s.mutate('create', '', { ...taskInput(form), draftId: id }, () => {});
  assert.equal(s.getState().drafts.length, 0);
  assert.equal(s.getState().tasks[0].title, form.title);
});
