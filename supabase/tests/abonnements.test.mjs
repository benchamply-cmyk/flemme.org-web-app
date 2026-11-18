// Tests de la migration abonnements (20261118130000) sur PGlite, sans Stripe ni réseau.
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
const [admin, member] = [randomUUID(), randomUUID()];
for (const [i, id] of [admin, member].entries())
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [id, `a${i}@example.org`]);
const dir = new URL('../migrations/', import.meta.url);
for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, dir), 'utf8'));
await db.query("insert into flemme_v2.profiles(user_id, display_name) values($1,'Admin'),($2,'Membre') on conflict do nothing", [admin, member]);
await db.query('insert into flemme_v2.admins(user_id) values($1) on conflict do nothing', [admin]);

async function as(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{}',false)", [id]);
  await db.exec('set role authenticated');
}
const api = async (action, data = {}) => (await db.query('select public.flemme_mobile_api($1,null,$2::jsonb,null) as data', [action, JSON.stringify(data)])).rows[0].data;
const adm = async (action, data = {}) => (await db.query('select public.flemme_admin_api($1,$2::jsonb) as data', [action, JSON.stringify(data)])).rows[0].data;
async function service(action, data) {
  await db.exec('reset role; set role service_role');
  return (await db.query('select public.flemme_paiement_api($1,$2::jsonb) as data', [action, JSON.stringify(data)])).rows[0].data;
}

// 1. Livré fermé : formule « membre-premium » en brouillon, flag éteint, rien de proposé ni de souscriptible.
await as(member);
assert.deepEqual(await api('subscriptions'), { open: false, plans: [], mine: [] });
await assert.rejects(db.query('select * from flemme_v2.subscription_plans'), /permission denied/);
await assert.rejects(adm('plans'), /réservé/);
await assert.rejects(service('subscription_context', { userId: member, planId: 'membre-premium' }), /pas encore ouverts/);

// 2. L'équipe modifie la formule sans code ; une formule ouverte doit avoir un prix ; chaque changement est journalisé.
await as(admin);
let plans = await adm('plans');
assert.deepEqual(plans.plans.map(p => [p.id, p.status, p.monthlyAmount]), [['membre-premium', 'draft', null]]);
await assert.rejects(adm('plan_save', { id: 'membre-premium', name: 'Membre Premium', status: 'open' }), /check/);
await assert.rejects(adm('plan_save', { id: 'Pas Valide', name: 'x' }), /check/);
const plan = (await adm('plan_save', { id: 'membre-premium', name: 'Membre Premium', audience: 'membre', monthlyAmount: 490, yearlyAmount: 4900,
  trialDays: 14, perks: ['Alertes en priorité'], conditions: ['Sans engagement'], status: 'open', stripePriceMonthly: 'price_M1' })).plan;
assert.deepEqual([plan.monthlyAmount, plan.trialDays, plan.stripePriceMonthly, plan.stripePriceYearly], [490, 14, 'price_M1', null]);
await db.exec('reset role');
assert.equal((await db.query("select count(*)::int n from flemme_v2.admin_log where action = 'plan_save'")).rows[0].n, 1);

// 3. Toujours fermé tant que le flag n'est pas allumé dans l'environnement de la base.
await as(member);
assert.deepEqual((await api('subscriptions')).plans, []);
await db.exec('reset role');
await db.query("insert into flemme_v2.feature_flags(key, environment, state) select 'abonnements.souscription', coalesce(flag_environment, 'prod'), 'tous' from flemme_v2.settings");
await as(member);
let mine = await api('subscriptions');
assert.equal(mine.open, true);
// Seule la période avec un prix Stripe est proposée.
assert.deepEqual(mine.plans, [{ id: 'membre-premium', name: 'Membre Premium', monthlyAmount: 490, yearlyAmount: null, trialDays: 14, perks: ['Alertes en priorité'], conditions: ['Sans engagement'] }]);

// 4. Souscription : contexte, session, webhooks idempotents et cycle de vie.
await assert.rejects(service('subscription_context', { userId: member, planId: 'membre-premium', period: 'year' }), /pour cette période/);
await assert.rejects(service('subscription_context', { userId: member, planId: 'inconnue' }), /indisponible/);
const ctx = await service('subscription_context', { userId: member, planId: 'membre-premium', period: 'month' });
assert.deepEqual(ctx, { planId: 'membre-premium', name: 'Membre Premium', priceId: 'price_M1', trialDays: 14, customerId: null });
await service('subscription_created', { userId: member, planId: 'membre-premium', period: 'month', sessionId: 'cs_test_S1' });
await as(member); assert.deepEqual((await api('subscriptions')).mine, [], 'paiement pas encore fait');
const hook = (id, type, data) => service('webhook', { eventId: id, type, ...data });
assert.equal((await hook('evt_s1', 'checkout.session.completed', { mode: 'subscription', sessionId: 'cs_test_S1', subscriptionId: 'sub_1', customerId: 'cus_1' })).linked !== undefined, true);
assert.deepEqual(await hook('evt_s1', 'checkout.session.completed', { mode: 'subscription', sessionId: 'cs_test_S1', subscriptionId: 'sub_1', customerId: 'cus_1' }), { already: true });
assert.deepEqual(await hook('evt_s2', 'customer.subscription.updated', { subscriptionId: 'sub_1', status: 'trialing', currentPeriodEnd: 1800000000, cancelAtPeriodEnd: false }), { status: 'trialing' });
await as(member); mine = (await api('subscriptions')).mine;
assert.deepEqual(mine.map(s => [s.planId, s.status, s.cancelAtPeriodEnd]), [['membre-premium', 'trialing', false]]);
assert.ok(mine[0].currentPeriodEnd.startsWith('2027-01-15'));
await assert.rejects(service('subscription_context', { userId: member, planId: 'membre-premium' }), /déjà cet abonnement/);
assert.deepEqual(await service('subscription_customer', { userId: member }), { customerId: 'cus_1' });
await assert.rejects(service('subscription_customer', { userId: admin }), /Aucun abonnement/);
assert.deepEqual(await hook('evt_s3', 'customer.subscription.updated', { subscriptionId: 'sub_1', status: 'active', cancelAtPeriodEnd: true }), { status: 'active' });
assert.deepEqual(await hook('evt_s4', 'customer.subscription.deleted', { subscriptionId: 'sub_1', status: 'canceled' }), { status: 'canceled' });
assert.deepEqual(await hook('evt_s5', 'customer.subscription.updated', { subscriptionId: 'sub_inconnu', status: 'active' }), { ignored: 'abonnement inconnu' });
// Résilié : un nouvel abonnement redevient possible, avec le même client Stripe.
assert.equal((await service('subscription_context', { userId: member, planId: 'membre-premium' })).customerId, 'cus_1');
// Session abandonnée : la ligne incomplète est retirée.
await service('subscription_created', { userId: member, planId: 'membre-premium', period: 'month', sessionId: 'cs_test_S2' });
assert.deepEqual(await hook('evt_s6', 'checkout.session.expired', { mode: 'subscription', sessionId: 'cs_test_S2' }), { status: 'expired' });
await db.exec('reset role');
assert.equal((await db.query("select count(*)::int n from flemme_v2.subscriptions where checkout_session_id = 'cs_test_S2'")).rows[0].n, 0);

// 5. Les webhooks des paiements de mission passent toujours par leur propre traitement.
assert.deepEqual(await hook('evt_p1', 'checkout.session.completed', { sessionId: 'cs_inconnue', paymentStatus: 'paid' }), { ignored: 'session inconnue' });
console.log('abonnements.test.mjs : ok');
