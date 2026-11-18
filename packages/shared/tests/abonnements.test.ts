// Abonnements (v2.0.0) : modèle générique, prix affichés, statuts, et cohérence avec la migration 20261118130000.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONDITIONS_COMMUNES, FORMULES, abonnementActif, prixFormule, resumeAbonnement, souscriptible, verifierFormule } from '../src/abonnements.ts';
import type { FormuleAbonnement } from '../src/abonnements.ts';
import { FLAGS, resoudreFlags } from '../src/flags.ts';

const sql = readFileSync(new URL('../../../supabase/migrations/20261118130000_flemme_v2_abonnements.sql', import.meta.url), 'utf8');
const base: FormuleAbonnement = { id: 'essai', nom: 'Essai', accroche: 'x', pour: 'tous', prixMensuel: null, prixAnnuel: null, essaiJours: 0, avantages: ['a'], conditions: [], statut: 'brouillon' };

test('abonnements : livré fermé (flag éteint partout, formules en brouillon)', () => {
  for (const env of ['local', 'beta', 'preprod', 'prod'] as const) assert.equal(resoudreFlags(env, null, true)['abonnements.souscription'].actif, false, env);
  assert.equal(FLAGS['abonnements.souscription'].type, 'lancement');
  for (const f of FORMULES) { verifierFormule(f); assert.equal(f.statut, 'brouillon', f.id); assert.equal(souscriptible(f), false); }
});

test('abonnements : chaque formule du modèle existe dans la migration, avec le même identifiant', () => {
  for (const f of FORMULES) assert.match(sql, new RegExp(`values \\('${f.id}', '${f.nom}'`), f.id);
});

test('abonnements : contrôles du modèle générique', () => {
  assert.throws(() => verifierFormule({ ...base, id: 'Pas Valide' }), /Identifiant/);
  assert.throws(() => verifierFormule({ ...base, prixMensuel: 4.9 }), /Prix invalide/);
  assert.throws(() => verifierFormule({ ...base, statut: 'ouverte' }), /a un prix/);
  assert.throws(() => verifierFormule({ ...base, avantages: [] }), /avantages/);
  assert.throws(() => verifierFormule({ ...base, essaiJours: 120 }), /Essai/);
  assert.equal(souscriptible({ ...base, statut: 'ouverte', prixMensuel: 490 }), true);
});

test('abonnements : prix affichés et résumé dans Mon espace', () => {
  assert.equal(prixFormule(base), 'Bientôt');
  assert.equal(prixFormule({ ...base, statut: 'brouillon', prixMensuel: 490 }), 'Bientôt', 'brouillon : prix pas encore annoncé');
  assert.equal(prixFormule({ ...base, statut: 'ouverte', prixMensuel: 490, prixAnnuel: 4900 }), '4,90 € / mois ou 49 € / an');
  assert.equal(prixFormule({ ...base, statut: 'fermee' }), 'Fermée');
  const date = (iso: string) => iso.slice(0, 10);
  assert.equal(resumeAbonnement({ planId: 'p', status: 'active', currentPeriodEnd: '2026-12-18T00:00:00Z', cancelAtPeriodEnd: false }, 'Premium', date), 'Premium : actif, renouvelé le 2026-12-18.');
  assert.equal(resumeAbonnement({ planId: 'p', status: 'active', currentPeriodEnd: '2026-12-18T00:00:00Z', cancelAtPeriodEnd: true }, 'Premium', date), 'Premium : actif, prend fin le 2026-12-18.');
  assert.equal(resumeAbonnement({ planId: 'p', status: 'canceled', currentPeriodEnd: null, cancelAtPeriodEnd: false }, 'Premium', date), 'Premium : résilié.');
  assert.deepEqual(['trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete'].map(s => abonnementActif(s as never)), [true, true, true, false, false, false]);
  assert.ok(CONDITIONS_COMMUNES.some(c => /Sans engagement/.test(c)));
});
