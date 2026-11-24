import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, createTask, visibleTask } from '../src/domain.ts';
import type { Task } from '../src/domain.ts';
import { COORDONNEES_MASQUEES, liberationAutomatique, masquerCoordonnees, reperesProfil } from '../src/confiance.ts';
import { rights } from '../src/ecrans.ts';
import { DemoGateway, demoActors } from '../src/gateway.ts';
const [owner, member, stranger] = demoActors;
const at = '2026-11-18T10:00:00.000Z';
const later = (days: number) => new Date(Date.parse(at) + days * 86_400_000).toISOString();
const terms = { scope: 'Monter', deliverable: 'Meuble monté', quality: 'Stable', deadline: 'Samedi', acceptance: 'Vérifié sur place',
  cancellation: 'Gratuite 24 h avant', confidentiality: 'Adresse privée' };
const open = () => createTask('t', owner, { title: 'Meuble', details: 'Un meuble', place: 'Aix', budget: null }, at, 'simulation');
function paid(): Task {
  let t = applyCommand(open(), member, 'apply', { id: 'o', amount: 4000, slot: 'Samedi', scope: 'Montage' }, at);
  t = applyCommand(t, owner, 'accept', { offerId: 'o' }, at);
  t = applyCommand(t, owner, 'agreement_save', terms, at);
  t = applyCommand(t, owner, 'agreement_submit', {}, at);
  t = applyCommand(t, owner, 'agreement_sign', { signature: 'Déposant', accept: true }, at);
  t = applyCommand(t, member, 'agreement_sign', { signature: 'Membre', accept: true }, at);
  return applyCommand(t, owner, 'pay', {}, at);
}

test('masquage : e-mails, liens et téléphones, sans toucher prix, dates ni horaires', () => {
  for (const s of ['écris-moi à lou.dupont@gmail.com', 'appelle le 06 12 34 56 78', 'ou +33 6 12 34 56 78', '0612345678', '06.12.34.56.78',
    'voir https://exemple.fr/annonce', 'www.monsite.com'])
    assert.ok(masquerCoordonnees(s).includes(COORDONNEES_MASQUEES), s);
  for (const s of ['Prix : 40,00 €, 1 200 € au plus', 'Samedi 18/11/2026 entre 10h et 12h', 'Commode MALM 3 tiroirs, 2e étage', 'Rendez-vous le 2026-11-18'])
    assert.equal(masquerCoordonnees(s), s);
});
test('questions publiques : visibles de tous, réponse du déposant, coordonnées masquées', () => {
  let t = applyCommand(open(), member, 'ask', { id: 'q', text: 'Quel étage ? Mon numéro : 06 12 34 56 78' }, at);
  assert.throws(() => applyCommand(t, owner, 'ask', { id: 'q2', text: 'Moi-même' }, at));
  assert.equal(t.questions![0].text, 'Quel étage ? Mon numéro : ' + COORDONNEES_MASQUEES);
  assert.throws(() => applyCommand(t, stranger, 'answer', { questionId: 'q', text: 'Pas moi' }, at));
  t = applyCommand(t, owner, 'answer', { questionId: 'q', text: '2e étage, écris à moi@exemple.fr' }, at);
  assert.equal(t.questions![0].answer, '2e étage, écris à ' + COORDONNEES_MASQUEES);
  assert.throws(() => applyCommand(t, owner, 'answer', { questionId: 'q', text: 'Encore' }, at));
  assert.equal(visibleTask(t, stranger).questions!.length, 1);
  assert.equal(rights(visibleTask(t, stranger), stranger.id).canAsk, true);
  assert.equal(rights(t, owner.id).canAsk, false);
  // 3 questions sans réponse au plus par membre.
  for (const id of ['a', 'b']) t = applyCommand(t, stranger, 'ask', { id, text: 'Question ' + id }, at);
  t = applyCommand(t, stranger, 'ask', { id: 'c', text: 'Question c' }, at);
  assert.throws(() => applyCommand(t, stranger, 'ask', { id: 'd', text: 'Une de trop' }, at), /3 questions/);
});
test('discussion : coordonnées masquées avant la signature, libres après', () => {
  let t = applyCommand(open(), member, 'apply', { id: 'o', amount: 4000, slot: 'Samedi', scope: 'Montage, appelle le 0612345678' }, at);
  assert.equal(t.offers[0].scope, 'Montage, appelle le ' + COORDONNEES_MASQUEES);
  t = applyCommand(t, owner, 'message', { offerId: 'o', text: 'Mon mail : moi@exemple.fr' }, at);
  assert.equal(t.offers[0].messages[0].text, 'Mon mail : ' + COORDONNEES_MASQUEES);
  t = paid();
  t = applyCommand(t, owner, 'message', { offerId: 'o', text: 'Code de la porte, et mon 06 12 34 56 78' }, at);
  assert.equal(t.offers[0].messages[0].text, 'Code de la porte, et mon 06 12 34 56 78');
});
test('livraison puis libération : déposant à tout moment, membre seul après 7 jours sans désaccord', () => {
  let t = paid();
  assert.equal(rights(t, member.id).canDeliver, true);
  assert.throws(() => applyCommand(t, owner, 'deliver', {}, at));
  assert.throws(() => applyCommand(t, member, 'complete', {}, at), /7 jours/);
  t = applyCommand(t, member, 'deliver', {}, at);
  assert.equal(t.deliveredAt, at);
  assert.throws(() => applyCommand(t, member, 'deliver', {}, at), /déjà/);
  assert.throws(() => applyCommand(t, member, 'complete', {}, later(6)), /7 jours/);
  assert.equal(liberationAutomatique(t, later(7)), true);
  const auto = applyCommand(t, member, 'complete', {}, later(7));
  assert.equal(auto.status, 'completed');
  assert.match(auto.history.at(-1)!.text, /libéré automatiquement/);
  // Un désaccord signalé après la livraison bloque la libération automatique.
  const disputed = applyCommand(t, owner, 'report', { text: 'Il manque une porte' }, later(2));
  assert.equal(liberationAutomatique(disputed, later(8)), false);
  assert.throws(() => applyCommand(disputed, member, 'complete', {}, later(8)));
  const done = applyCommand(disputed, owner, 'complete', {}, later(9));
  assert.match(done.history.at(-1)!.text, /paiement libéré pour le Brigadier/);
  assert.equal(visibleTask(t, member).deliveredAt, at);
});
test('livraison impossible avant paiement via Flemme', () => {
  let t = applyCommand(open(), member, 'apply', { id: 'o', amount: 4000, slot: 'Samedi', scope: 'Montage' }, at);
  t = applyCommand(t, owner, 'accept', { offerId: 'o' }, at);
  assert.equal(rights(t, member.id).canDeliver, false);
  assert.throws(() => applyCommand(t, member, 'deliver', {}, at), /signé/);
});
test('profil public : repères lisibles et démo avec missions en cours', async () => {
  assert.deepEqual(reperesProfil({ since: '2026-08-01T00:00:00.000Z', missions: 2, rating: 4.5, reviews: [{}, {}], ongoing: 1, requests: 1 }, at),
    ['4,5/5 sur 2 avis', '2 missions réalisées', '1 en cours', '1 demande menée à terme comme déposant', 'Membre depuis 3 mois']);
  assert.deepEqual(reperesProfil({ since: at, missions: 0, rating: null, reviews: [] }, at), ['Pas encore d’avis', '0 mission réalisée', 'Inscrit ce mois-ci']);
  const demo = new DemoGateway(null, async () => {});
  const p = await demo.profile(member.id);
  assert.equal(p.ongoing, 0); assert.equal(p.requests, 0);
  const meuble = (await demo.search({})).tasks.find(t => t.id === 'demo-meuble');
  assert.equal(meuble?.questions?.[0].answer, 'Une commode MALM à 3 tiroirs, au 2e étage avec ascenseur.');
});
