// Tests de la migration du parcours complet (20261104120000_flemme_v2_parcours.sql) sur PGlite.
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
  'grant execute on function auth.uid(),auth.jwt() to authenticated;'
].join('\n'));
const ids = { admin: randomUUID(), owner: randomUUID(), brigadier: randomUUID(), other: randomUUID() };
const emails = { admin: 'ben.champly@gmail.com', owner: 'flemmard@example.org', brigadier: 'brigadier@example.org', other: 'autre@example.org' };
for (const k of Object.keys(ids)) await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [ids[k], emails[k]]);

// Une flemme publiée avant la migration doit le rester.
const dir = new URL('../migrations/', import.meta.url);
const files = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort();
for (const file of files.filter(f => f < '20261104120000')) await db.exec(await readFile(new URL(file, dir), 'utf8'));
const old = randomUUID();
await db.query("insert into flemme_v2.tasks(id, owner_id, title, details, place) values($1,$2,'Ancienne flemme','Avant la validation','Aix')", [old, ids.other]);
for (const file of files.filter(f => f >= '20261104120000')) await db.exec(await readFile(new URL(file, dir), 'utf8'));

const { admin, owner, brigadier, other } = ids;
async function as(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{}',false)", [id || '']);
  await db.exec('set role authenticated');
}
const api = async (action, task = null, data = {}, request = randomUUID()) =>
  (await db.query('select public.flemme_mobile_api($1,$2,$3::jsonb,$4) as data', [action, task, JSON.stringify(data), request])).rows[0].data;
const adm = async (action, data = {}) => (await db.query('select public.flemme_admin_api($1,$2::jsonb) as data', [action, JSON.stringify(data)])).rows[0].data;
const listed = async id => (await api('list', null, { limit: 100 })).tasks.find(t => t.id === id);

// 1. Flemme existante : toujours publiée et visible.
await as(brigadier);
assert.equal((await listed(old)).title, 'Ancienne flemme');

// 2. Dépôt enrichi : contrôles serveur.
await as(owner);
const base = { title: 'Remettre mon CV au propre', details: 'Une page, contenu déjà rédigé.', category: 'administratif', deadline: '1_semaine', mode: 'distance' };
await assert.rejects(api('create', null, { ...base, budget: 4000, budgetRange: '10_50' }), /pas les deux/);
await assert.rejects(api('create', null, { ...base, deadline: 'autre' }), /Précise le délai/);
await assert.rejects(api('create', null, { ...base, mode: 'sur_place' }), /ville ou un secteur/);
await assert.rejects(api('create', null, { ...base, category: 'jardinage' }), /Catégorie invalide/);
await assert.rejects(api('create', null, { ...base, budgetRange: '1_000' }), /Fourchette invalide/);

// 3. Brouillons : enregistrés sur le compte, sans doublon, privés.
const draftId = randomUUID();
await api('draft_save', null, { id: draftId, kind: 'task', fields: { title: 'Brouillon' } });
await api('draft_save', null, { id: draftId, kind: 'task', fields: { title: 'Brouillon modifié' } });
let drafts = (await api('drafts')).drafts;
assert.equal(drafts.length, 1); assert.equal(drafts[0].fields.title, 'Brouillon modifié');
await as(other);
assert.equal((await api('drafts')).drafts.length, 0);
await assert.rejects(api('draft_save', null, { id: draftId, kind: 'task', fields: {} }), /introuvable/);
await api('draft_delete', null, { id: draftId }); // sans effet sur le brouillon d'un autre
await as(owner);
assert.equal((await api('drafts')).drafts.length, 1);
await assert.rejects(api('draft_save', null, { id: randomUUID(), kind: 'task', fields: 'texte' }), /Brouillon invalide/);
await assert.rejects(api('draft_save', null, { id: randomUUID(), kind: 'task', fields: { t: 'x'.repeat(9000) } }), /drafts_fields_check|violates/);

// 4. Envoi : privé jusqu'à validation, brouillon supprimé, adresse privée.
let t = (await api('create', null, { ...base, mode: 'sur_place', place: 'Lyon · Croix-Rousse', address: '3 rue des Pierres', budgetRange: '10_50', draftId })).task;
assert.equal(t.review, 'pending'); assert.equal(t.category, 'administratif'); assert.equal(t.budgetRange, '10_50'); assert.equal(t.budget, null);
assert.equal(t.address, '3 rue des Pierres'); assert.equal(t.mode, 'sur_place'); assert.equal(t.deadline, '1_semaine');
assert.match(t.history[0].text, /privée jusqu'à sa validation/);
assert.equal((await api('drafts')).drafts.length, 0);
const remote = (await api('create', null, { ...base, address: 'ignorée à distance' })).task;
assert.equal(remote.place, 'À distance'); assert.equal(remote.address, null);
await as(brigadier);
assert.equal(await listed(t.id), undefined);
await assert.rejects(api('offer', t.id, { amount: 3000, slot: 'Samedi', scope: 'Tout' }), /introuvable/);
await assert.rejects(api('draft_save', null, { id: randomUUID(), kind: 'offer', taskId: t.id, fields: {} }), /indisponible/);

// 5. Validation admin : réservée à l'équipe, correction demandée puis publication.
await assert.rejects(adm('moderation'), /réservé/);
await as(admin);
let queue = (await adm('moderation')).tasks;
assert.deepEqual(queue.map(x => x.id).sort(), [t.id, remote.id].sort());
assert.equal(queue.find(x => x.id === t.id).address, '3 rue des Pierres');
assert.equal(queue.find(x => x.id === t.id).ownerEmail, emails.owner);
await assert.rejects(adm('task_review', { taskId: t.id, decision: 'changes' }), /Texte requis/);
await assert.rejects(adm('task_review', { taskId: t.id, decision: 'peut-être' }), /Décision invalide/);
await adm('task_review', { taskId: t.id, decision: 'changes', note: 'Retire le nom de ton employeur du titre.' });
await assert.rejects(adm('task_review', { taskId: t.id, decision: 'publish' }), /n'attend plus/);
await adm('task_review', { taskId: remote.id, decision: 'reject', note: 'Hors périmètre.' });
assert.equal((await adm('moderation')).waiting, 1);
await as(owner);
t = await listed(t.id);
assert.equal(t.review, 'changes_requested'); assert.equal(t.reviewNote, 'Retire le nom de ton employeur du titre.');
assert.match(t.history.at(-1).text, /Correction demandée/);
await assert.rejects(api('edit', remote.id, base), /ne peut plus être modifiée/);

// 6. Modification : renvoyée pour validation, puis publiée.
await as(other); await assert.rejects(api('edit', t.id, base), /introuvable/);
await as(owner);
t = (await api('edit', t.id, { ...base, mode: 'les_deux', place: 'Lyon', address: '3 rue des Pierres', budget: 4000 })).task;
assert.equal(t.review, 'pending'); assert.equal(t.reviewNote, null); assert.equal(t.budget, 4000); assert.equal(t.budgetRange, null);
await as(admin);
await adm('task_review', { taskId: t.id, decision: 'publish' });
await as(brigadier);
let seen = await listed(t.id);
assert.equal(seen.title, base.title); assert.equal(seen.address, undefined); assert.equal(seen.review, undefined); assert.equal(seen.category, 'administratif');
const offerId = (await api('offer', t.id, { amount: 4000, slot: 'Samedi', scope: 'Mise en page' })).task.offers[0].id;
await as(owner);
await assert.rejects(api('edit', t.id, base), /ne peut plus être modifiée/);
await api('accept', t.id, { offerId });
await as(brigadier);
assert.equal((await listed(t.id)).address, '3 rue des Pierres'); // Brigadier retenu
await as(other);
assert.equal(await listed(t.id), undefined);

// 7. Alertes et journal : chaque envoi et chaque modification prévient l'équipe ; décisions journalisées.
await db.exec('reset role');
const alerts = (await db.query("select kind from flemme_v2.alerts order by id")).rows.map(r => r.kind);
assert.deepEqual(alerts, ['task_created', 'task_created', 'task_edited', 'agreement']);
const log = (await db.query('select action from flemme_v2.admin_log order by id')).rows.map(r => r.action);
assert.deepEqual(log, ['task_changes', 'task_reject', 'task_publish']);

// 8. Validation désactivée : publication directe.
await db.exec('update flemme_v2.settings set moderation_tasks = false');
await as(owner);
const direct = (await api('create', null, base)).task;
assert.equal(direct.review, 'published');
await as(brigadier); assert.ok(await listed(direct.id));

// 9. Anciennes versions de l'app : le contrat d'origine (title, details, place, budget) fonctionne toujours.
await as(owner);
const legacy = (await api('create', null, { title: 'Monter un meuble', details: 'Petit meuble', place: 'Aix', budget: 3500 })).task;
assert.equal(legacy.place, 'Aix'); assert.equal(legacy.category, null); assert.equal(legacy.mode, null);

// 10. Recherche « Résoudre une flemme » : uniquement les flemmes publiées, ouvertes, des autres membres.
await as(other);
const mk = async data => (await api('create', null, { details: 'Détails', category: 'maison', mode: 'distance', ...data })).task;
const meuble = await mk({ title: 'Monter une armoire', mode: 'sur_place', place: 'Lyon 4e', deadline: 'urgent', budget: 6000 });
const papiers = await mk({ title: 'Classer mes papiers', category: 'administratif', deadline: '1_mois', budgetRange: '10_50' });
const site = await mk({ title: 'Refaire mon site', category: 'numerique', mode: 'les_deux', place: 'Lyon', deadline: '1_semaine', budget: 30000 });
const libre = await mk({ title: 'Promener le chien', details: 'Une ARMOIRE pour le chien', place: 'Aix', mode: 'sur_place' });
await as(brigadier);
const find = async (f = {}) => (await api('search', null, f));
const titles = async f => (await find(f)).tasks.map(t => t.title);
let all = await find({ limit: 100 });
assert.ok(all.tasks.every(t => t.status === 'open' && t.owner.id !== brigadier));
assert.ok(!all.tasks.some(t => t.id === remote.id)); // refusée
assert.deepEqual(await titles({ q: 'armoire' }), ['Promener le chien', 'Monter une armoire']);
assert.deepEqual(await titles({ category: 'administratif', q: 'papiers' }), ['Classer mes papiers']);
assert.deepEqual(await titles({ place: 'lyon' }), ['Refaire mon site', 'Monter une armoire']);
assert.deepEqual((await titles({ mode: 'sur_place', q: 'o' })).filter(x => [meuble.title, site.title, libre.title].includes(x)).sort(), [libre.title, meuble.title, site.title].sort());
assert.deepEqual(await titles({ budget: 'moins_50', q: 'papiers' }), ['Classer mes papiers']);
assert.deepEqual(await titles({ budget: '50_200', q: 'armoire' }), ['Monter une armoire']);
assert.deepEqual(await titles({ budget: 'plus_200' }), ['Refaire mon site']);
assert.ok((await titles({ budget: 'a_discuter' })).includes('Promener le chien'));
assert.deepEqual(await titles({ deadline: 'urgent' }), ['Monter une armoire']);
const byDeadline = (await titles({ sort: 'deadline', limit: 100 }));
assert.ok(byDeadline.indexOf('Monter une armoire') < byDeadline.indexOf('Refaire mon site'));
assert.ok(byDeadline.indexOf('Refaire mon site') < byDeadline.indexOf('Classer mes papiers'));
const byBudget = (await titles({ sort: 'budget', limit: 100 }));
assert.ok(byBudget.indexOf('Classer mes papiers') < byBudget.indexOf('Monter une armoire'));
assert.ok(byBudget.indexOf('Monter une armoire') < byBudget.indexOf('Refaire mon site'));
// Pagination par rang : chaque flemme une fois, dans l'ordre, puis plus de curseur.
const seenIds = []; let cursor = null;
do { const page = await find({ sort: 'budget', limit: 2, cursor }); seenIds.push(...page.tasks.map(t => t.id)); cursor = page.nextCursor; assert.equal(page.total, all.total); } while (cursor);
assert.deepEqual(seenIds, (await find({ sort: 'budget', limit: 100 })).tasks.map(t => t.id));
assert.equal((await find({ q: 'introuvable-xyz' })).total, 0);
assert.equal((await find({ cursor: '999' })).tasks.length, 0);
await assert.rejects(find({ sort: 'prix' }), /Tri invalide/);
await assert.rejects(find({ cursor: 'abc' }), /Curseur invalide/);
await assert.rejects(find({ limit: 101 }), /Taille de page/);

await db.close();
console.log('OK SQL parcours : flemmes existantes publiées, dépôt enrichi contrôlé, brouillons privés sans doublon, validation admin (correction, refus, publication), modification renvoyée en validation, adresse privée, alertes, journal, contrat d’origine, recherche (mots clés, filtres, tris, pagination).');
