// Tests des fonctions Edge de paiement avec un faux Stripe et une fausse base : aucun appel réseau, aucune clé réelle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { checkout, form, onboarding, settings, verifySignature, webhook } from '../functions/_shared/paiement.ts';

const TASK = '11111111-2222-4333-8444-555555555555';
const baseEnv: Record<string, string> = {
  STRIPE_SECRET_KEY: 'sk_test_factice', STRIPE_WEBHOOK_SECRET: 'whsec_factice', FLEMME_SITE_URL: 'https://preprod--flemmeorg.netlify.app/',
  SUPABASE_URL: 'https://exemple.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_factice',
};
const env = (over: Record<string, string | undefined> = {}) => ({ get: (k: string) => ({ ...baseEnv, ...over } as Record<string, string | undefined>)[k] });
type Call = { url: string; body: string; headers: Record<string, string> };
function fakeFetch(routes: Record<string, (body: string) => unknown>) {
  const calls: Call[] = [];
  const fn = (async (url: string, init: RequestInit = {}) => {
    const body = String(init.body ?? ''); calls.push({ url, body, headers: init.headers as Record<string, string> });
    const route = Object.keys(routes).find(r => url.endsWith(r) || url.includes(r + '?'));
    if (!route) return new Response(JSON.stringify({ message: 'route inconnue ' + url }), { status: 404 });
    const out = routes[route](body);
    return out instanceof Response ? out : new Response(JSON.stringify(out), { status: 200 });
  }) as typeof fetch;
  return { fn, calls };
}
const user = { '/auth/v1/user': () => ({ id: 'u-owner', email: 'deposant@example.org', email_confirmed_at: '2026-11-01' }) };
const post = (body: unknown, headers: Record<string, string> = { Authorization: 'Bearer jeton' }) =>
  new Request('https://fn/', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
const rpcAction = (body: string) => JSON.parse(body).p_action as string;

test('réglages : clé live refusée sans FLEMME_PAIEMENT_LIVE, secrets requis, HTTPS', () => {
  assert.equal(settings(env()).siteUrl, 'https://preprod--flemmeorg.netlify.app');
  assert.throws(() => settings(env({ STRIPE_SECRET_KEY: 'sk_live_x' })), /live refusée/);
  assert.equal(settings(env({ STRIPE_SECRET_KEY: 'sk_live_x', FLEMME_PAIEMENT_LIVE: 'oui' })).stripeKey, 'sk_live_x');
  assert.throws(() => settings(env({ STRIPE_SECRET_KEY: undefined })), /STRIPE_SECRET_KEY manquant/);
  assert.throws(() => settings(env({ STRIPE_SECRET_KEY: 'pk_test_x' })), /invalide/);
  assert.throws(() => settings(env({ FLEMME_SITE_URL: 'http://flemme.org' })), /HTTPS/);
  assert.deepEqual(settings(env({ STRIPE_WEBHOOK_SECRET: 'whsec_a, whsec_b' })).webhookSecrets, ['whsec_a', 'whsec_b']);
});

test('encodage Stripe', () => {
  assert.equal(form({ a: 1, 'b[c]': 'x y', d: undefined, e: true }), 'a=1&b%5Bc%5D=x%20y&e=true');
});

test('checkout : montants de l’accord serveur, commission en application_fee, Brigadier en destination', async () => {
  const { fn, calls } = fakeFetch({ ...user,
    '/rest/v1/rpc/flemme_paiement_api': body => rpcAction(body) === 'checkout_context'
      ? { title: 'Monter mon meuble', accountId: 'acct_B', total: 4400, commission: 400, payout: 4000, openUrl: null } : { ok: true },
    '/v1/checkout/sessions': () => ({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }) });
  const res = await checkout(post({ taskId: TASK, total: 1 }), { env: env(), fetch: fn, now: () => Date.UTC(2026, 10, 3, 20) });
  assert.equal(res.status, 200); assert.deepEqual(await res.json(), { url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://preprod--flemmeorg.netlify.app');
  const stripe = calls.find(c => c.url.includes('api.stripe.com'))!;
  const p = new URLSearchParams(stripe.body);
  assert.equal(p.get('line_items[0][price_data][unit_amount]'), '4400');
  assert.equal(p.get('payment_intent_data[application_fee_amount]'), '400');
  assert.equal(p.get('payment_intent_data[transfer_data][destination]'), 'acct_B');
  assert.equal(p.get('success_url'), 'https://preprod--flemmeorg.netlify.app/app.html#paiement-ok');
  assert.equal(stripe.headers.Authorization, 'Bearer sk_test_factice');
  assert.equal(stripe.headers['Idempotency-Key'], 'flemme-checkout-' + TASK + '-2026-11-03T20');
  const ctx = JSON.parse(calls.find(c => c.body.includes('checkout_context'))!.body);
  assert.deepEqual(ctx.p_data, { userId: 'u-owner', taskId: TASK });
  const saved = JSON.parse(calls.find(c => c.body.includes('checkout_created'))!.body).p_data;
  assert.deepEqual([saved.sessionId, saved.total, saved.commission, saved.payout], ['cs_test_1', 4400, 400, 4000]);
  assert.equal(calls.find(c => c.url.includes('/rest/v1/'))!.headers.Authorization, undefined, 'sb_secret uniquement en apikey');
});

test('checkout : modèle « prélèvement », session déjà ouverte réutilisée, refus propagés', async () => {
  const { fn, calls } = fakeFetch({ ...user, '/rest/v1/rpc/flemme_paiement_api': () => ({ title: 'x', accountId: 'acct_B', total: 4000, commission: 1400, payout: 2600, openUrl: null }),
    '/v1/checkout/sessions': () => ({ id: 'cs_test_2', url: 'u' }) });
  await checkout(post({ taskId: TASK }), { env: env(), fetch: fn });
  assert.equal(new URLSearchParams(calls.find(c => c.url.includes('stripe'))!.body).get('payment_intent_data[application_fee_amount]'), '1400');

  const open = fakeFetch({ ...user, '/rest/v1/rpc/flemme_paiement_api': () => ({ openUrl: 'https://checkout.stripe.com/deja' }) });
  assert.deepEqual(await (await checkout(post({ taskId: TASK }), { env: env(), fetch: open.fn })).json(), { url: 'https://checkout.stripe.com/deja' });
  assert.ok(!open.calls.some(c => c.url.includes('stripe.com/v1')));

  const refused = fakeFetch({ ...user, '/rest/v1/rpc/flemme_paiement_api': () => new Response(JSON.stringify({ message: 'Seul le déposant peut payer' }), { status: 403 }) });
  const r = await checkout(post({ taskId: TASK }), { env: env(), fetch: refused.fn });
  assert.equal(r.status, 409); assert.match((await r.json()).message, /Seul le déposant/);
  assert.equal((await checkout(post({ taskId: 'pas-un-uuid' }), { env: env(), fetch: fn })).status, 400);
  assert.equal((await checkout(post({ taskId: TASK }, {}), { env: env(), fetch: fn })).status, 401);
  const unconfirmed = fakeFetch({ '/auth/v1/user': () => ({ id: 'u', email_confirmed_at: null }) });
  assert.equal((await checkout(post({ taskId: TASK }), { env: env(), fetch: unconfirmed.fn })).status, 403);
  assert.equal((await checkout(new Request('https://fn/', { method: 'OPTIONS' }), { env: env(), fetch: fn })).status, 204);
  assert.equal((await checkout(post({ taskId: TASK }), { env: env({ STRIPE_SECRET_KEY: 'sk_live_x' }), fetch: fn })).status, 503);
});

test('onboarding : compte Express créé une seule fois puis lien Stripe', async () => {
  let stored: unknown = null;
  const { fn, calls } = fakeFetch({ ...user,
    '/rest/v1/rpc/flemme_paiement_api': body => {
      const { p_action, p_data } = JSON.parse(body);
      if (p_action === 'account_save') stored = { id: p_data.accountId, chargesEnabled: false };
      return { account: stored };
    },
    '/v1/accounts': () => ({ id: 'acct_New' }),
    '/v1/account_links': () => ({ url: 'https://connect.stripe.com/setup/e/acct_New/x' }) });
  const deps = { env: env(), fetch: fn };
  assert.deepEqual(await (await onboarding(post({}), deps)).json(), { url: 'https://connect.stripe.com/setup/e/acct_New/x', chargesEnabled: false });
  await onboarding(post({}), deps);
  assert.equal(calls.filter(c => c.url.endsWith('/v1/accounts')).length, 1);
  const acc = new URLSearchParams(calls.find(c => c.url.endsWith('/v1/accounts'))!.body);
  assert.deepEqual([acc.get('type'), acc.get('country'), acc.get('capabilities[transfers][requested]')], ['express', 'FR', 'true']);
  const link = new URLSearchParams(calls.find(c => c.url.endsWith('/v1/account_links'))!.body);
  assert.equal(link.get('return_url'), 'https://preprod--flemmeorg.netlify.app/app.html#compte');
});

const sign = (payload: string, secret: string, t: number) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')}`;

test('signature Stripe : valide, falsifiée, périmée', async () => {
  const t = 1_800_000_000, body = '{"id":"evt_1"}';
  assert.equal(await verifySignature(body, sign(body, 'whsec_factice', t), 'whsec_factice', t + 10), true);
  assert.equal(await verifySignature(body + ' ', sign(body, 'whsec_factice', t), 'whsec_factice', t), false);
  assert.equal(await verifySignature(body, sign(body, 'autre', t), 'whsec_factice', t), false);
  assert.equal(await verifySignature(body, sign(body, 'whsec_factice', t), 'whsec_factice', t + 301), false);
  assert.equal(await verifySignature(body, null, 'whsec_factice', t), false);
});

test('webhook : paiement, expiration, compte connecté ; refus sans signature valide', async () => {
  const now = Date.UTC(2026, 10, 3, 20), t = Math.floor(now / 1000);
  const { fn, calls } = fakeFetch({ '/rest/v1/rpc/flemme_paiement_api': () => ({ ok: true }) });
  const send = (event: unknown, secret = 'whsec_factice') => {
    const body = JSON.stringify(event);
    return webhook(post(body, { 'Stripe-Signature': sign(body, secret, t) }), { env: env({ STRIPE_WEBHOOK_SECRET: 'whsec_autre,whsec_factice' }), fetch: fn, now: () => now });
  };
  assert.equal((await send({ type: 'checkout.session.completed', data: { object: { id: 'cs_1', payment_status: 'paid', amount_total: 4400, payment_intent: 'pi_1' } } })).status, 200);
  await send({ type: 'checkout.session.completed', data: { object: { id: 'cs_2', payment_status: 'unpaid' } } });
  await send({ type: 'checkout.session.expired', data: { object: { id: 'cs_3' } } });
  await send({ type: 'account.updated', data: { object: { id: 'acct_B', charges_enabled: true, payouts_enabled: false } } });
  await send({ type: 'payout.paid', data: { object: {} } });
  assert.deepEqual(calls.map(c => JSON.parse(c.body)), [
    { p_action: 'checkout_paid', p_data: { sessionId: 'cs_1', amountTotal: 4400, paymentIntentId: 'pi_1' } },
    { p_action: 'checkout_expired', p_data: { sessionId: 'cs_3' } },
    { p_action: 'account_update', p_data: { accountId: 'acct_B', chargesEnabled: true, payoutsEnabled: false } }]);
  const forged = await send({ type: 'checkout.session.completed', data: { object: { id: 'cs_9', payment_status: 'paid' } } }, 'whsec_pirate');
  assert.equal(forged.status, 400); assert.equal(calls.length, 3);
  assert.equal(forged.headers.get('Access-Control-Allow-Origin'), null);
});
