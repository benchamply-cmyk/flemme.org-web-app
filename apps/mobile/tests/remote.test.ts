import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RemoteGateway } from '../src/gateway.ts';
test('transport : jeton sécurisé, session et identifiant idempotent envoyés à la RPC', async () => {
  let saved: string | null = null;
  const calls: { path: string; body: any; headers: any }[] = [];
  const transport = async (path: any, init: any) => {
    calls.push({ path, body: JSON.parse(init.body), headers: init.headers });
    const body = JSON.parse(init.body);
    return new Response(JSON.stringify(path.includes('/token') ? { access_token: 'access', refresh_token: 'refresh', expires_in: 3600, user: { id: 'a', email: 'ben@example.com' } }
      : body.p_action === 'me' ? { profile: { id: 'a', name: 'Benjamin' } }
      : body.p_action === 'update_profile' ? { profile: { id: 'a', name: body.p_data.displayName } }
      : body.p_action === 'list' ? { tasks: [], nextCursor: body.p_data.cursor ? null : 'page-2' }
      : { task: { id: 'new' } }), { status: 200 });
  };
  const g = new RemoteGateway('https://example.supabase.co', 'sb_publishable_test', { get: async () => saved, set: async v => { saved = v; }, clear: async () => { saved = null; } }, transport);
  await g.login('ben@example.com', 'password');
  assert.equal(saved, 'refresh'); assert.equal(g.actor.id, 'a');
  assert.equal(g.actor.name, 'Benjamin', 'nom affiché lu dans le profil serveur, pas déduit de l’e-mail');
  await g.create({ title: 'Une tâche' }, 'request-id');
  assert.equal(calls[2].headers.Authorization, 'Bearer access');
  assert.equal(calls[2].body.p_request, 'request-id');
  assert.equal(calls[2].body.p_data.actorName, undefined, 'le client n’envoie plus de nom');
  await g.updateProfile('Ben'); assert.equal(g.actor.name, 'Ben');
  const first = await g.list();
  assert.equal(first.nextCursor, 'page-2'); assert.equal(calls.at(-1)!.body.p_data.limit, 50);
  assert.equal((await g.list(first.nextCursor)).nextCursor, null); assert.equal(calls.at(-1)!.body.p_data.cursor, 'page-2');
  await g.logout(); assert.equal(saved, null); assert.equal(g.actor.id, '');
});
test('erreurs réseau remontées, pas de faux succès ni de bascule silencieuse en démo', async () => {
  const storage = { get: async () => null, set: async () => {}, clear: async () => {} };
  const g = new RemoteGateway('https://example.supabase.co', 'public', storage, async () => { throw new Error('offline'); });
  await assert.rejects(g.login('x', 'x'), /Connexion interrompue/);
  assert.equal(g.actor.id, '');
  assert.throws(() => new RemoteGateway('http://example.com', 'public', storage));
  assert.throws(() => new RemoteGateway('https://example.com', 'sb_secret_x', storage));
});
test('reprise : les appels concurrents partagent un seul renouvellement du jeton', async () => {
  let refreshes = 0;
  const storage = { get: async () => 'refresh', set: async () => {}, clear: async () => {} };
  const g = new RemoteGateway('https://example.supabase.co', 'public', storage, async (path: any) => {
    if (path.includes('/token')) { refreshes++; await new Promise(r => setTimeout(r, 5)); return new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { id: 'u', email: 'u@example.com' } })); }
    return new Response(JSON.stringify({ tasks: [], nextCursor: null, profile: { id: 'u', name: 'U' } }));
  });
  await Promise.all([g.list(), g.list()]); assert.equal(refreshes, 1);
});
test('comptes repris : mot de passe oublié, retour de lien PKCE et nouveau mot de passe', async () => {
  let saved: string | null = null;
  const calls: { path: string; method: string; body: any; headers: any }[] = [];
  const g = new RemoteGateway('https://example.supabase.co', 'sb_publishable_test', { get: async () => saved, set: async v => { saved = v; }, clear: async () => { saved = null; } }, async (path: any, init: any) => {
    calls.push({ path, method: init.method, body: JSON.parse(init.body), headers: init.headers });
    if (path.includes('/logout')) return new Response(null, { status: 204 });
    if (path.includes('/rpc/')) return new Response(JSON.stringify({ profile: { id: 'a', name: 'Lou.B' } }), { status: 200 });
    return new Response(JSON.stringify(path.includes('/token') ? { access_token: 'access', refresh_token: 'refresh', expires_in: 3600, user: { id: 'a', email: 'ancien@example.com' } } : {}), { status: 200 });
  });
  const link = { redirectTo: 'https://flemme.org/app.html', codeChallenge: 'empreinte' };
  await g.recover(' ancien@example.com ', link);
  assert.equal(calls[0].path, 'https://example.supabase.co/auth/v1/recover?redirect_to=https%3A%2F%2Fflemme.org%2Fapp.html');
  assert.deepEqual(calls[0].body, { email: 'ancien@example.com', code_challenge: 'empreinte', code_challenge_method: 's256' });
  await g.signup('nouveau@example.com', 'un-long-mot-de-passe', link);
  assert.equal(calls[1].body.code_challenge, 'empreinte');
  await g.exchangeCode('code', 'secret');
  assert.deepEqual(calls[2].body, { auth_code: 'code', code_verifier: 'secret' });
  assert.equal(saved, 'refresh'); assert.equal(g.actor.id, 'a');
  // Le nom affiché vient du profil serveur (pseudo de l'ancien espace repris).
  assert.equal(calls[3].body.p_action, 'me'); assert.equal(g.actor.name, 'Lou.B');
  await g.setPassword('un-long-mot-de-passe');
  assert.equal(calls[4].method, 'PUT'); assert.equal(calls[4].headers.Authorization, 'Bearer access');
  await g.logout(); // Réponse 204 vide : pas d’erreur affichée.
  assert.equal(saved, null);
  await g.signup('x@example.com', 'un-long-mot-de-passe');
  assert.equal(calls[6].path, 'https://example.supabase.co/auth/v1/signup'); assert.equal(calls[6].body.code_challenge, undefined);
});
test('erreurs Supabase Auth traduites, clé service_role refusée', async () => {
  const storage = { get: async () => null, set: async () => {}, clear: async () => {} };
  const g = new RemoteGateway('https://example.supabase.co', 'public', storage, async () => new Response(JSON.stringify({ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }), { status: 400 }));
  await assert.rejects(g.login('x', 'x'), /E-mail ou mot de passe incorrect/);
  const serviceRole = 'eyJhbGciOiJIUzI1NiJ9.' + btoa(JSON.stringify({ role: 'service_role' })).replace(/=+$/, '') + '.s';
  assert.throws(() => new RemoteGateway('https://example.com', serviceRole, storage));
});
