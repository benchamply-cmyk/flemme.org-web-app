// Tests de la migration commission + paiement en ligne (20261103130000) sur PGlite, sans Stripe ni réseau.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const { PGlite } = await import(process.env.PGLITE_MODULE_URL || '@electric-sql/pglite');
const db = new PGlite();
await db.exec([
  'create role anon; create role authenticated; create role service_role;',
  'create schema auth;',
  'create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb, email_confirmed_at timestamptz);',
  "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
  "create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;",
  'grant usage on schema auth to authenticated;',
  'grant execute on function auth.uid(),auth.jwt() to authenticated;',
].join('\n'));
const [owner, brigadier, other, unconfirmed] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const dir = new URL('../migrations/', import.meta.url);
const files = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort();
// Une flemme acceptée AVANT la migration doit garder ses 10 % ajoutés.
for (const file of files.filter(f => f < '20261103130000')) await db.exec(await readFile(new URL(file, dir), 'utf8'));
for (const [i, id] of [owner, brigadier, other, unconfirmed].entries())
  await db.query('insert into auth.users values($1,$2,null,$3)', [id, `m${i}@example.com`, i === 3 ? null : new Date()]);

async function actor(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{}',false)", [id]);
  await db.exec('set role authenticated');
}
const api = async (action, task = null, data = {}) =>
  (await db.query('select public.flemme_mobile_api($1,$2,$3::jsonb,$4) as data', [action, task, JSON.stringify(data), randomUUID()])).rows[0].data;
async function agreed(amount) {
  await actor(owner); let t = (await api('create', null, { title: 'Colis', details: 'Deux colis', place: 'Aix' })).task;
  await actor(brigadier); t = (await api('offer', t.id, { amount, slot: 'Samedi', scope: 'Tout' })).task;
  await actor(owner); return (await api('accept', t.id, { offerId: t.offers[0].id })).task;
}
const before = await agreed(4005);
await db.exec('reset role');
for (const file of files.filter(f => f >= '20261103130000')) await db.exec(await readFile(new URL(file, dir), 'utf8'));
await actor(owner);
let t = (await api('list')).tasks.find(x => x.id === before.id);
assert.deepEqual([t.agreement.commission, t.agreement.total, t.agreement.payout, t.agreement.rateBps, t.agreement.model], [401, 4406, 4005, 1000, 'ajout']);

// Réglage serveur identique à COMMISSION de apps/mobile/src/domain.ts.
await db.exec('reset role');
const domain = await readFile(new URL('../../apps/mobile/src/domain.ts', import.meta.url), 'utf8');
const [, model, bps] = domain.match(/COMMISSION: CommissionConfig = \{ model: '(\w+)', rateBps: (\d+) \}/);
assert.deepEqual((await db.query('select commission_model, commission_bps from flemme_v2.settings')).rows, [{ commission_model: model, commission_bps: Number(bps) }]);
await assert.rejects(db.query('insert into flemme_v2.settings(id) values(false)'));
for (const table of ['settings', 'brigadier_accounts', 'payments']) {
  await actor(owner); await assert.rejects(db.query(`select * from flemme_v2.${table}`), /permission denied/);
}

// Modèle « 65 % reversés au Brigadier », puis retour aux 10 % : les accords conclus ne bougent pas.
await db.exec('reset role');
await db.exec("update flemme_v2.settings set commission_model='prelevement', commission_bps=3500");
const brigade = await agreed(4000);
assert.deepEqual([brigade.agreement.commission, brigade.agreement.total, brigade.agreement.payout, brigade.agreement.model], [1400, 4000, 2600, 'prelevement']);
assert.match(brigade.history.at(-1).text, /commission de 35 % confirmés/);
await db.exec("reset role; update flemme_v2.settings set commission_model='ajout', commission_bps=1250");
assert.match((await agreed(1000)).history.at(-1).text, /commission de 12,5 % confirmés/);
await db.exec("reset role; update flemme_v2.settings set commission_bps=1000");
await actor(owner);
assert.equal((await api('list', null, { limit: 100 })).tasks.find(x => x.id === brigade.id).agreement.payout, 2600);

// API de paiement : réservée à service_role.
const pay = async (action, data) => (await db.query('select public.flemme_paiement_api($1,$2::jsonb) as data', [action, JSON.stringify(data)])).rows[0].data;
for (const role of ['anon', 'authenticated']) {
  await db.exec('reset role; set role ' + role);
  await assert.rejects(pay('account_get', { userId: brigadier }), /permission denied/);
}
let t3 = await agreed(2000);
const ctx = { userId: owner, taskId: t3.id };
await db.exec('reset role; set role service_role');
await assert.rejects(pay('checkout_context', ctx), /tâche est terminée/);
await actor(owner); await api('complete', t3.id);
await db.exec('reset role; set role service_role');
await assert.rejects(pay('checkout_context', { userId: brigadier, taskId: t3.id }), /Seul le déposant/);
await assert.rejects(pay('checkout_context', ctx), /pas encore activé/);
await assert.rejects(pay('account_save', { userId: unconfirmed, accountId: 'acct_X' }), /non confirmé/);
assert.equal((await pay('account_save', { userId: brigadier, accountId: 'acct_Test123' })).account.chargesEnabled, false);
assert.equal((await pay('account_save', { userId: brigadier, accountId: 'acct_Autre' })).account.id, 'acct_Test123');
await assert.rejects(pay('account_save', { userId: other, accountId: 'pas-un-compte' }), /check/);
assert.equal((await pay('account_update', { accountId: 'acct_Test123', chargesEnabled: true, payoutsEnabled: true })).updated, true);
const c = await pay('checkout_context', ctx);
assert.deepEqual([c.accountId, c.total, c.commission, c.payout, c.openUrl], ['acct_Test123', 2200, 200, 2000, null]);
const session = { ...ctx, sessionId: 'cs_test_abc', accountId: c.accountId, url: 'https://checkout.stripe.com/c/pay/cs_test_abc', total: c.total, commission: c.commission, payout: c.payout };
await pay('checkout_created', session);
assert.equal((await pay('checkout_context', ctx)).openUrl, session.url);
await assert.rejects(pay('checkout_created', { ...session, sessionId: 'cs_test_bad', payout: 1 }), /check/);
await assert.rejects(pay('checkout_paid', { sessionId: 'cs_test_abc', amountTotal: 1 }), /différent/);
await assert.rejects(pay('checkout_paid', { sessionId: 'cs_inconnue', amountTotal: 2200 }), /inconnue/);
assert.equal((await pay('checkout_paid', { sessionId: 'cs_test_abc', amountTotal: 2200, paymentIntentId: 'pi_1' })).ok, true);
assert.equal((await pay('checkout_paid', { sessionId: 'cs_test_abc', amountTotal: 2200, paymentIntentId: 'pi_1' })).already, true);
await assert.rejects(pay('checkout_context', ctx), /déjà enregistré/);
await pay('checkout_created', { ...session, sessionId: 'cs_test_def', url: 'https://checkout.stripe.com/c/pay/cs_test_def' });
assert.equal((await pay('checkout_paid', { sessionId: 'cs_test_def', amountTotal: 2200, paymentIntentId: 'pi_2' })).duplicate, true);
await pay('checkout_created', { ...session, sessionId: 'cs_test_exp' });
await pay('checkout_expired', { sessionId: 'cs_test_exp' });
await db.exec('reset role');
assert.deepEqual((await db.query("select checkout_session_id id, status from flemme_v2.payments order by created_at, checkout_session_id")).rows.map(r => r.status), ['paid', 'doublon', 'expired']);

// Vue des participants : paiement en ligne visible, paiement direct bloqué ; un tiers ne voit rien.
await actor(owner);
t3 = (await api('list', null, { limit: 100 })).tasks.find(x => x.id === t3.id);
assert.deepEqual([t3.payment.status, t3.payment.total, t3.payment.commission, t3.payment.payout, t3.paymentConfirmed], ['paid', 2200, 200, 2000, true]);
assert.match(t3.history.at(-1).text, /Paiement en ligne reçu/);
await assert.rejects(api('declare_payment', t3.id), /non autorisée/);
await actor(brigadier);
assert.equal((await api('list', null, { limit: 100 })).tasks.find(x => x.id === t3.id).payment.payout, 2000);
await actor(other);
assert.equal((await api('list', null, { limit: 100 })).tasks.find(x => x.id === t3.id), undefined);

// Suppression du compte du déposant : la trace de paiement reste, détachée.
await db.exec('reset role');
await db.query('delete from auth.users where id=$1', [owner]);
assert.deepEqual((await db.query("select task_id, payer_id from flemme_v2.payments where checkout_session_id='cs_test_abc'")).rows, [{ task_id: null, payer_id: null }]);
await db.close();
console.log('OK SQL paiement : accords existants conservés, réglage = domain.ts, modèle prélèvement, taux figé, API réservée à service_role, montants serveur, session réutilisée, webhook idempotent, doublon, confidentialité, trace conservée.');
