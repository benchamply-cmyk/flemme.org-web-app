import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyCommand, createTask, visibleTask } from '../src/domain.ts';
import { rights } from '../src/ecrans.ts';
import { FlemmeSession } from '../src/session.ts';
import { CONTRACT_FIELDS, contractInput, offerInput, profileInput, reviewInput, signatureInput } from '../src/accord.ts';

const sql = readFileSync(new URL('../../../supabase/migrations/20261104140000_flemme_v2_accord.sql', import.meta.url), 'utf8');
const owner = { id: 'o', name: 'Ondine' }, brig = { id: 'b', name: 'Basile' }, other = { id: 'x', name: 'Xavier' }, at = '2026-11-04T10:00:00.000Z';
const terms = { scope: 'Montage', quality: 'De niveau', deadline: 'Samedi', cancellation: '48 h avant', confidentiality: 'Adresse privée' };

test('accord : mêmes rubriques et limites que flemme_v2.agreement_terms', () => {
  for (const f of CONTRACT_FIELDS) assert.match(sql, new RegExp(`'${f.name}', flemme_v2\\.required_text\\(p_data->'${f.name}', ${f.max}\\)`), f.name);
});

test('accord : contrôles des formulaires', () => {
  assert.throws(() => contractInput({ ...terms, quality: ' ' }), /Résultat attendu/);
  assert.deepEqual(contractInput({ ...terms, scope: ' Montage ' }), terms);
  assert.throws(() => offerInput({ slot: 'Samedi', scope: 'Tout' }), /montant/);
  assert.deepEqual(offerInput({ amount: '42,5', slot: ' Samedi ', scope: 'Tout', result: '' }), { amount: 4250, slot: 'Samedi', scope: 'Tout', result: null });
  assert.throws(() => signatureInput('Ondine', false), /Coche la case/);
  assert.throws(() => signatureInput(' ', true), /nom complet/);
  assert.deepEqual(profileInput({ skills: 'Montage, montage, Montage,, Peinture', bio: '' }), { bio: null, experience: null, skills: ['Montage', 'montage', 'Peinture'] });
  assert.throws(() => profileInput({ skills: Array.from({ length: 11 }, (_, i) => 'c' + i).join(',') }), /10 compétences/);
  assert.throws(() => reviewInput('0', ''), /note de 1 à 5/);
  assert.deepEqual(reviewInput('4', ' Bien '), { rating: 4, text: 'Bien' });
});

test('accord : parcours complet en local (candidature, accord, deux signatures, fin, avis)', () => {
  let t = createTask('t', owner, { title: 'Étagère', details: 'Trois planches', place: 'Aix', budget: 5000 }, at);
  t = applyCommand(t, brig, 'apply', { id: 'p', ...offerInput({ amount: '40', slot: 'Samedi', scope: 'Montage', result: 'Fixée' }) }, at);
  assert.equal(t.offers[0].result, 'Fixée'); assert.equal(t.offers[0].review, 'approved');
  t = applyCommand(t, brig, 'apply_edit', { offerId: 'p', amount: 4200, slot: 'Samedi', scope: 'Montage' }, at);
  assert.equal(t.offers[0].amount, 4200);
  assert.throws(() => applyCommand(t, owner, 'agreement_save', terms, at), /Brigadier choisi/);
  t = applyCommand(t, owner, 'accept', { offerId: 'p' }, at);
  assert.throws(() => applyCommand(t, other, 'agreement_save', terms, at), /inaccessible/);
  t = applyCommand(t, brig, 'agreement_save', terms, at);
  assert.ok(rights(t, owner.id).canContract); assert.ok(!rights(t, owner.id).canComplete);
  assert.throws(() => applyCommand(t, owner, 'agreement_sign', signatureInput('Ondine', true), at), /validé avant/);
  t = applyCommand(t, owner, 'agreement_submit', {}, at);
  assert.equal(t.contract!.status, 'approved'); assert.ok(rights(t, owner.id).canSign);
  t = applyCommand(t, owner, 'agreement_sign', signatureInput('Ondine Martin', true), at);
  assert.ok(!rights(t, owner.id).canSign); assert.ok(rights(t, brig.id).canSign);
  assert.throws(() => applyCommand(t, owner, 'complete', {}, at), /signé par les deux/);
  t = applyCommand(t, brig, 'agreement_sign', signatureInput('Basile', true), at);
  assert.equal(t.contract!.status, 'signed'); assert.throws(() => applyCommand(t, owner, 'agreement_save', terms, at), /déjà signé/);
  assert.throws(() => visibleTask(t, other), /inaccessible/);
  assert.equal(visibleTask(t, brig).contract!.ownerSignature, 'Ondine Martin');
  t = applyCommand(t, owner, 'complete', {}, at);
  t = applyCommand(t, owner, 'review', reviewInput('5', 'Parfait'), at);
  assert.throws(() => applyCommand(t, owner, 'review', reviewInput('4', ''), at), /déjà donné/);
  assert.deepEqual(visibleTask(t, owner).myReview, { rating: 5, text: 'Parfait' });
  assert.equal(visibleTask(t, brig).myReview, null); assert.ok(rights(visibleTask(t, brig), brig.id).canReview);
  assert.equal(visibleTask(t, owner).ratings, undefined);
});

test('accord : profils et avis dans la démo', async () => {
  const s = new FlemmeSession({ url: '', key: '', tokens: { get: async () => null, set: async () => {}, clear: async () => {} }, readDemo: async () => null, writeDemo: async () => {} });
  await s.initialize();
  await s.saveProfile(profileInput({ bio: 'Bricoleur', skills: 'Montage, Peinture' }), () => {});
  assert.deepEqual(s.getState().profile!.skills, ['Montage', 'Peinture']);
  await s.openProfile('demo-lou');
  assert.equal(s.getState().profile!.name, 'Lou'); assert.equal(s.getState().profile!.rating, null);
  await s.openProfile('inconnu');
  assert.match(s.getState().error, /Profil introuvable/);
});
