import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const { PGlite } = await import(process.env.PGLITE_MODULE_URL || '@electric-sql/pglite');
const db = new PGlite();
await db.exec([
  'create role anon; create role authenticated; create role service_role;',
  'create schema auth;',
  'create table auth.users(id uuid primary key,email_confirmed_at timestamptz);',
  "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
  "create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;",
  'grant usage on schema auth to authenticated;',
  'grant execute on function auth.uid(),auth.jwt() to authenticated;'
].join('\n'));
const users = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
for (const [i, id] of users.entries()) await db.query('insert into auth.users values($1,$2)', [id, i === 3 ? null : new Date()]);
await db.exec(await readFile(new URL('./install.sql', import.meta.url), 'utf8'));
async function actor(id, claims = {}) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)", [id || '', JSON.stringify(claims)]);
  await db.exec('set role authenticated');
}
async function api(action, task = null, data = {}, request = randomUUID()) {
  return (await db.query('select public.flemme_mobile_api($1,$2,$3::jsonb,$4) as data', [action, task, JSON.stringify({ actorName: 'Membre', ...data }), request])).rows[0].data;
}
await actor(users[3]); await assert.rejects(api('list'), /compte confirmé/);
await actor(users[0], { is_anonymous: true }); await assert.rejects(api('list'), /compte confirmé/);
await actor(null); await assert.rejects(api('list'), /compte confirmé/);
await actor(users[0]);
const request = randomUUID(), payload = { title: 'Un meuble', details: 'Un montage simple', place: 'Aix', budget: null };
const created = (await api('create', null, payload, request)).task;
assert.equal(created.status, 'open'); assert.equal(created.budget, null);
assert.equal((await api('create', null, payload, request)).task.id, created.id);
await assert.rejects(api('create', null, { ...payload, title: 'Autre' }, request), /Identifiant déjà utilisé/);
await assert.rejects(db.query('select * from flemme_mobile_v1.tasks'), /permission denied/);
await assert.rejects(db.query("update flemme_mobile_v1.tasks set document='{}'"), /permission denied/);
await assert.rejects(api('offer', created.id, { amount: 4000, slot: 'Samedi', scope: 'Inclus' }), /indisponible/);
await actor(users[1]);
let t = (await api('offer', created.id, { amount: 4005, slot: 'Samedi', scope: 'Déplacement inclus' })).task;
const offerId = t.offers[0].id;
await api('message', t.id, { offerId, text: 'Message privé' });
await assert.rejects(api('accept', t.id, { offerId }), /indisponible/);
await actor(users[2]);
assert.equal((await api('list')).tasks[0].offers.length, 0);
await assert.rejects(api('message', t.id, { offerId, text: 'Intrusion' }), /inaccessible/);
let second = (await api('offer', t.id, { amount: 3000, slot: 'Lundi', scope: 'Autre forfait' })).task.offers[0].id;
await actor(users[0]);
assert.equal((await api('list')).tasks[0].offers.length, 2);
const acceptRequest = randomUUID();
t = (await api('accept', t.id, { offerId, commission: 0, total: 1 }, acceptRequest)).task;
assert.deepEqual([t.agreement.amount,t.agreement.commission,t.agreement.total,t.agreement.payout,t.agreement.rateBps,t.agreement.model], [4005,401,4406,4005,1000,'ajout']);
assert.match(t.history.at(-1).text, /commission de 10 % confirmés/);
assert.equal(t.offers[1].status, 'not_selected'); assert.equal(t.offers[0].messages[0].text, 'Message privé');
await api('accept', t.id, { offerId, commission: 0, total: 1 }, acceptRequest);
await assert.rejects(api('accept', t.id, { offerId: second }), /indisponible/);
await assert.rejects(api('declare_payment', t.id), /non autorisée/);
await api('complete', t.id); await api('declare_payment', t.id);
await actor(users[2]);
await assert.rejects(api('confirm_payment', t.id), /non autorisée/);
await assert.rejects(api('report', t.id, { text: 'Intrusion' }), /inaccessible/);
assert.equal((await api('list')).tasks[0].agreement, undefined);
await actor(users[1]);
t = (await api('confirm_payment', t.id)).task;
assert.equal(t.paymentConfirmed, true);
await api('report', t.id, { text: 'Un problème à examiner' });
await actor(users[0]);
t = (await api('list')).tasks[0];
assert.equal(t.reports.length, 1); assert.equal(t.history.length, 9);
await db.exec('reset role; set role anon');
await assert.rejects(api('list'), /permission denied/);
await db.exec('reset role');

// Réglage de commission : identique à COMMISSION de src/domain.ts, puis modèle « 65 % reversés au Brigadier ».
const domain = await readFile(new URL('../src/domain.ts', import.meta.url), 'utf8');
const [, model, bps] = domain.match(/COMMISSION: CommissionConfig = \{ model: '(\w+)', rateBps: (\d+) \}/);
assert.deepEqual((await db.query('select commission_model,commission_bps from flemme_mobile_v1.settings')).rows, [{ commission_model: model, commission_bps: Number(bps) }]);
await assert.rejects(db.query("insert into flemme_mobile_v1.settings(id) values(false)"));
await db.exec("update flemme_mobile_v1.settings set commission_model='prelevement', commission_bps=3500");
await actor(users[0]);
let t2 = (await api('create', null, payload)).task;
await actor(users[1]); t2 = (await api('offer', t2.id, { amount: 4000, slot: 'Mardi', scope: 'Tout' })).task;
await actor(users[0]); t2 = (await api('accept', t2.id, { offerId: t2.offers[0].id })).task;
assert.deepEqual([t2.agreement.commission,t2.agreement.total,t2.agreement.payout,t2.agreement.model], [1400,4000,2600,'prelevement']);
assert.match(t2.history.at(-1).text, /commission de 35 % confirmés/);
t = (await api('list')).tasks.find(x => x.id === t.id);
assert.equal(t.agreement.commission, 401, 'un accord déjà conclu garde son taux');
await db.exec('reset role');
await db.exec("update flemme_mobile_v1.settings set commission_model='ajout', commission_bps=1000");

// Paiement en ligne (paiement.sql) : réservé à service_role, montants issus de l'accord, webhook idempotent.
await db.exec(await readFile(new URL('./paiement.sql', import.meta.url), 'utf8'));
const pay = async (action, data) => (await db.query('select public.flemme_paiement_api($1,$2::jsonb) as data', [action, JSON.stringify(data)])).rows[0].data;
for (const role of ['anon', 'authenticated']) {
  await db.exec('reset role; set role ' + role);
  await assert.rejects(pay('account_get', { userId: users[1] }), /permission denied/);
}
await db.exec('reset role; set role service_role');
await actor(users[0]);
let t3 = (await api('create', null, payload)).task;
await actor(users[1]); t3 = (await api('offer', t3.id, { amount: 2000, slot: 'Jeudi', scope: 'Colis' })).task;
await actor(users[0]); t3 = (await api('accept', t3.id, { offerId: t3.offers[0].id })).task;
await db.exec('reset role; set role service_role');
const ctx = { userId: users[0], taskId: t3.id };
await assert.rejects(pay('checkout_context', ctx), /tâche est terminée/);
await actor(users[0]); await api('complete', t3.id);
await db.exec('reset role; set role service_role');
await assert.rejects(pay('checkout_context', { userId: users[1], taskId: t3.id }), /Seul le déposant/);
await assert.rejects(pay('checkout_context', ctx), /pas encore activé/);
await assert.rejects(pay('account_save', { userId: users[3], accountId: 'acct_X' }), /non confirmé/);
assert.equal((await pay('account_save', { userId: users[1], accountId: 'acct_Test123' })).account.chargesEnabled, false);
assert.equal((await pay('account_save', { userId: users[1], accountId: 'acct_Autre' })).account.id, 'acct_Test123');
assert.equal((await pay('account_update', { accountId: 'acct_Test123', chargesEnabled: true, payoutsEnabled: true })).updated, true);
let c = await pay('checkout_context', ctx);
assert.deepEqual([c.accountId, c.total, c.commission, c.payout, c.openUrl], ['acct_Test123', 2200, 200, 2000, null]);
const session = { ...ctx, sessionId: 'cs_test_abc', accountId: c.accountId, url: 'https://checkout.stripe.com/c/pay/cs_test_abc', total: c.total, commission: c.commission, payout: c.payout };
await pay('checkout_created', session);
assert.equal((await pay('checkout_context', ctx)).openUrl, session.url);
await assert.rejects(pay('checkout_paid', { sessionId: 'cs_test_abc', amountTotal: 1 }), /différent/);
assert.equal((await pay('checkout_paid', { sessionId: 'cs_test_abc', amountTotal: 2200, paymentIntentId: 'pi_1' })).ok, true);
assert.equal((await pay('checkout_paid', { sessionId: 'cs_test_abc', amountTotal: 2200, paymentIntentId: 'pi_1' })).already, true);
await assert.rejects(pay('checkout_context', ctx), /déjà enregistré/);
await pay('checkout_created', { ...session, sessionId: 'cs_test_def', url: 'https://checkout.stripe.com/c/pay/cs_test_def' });
assert.equal((await pay('checkout_paid', { sessionId: 'cs_test_def', amountTotal: 2200, paymentIntentId: 'pi_2' })).duplicate, true);
await actor(users[0]);
t3 = (await api('list')).tasks.find(x => x.id === t3.id);
assert.deepEqual(t3.payment && [t3.payment.status, t3.payment.total, t3.payment.commission, t3.paymentConfirmed], ['paid', 2200, 200, true]);
await assert.rejects(api('declare_payment', t3.id), /non autorisée/);
await actor(users[2]);
assert.equal((await api('list')).tasks.find(x => x.id === t3.id), undefined);
await db.exec('reset role');

const rls = await db.query("select relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='flemme_mobile_v1' and relkind='r'");
assert.equal(rls.rows.length, 5);
assert.ok(rls.rows.every(r => r.relrowsecurity));
await db.close();
console.log('OK SQL : installation, authentification, autorisations, RLS, confidentialité, prix serveur, commission arrondie, attribution unique, idempotence, paiements déclaratifs, commission configurable, paiement en ligne Stripe (service_role) et historique.');
