// Tests de la migration admin et alertes (20261103130000_flemme_v2_admin.sql) sur PGlite.
// Pas de pg_net ni de Vault ici : les alertes doivent rester en file avec une erreur, sans bloquer le membre.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const { PGlite } = await import(process.env.PGLITE_MODULE_URL || '@electric-sql/pglite');

async function setup(withOwner) {
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
  const ids = { admin: randomUUID(), owner: randomUUID(), brigadier: randomUUID(), other: randomUUID() };
  const emails = { admin: 'Ben.Champly@gmail.com', owner: 'deposant@example.org', brigadier: 'brigadier@example.org', other: 'ancien-espace@example.org' };
  for (const k of Object.keys(ids)) if (withOwner || k !== 'admin')
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [ids[k], emails[k]]);
  const dir = new URL('../migrations/', import.meta.url);
  for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, dir), 'utf8'));
  // Ces tests portent sur le contrat d'origine : la validation des demandes (parcours.test.mjs) est coupée.
  await db.exec('update flemme_v2.settings set moderation_tasks = false');
  return { db, ids };
}

// Projet sans le compte du propriétaire : la migration passe, personne n'est admin.
{
  const { db, ids } = await setup(false);
  assert.equal((await db.query('select count(*)::int as n from flemme_v2.admins')).rows[0].n, 0);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids.owner]); await db.exec('set role authenticated');
  await assert.rejects(db.query("select public.flemme_admin_api('overview')"), /réservé/);
  await db.close();
}

const { db, ids } = await setup(true);
const { admin, owner, brigadier, other } = ids;
async function as(id, claims = {}) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)", [id || '', JSON.stringify(claims)]);
  await db.exec('set role authenticated');
}
const api = async (action, task = null, data = {}) => (await db.query('select public.flemme_mobile_api($1,$2,$3::jsonb,$4) as data', [action, task, JSON.stringify(data), randomUUID()])).rows[0].data;
const adm = async (action, data = {}) => (await db.query('select public.flemme_admin_api($1,$2::jsonb) as data', [action, JSON.stringify(data)])).rows[0].data;

// Accès : seul l'administrateur confirmé passe ; aucun accès direct aux tables.
for (const id of [owner, null]) { await as(id); await assert.rejects(adm('overview'), /réservé/); }
await as(admin, { is_anonymous: true }); await assert.rejects(adm('overview'), /réservé/);
await db.exec('reset role; set role anon'); await assert.rejects(adm('overview'), /permission denied/);
await as(owner);
await assert.rejects(db.query('select * from flemme_v2.alerts'), /permission denied/);
await assert.rejects(db.query('insert into flemme_v2.admins values($1)', [owner]), /permission denied/);

// Parcours membre : publication, accord, signalement. Chaque étape crée une alerte, même sans pg_net.
let t = (await api('create', null, { title: 'Monter une étagère', details: 'Deux vis', place: 'Aix', budget: 3000 })).task;
await as(brigadier);
const offerId = (await api('offer', t.id, { amount: 3000, slot: 'Samedi', scope: 'Montage' })).task.offers[0].id;
await as(owner);
await api('message', t.id, { offerId, text: 'Pas d’alerte pour un message' });
await api('accept', t.id, { offerId });
await api('report', t.id, { text: 'Le Brigadier n’est pas venu' });

await as(admin);
const alerts = (await adm('alerts')).alerts;
assert.deepEqual(alerts.map(a => a.kind), ['report', 'agreement', 'task_created']);
assert.ok(alerts.every(a => /vault|decrypted_secrets/i.test(a.error) && !a.dispatchedAt), 'sans pg_net/Vault : erreur notée, rien de perdu');
assert.equal(alerts[0].payload.text, 'Le Brigadier n’est pas venu');
assert.equal(alerts[0].payload.actor, 'deposant'); assert.equal(alerts[0].payload.brigadier, 'brigadier');
assert.deepEqual([alerts[1].payload.amount, alerts[1].payload.commission], [3000, 300]);
assert.ok((await adm('alert_retry', { id: alerts[0].id })).alert.error);

let overview = await adm('overview');
assert.deepEqual(overview.tasks, { open: 0, assigned: 1, completed: 0 });
assert.deepEqual(overview.disputes, { open: 1, in_review: 0, resolved: 0 });
assert.equal(overview.users, 4); assert.equal(overview.alertErrors, 3);

const reports = (await adm('reports')).reports;
assert.equal(reports.length, 1); assert.equal(reports[0].disputeStatus, 'open'); assert.equal(reports[0].actor.id, owner);

// Litige : prise en charge, puis clôture avec une note visible des deux participants.
await adm('dispute_update', { taskId: t.id, status: 'in_review' });
await assert.rejects(adm('dispute_update', { taskId: t.id, status: 'resolved' }), /Texte requis/);
await assert.rejects(adm('dispute_update', { taskId: t.id, status: 'supprimé' }), /invalide/);
await assert.rejects(adm('dispute_update', { taskId: 'pas-un-uuid', status: 'in_review' }), /Identifiant invalide/);
await adm('dispute_update', { taskId: t.id, status: 'resolved', note: 'Nouveau créneau convenu avec les deux parties' });
const dispute = (await adm('disputes')).disputes[0];
assert.equal(dispute.status, 'resolved'); assert.equal(dispute.updatedBy, 'Ben.Champly@gmail.com');
assert.equal(dispute.task.agreement.amount, 3000); assert.equal(dispute.task.reports.length, 1);
await as(brigadier);
t = (await api('list')).tasks.find(x => x.id === t.id);
assert.match(t.history.at(-1).text, /Litige clos par l'équipe FLEMME : Nouveau créneau/);
// Un nouveau signalement rouvre le litige clos.
await api('report', t.id, { text: 'Toujours pas réglé' });
await as(admin);
assert.equal((await adm('disputes')).disputes[0].status, 'open');

// Utilisateurs : tous les comptes du projet, compteurs, suspension.
let users = (await adm('users')).users;
const row = id => users.find(u => u.id === id);
assert.equal(users.length, 4);
assert.equal(row(admin).admin, true); assert.equal(row(owner).displayName, 'deposant');
assert.deepEqual([row(owner).tasks, row(owner).reports, row(brigadier).offers, row(brigadier).missions, row(brigadier).reports], [1, 1, 1, 1, 1]);
assert.equal(row(other).tasks, 0);
await assert.rejects(adm('user_suspend', { userId: admin, reason: 'Test' }), /administrateur/);
await assert.rejects(adm('user_suspend', { userId: other }), /Texte requis/);
await adm('user_suspend', { userId: other, reason: 'Annonces frauduleuses' });
users = (await adm('users')).users;
assert.equal(row(other).suspendedReason, 'Annonces frauduleuses');
await as(other);
await assert.rejects(api('create', null, { title: 'Spam', details: 'Spam', place: 'Partout', budget: null }), /Compte suspendu/);
assert.ok(Array.isArray((await api('list')).tasks), 'la lecture reste possible');
await as(admin);
await adm('user_restore', { userId: other });
await assert.rejects(adm('user_restore', { userId: other }), /pas suspendu/);
await as(other);
await api('create', null, { title: 'Courses', details: 'Un sac', place: 'Aix', budget: null });

await as(admin);
overview = await adm('overview');
assert.deepEqual(overview.log.map(l => l.action), ['user_restore', 'user_suspend', 'dispute_resolved', 'dispute_in_review']);
await assert.rejects(adm('supprimer_tout'), /Action inconnue/);
await db.exec('reset role');
const rls = await db.query("select relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='flemme_v2' and relkind='r'");
assert.ok(rls.rows.every(r => r.relrowsecurity));
await db.close();
console.log('OK SQL admin : accès réservé, alertes en file sans blocage, signalements, litiges (prise en charge, clôture, réouverture), utilisateurs, suspension et journal.');
