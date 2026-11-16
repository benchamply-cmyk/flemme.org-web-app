// Tests de la migration feature flags (20261116120000_flemme_v2_feature_flags.sql) sur PGlite.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const { PGlite } = await import(process.env.PGLITE_MODULE_URL || '@electric-sql/pglite');

const db = new PGlite();
await db.exec([
  'create role anon; create role authenticated; create role service_role;',
  'create schema auth;',
  'create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb, email_confirmed_at timestamptz, created_at timestamptz default now(), last_sign_in_at timestamptz);',
  "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
  "create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;",
  'grant usage on schema auth to authenticated;',
  'grant execute on function auth.uid(),auth.jwt() to authenticated;'
].join('\n'));
const admin = randomUUID(), owner = randomUUID();
await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,$4,now())', [admin, 'Ben.Champly@gmail.com', owner, 'deposant@example.org']);
const dir = new URL('../migrations/', import.meta.url);
for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, dir), 'utf8'));
await db.exec('update flemme_v2.settings set moderation_tasks = false, moderation_offers = false, moderation_agreements = false');

async function as(id, claims = {}) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)", [id || '', JSON.stringify(claims)]);
  await db.exec('set role authenticated');
}
const api = async (action, task = null, data = {}) => (await db.query('select public.flemme_mobile_api($1,$2,$3::jsonb,$4) as data', [action, task, JSON.stringify(data), randomUUID()])).rows[0].data;
const adm = async (action, data = {}) => (await db.query('select public.flemme_admin_api($1,$2::jsonb) as data', [action, JSON.stringify(data)])).rows[0].data;
const lire = async env => (await db.query('select public.flemme_flags($1) as data', [env])).rows[0].data;
const demande = { title: 'Monter une étagère', details: 'Deux vis', place: 'Aix', budget: 3000 };

// Lecture publique : un visiteur anonyme lit l'état, sans l'auteur ; table vide = registre.
await db.exec('reset role; set role anon');
assert.deepEqual(await lire('prod'), { environment: 'prod', flags: [] });
await assert.rejects(db.query('select * from flemme_v2.feature_flags'), /permission denied/);
await assert.rejects(adm('flags'), /permission denied/);

// Seul un admin confirmé bascule ; un membre ne peut ni lire la liste admin ni écrire la table.
await as(owner);
await assert.rejects(adm('flag_set', { key: 'formulaires.deleguer', environment: 'prod', state: 'off' }), /réservé/);
await assert.rejects(db.query("insert into flemme_v2.feature_flags(key,environment,state) values('a.b','prod','off')"), /permission denied/);

await as(admin);
await assert.rejects(adm('flag_set', { key: 'Pas Une Clé', environment: 'prod', state: 'off' }), /Clé de flag invalide/);
await assert.rejects(adm('flag_set', { key: 'formulaires.deleguer', environment: 'staging', state: 'off' }), /Environnement invalide/);
await assert.rejects(adm('flag_set', { key: 'formulaires.deleguer', environment: 'prod', state: 'peut-etre' }), /État invalide/);
await adm('flag_set', { key: 'formulaires.deleguer', environment: 'prod', state: 'off' });
await adm('flag_set', { key: 'design.theme', environment: 'beta', state: 'tous', value: 'nuit' });
let liste = await adm('flags');
assert.equal(liste.serverEnvironment, 'prod');
assert.deepEqual(liste.flags.map(f => [f.key, f.environment, f.state, f.value, f.updatedBy]), [
  ['design.theme', 'beta', 'tous', 'nuit', 'Ben.Champly@gmail.com'], ['formulaires.deleguer', 'prod', 'off', null, 'Ben.Champly@gmail.com']]);
const journal = (await adm('overview')).log.map(l => [l.action, l.target]);
assert.deepEqual(journal.slice(0, 2), [['flag_set', 'design.theme'], ['flag_set', 'formulaires.deleguer']]);

// Chaque environnement lit sa colonne.
await db.exec('reset role; set role anon');
assert.deepEqual((await lire('beta')).flags, [{ key: 'design.theme', state: 'tous', value: 'nuit' }]);
assert.deepEqual((await lire('prod')).flags, [{ key: 'formulaires.deleguer', state: 'off', value: null }]);

// Garde serveur : formulaire « Déléguer » éteint en prod (environnement serveur) = nouvelle demande refusée.
await as(owner);
await assert.rejects(api('create', null, demande), /indisponible/);
// Un flag éteint dans un autre environnement ne bloque pas le serveur réglé sur prod.
await as(admin);
await adm('flag_set', { key: 'formulaires.deleguer', environment: 'prod', state: 'testeurs' });
await adm('flag_set', { key: 'formulaires.resoudre', environment: 'beta', state: 'off' });
await as(owner);
const t = (await api('create', null, demande)).task;
assert.ok(t.id);
// Parcours « Résoudre » éteint côté serveur : candidature refusée avant tout traitement.
await as(admin);
await adm('flag_set', { key: 'formulaires.resoudre', environment: 'prod', state: 'off' });
await as(owner);
await assert.rejects(api('apply', t.id, {}), /indisponible/);
// Retour au registre, et changement d'environnement serveur.
await as(admin);
await adm('flag_reset', { key: 'formulaires.resoudre', environment: 'prod' });
await assert.rejects(adm('flag_reset', { key: 'formulaires.resoudre', environment: 'prod' }), /suit déjà/);
await adm('flag_environment', { environment: 'beta' });
assert.equal((await adm('flags')).serverEnvironment, 'beta');
await as(owner);
await assert.rejects(api('apply', t.id, {}), /indisponible/, 'serveur réglé sur beta : le flag beta « off » s’applique');
await db.close();
console.log('flags.test.mjs : ok');
