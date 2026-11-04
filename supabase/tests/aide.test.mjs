// Tests du lot 4 (20261104150000_flemme_v2_fichiers_aide.sql) sur PGlite : pièces jointes, photo de profil, aide humaine.
// Un faux schéma storage (buckets, objects) vérifie le bucket privé et les règles d'accès aux fichiers.
// Lancer : cd supabase/tests && npm ci && npm test
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
async function as(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{}',false)", [id || '']);
  await db.exec('set role authenticated');
}
const api = async (action, task = null, data = {}, request = randomUUID()) =>
  (await db.query('select public.flemme_mobile_api($1,$2,$3::jsonb,$4) as data', [action, task, JSON.stringify(data), request])).rows[0].data;
const adm = async (action, data = {}) => (await db.query('select public.flemme_admin_api($1,$2::jsonb) as data', [action, JSON.stringify(data)])).rows[0].data;
const put = path => db.query("insert into storage.objects(bucket_id, name) values ('flemme-fichiers', $1)", [path]);
const seen = async path => (await db.query("select count(*)::int n from storage.objects where bucket_id = 'flemme-fichiers' and name = $1", [path])).rows[0].n;

// 0. Bucket privé, 10 Mo, formats acceptés.
const bucket = (await db.query("select * from storage.buckets where id = 'flemme-fichiers'")).rows[0];
assert.equal(bucket.public, false); assert.equal(Number(bucket.file_size_limit), 10485760); assert.equal(bucket.allowed_mime_types.length, 5);

// 1. Pièces jointes : déposant et Brigadier retenu seulement.
await as(owner);
const t = (await api('create', null, { title: 'Classer mes papiers', details: 'Deux classeurs', place: 'Aix', budget: 3000 })).task;
const pdf = { name: 'facture.pdf', mime: 'application/pdf', size: 120000 };
await assert.rejects(api('file_prepare', t.id, { ...pdf, mime: 'application/zip' }), /PDF, JPEG, PNG ou Word/);
await assert.rejects(api('file_prepare', t.id, { ...pdf, size: 10485761 }), /10 Mo/);
await assert.rejects(api('file_prepare', t.id, { ...pdf, size: '12' }), /10 Mo/);
const f1 = (await api('file_prepare', t.id, pdf)).file;
assert.match(f1.path, new RegExp(`^${owner}/[0-9a-f-]+\\.pdf$`)); assert.equal(f1.name, 'facture.pdf');
await put(f1.path);
await assert.rejects(put(owner + '/inconnu.pdf'), /row-level security/); // non déclaré
await as(brigadier);
await assert.rejects(api('file_prepare', t.id, pdf), /réservées/);
await assert.rejects(api('file_list', t.id), /réservées/);
assert.equal(await seen(f1.path), 0);
const offerId = (await api('offer', t.id, { amount: 3000, slot: 'Lundi', scope: 'Tout' })).task.offers[0].id;
await as(owner);
await api('accept', t.id, { offerId });
await as(brigadier);
assert.equal(await seen(f1.path), 1);
assert.deepEqual((await api('file_list', t.id)).files.map(f => f.name), ['facture.pdf']);
const f2 = (await api('file_prepare', t.id, { name: 'devis.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 5000 })).file;
await put(f2.path);
await assert.rejects(api('file_delete', null, { id: f1.id }), /introuvable/); // pas le sien
await as(other);
assert.equal(await seen(f1.path), 0);
await assert.rejects(put(f2.path), /row-level security/);
await as(owner);
assert.equal((await api('file_list', t.id)).files.length, 2);
assert.equal((await api('file_delete', null, { id: f1.id })).path, f1.path);
assert.equal(await seen(f1.path), 0); // déclaration supprimée : plus lisible

// 2. Photo de profil : JPEG ou PNG, visible de tous les membres, remplace l'ancienne.
await assert.rejects(api('file_prepare', null, { ...pdf }), /JPEG ou PNG/);
const a1 = await api('file_prepare', null, { name: 'moi.jpg', mime: 'image/jpeg', size: 80000 });
assert.equal(a1.previous, null);
await put(a1.file.path);
const a2 = await api('file_prepare', null, { name: 'moi2.png', mime: 'image/png', size: 90000 });
assert.equal(a2.previous.path, a1.file.path);
await put(a2.file.path);
assert.equal((await api('file_delete', null, { id: a2.previous.id })).path, a1.file.path);
await as(other);
assert.equal((await api('profile_get', null, { userId: owner })).profile.avatar, a2.file.path);
assert.equal(await seen(a2.file.path), 1); assert.equal(await seen(a1.file.path), 0);

// 3. Aide humaine : envoi idempotent, alerte, réponse de l'équipe visible du membre.
const req = randomUUID();
await assert.rejects(api('help_send', null, { topic: 'meteo', text: 'x' }), /Sujet invalide/);
await assert.rejects(api('help_send', null, { topic: 'mission', text: 'x', taskId: t.id }), /Flemme introuvable/);
const h = (await api('help_send', null, { topic: 'compte', text: 'Je ne reçois pas l’e-mail de confirmation' }, req)).request;
assert.equal((await api('help_send', null, { topic: 'compte', text: 'Je ne reçois pas l’e-mail de confirmation' }, req)).request.id, h.id);
assert.equal(h.status, 'open');
await as(brigadier);
await api('help_send', null, { topic: 'mission', text: 'Question sur la mission', taskId: t.id });
assert.equal((await api('help_list')).requests.length, 1);
await as(other);
await assert.rejects(adm('help_queue'), /réservé/);
await as(admin);
const queue = (await adm('help_queue')).requests;
assert.equal(queue.length, 2); assert.ok(queue.some(r => r.email === emails.other && r.text.includes('confirmation')));
assert.equal(queue.find(r => r.topic === 'mission').title, 'Classer mes papiers');
await assert.rejects(adm('help_answer', { id: h.id }), /./);
await adm('help_answer', { id: h.id, answer: 'Regarde dans tes indésirables, puis redemande un lien.' });
await as(other);
const mine = (await api('help_list')).requests[0];
assert.equal(mine.status, 'answered'); assert.match(mine.answer, /indésirables/);
for (let i = 0; i < 5; i++) await api('help_send', null, { topic: 'autre', text: 'Relance ' + i }).catch(e => e);
await assert.rejects(api('help_send', null, { topic: 'autre', text: 'Encore' }), /5 demandes en attente/);
await db.exec('reset role');
assert.ok((await db.query("select count(*)::int n from flemme_v2.alerts where kind = 'help' and task_id is null")).rows[0].n >= 1);
assert.deepEqual((await db.query("select action from flemme_v2.admin_log order by id")).rows.map(r => r.action), ['help_answered']);

await db.close();
console.log('OK SQL fichiers et aide : bucket privé 10 Mo, formats, pièces jointes réservées aux deux parties, règles Storage, photo de profil, aide humaine idempotente, réponse de l’équipe, limite de relances.');
