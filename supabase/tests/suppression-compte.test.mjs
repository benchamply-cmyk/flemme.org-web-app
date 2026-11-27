// Tests de la suppression du compte par le membre (20261127140000_flemme_v2_suppression_compte.sql) sur PGlite.
// Faux schéma storage comme aide.test.mjs. Lancer : cd supabase/tests && npm ci && npm test
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
  'grant execute on function auth.uid(),auth.jwt() to authenticated;',
  'create schema storage; grant usage on schema storage to authenticated;',
  'create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);',
  'create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);',
  'alter table storage.objects enable row level security;',
  'grant select, insert, delete on storage.objects to authenticated;',
].join('\n'));
const ids = { admin: randomUUID(), owner: randomUUID(), brigadier: randomUUID(), other: randomUUID() };
const emails = { admin: 'ben.champly@gmail.com', owner: 'flemmard@example.org', brigadier: 'brigadier@example.org', other: 'autre@example.org' };
for (const k of Object.keys(ids)) await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [ids[k], emails[k]]);
const dir = new URL('../migrations/', import.meta.url);
for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, dir), 'utf8'));
await db.exec('update flemme_v2.settings set moderation_tasks = false, moderation_offers = false, moderation_agreements = false');
const { admin, owner, brigadier, other } = ids;
async function as(id, claims = {}) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)", [id || '', JSON.stringify(claims)]);
  await db.exec('set role authenticated');
}
const api = async (action, task = null, data = {}) =>
  (await db.query('select public.flemme_mobile_api($1,$2,$3::jsonb,$4) as data', [action, task, JSON.stringify(data), randomUUID()])).rows[0].data;
const fichiers = async () => (await db.query('select public.flemme_compte_fichiers() as data')).rows[0].data.paths;
const supprimer = async (mot = 'SUPPRIMER') => (await db.query('select public.flemme_supprimer_compte($1) as data', [mot])).rows[0].data;
const exists = async id => { await db.exec('reset role'); return (await db.query('select count(*)::int n from auth.users where id = $1', [id])).rows[0].n === 1; };

// 0. Anonyme ou non connecté : refusé. anon n'a pas le droit d'exécuter.
await as('');
await assert.rejects(supprimer(), /Connectez-vous/);
await as(owner, { is_anonymous: true });
await assert.rejects(supprimer(), /Connectez-vous/);
await db.exec('reset role'); await db.exec('set role anon');
await assert.rejects(supprimer(), /permission denied/);

// 1. Le membre prépare des données : flemme, brouillon, recherche, aide, photo.
await as(owner);
const t = (await api('create', null, { title: 'Classer mes papiers', details: 'Deux classeurs', place: 'Aix', budget: 3000 })).task;
await api('draft_save', null, { id: randomUUID(), kind: 'task', fields: { title: 'Brouillon' } });
await api('search_save', null, { id: randomUUID(), filter: { q: 'cv' }, label: 'cv' });
await api('help_send', null, { topic: 'compte', text: 'Question' });
const photo = (await api('file_prepare', null, { name: 'moi.jpg', mime: 'image/jpeg', size: 80000 })).file;
await db.query("insert into storage.objects(bucket_id, name) values ('flemme-fichiers', $1)", [photo.path]);

// 2. Confirmation obligatoire ; fichiers encore dans le bucket : refusé.
await assert.rejects(supprimer('oui'), /SUPPRIMER/);
await assert.rejects(supprimer(), /fichiers/);
assert.deepEqual(await fichiers(), [photo.path]);

// 3. Mission en cours (déposant ou Brigadier retenu) : refusé.
await as(brigadier);
const offerId = (await api('offer', t.id, { amount: 3000, slot: 'Lundi', scope: 'Tout' })).task.offers[0].id;
await as(owner);
await api('accept', t.id, { offerId });
await db.query("delete from storage.objects where bucket_id = 'flemme-fichiers' and name = $1", [photo.path]); // ce que fait l'app par l'API Storage
await assert.rejects(supprimer(), /mission est en cours/);
await as(brigadier);
await assert.rejects(supprimer(), /mission est en cours/);

// 4. Compte de l'équipe : refusé.
await as(admin);
await assert.rejects(supprimer(), /équipe/);
assert.ok(await exists(admin));

// 5. Mission terminée : la suppression passe et emporte les données du membre ; le Brigadier reste.
await db.exec('reset role');
await db.query("update flemme_v2.tasks set status = 'completed' where id = $1", [t.id]);
await as(owner);
assert.deepEqual(await supprimer(), { ok: true });
assert.equal(await exists(owner), false);
for (const table of ['profiles', 'drafts', 'saved_searches', 'help_requests', 'files']) {
  const col = table === 'profiles' || table === 'help_requests' ? 'user_id' : 'owner_id';
  assert.equal((await db.query(`select count(*)::int n from flemme_v2.${table} where ${col} = $1`, [owner])).rows[0].n, 0, table);
}
assert.equal((await db.query('select count(*)::int n from flemme_v2.tasks where id = $1', [t.id])).rows[0].n, 0, 'flemmes supprimées');
assert.ok(await exists(brigadier));

// 6. Pré-bêta allumée : la suppression reste permise.
await db.query("insert into flemme_v2.feature_flags(key, environment, state) values ('espace.pre_beta', 'prod', 'tous') on conflict do nothing");
await as(other);
assert.deepEqual(await supprimer(), { ok: true });
assert.equal(await exists(other), false);

console.log('suppression-compte : ok');
