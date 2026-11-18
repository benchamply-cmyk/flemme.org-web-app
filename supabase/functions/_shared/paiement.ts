// Logique des fonctions Edge de paiement (Stripe Connect), sans dépendance : tourne sous Deno (Supabase)
// et sous Node pour les tests (supabase/tests/functions.test.ts). Aucun appel réel à Stripe dans les tests.
//
// Secrets à définir dans Supabase (Project Settings > Edge Functions > Secrets), jamais dans le dépôt :
//   STRIPE_SECRET_KEY      sk_test_… en préprod. Une clé sk_live_/rk_live_ est refusée tant que
//                          FLEMME_PAIEMENT_LIVE n'est pas à « oui ».
//   STRIPE_WEBHOOK_SECRET  whsec_… ; plusieurs valeurs séparées par des virgules si deux points de terminaison
//                          (paiements de la plateforme + événements des comptes connectés).
//   FLEMME_SITE_URL        https://flemme.org ou l'adresse de préprod : retours Stripe et CORS.
// Fournis par Supabase : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

export type Env = { get(name: string): string | undefined };
export type Deps = { env: Env; fetch: typeof fetch; now?: () => number };
type Params = Record<string, string | number | boolean | undefined>;
type Settings = { stripeKey: string; webhookSecrets: string[]; supabaseUrl: string; serviceKey: string; siteUrl: string };

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export function settings(env: Env): Settings {
  const need = (name: string) => {
    const value = env.get(name)?.trim();
    if (!value) throw new HttpError(503, `Paiement en ligne non configuré (${name} manquant).`);
    return value;
  };
  const stripeKey = need('STRIPE_SECRET_KEY');
  if (!/^(sk|rk)_(test|live)_/.test(stripeKey)) throw new HttpError(503, 'Clé Stripe invalide.');
  if (/_live_/.test(stripeKey) && env.get('FLEMME_PAIEMENT_LIVE') !== 'oui') throw new HttpError(503, 'Clé Stripe live refusée : FLEMME_PAIEMENT_LIVE n’est pas activé.');
  const siteUrl = need('FLEMME_SITE_URL').replace(/\/$/, '');
  if (!/^https:\/\//.test(siteUrl)) throw new HttpError(503, 'FLEMME_SITE_URL doit être en HTTPS.');
  return { stripeKey, siteUrl, supabaseUrl: need('SUPABASE_URL').replace(/\/$/, ''), serviceKey: need('SUPABASE_SERVICE_ROLE_KEY'),
    webhookSecrets: (env.get('STRIPE_WEBHOOK_SECRET') || '').split(',').map(s => s.trim()).filter(Boolean) };
}

// Encodage application/x-www-form-urlencoded attendu par l'API Stripe (clés déjà au format a[b][c]).
export function form(params: Params): string {
  return Object.entries(params).filter(([, v]) => v !== undefined)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v))).join('&');
}

async function stripe(deps: Deps, s: Settings, path: string, params: Params, idempotencyKey: string) {
  const response = await deps.fetch('https://api.stripe.com/v1/' + path, { method: 'POST', body: form(params), headers: {
    Authorization: 'Bearer ' + s.stripeKey, 'Content-Type': 'application/x-www-form-urlencoded',
    'Idempotency-Key': idempotencyKey } });
  const body = await response.json();
  if (!response.ok) throw new HttpError(502, 'Stripe : ' + (body?.error?.message || 'erreur ' + response.status));
  return body;
}

// RPC réservée à service_role (paiement.sql). sb_secret_… passe seulement en apikey ; l'ancienne clé JWT aussi en Bearer.
async function rpc(deps: Deps, s: Settings, action: string, data: Record<string, unknown>) {
  const headers: Record<string, string> = { apikey: s.serviceKey, 'Content-Type': 'application/json' };
  if (s.serviceKey.startsWith('eyJ')) headers.Authorization = 'Bearer ' + s.serviceKey;
  const response = await deps.fetch(s.supabaseUrl + '/rest/v1/rpc/flemme_paiement_api', { method: 'POST', headers, body: JSON.stringify({ p_action: action, p_data: data }) });
  const body = await response.json();
  if (!response.ok) throw new HttpError(response.status >= 500 ? 502 : 409, body?.message || 'Base de données indisponible.');
  return body;
}

// Identité vérifiée par Supabase Auth à partir du jeton de session envoyé par l'app.
async function currentUser(deps: Deps, s: Settings, request: Request): Promise<{ id: string; email: string }> {
  const auth = request.headers.get('Authorization') || '';
  if (!/^Bearer \S+$/.test(auth)) throw new HttpError(401, 'Connecte-toi pour continuer.');
  const response = await deps.fetch(s.supabaseUrl + '/auth/v1/user', { headers: { apikey: s.serviceKey, Authorization: auth } });
  const user = await response.json();
  if (!response.ok || !user?.id) throw new HttpError(401, 'Session expirée. Reconnecte-toi.');
  if (!user.email_confirmed_at || user.is_anonymous) throw new HttpError(403, 'Compte confirmé requis.');
  return { id: user.id, email: user.email || '' };
}

function cors(s: Settings | null): Record<string, string> {
  return s ? { 'Access-Control-Allow-Origin': s.siteUrl, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' } : {};
}
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

async function run(request: Request, deps: Deps, handler: (s: Settings) => Promise<unknown>, withCors = true) {
  let s: Settings | null = null;
  try {
    s = settings(deps.env);
    if (withCors && request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(s) });
    if (request.method !== 'POST') throw new HttpError(405, 'Méthode non autorisée.');
    return json(200, await handler(s), withCors ? cors(s) : {});
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error(e);
    return json(status, { message: status === 500 ? 'Erreur interne.' : (e as Error).message }, withCors ? cors(s) : {});
  }
}

// POST /functions/v1/stripe-onboarding : crée (une fois) le compte Stripe Express du Brigadier
// et renvoie le lien d'inscription Stripe (identité, IBAN). Stripe gère le KYC.
export function onboarding(request: Request, deps: Deps) {
  return run(request, deps, async s => {
    const user = await currentUser(deps, s, request);
    let account = (await rpc(deps, s, 'account_get', { userId: user.id })).account;
    if (!account) {
      const created = await stripe(deps, s, 'accounts', { type: 'express', country: 'FR', email: user.email || undefined,
        business_type: 'individual', 'capabilities[card_payments][requested]': true, 'capabilities[transfers][requested]': true,
        'metadata[flemme_user_id]': user.id }, 'flemme-account-' + user.id);
      account = (await rpc(deps, s, 'account_save', { userId: user.id, accountId: created.id })).account;
    }
    const back = s.siteUrl + '/compte';
    const link = await stripe(deps, s, 'account_links', { account: account.id, type: 'account_onboarding', refresh_url: back, return_url: back },
      'flemme-link-' + user.id + '-' + Math.floor((deps.now?.() ?? Date.now()) / 60000));
    return { url: link.url, chargesEnabled: account.chargesEnabled };
  });
}

// POST /functions/v1/stripe-checkout { taskId, stage? } : session Stripe Checkout.
// stage « signature » (v2.0.0, payment_mode = 'stripe') : le déposant paie le total dès la signature de l'accord.
//   Charges séparées : Flemme encaisse, puis verse la part du membre à la fin de la mission (stripe-payout).
// sinon (ancien parcours) : tâche terminée, paiement « destination », le membre reçoit total − commission tout de suite.
export function checkout(request: Request, deps: Deps) {
  return run(request, deps, async s => {
    const user = await currentUser(deps, s, request);
    const body = await request.json().catch(() => ({}));
    const taskId = typeof body?.taskId === 'string' && /^[0-9a-f-]{36}$/i.test(body.taskId) ? body.taskId : '';
    if (!taskId) throw new HttpError(400, 'Flemme introuvable.');
    const signature = body?.stage === 'signature';
    const ctx = await rpc(deps, s, signature ? 'signature_context' : 'checkout_context', { userId: user.id, taskId });
    if (ctx.openUrl) return { url: ctx.openUrl };
    const fee = ctx.total - ctx.payout;
    const now = deps.now?.() ?? Date.now();
    const common = {
      mode: 'payment', locale: 'fr', client_reference_id: taskId,
      'line_items[0][quantity]': 1, 'line_items[0][price_data][currency]': 'eur', 'line_items[0][price_data][unit_amount]': ctx.total,
      'line_items[0][price_data][product_data][name]': ('FLEMME · ' + ctx.title).slice(0, 250),
      'payment_intent_data[metadata][task_id]': taskId, 'metadata[task_id]': taskId, 'metadata[user_id]': user.id,
      success_url: s.siteUrl + '/paiement/ok', cancel_url: s.siteUrl + '/paiement/annule',
      expires_at: Math.floor(now / 1000) + 23 * 3600,
    };
    const hour = new Date(now).toISOString().slice(0, 13);
    if (signature) {
      // Clé d'idempotence liée au montant : un nouveau prix (nouvelle version d'accord) ouvre une nouvelle session.
      const session = await stripe(deps, s, 'checkout/sessions', { ...common,
        'line_items[0][price_data][product_data][description]': `Prix convenu ${euros(ctx.payout)} + frais de plateforme ${euros(fee)}`,
        'payment_intent_data[transfer_group]': 'flemme-' + taskId, 'payment_intent_data[metadata][stage]': 'signature', 'metadata[stage]': 'signature',
      }, `flemme-signature-${taskId}-${ctx.total}-${hour}`);
      await rpc(deps, s, 'signature_created', { userId: user.id, taskId, sessionId: session.id, url: session.url, total: ctx.total, commission: fee, payout: ctx.payout });
      return { url: session.url };
    }
    const session = await stripe(deps, s, 'checkout/sessions', { ...common,
      'payment_intent_data[application_fee_amount]': fee, 'payment_intent_data[transfer_data][destination]': ctx.accountId,
    }, 'flemme-checkout-' + taskId + '-' + hour);
    await rpc(deps, s, 'checkout_created', { userId: user.id, taskId, sessionId: session.id, url: session.url, accountId: ctx.accountId, total: ctx.total, commission: fee, payout: ctx.payout });
    return { url: session.url };
  });
}

const euros = (cents: number) => (cents / 100).toFixed(2).replace('.', ',').replace(/,00$/, '') + ' €';

// POST /functions/v1/stripe-payout { taskId } : verse la part du membre une fois la mission terminée et payée à la signature.
// Déclenché par le déposant ou le membre ; une seule fois (clé d'idempotence par flemme, et contrôle en base).
export function payout(request: Request, deps: Deps) {
  return run(request, deps, async s => {
    const user = await currentUser(deps, s, request);
    const body = await request.json().catch(() => ({}));
    const taskId = typeof body?.taskId === 'string' && /^[0-9a-f-]{36}$/i.test(body.taskId) ? body.taskId : '';
    if (!taskId) throw new HttpError(400, 'Flemme introuvable.');
    const ctx = await rpc(deps, s, 'payout_context', { userId: user.id, taskId });
    if (ctx.done) return { done: true };
    const transfer = await stripe(deps, s, 'transfers', { amount: ctx.amount, currency: 'eur', destination: ctx.accountId,
      transfer_group: 'flemme-' + taskId, 'metadata[task_id]': taskId, 'metadata[session_id]': ctx.sessionId }, 'flemme-transfer-' + taskId);
    await rpc(deps, s, 'payout_done', { userId: user.id, sessionId: ctx.sessionId, transferId: transfer.id });
    return { done: true };
  });
}

// POST /functions/v1/stripe-subscribe { planId, period? } : session Stripe Checkout en mode abonnement.
//        { action: 'portal' } : portail client Stripe (résilier, changer de carte, factures).
// La base vérifie le flag abonnements.souscription, le statut de la formule et son prix Stripe : rien n'est ouvert sans Ben.
export function subscribe(request: Request, deps: Deps) {
  return run(request, deps, async s => {
    const user = await currentUser(deps, s, request);
    const body = await request.json().catch(() => ({}));
    if (body?.action === 'portal') {
      const { customerId } = await rpc(deps, s, 'subscription_customer', { userId: user.id });
      const portal = await stripe(deps, s, 'billing_portal/sessions', { customer: customerId, return_url: s.siteUrl + '/mon-espace' },
        'flemme-portal-' + user.id + '-' + Math.floor((deps.now?.() ?? Date.now()) / 60000));
      return { url: portal.url };
    }
    const planId = typeof body?.planId === 'string' && /^[a-z][a-z0-9-]{1,39}$/.test(body.planId) ? body.planId : '';
    if (!planId) throw new HttpError(400, 'Formule introuvable.');
    const period = body?.period === 'year' ? 'year' : 'month';
    const ctx = await rpc(deps, s, 'subscription_context', { userId: user.id, planId, period });
    const now = deps.now?.() ?? Date.now();
    const session = await stripe(deps, s, 'checkout/sessions', {
      mode: 'subscription', locale: 'fr', client_reference_id: user.id,
      'line_items[0][price]': ctx.priceId, 'line_items[0][quantity]': 1,
      customer: ctx.customerId || undefined, customer_email: ctx.customerId ? undefined : (user.email || undefined),
      'subscription_data[trial_period_days]': ctx.trialDays > 0 ? ctx.trialDays : undefined,
      'subscription_data[metadata][flemme_user_id]': user.id, 'subscription_data[metadata][plan_id]': planId,
      'metadata[user_id]': user.id, 'metadata[plan_id]': planId,
      success_url: s.siteUrl + '/mon-espace?abonnement=ok', cancel_url: s.siteUrl + '/premium',
      expires_at: Math.floor(now / 1000) + 23 * 3600,
    }, `flemme-subscribe-${user.id}-${planId}-${period}-${new Date(now).toISOString().slice(0, 13)}`);
    await rpc(deps, s, 'subscription_created', { userId: user.id, planId, period, sessionId: session.id });
    return { url: session.url };
  });
}

// Vérification de l'en-tête Stripe-Signature (HMAC-SHA256 de « t.corps », tolérance 5 min).
export async function verifySignature(payload: string, header: string | null, secret: string, nowSeconds: number, tolerance = 300) {
  if (!header) return false;
  const parts = header.split(',').map(p => p.split('=', 2) as [string, string]);
  const t = Number(parts.find(([k]) => k === 't')?.[1]);
  if (!Number.isFinite(t) || Math.abs(nowSeconds - t) > tolerance) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(t + '.' + payload)));
  const expected = Array.from(mac, b => b.toString(16).padStart(2, '0')).join('');
  return parts.some(([k, v]) => k === 'v1' && v.length === expected.length && [...v].reduce((d, c, i) => d | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0);
}

// POST /functions/v1/stripe-webhook (déployée avec --no-verify-jwt : Stripe n'a pas de session Supabase).
export function webhook(request: Request, deps: Deps) {
  return run(request, deps, async s => {
    const payload = await request.text();
    const now = Math.floor((deps.now?.() ?? Date.now()) / 1000);
    let valid = false;
    for (const secret of s.webhookSecrets) if (await verifySignature(payload, request.headers.get('Stripe-Signature'), secret, now)) valid = true;
    if (!valid) throw new HttpError(400, 'Signature Stripe invalide.');
    const event = JSON.parse(payload), o = event.data?.object || {};
    if (typeof event.id !== 'string' || !/^evt_[A-Za-z0-9_]+$/.test(event.id)) throw new HttpError(400, 'Événement Stripe invalide.');
    // Tout passe par une seule action en base, dans une transaction : l'identifiant evt_… y est enregistré,
    // un événement rejoué ne fait donc rien deux fois. Les types non suivis sont notés puis ignorés.
    const data: Record<string, unknown> = { eventId: event.id, type: event.type };
    if (String(event.type).startsWith('checkout.session.') && o.mode === 'subscription')
      Object.assign(data, { sessionId: o.id, mode: 'subscription', subscriptionId: o.subscription, customerId: o.customer });
    else if (String(event.type).startsWith('checkout.session.'))
      Object.assign(data, { sessionId: o.id, paymentStatus: o.payment_status, amountTotal: o.amount_total, paymentIntentId: o.payment_intent });
    else if (String(event.type).startsWith('customer.subscription.'))
      Object.assign(data, { subscriptionId: o.id, customerId: o.customer, status: o.status, cancelAtPeriodEnd: !!o.cancel_at_period_end,
        currentPeriodEnd: o.current_period_end ?? o.items?.data?.[0]?.current_period_end });
    else if (event.type === 'charge.refunded')
      Object.assign(data, { paymentIntentId: o.payment_intent, refunded: !!o.refunded, amountRefunded: o.amount_refunded });
    else if (event.type === 'charge.dispute.created' || event.type === 'charge.dispute.closed')
      Object.assign(data, { paymentIntentId: o.payment_intent, disputeStatus: o.status });
    else if (event.type === 'account.updated')
      Object.assign(data, { accountId: o.id, chargesEnabled: !!o.charges_enabled, payoutsEnabled: !!o.payouts_enabled });
    await rpc(deps, s, 'webhook', data);
    return { received: true };
  }, false);
}
