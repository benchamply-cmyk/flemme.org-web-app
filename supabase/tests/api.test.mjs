// Tests des migrations supabase/migrations sur un Postgres en mémoire (PGlite), avec un faux schéma auth.
// Lancer : cd supabase/tests && npm ci && npm test
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const { PGlite } = await import(process.env.PGLITE_MODULE_URL || '@electric-sql/pglite');
const db = new PGlite();
await db.exec([
  'create role anon; create role authenticated;',
  'create schema auth;',
  'create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb, email_confirmed_at timestamptz);',
  "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
  "create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;",
  'grant usage on schema auth to authenticated;',
  'grant execute on function auth.uid(),auth.jwt() to authenticated;',
  // Ancien espace client (FlemmeV2.0/supabase/espace.sql) : ses pseudos doivent être repris.
  'create table public.profils(user_id uuid primary key references auth.users(id) on delete cascade, pseudo text not null);'
].join('\n'));

const users = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const addUser = (id, email, meta, confirmed = true) =>
  db.query('insert into auth.users values($1,$2,$3,$4)', [id, email, meta ? JSON.stringify(meta) : null, confirmed ? new Date() : null]);
// Comptes déjà présents avant la migration.
await addUser(users[0], 'benjamin@example.com', null);
await addUser(users[1], 'lou@example.com', { pseudo: 'lou_b' });
await db.query("insert into public.profils values($1,'Lou.B')", [users[1]]);

const dir = new URL('../migrations/', import.meta.url);
for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) {
  await db.exec(await readFile(new URL(file, dir), 'utf8'));
}
// Comptes créés après : le déclencheur crée le profil.
await addUser(users[2], 'camille@example.com', { display_name: '  Camille  ' });
await addUser(users[3], 'pas-confirme@example.com', null, false);

async function actor(id, claims = {}) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)", [id || '', JSON.stringify(claims)]);
  await db.exec('set role authenticated');
}
async function api(action, task = null, data = {}, request = randomUUID()) {
  return (await db.query('select public.flemme_mobile_api($1,$2,$3::jsonb,$4) as data', [action, task, JSON.stringify(data), request])).rows[0].data;
}

// Authentification.
await actor(users[3]); await assert.rejects(api('list'), /compte confirmé/);
await actor(users[0], { is_anonymous: true }); await assert.rejects(api('list'), /compte confirmé/);
await actor(null); await assert.rejects(api('list'), /compte confirmé/);

// Profils : reprise, déclencheur, nom décidé par le serveur.
await actor(users[0]); assert.deepEqual((await api('me')).profile, { id: users[0], name: 'benjamin' });
await actor(users[1]); assert.equal((await api('me')).profile.name, 'Lou.B');
await actor(users[2]); assert.equal((await api('me')).profile.name, 'Camille');
await assert.rejects(api('update_profile', null, { displayName: '   ' }), /Texte invalide/);
await assert.rejects(api('update_profile', null, { displayName: 'x'.repeat(41) }), /Texte invalide/);
assert.equal((await api('update_profile', null, { displayName: ' Cam ' })).profile.name, 'Cam');

// Création, idempotence, nom usurpé ignoré.
await actor(users[0]);
const request = randomUUID(), payload = { title: 'Un meuble', details: 'Un montage simple', place: 'Aix', budget: null, actorName: 'Usurpateur' };
const created = (await api('create', null, payload, request)).task;
assert.equal(created.status, 'open'); assert.equal(created.budget, null);
assert.equal(created.owner.name, 'benjamin');
assert.equal((await api('create', null, payload, request)).task.id, created.id);
await assert.rejects(api('create', null, { ...payload, title: 'Autre' }, request), /Identifiant déjà utilisé/);
await assert.rejects(api('create', null, { ...payload, budget: 12.5 }), /Montant invalide/);
for (const table of ['tasks', 'offers', 'messages', 'events', 'profiles', 'requests']) {
  await assert.rejects(db.query(`select * from flemme_v2.${table}`), /permission denied/);
}
await assert.rejects(db.query("update flemme_v2.tasks set status='completed'"), /permission denied/);
await assert.rejects(db.query("select flemme_v2.task_json($1,$2)", [created.id, users[0]]), /permission denied/);
await assert.rejects(api('offer', created.id, { amount: 4000, slot: 'Samedi', scope: 'Inclus' }), /indisponible/);

// Propositions et discussions privées.
await actor(users[1]);
let t = (await api('offer', created.id, { amount: 4005, slot: 'Samedi', scope: 'Déplacement inclus' })).task;
const offerId = t.offers[0].id;
assert.equal(t.offers[0].brigadier.name, 'Lou.B');
await assert.rejects(api('offer', created.id, { amount: 4000, slot: 'Samedi', scope: 'Encore' }), /déjà en attente/);
await api('message', t.id, { offerId, text: 'Message privé' });
await assert.rejects(api('accept', t.id, { offerId }), /indisponible/);
await assert.rejects(api('accept', t.id, { offerId: 'pas-un-uuid' }), /introuvable/);
await actor(users[2]);
assert.equal((await api('list')).tasks[0].offers.length, 0);
await assert.rejects(api('message', t.id, { offerId, text: 'Intrusion' }), /inaccessible/);
const second = (await api('offer', t.id, { amount: 3000, slot: 'Lundi', scope: 'Autre forfait' })).task.offers[0].id;

// Accord : prix et commission calculés par le serveur.
await actor(users[0]);
assert.equal((await api('list')).tasks[0].offers.length, 2);
const acceptRequest = randomUUID();
t = (await api('accept', t.id, { offerId, commission: 0, total: 1 }, acceptRequest)).task;
assert.deepEqual([t.agreement.amount, t.agreement.commission, t.agreement.total], [4005, 401, 4406]);
assert.equal(t.agreement.brigadier.name, 'Lou.B'); assert.equal(t.acceptedOfferId, offerId);
assert.equal(t.offers[1].status, 'not_selected'); assert.equal(t.offers[0].messages[0].text, 'Message privé');
assert.equal(t.offers[0].messages[0].actor.name, 'Lou.B');
await api('accept', t.id, { offerId, commission: 0, total: 1 }, acceptRequest);
await assert.rejects(api('accept', t.id, { offerId: second }), /indisponible/);
await assert.rejects(api('declare_payment', t.id), /non autorisée/);
await api('complete', t.id); await api('declare_payment', t.id);

// Un Brigadier non retenu ne voit ni l'accord ni les paiements.
await actor(users[2]);
await assert.rejects(api('confirm_payment', t.id), /non autorisée/);
await assert.rejects(api('report', t.id, { text: 'Intrusion' }), /inaccessible/);
const seen = (await api('list')).tasks[0];
assert.equal(seen.agreement, undefined); assert.equal(seen.paymentDeclared, undefined); assert.equal(seen.offers.length, 1);
await actor(users[1]);
t = (await api('confirm_payment', t.id)).task;
assert.equal(t.paymentConfirmed, true);
await api('report', t.id, { text: 'Un problème à examiner' });
await actor(users[0]);
t = (await api('list')).tasks[0];
assert.equal(t.reports.length, 1); assert.equal(t.reports[0].actor.name, 'Lou.B'); assert.equal(t.history.length, 9);

// Pagination : ordre stable, aucune flemme sautée ni répétée.
for (let i = 0; i < 24; i++) await api('create', null, { title: 'Flemme ' + i, details: 'Détail', place: 'Aix' });
await actor(users[2]);
const pages = []; let cursor = null;
do {
  const page = await api('list', null, { limit: 10, cursor });
  assert.ok(page.tasks.length <= 10);
  pages.push(...page.tasks); cursor = page.nextCursor;
} while (cursor);
// 24 flemmes ouvertes + la flemme terminée où Camille a proposé.
assert.equal(pages.length, 25); assert.equal(new Set(pages.map(p => p.id)).size, 25);
assert.equal((await api('list')).tasks.length, 20);
assert.equal((await api('list', null, { limit: 100 })).nextCursor, null);
await assert.rejects(api('list', null, { limit: 101 }), /Taille de page invalide/);
await assert.rejects(api('list', null, { limit: 0 }), /invalide/);
await assert.rejects(api('list', null, { cursor: 'nimporte|quoi' }), /Curseur invalide/);

// Accès anonyme et RLS.
await db.exec('reset role; set role anon');
await assert.rejects(api('list'), /permission denied/);
await db.exec('reset role');
const rls = await db.query("select relname, relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='flemme_v2' and relkind='r'");
assert.equal(rls.rows.length, 11); // 6 tables V2 + 5 tables admin (admins, disputes, suspensions, admin_log, alerts)
assert.ok(rls.rows.every(r => r.relrowsecurity));

// Suppression d'un compte : ses flemmes partent, ses messages restent signés « Compte supprimé ».
await db.query('delete from auth.users where id=$1', [users[1]]);
await actor(users[0]);
t = (await api('list', null, { limit: 100 })).tasks.find(x => x.id === created.id);
assert.equal(t.offers[0].brigadier.name, 'Compte supprimé'); assert.equal(t.offers[0].brigadier.id, null);
await db.exec('reset role');
await db.close();
console.log('OK SQL : migrations, profils (reprise ancien espace, déclencheur, nom serveur), authentification, RLS, confidentialité, prix serveur, commission arrondie, attribution unique, idempotence, paiements déclaratifs, historique, pagination, suppression de compte.');
