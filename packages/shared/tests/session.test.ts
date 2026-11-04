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
    return new Response(JSON.stringify(path.includes('/token') ? { access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { id: 'u', email: 'u@example.com' } } : { tasks: [], nextCursor: null, profile: { id: 'u', name: 'U' } }));
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

// Faux serveur Supabase : deux pages de flemmes, profil, mot de passe.
function server(log: string[] = []) {
  const task = (id: string) => ({ id, owner: { id: 'x', name: 'X' }, title: id, details: '', place: '', budget: null, status: 'open', createdAt: '', offers: [], history: [], reports: [] });
  return (async (path: string, init: RequestInit) => {
    const body = init.body ? JSON.parse(String(init.body)) : {};
    log.push(body.p_action || path.replace(/^https:\/\/[^/]+/, ''));
    if (path.includes('/token')) return new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { id: 'u', email: 'u@example.com' } }));
    if (body.p_action === 'list') return new Response(JSON.stringify(body.p_data.cursor ? { tasks: [task('t2'), task('t1')], nextCursor: null } : { tasks: [task('t1')], nextCursor: 'p2' }));
    if (body.p_action === 'update_profile') return new Response(JSON.stringify({ profile: { id: 'u', name: body.p_data.displayName } }));
    return new Response(JSON.stringify({ profile: { id: 'u', name: 'U' } }));
  }) as unknown as typeof fetch;
}
const remote = (o: Partial<ConstructorParameters<typeof FlemmeSession>[0]> = {}) => {
  let saved: string | null = null;
  return new FlemmeSession({ url: 'https://example.supabase.co', key: 'public', tokens: { get: async () => saved, set: async v => { saved = v; }, clear: async () => { saved = null; } }, readDemo: async () => null, writeDemo: async () => {}, transport: server(), ...o });
};
test('pagination : la page suivante s’ajoute sans doublon, puis plus rien à charger', async () => {
  const s = remote(); await s.initialize();
  await s.login('u@example.com', 'motdepasse-long', () => {});
  assert.deepEqual(s.getState().tasks.map(t => t.id), ['t1']); assert.equal(s.getState().more, 'p2');
  await s.loadMore();
  assert.deepEqual(s.getState().tasks.map(t => t.id), ['t1', 't2']); assert.equal(s.getState().more, null);
  await s.refresh(); assert.deepEqual(s.getState().tasks.map(t => t.id), ['t1']);
});
test('retour d’un lien « mot de passe oublié » : connecté, choix du mot de passe proposé puis enregistré', async () => {
  const s = remote({ onStart: async g => { await g.exchangeCode('code', 'secret'); return { signedIn: true, recovering: true }; } });
  await s.initialize();
  assert.equal(s.getState().actorId, 'u'); assert.equal(s.getState().recovering, true);
  await s.setPassword('court', () => {}); assert.match(s.getState().error, /12 caractères/); assert.equal(s.getState().recovering, true);
  let done = false; await s.setPassword('un-long-mot-de-passe', () => { done = true; });
  assert.ok(done); assert.equal(s.getState().recovering, false); assert.equal(s.getState().notice, 'Mot de passe enregistré.');
});
test('lien expiré : erreur affichée, sans perdre la session déjà ouverte ; configuration refusée', async () => {
  const s = remote({ onStart: async () => ({ signedIn: false, error: 'Ce lien a expiré.' }) });
  await s.initialize(); assert.equal(s.getState().error, 'Ce lien a expiré.'); assert.equal(s.getState().actorId, '');
  const bad = remote({ configProblem: 'Clé secrète refusée.' }); await bad.initialize();
  assert.equal(bad.getState().error, 'Clé secrète refusée.'); assert.equal(bad.getState().gateway, null);
});
test('mot de passe oublié et nom affiché', async () => {
  const s = remote(); await s.initialize();
  await s.recover('  ', async () => ({}), () => {}); assert.match(s.getState().error, /Indique ton adresse/);
  await s.recover('u@example.com', async () => ({ redirectTo: 'https://flemme.org/app.html' }), () => {}); assert.match(s.getState().notice, /un e-mail vient de partir/);
  await s.login('u@example.com', 'motdepasse-long', () => {});
  await s.updateProfile('Ben', () => {}); assert.equal(s.getState().gateway!.actor.name, 'Ben'); assert.equal(s.getState().notice, 'Nom affiché mis à jour.');
});
