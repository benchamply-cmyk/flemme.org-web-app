// Tests du lot 3 (20261104140000_flemme_v2_accord.sql) sur PGlite : profils, avis, candidatures validées, accord écrit et signatures.
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

// Une proposition faite avant la migration reste visible et acceptable.
const dir = new URL('../migrations/', import.meta.url);
const files = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort();
for (const file of files.filter(f => f < '20261104140000')) await db.exec(await readFile(new URL(file, dir), 'utf8'));
await db.exec('update flemme_v2.settings set moderation_tasks = false');
const { admin, owner, brigadier, other } = ids;
async function as(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{}',false)", [id || '']);
  await db.exec('set role authenticated');
}
const api = async (action, task = null, data = {}, request = randomUUID()) =>
  (await db.query('select public.flemme_mobile_api($1,$2,$3::jsonb,$4) as data', [action, task, JSON.stringify(data), request])).rows[0].data;
const adm = async (action, data = {}) => (await db.query('select public.flemme_admin_api($1,$2::jsonb) as data', [action, JSON.stringify(data)])).rows[0].data;
const get = async id => (await api('list', null, { limit: 100 })).tasks.find(t => t.id === id);
const base = { title: 'Monter une étagère', details: 'Trois planches', category: 'maison', deadline: '1_semaine', mode: 'distance', budget: 5000 };

await as(owner);
const ancienne = (await api('create', null, { ...base, title: 'Ancienne demande' })).task;
await as(brigadier);
const ancienneOffre = (await api('offer', ancienne.id, { amount: 4500, slot: 'Lundi', scope: 'Tout' })).task.offers[0];
await db.exec('reset role');
for (const file of files.filter(f => f >= '20261104140000')) await db.exec(await readFile(new URL(file, dir), 'utf8'));
await as(owner);
assert.equal((await get(ancienne.id)).offers[0].review, 'approved');
await api('accept', ancienne.id, { offerId: ancienneOffre.id });
// Sans accord écrit commencé, la fin de tâche reste possible (contrat d'origine).
await api('complete', ancienne.id);

// 1. Profil public : bio, compétences (dédoublonnées), expérience ; visible des autres membres.
await as(brigadier);
await assert.rejects(api('profile_save', null, { skills: 'bricolage' }), /Compétences invalides/);
await assert.rejects(api('profile_save', null, { skills: Array.from({ length: 11 }, (_, i) => 'c' + i) }), /10 compétences/);
let profile = (await api('profile_save', null, { displayName: 'Basile', bio: 'Bricoleur du dimanche', skills: ['Montage', ' Montage ', 'Peinture', ''], experience: '10 ans de déménagements' })).profile;
assert.deepEqual(profile.skills, ['Montage', 'Peinture']);
assert.equal(profile.name, 'Basile'); assert.equal(profile.missions, 1); assert.equal(profile.rating, null);
await as(other);
profile = (await api('profile_get', null, { userId: brigadier })).profile;
assert.equal(profile.bio, 'Bricoleur du dimanche'); assert.equal(profile.email, undefined);
await assert.rejects(api('profile_get', null, { userId: randomUUID() }), /Profil introuvable/);
await db.exec('reset role; set role anon');
await assert.rejects(api('profile_get', null, {}), /permission denied/);

// 2. Candidature : résultat promis, validation par l'équipe avant d'être transmise au déposant.
await as(owner);
const t = (await api('create', null, base)).task;
await as(brigadier);
const draftId = (await api('draft_save', null, { id: randomUUID(), kind: 'offer', taskId: t.id, fields: { amount: '40' } })).draft.id;
let seen = (await api('apply', t.id, { amount: 4000, slot: 'Samedi matin', scope: 'Montage et fixation', result: 'Étagère droite et fixée au mur', draftId })).task;
const offerId = seen.offers[0].id;
assert.equal(seen.offers[0].review, 'pending'); assert.equal(seen.offers[0].result, 'Étagère droite et fixée au mur');
assert.deepEqual((await api('drafts')).drafts, []);
await assert.rejects(api('apply', t.id, { amount: 4000, slot: 'x', scope: 'y' }), /déjà en attente/);
await as(owner);
assert.deepEqual((await get(t.id)).offers, []); // pas encore validée
await assert.rejects(api('accept', t.id, { offerId }), /attend la validation/);
await as(other);
await assert.rejects(adm('review_queue'), /réservé à l'équipe/);
await as(admin);
let queue = await adm('review_queue');
assert.equal(queue.offers.length, 1); assert.equal(queue.offers[0].result, 'Étagère droite et fixée au mur');
await assert.rejects(adm('offer_review', { offerId, decision: 'changes' }), /requis|vide|texte/i);
await adm('offer_review', { offerId, decision: 'changes', note: 'Précise le matériel fourni' });
await assert.rejects(adm('offer_review', { offerId, decision: 'approve' }), /n'attend plus/);
await as(brigadier);
seen = (await get(t.id)).offers[0];
assert.equal(seen.review, 'changes_requested'); assert.equal(seen.reviewNote, 'Précise le matériel fourni');
seen = (await api('apply_edit', t.id, { offerId, amount: 4200, slot: 'Samedi matin', scope: 'Montage, chevilles fournies', result: 'Étagère fixée' })).task.offers[0];
assert.equal(seen.review, 'pending'); assert.equal(seen.amount, 4200); assert.equal(seen.reviewNote, null);
await as(other);
await assert.rejects(api('apply_edit', t.id, { offerId, amount: 1, slot: 'x', scope: 'y' }), /introuvable/);
const refusee = (await api('apply', t.id, { amount: 100, slot: 'Jamais', scope: 'Rien' })).task.offers[0].id;
await as(admin);
await adm('offer_review', { offerId, decision: 'approve' });
await adm('offer_review', { offerId: refusee, decision: 'reject', note: 'Proposition hors sujet' });
await as(owner);
seen = await get(t.id);
assert.deepEqual(seen.offers.map(o => o.id), [offerId]); assert.equal(seen.offers[0].reviewNote, null);
await as(brigadier);
await assert.rejects(api('apply_edit', t.id, { offerId, amount: 1, slot: 'x', scope: 'y' }), /ne peut plus être modifiée/);
await as(owner);
await api('accept', t.id, { offerId });

// 3. Accord écrit : rédigé par l'une ou l'autre partie, contrôlé par l'équipe, signé par les deux.
const terms = { scope: 'Montage de l\'étagère', quality: 'De niveau, fixée', deadline: 'Samedi 8 novembre', cancellation: '48 h avant, sans frais', confidentiality: 'Adresse non partagée' };
await assert.rejects(api('agreement_submit', t.id), /Aucun brouillon/);
await assert.rejects(api('agreement_save', t.id, { ...terms, quality: '' }), /./);
seen = (await api('agreement_save', t.id, terms)).task;
assert.equal(seen.contract.status, 'draft'); assert.equal(seen.contract.terms.scope, terms.scope);
await as(other);
await assert.rejects(api('agreement_save', t.id, terms), /inaccessible/);
await as(brigadier);
assert.equal((await get(t.id)).contract.terms.deadline, 'Samedi 8 novembre');
await assert.rejects(api('agreement_sign', t.id, { signature: 'Basile', accept: true }), /validé avant/);
seen = (await api('agreement_submit', t.id)).task;
assert.equal(seen.contract.status, 'pending');
await as(owner);
await assert.rejects(api('complete', t.id), /signé par les deux parties/);
await as(admin);
queue = await adm('review_queue');
assert.equal(queue.offers.length, 0); assert.equal(queue.agreements.length, 1); assert.equal(queue.agreements[0].amount, 4200);
await adm('agreement_review', { taskId: t.id, decision: 'changes', note: 'Ajoute qui fournit les chevilles' });
await as(owner);
assert.equal((await get(t.id)).contract.reviewNote, 'Ajoute qui fournit les chevilles');
await api('agreement_save', t.id, { ...terms, scope: 'Montage, chevilles fournies par le Brigadier' });
await api('agreement_submit', t.id);
await as(admin);
await adm('agreement_review', { taskId: t.id, decision: 'approve' });
await as(owner);
await assert.rejects(api('agreement_sign', t.id, { signature: 'Ondine' }), /Coche la case/);
seen = (await api('agreement_sign', t.id, { signature: 'Ondine', accept: true })).task;
assert.equal(seen.contract.status, 'approved'); assert.ok(seen.contract.ownerSignedAt); assert.equal(seen.contract.brigadierSignedAt, null);
await assert.rejects(api('agreement_sign', t.id, { signature: 'Ondine', accept: true }), /déjà signé/);
await assert.rejects(api('complete', t.id), /signé par les deux parties/);
await as(brigadier);
seen = (await api('agreement_sign', t.id, { signature: 'Basile', accept: true })).task;
assert.equal(seen.contract.status, 'signed'); assert.equal(seen.contract.brigadierSignature, 'Basile');
await assert.rejects(api('agreement_save', t.id, terms), /déjà signé/);
assert.ok(seen.history.some(h => h.text === 'Accord signé par Basile (« Basile »)'));

// 4. Avis : seulement après la fin, un par partie, et sur l'autre partie.
await assert.rejects(api('review', t.id, { rating: 5 }), /mission terminée/);
await as(owner);
await api('complete', t.id);
await assert.rejects(api('review', t.id, { rating: 6 }), /Note invalide/);
await assert.rejects(api('review', t.id, { rating: '5' }), /Note invalide/);
seen = (await api('review', t.id, { rating: 5, text: 'Travail soigné' })).task;
assert.deepEqual(seen.myReview, { rating: 5, text: 'Travail soigné' });
await assert.rejects(api('review', t.id, { rating: 4 }), /déjà donné/);
await as(brigadier);
await api('review', t.id, { rating: 4 });
await as(other);
await assert.rejects(api('review', t.id, { rating: 5 }), /mission terminée|introuvable/);
profile = (await api('profile_get', null, { userId: brigadier })).profile;
assert.equal(profile.rating, 5); assert.equal(profile.missions, 2); assert.equal(profile.reviews[0].text, 'Travail soigné');
assert.equal((await api('profile_get', null, { userId: owner })).profile.rating, 4);

// 5. Idempotence, alertes et journal.
await as(owner);
const req = randomUUID();
const once = await api('agreement_save', ancienne.id, terms, req).catch(e => e.message);
assert.equal(await api('agreement_save', ancienne.id, terms, req).catch(e => e.message), once);
await db.exec('reset role');
const alerts = (await db.query("select kind from flemme_v2.alerts where kind in ('offer_review', 'agreement_review') order by id")).rows.map(r => r.kind);
assert.deepEqual(alerts, ['offer_review', 'offer_review', 'offer_review', 'agreement_review', 'agreement_review']);
const log = (await db.query("select action from flemme_v2.admin_log order by id")).rows.map(r => r.action);
assert.deepEqual(log, ['offer_changes', 'offer_approve', 'offer_reject', 'agreement_changes', 'agreement_approve']);

// 6. Validation désactivée : candidature transmise et accord prêt à signer sans contrôle.
await db.exec('update flemme_v2.settings set moderation_offers = false, moderation_agreements = false');
await as(owner);
const t2 = (await api('create', null, { ...base, title: 'Vider la cave' })).task;
await as(brigadier);
const o2 = (await api('apply', t2.id, { amount: 3000, slot: 'Dimanche', scope: 'Tout' })).task.offers[0];
assert.equal(o2.review, 'approved');
await as(owner);
await api('accept', t2.id, { offerId: o2.id });
await api('agreement_save', t2.id, terms);
assert.equal((await api('agreement_submit', t2.id)).task.contract.status, 'approved');

await db.close();
console.log('OK SQL accord : propositions existantes conservées, profils publics, candidatures validées (correction, refus), accord écrit contrôlé, deux signatures horodatées, fin bloquée tant que non signé, avis après mission, alertes, journal.');
