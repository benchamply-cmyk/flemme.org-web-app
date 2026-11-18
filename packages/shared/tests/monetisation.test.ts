import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, createTask, money, visibleTask } from '../src/domain.ts';
import { CONTRACT_COMMON_CLAUSES, contractFields, contractInput } from '../src/accord.ts';
import { rights } from '../src/ecrans.ts';
import { demoActors } from '../src/gateway.ts';
import { etapeArgent, modePaiement, recapitulatif } from '../src/monetisation.ts';
import { paymentStatus } from '../src/textes.ts';

// Parcours v2.0.0 (marketplace ouverte) : frais à la signature, prix renégociable dans l'accord, paiement via Flemme simulé.
const [owner, brigadier, stranger] = demoActors;
const at = '2026-11-18T10:00:00.000Z';
const terms = { scope: 'Montage', deliverable: 'Meuble monté', quality: 'Meuble stable', deadline: 'Samedi', acceptance: 'Vérifié le jour même', cancellation: 'Jusqu’à vendredi', confidentiality: 'Adresse privée' };
const run = (t: ReturnType<typeof createTask>, who: typeof owner, cmd: Parameters<typeof applyCommand>[2], data = {}) => applyCommand(t, who, cmd, data, at);
function choisie(mode: 'simulation' | 'stripe' | null = 'simulation') {
  const t = createTask('t', owner, { title: 'Meuble', details: 'Montage', place: 'Aix', budget: null }, at, mode ?? undefined);
  return run(run(t, brigadier, 'offer', { id: 'o', amount: 4000, slot: 'Samedi', scope: 'Montage' }), owner, 'accept', { offerId: 'o' });
}
const signee = (t = choisie()) => {
  const s = run(run(t, owner, 'agreement_save', terms), owner, 'agreement_submit');
  return run(run(s, owner, 'agreement_sign', { signature: 'Benjamin', accept: true }), brigadier, 'agreement_sign', { signature: 'Lou', accept: true });
};

test('v2 : rien n’est dû au choix de la proposition, les frais deviennent dus à la seconde signature', () => {
  const t = choisie();
  assert.equal(etapeArgent(t), 'choisi');
  assert.match(t.history.at(-1)!.text, /dus seulement à la signature/);
  const une = run(run(run(t, owner, 'agreement_save', terms), owner, 'agreement_submit'), owner, 'agreement_sign', { signature: 'Benjamin', accept: true });
  assert.equal(une.contract!.feeDueAt ?? null, null);
  const deux = signee();
  assert.equal(deux.contract!.status, 'signed');
  assert.equal(deux.contract!.feeDueAt, at);
  assert.equal(etapeArgent(deux), 'frais_dus');
  assert.ok(deux.history.some(h => /Frais de plateforme dus : 4,00/.test(h.text.replace(/ | /g, ' '))));
});

test('v2 : le prix convenu change dans l’accord, avec le taux figé, et crée une nouvelle version', () => {
  const v1 = run(choisie(), owner, 'agreement_save', terms);
  assert.equal(v1.contract!.version, 1);
  const v2 = run(v1, brigadier, 'agreement_save', { ...terms, amount: 5000 });
  assert.equal(v2.contract!.version, 2);
  assert.deepEqual([v2.agreement!.amount, v2.agreement!.commission, v2.agreement!.total, v2.agreement!.payout], [5000, 500, 5500, 5000]);
  assert.equal(v2.offers.find(o => o.id === 'o')!.amount, 5000);
  assert.deepEqual(contractInput({ ...terms, amount: '50' }), { template: '0.2', ...terms, amount: 5000 });
  assert.deepEqual(contractInput(terms), { template: '0.2', ...terms });
  assert.equal(contractFields(v2.contract, v2.agreement!.amount).amount, '50');
});

test('v2 : paiement via Flemme obligatoire, après signature et avant la fin ; plus de déclaration directe', () => {
  const t = choisie();
  assert.throws(() => run(t, owner, 'pay'), /signé/);
  const s = signee(t);
  assert.equal(rights(s, owner.id).canPay, true);
  assert.equal(rights(s, owner.id).canComplete, false);
  assert.throws(() => run(s, owner, 'complete'), /payée via Flemme/);
  assert.throws(() => run(s, brigadier, 'pay'), /indisponible/);
  const paye = run(s, owner, 'pay');
  assert.deepEqual([paye.payment!.method, paye.payment!.status, paye.payment!.total, paye.payment!.commission, paye.payment!.payout], ['simulation', 'paid', 4400, 400, 4000]);
  assert.throws(() => run(paye, owner, 'pay'), /déjà payée/);
  assert.match(paymentStatus(paye, money), /Payé via Flemme \(simulation\)/);
  const fin = run(paye, owner, 'complete');
  assert.equal(fin.status, 'completed');
  assert.equal(rights(fin, owner.id).canDeclarePayment, false);
  assert.throws(() => run(fin, owner, 'declare_payment'), /se paie via Flemme/);
  assert.equal(visibleTask(fin, stranger.id === fin.owner.id ? owner : brigadier).payment?.status, 'paid');
});

test('v2 : sans mode serveur (base pas encore migrée), l’ancien parcours direct reste intact', () => {
  const s = signee(choisie(null));
  assert.equal(rights(s, owner.id).canPay, false);
  assert.throws(() => run(s, owner, 'pay'), /indisponible/);
  const fin = run(s, owner, 'complete');
  assert.equal(rights(fin, owner.id).canDeclarePayment, true);
  assert.equal(modePaiement(undefined), 'direct');
  assert.equal(modePaiement('autre'), 'direct');
});

test('v2 : récapitulatif avant signature, une seule ligne de frais', () => {
  const lignes = recapitulatif(signee().agreement!, money);
  assert.equal(lignes.length, 4);
  assert.equal(lignes.filter(l => /Frais/.test(l.label)).length, 1);
  assert.ok(lignes[2].strong);
});

test('v2 : mode stripe, paiement par carte (pas de simulation locale), versement une fois la mission terminée', () => {
  assert.equal(modePaiement('stripe'), 'stripe');
  let t = signee(choisie('stripe'));
  assert.throws(() => run(t, owner, 'pay'), /par carte via Stripe/);
  assert.equal(rights(t, owner.id).canPay, true);
  assert.throws(() => run(t, owner, 'complete'), /payée via Flemme/);
  t = { ...t, payment: { method: 'stripe', status: 'authorized', total: 5500, commission: 500, payout: 5000, at } };
  assert.equal(rights(t, owner.id).canPay, false, 'paiement différé en cours');
  t = { ...t, payment: { ...t.payment!, status: 'paid' } };
  assert.match(paymentStatus(t, money), /^Payé via Flemme par carte .* part du membre versée à la fin de la mission$/);
  t = run(t, owner, 'complete');
  assert.equal(rights(t, owner.id).canPayout, true);
  assert.equal(rights(t, brigadier.id).canPayout, true);
  assert.equal(rights(t, stranger.id).canPayout, false);
  t = { ...t, payment: { ...t.payment!, transferredAt: at } };
  assert.equal(rights(t, owner.id).canPayout, false);
  assert.match(paymentStatus(t, money), /part du membre versée$/);
});

test('contrat v0.2 : rubriques facultatives, textes proposés, clauses communes', () => {
  assert.deepEqual(contractInput({ ...terms, access: ' Clés chez la gardienne ', liability: '' }), { template: '0.2', ...terms, access: 'Clés chez la gardienne' });
  assert.throws(() => contractInput({ ...terms, deliverable: '' }), /Livrable/);
  assert.throws(() => contractInput({ ...terms, acceptance: '' }), /Réception/);
  assert.throws(() => contractInput({ ...terms, access: 'x'.repeat(1001) }), /1000 caractères/);
  const defaults = contractFields(null);
  assert.ok(defaults.acceptance && defaults.cancellation && defaults.confidentiality);
  assert.equal(contractFields({ terms } as never).acceptance, terms.acceptance, 'un accord existant garde ses textes');
  assert.ok(CONTRACT_COMMON_CLAUSES.some(c => /n’est pas partie/.test(c)));
});
