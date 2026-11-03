import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FlemmeSession } from '../src/session.ts';
import { demoActors } from '../src/gateway.ts';
import type { DemoState } from '../src/gateway.ts';
import { partition, rights, parentScreen } from '../src/ecrans.ts';
import { cardHint, paymentStatus } from '../src/textes.ts';

const noTokens = { get: async () => null, set: async () => {}, clear: async () => {} };
const demo = (writeDemo: (s: DemoState) => Promise<void> = async () => {}) =>
  new FlemmeSession({ url: '', key: '', tokens: noTokens, readDemo: async () => null, writeDemo });
const input = { title: 'Mon meuble', details: 'Un montage', place: 'Aix', budget: null };

test('démo : sans clé Supabase, la session charge les données fictives', async () => {
  const s = demo(); await s.initialize();
  const st = s.getState();
  assert.equal(s.remote, false); assert.equal(st.ready, true); assert.equal(st.actorId, demoActors[0].id); assert.equal(st.tasks.length, 3);
});
test('configuration incomplète : erreur affichée, aucune bascule silencieuse en démo', async () => {
  const s = new FlemmeSession({ url: 'https://example.supabase.co', key: '', tokens: noTokens, readDemo: async () => null, writeDemo: async () => {} });
  await s.initialize();
  assert.equal(s.remote, true); assert.equal(s.getState().gateway, null); assert.match(s.getState().error, /Configuration incomplète/);
});
test('envoi retenté après un échec : même identifiant de requête, une seule flemme créée', async () => {
  let fail = true, writes = 0;
  const s = demo(async () => { if (fail) throw new Error('Disque plein'); writes++; }); await s.initialize();
  let created = 0;
  await s.mutate('create', '', input, () => { created++; });
  assert.equal(s.getState().error, 'Disque plein'); assert.equal(created, 0);
  fail = false;
  await s.mutate('create', '', input, () => { created++; });
  assert.equal(created, 1); assert.equal(writes, 1); assert.equal(s.getState().tasks[0].title, 'Mon meuble'); assert.equal(s.getState().error, '');
});
test('verrou : une seconde action pendant un envoi est ignorée', async () => {
  let release!: () => void;
  const s = demo(() => new Promise<void>(r => { release = r; })); await s.initialize();
  let done = 0;
  const first = s.mutate('create', '', input, () => { done++; });
  await s.mutate('create', '', { ...input, title: 'Autre' }, () => { done++; });
  assert.equal(s.getState().busy, true);
  release(); await first;
  assert.equal(done, 1); assert.equal(s.getState().busy, false);
});
test('changement de personnage puis proposition et droits calculés', async () => {
  const s = demo(); await s.initialize();
  let switched = false;
  await s.switchActor(demoActors[2], () => { switched = true; });
  assert.ok(switched); assert.equal(s.getState().actorId, 'demo-camille');
  const colis = s.getState().tasks.find(t => t.id === 'demo-colis')!;
  assert.equal(cardHint(colis, 'demo-camille'), 'Je peux aider →');
  assert.equal(rights(colis, 'demo-camille').canOffer, true);
  await s.mutate('offer', colis.id, { amount: 1500, slot: 'Lundi', scope: 'Tout compris' }, () => {});
  const after = s.getState().tasks.find(t => t.id === 'demo-colis')!;
  assert.equal(rights(after, 'demo-camille').canOffer, false);
  assert.equal(cardHint(after, 'demo-camille'), 'Ma proposition et le suivi →');
  const lists = partition(s.getState().tasks, 'demo-camille');
  assert.deepEqual(lists.helping.map(t => t.id), ['demo-colis']);
  assert.deepEqual(lists.own.map(t => t.id), ['demo-meuble']);
});
test('parcours et paiement : écran parent et libellés', () => {
  assert.equal(parentScreen('review'), 'offer'); assert.equal(parentScreen('report'), 'detail'); assert.equal(parentScreen('account'), 'home'); assert.equal(parentScreen('detail'), 'list');
  const t = { paymentDeclared: true } as Parameters<typeof paymentStatus>[0];
  assert.equal(paymentStatus(t), 'Paiement déclaré · confirmation Brigadier attendue');
});
test('déconnexion : la session locale est effacée même si le serveur ne répond pas', async () => {
  let calls = 0;
  const transport = (async (path: string) => {
    calls++;
    if (path.includes('/logout')) throw new Error('offline');
    return new Response(JSON.stringify(path.includes('/token') ? { access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { id: 'u', email: 'u@example.com' } } : { tasks: [] }));
  }) as unknown as typeof fetch;
  let saved: string | null = null;
  const s = new FlemmeSession({ url: 'https://example.supabase.co', key: 'public', tokens: { get: async () => saved, set: async v => { saved = v; }, clear: async () => { saved = null; } }, readDemo: async () => null, writeDemo: async () => {}, transport });
  await s.initialize();
  await s.login('u@example.com', 'motdepasse-long', () => {});
  assert.equal(s.getState().actorId, 'u');
  let out = false;
  await s.logout(() => { out = true; });
  assert.ok(out); assert.equal(s.getState().actorId, ''); assert.equal(saved, null); assert.match(s.getState().error, /Connexion interrompue/); assert.ok(calls >= 3);
});
