// Registre et résolution des feature flags (src/flags.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLES, FLAGS, environnementDepuis, estActif, lireLignes, resoudreFlags } from '../src/flags.ts';

test('chaque clé suit domaine.fonction et chaque variante a des valeurs', () => {
  for (const k of CLES) {
    assert.match(k, /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/, k);
    const def: { valeurs?: readonly string[]; type: string } = FLAGS[k];
    assert.equal(def.type === 'variante', !!def.valeurs?.length, k);
  }
});

test('environnement de build : branches persistantes, aperçu = preprod, poste local = local', () => {
  assert.equal(environnementDepuis('prod', 'production'), 'prod');
  assert.equal(environnementDepuis('beta', 'branch-deploy'), 'beta');
  assert.equal(environnementDepuis('feature/x', 'deploy-preview'), 'preprod');
  assert.equal(environnementDepuis('', ''), 'local');
});

test('testeurs : actif seulement avec l’accès bêta', () => {
  assert.equal(estActif('tous', false), true);
  assert.equal(estActif('testeurs', false), false);
  assert.equal(estActif('testeurs', true), true);
  assert.equal(estActif('off', true), false);
});

test('sans base : le registre s’applique ; la base l’emporte ; lignes inconnues ignorées', () => {
  const defaut = resoudreFlags('prod', null, false);
  assert.equal(defaut['formulaires.resoudre'].etat, 'off');
  assert.equal(defaut['formulaires.deleguer'].actif, true);
  assert.equal(defaut['design.theme'].valeur, 'clair');
  const base = resoudreFlags('prod', [
    { key: 'formulaires.deleguer', state: 'off', value: null },
    { key: 'formulaires.resoudre', state: 'testeurs', value: null },
    { key: 'design.theme', state: 'tous', value: 'nuit' },
    { key: 'navigation.style', state: 'tous', value: 'inconnue' },
    { key: 'inconnu.flag', state: 'tous', value: null },
    { key: 'espace.aide', state: 'peut-etre' as never, value: null },
  ], true);
  assert.equal(base['formulaires.deleguer'].actif, false);
  assert.equal(base['formulaires.resoudre'].actif, true);
  assert.equal(base['design.theme'].valeur, 'nuit');
  assert.equal(base['navigation.style'].valeur, 'burger', 'valeur hors liste : première valeur');
  assert.equal(base['espace.aide'].source, 'registre');
  assert.ok(!('inconnu.flag' in base));
});

test('lecture : appel public sans session, repli null si erreur', async () => {
  let appel: { url: string; body: string } | null = null;
  const ok = (async (url: string, init: RequestInit) => { appel = { url, body: String(init.body) }; return new Response(JSON.stringify({ flags: [{ key: 'espace.aide', state: 'off', value: null }] })); }) as unknown as typeof fetch;
  assert.deepEqual(await lireLignes('https://x.supabase.co/', 'sb_publishable_x', 'beta', ok), [{ key: 'espace.aide', state: 'off', value: null }]);
  assert.equal(appel!.url, 'https://x.supabase.co/rest/v1/rpc/flemme_flags');
  assert.deepEqual(JSON.parse(appel!.body), { p_environment: 'beta' });
  assert.equal(await lireLignes('https://x.supabase.co', 'k', 'prod', (async () => new Response('', { status: 404 })) as unknown as typeof fetch), null);
  assert.equal(await lireLignes('https://x.supabase.co', 'k', 'prod', (async () => { throw new Error('réseau'); }) as unknown as typeof fetch), null);
  assert.equal(await lireLignes('', '', 'prod'), null);
});
