// Tests de la migration recherches enregistrées (20261127130000_flemme_v2_recherches.sql) sur PGlite.
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
const ana = randomUUID(), bob = randomUUID(), nouveau = randomUUID();
await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,$4,now()),($5,$6,null)', [ana, 'ana@example.org', bob, 'bob@example.org', nouveau, 'nouveau@example.org']);
const dir = new URL('../migrations/', import.meta.url);
for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, dir), 'utf8'));

async function as(id, claims = {}) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)", [id || '', JSON.stringify(claims)]);
  await db.exec('set role authenticated');
}
const api = async (action, data = {}) => (await db.query('select public.flemme_mobile_api($1,null,$2::jsonb,null) as data', [action, JSON.stringify(data)])).rows[0].data;

// Compte non confirmé ou anonyme : refusé ; table jamais lisible directement.
await as(nouveau);
await assert.rejects(api('searches'), /compte confirmé/);
await as(ana, { is_anonymous: true });
await assert.rejects(api('searches'), /compte confirmé/);
await as(ana);
await assert.rejects(db.query('select * from flemme_v2.saved_searches'), /permission denied/);
assert.deepEqual((await api('searches')).searches, []);

// Enregistrement : filtres inconnus et tri retirés, textes coupés, même id = mise à jour sans doublon.
const id = randomUUID();
let s = (await api('search_save', { id, filter: { category: 'administratif', mode: 'distance', sort: 'prix', pirate: 'x', q: '  ' }, label: 'Administratif · à distance' })).search;
assert.deepEqual(s.filter, { category: 'administratif', mode: 'distance' });
assert.equal(s.label, 'Administratif · à distance');
s = (await api('search_save', { id, filter: { category: 'administratif' }, label: 'Administratif', seenAt: '2026-12-01T10:00:00Z' })).search;
assert.deepEqual(s.filter, { category: 'administratif' });
assert.equal(new Date(s.seenAt).toISOString(), '2026-12-01T10:00:00.000Z');
assert.equal((await api('searches')).searches.length, 1);
await assert.rejects(api('search_save', { id: randomUUID(), filter: 'tout' }), /Recherche invalide/);

// Cinq au plus par compte.
for (let i = 0; i < 4; i++) await api('search_save', { id: randomUUID(), filter: { q: 'cv ' + i }, label: 'cv ' + i });
await assert.rejects(api('search_save', { id: randomUUID(), filter: { q: 'de trop' }, label: 'de trop' }), /Cinq recherches au plus/);

// Un autre membre ne voit ni ne modifie ni ne supprime les recherches d'Ana.
await as(bob);
assert.deepEqual((await api('searches')).searches, []);
await assert.rejects(api('search_save', { id, filter: { q: 'vol' }, label: 'vol' }), /introuvable/);
await api('search_delete', { id });
await as(ana);
assert.equal((await api('searches')).searches.length, 5, 'suppression par un autre membre sans effet');
await api('search_delete', { id });
assert.equal((await api('searches')).searches.length, 4);

// Pré-bêta allumée : les recherches restent permises (seules les actions publiques sont bloquées).
await db.exec('reset role');
await db.query("insert into flemme_v2.feature_flags(key, environment, state) values ('espace.pre_beta', 'prod', 'tous')");
await as(ana);
assert.ok((await api('search_save', { id: randomUUID(), filter: { place: 'Lyon' }, label: 'Lyon' })).search.id);

// Suppression du compte : ses recherches partent avec lui.
await db.exec('reset role');
await db.query('delete from auth.users where id = $1', [ana]);
assert.equal((await db.query('select count(*)::int n from flemme_v2.saved_searches')).rows[0].n, 0);
await db.close();
console.log('recherches.test.mjs : ok');
