// Tests de la migration « confiance » (20261118140000) sur PGlite : questions publiques, masquage, livraison, profil.
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
].join('\n'));
const [owner, member, other, admin] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
for (const [i, id] of [owner, member, other, admin].entries())
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [id, `m${i}@example.org`]);
const dir = new URL('../migrations/', import.meta.url);
for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, dir), 'utf8'));
await db.exec("update flemme_v2.settings set moderation_tasks = false, moderation_offers = false, moderation_agreements = false, payment_mode = 'simulation'");
await db.query('insert into flemme_v2.admins(user_id) values($1)', [admin]);

async function as(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{}',false)", [id]);
  await db.exec('set role authenticated');
}
const api = async (action, task = null, data = {}, request = randomUUID()) =>
  (await db.query('select public.flemme_mobile_api($1,$2,$3::jsonb,$4) as data', [action, task, JSON.stringify(data), request])).rows[0].data;
const adm = async (action, data = {}) => (await db.query('select public.flemme_admin_api($1,$2::jsonb) as data', [action, JSON.stringify(data)])).rows[0].data;
const M = '[coordonnées masquées]';
const terms = { scope: 'Monter le meuble', deliverable: 'Meuble monté', quality: 'Stable', deadline: 'Samedi',
  acceptance: 'Vérifié sur place', cancellation: 'Gratuite 24 h avant', confidentiality: 'Adresse privée' };

// 1. Masquage SQL identique au client.
await db.exec('reset role');
for (const [input, expected] of [['écris à lou.dupont@gmail.com', 'écris à ' + M], ['06 12 34 56 78 ou +33 6 12 34 56 78', M + ' ou ' + M],
  ['voir https://exemple.fr/x et www.site.com', 'voir ' + M + ' et ' + M], ['40,00 € samedi 18/11/2026 de 10h à 12h', '40,00 € samedi 18/11/2026 de 10h à 12h']])
  assert.equal((await db.query('select flemme_v2.masquer($1) as v', [input])).rows[0].v, input === expected ? input : expected);

// 2. Questions publiques.
await as(owner);
let t = (await api('create', null, { title: 'Meuble', details: 'Un meuble à monter', place: 'Aix' })).task;
assert.deepEqual(t.questions, []);
await assert.rejects(api('ask', t.id, { text: 'Moi-même ?' }), /fermées/);
await as(member);
t = (await api('ask', t.id, { text: 'Quel étage ? Mon 0612345678' })).task;
assert.equal(t.questions[0].text, 'Quel étage ? Mon ' + M);
const qid = t.questions[0].id;
await as(other);
assert.equal((await api('search', null, {})).tasks.find(x => x.id === t.id).questions.length, 1, 'visible des autres membres');
await assert.rejects(api('answer', t.id, { questionId: qid, text: 'Pas moi' }), /introuvable/);
for (const n of [1, 2, 3]) await api('ask', t.id, { text: 'Question ' + n });
await assert.rejects(api('ask', t.id, { text: 'Une de trop' }), /3 questions/);
await as(owner);
t = (await api('answer', t.id, { questionId: qid, text: '2e étage, écris à moi@exemple.fr' })).task;
assert.equal(t.questions[0].answer, '2e étage, écris à ' + M);
assert.ok(t.questions[0].answeredAt);
await assert.rejects(api('answer', t.id, { questionId: qid, text: 'Encore' }), /déjà répondu/);
// Modération : réservée à l'équipe, la question disparaît pour tous.
await assert.rejects(adm('question_hide', { questionId: qid }), /réservé/);
await as(admin);
await adm('question_hide', { questionId: qid });
await as(owner);
t = (await api('list')).tasks.find(x => x.id === t.id);
assert.equal(t.questions.length, 3);

// 3. Candidature et discussion masquées avant la signature.
await as(member);
t = (await api('apply', t.id, { amount: 4000, slot: 'Samedi', scope: 'Montage, appelle le 06 12 34 56 78', result: 'Meuble monté, voir www.site.fr' })).task;
const offer = t.offers[0];
assert.equal(offer.scope, 'Montage, appelle le ' + M);
assert.equal(offer.result, 'Meuble monté, voir ' + M);
t = (await api('message', t.id, { offerId: offer.id, text: 'Mon mail : lou@exemple.fr' })).task;
assert.equal(t.offers[0].messages[0].text, 'Mon mail : ' + M);
// Idempotence conservée : même requête, même résultat.
const rq = randomUUID();
await api('message', t.id, { offerId: offer.id, text: 'Rejoué 0612345678' }, rq);
t = (await api('message', t.id, { offerId: offer.id, text: 'Rejoué 0612345678' }, rq)).task;
assert.equal(t.offers[0].messages.filter(m => m.text === 'Rejoué ' + M).length, 1);

// 4. Livraison et libération du paiement.
await as(owner);
t = (await api('accept', t.id, { offerId: offer.id })).task;
await as(member);
await assert.rejects(api('deliver', t.id), /signé/);
await as(owner);
await api('agreement_save', t.id, terms); await api('agreement_submit', t.id);
await api('agreement_sign', t.id, { signature: 'Déposant', accept: true });
await as(member);
t = (await api('agreement_sign', t.id, { signature: 'Membre', accept: true })).task;
t = (await api('message', t.id, { offerId: offer.id, text: 'Après signature : 06 12 34 56 78' })).task;
assert.equal(t.offers[0].messages.at(-1).text, 'Après signature : 06 12 34 56 78', 'coordonnées libres après la signature');
await assert.rejects(api('deliver', t.id), /payée/);
await as(owner); await api('pay', t.id);
await as(other); await assert.rejects(api('deliver', t.id), /membre retenu/);
await as(member);
t = (await api('deliver', t.id)).task;
assert.ok(t.deliveredAt);
await assert.rejects(api('deliver', t.id), /déjà/);
await assert.rejects(api('complete', t.id), /7 jours/);
// 8 jours plus tard, avec un désaccord signalé après la livraison : pas de libération automatique.
await db.exec('reset role');
await db.query("update flemme_v2.tasks set delivered_at = delivered_at - interval '8 days' where id = $1", [t.id]);
await as(owner); await api('report', t.id, { text: 'Il manque une porte' });
await as(member); await assert.rejects(api('complete', t.id), /7 jours/);
// Sans désaccord depuis la livraison : le membre clôture.
await db.exec('reset role');
await db.query("update flemme_v2.events set created_at = created_at - interval '9 days' where task_id = $1 and kind = 'report'", [t.id]);
await as(member);
t = (await api('complete', t.id)).task;
assert.equal(t.status, 'completed');
assert.match(t.history.at(-1).text, /libéré automatiquement/);

// Déposant : confirmation à tout moment, libellé « paiement libéré ».
await as(owner);
let t2 = (await api('create', null, { title: 'Courses', details: 'Faire mes courses', place: 'Aix' })).task;
await as(other); t2 = (await api('apply', t2.id, { amount: 2000, slot: 'Lundi', scope: 'Courses' })).task;
await as(owner); t2 = (await api('accept', t2.id, { offerId: t2.offers[0].id })).task;
await api('agreement_save', t2.id, terms); await api('agreement_submit', t2.id);
await api('agreement_sign', t2.id, { signature: 'Déposant', accept: true });
await as(other); await api('agreement_sign', t2.id, { signature: 'Autre', accept: true });
await as(owner);
await assert.rejects(api('complete', t2.id), /payée/);
await api('pay', t2.id);
t2 = (await api('complete', t2.id)).task;
assert.match(t2.history.at(-1).text, /paiement libéré pour le membre/);

// 5. Profil public : missions réalisées, en cours, demandes menées à terme.
const p = (await api('profile_get', null, { userId: owner })).profile;
assert.deepEqual([p.missions, p.ongoing, p.requests], [0, 0, 2]);
const pm = (await api('profile_get', null, { userId: member })).profile;
assert.deepEqual([pm.missions, pm.ongoing, pm.requests], [1, 0, 0]);

await db.close();
console.log('confiance.test.mjs : ok');
