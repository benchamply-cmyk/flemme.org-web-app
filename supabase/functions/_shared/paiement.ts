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
    const back = s.siteUrl + '/app.html#compte';
    const link = await stripe(deps, s, 'account_links', { account: account.id, type: 'account_onboarding', refresh_url: back, return_url: back },
      'flemme-link-' + user.id + '-' + Math.floor((deps.now?.() ?? Date.now()) / 60000));
    return { url: link.url, chargesEnabled: account.chargesEnabled };
  });
}

// POST /functions/v1/stripe-checkout { taskId } : session Stripe Checkout pour une tâche terminée.
// Paiement « destination » : le Brigadier reçoit total − commission, FLEMME garde application_fee_amount.
export function checkout(request: Request, deps: Deps) {
  return run(request, deps, async s => {
    const user = await currentUser(deps, s, request);
    const body = await request.json().catch(() => ({}));
    const taskId = typeof body?.taskId === 'string' && /^[0-9a-f-]{36}$/i.test(body.taskId) ? body.taskId : '';
    if (!taskId) throw new HttpError(400, 'Flemme introuvable.');
    const ctx = await rpc(deps, s, 'checkout_context', { userId: user.id, taskId });
    if (ctx.openUrl) return { url: ctx.openUrl };
    const fee = ctx.total - ctx.payout;
    const now = deps.now?.() ?? Date.now();
    const session = await stripe(deps, s, 'checkout/sessions', {
      mode: 'payment', locale: 'fr', client_reference_id: taskId,
      'line_items[0][quantity]': 1, 'line_items[0][price_data][currency]': 'eur', 'line_items[0][price_data][unit_amount]': ctx.total,
      'line_items[0][price_data][product_data][name]': ('FLEMME · ' + ctx.title).slice(0, 250),
      'payment_intent_data[application_fee_amount]': fee, 'payment_intent_data[transfer_data][destination]': ctx.accountId,
      'payment_intent_data[metadata][task_id]': taskId, 'metadata[task_id]': taskId, 'metadata[user_id]': user.id,
      success_url: s.siteUrl + '/app.html#paiement-ok', cancel_url: s.siteUrl + '/app.html#paiement-annule',
      expires_at: Math.floor(now / 1000) + 23 * 3600,
    }, 'flemme-checkout-' + taskId + '-' + new Date(now).toISOString().slice(0, 13));
    await rpc(deps, s, 'checkout_created', { userId: user.id, taskId, sessionId: session.id, url: session.url, accountId: ctx.accountId, total: ctx.total, commission: fee, payout: ctx.payout });
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
    if ((event.type === 'checkout.session.completed' && o.payment_status === 'paid') || event.type === 'checkout.session.async_payment_succeeded')
      await rpc(deps, s, 'checkout_paid', { sessionId: o.id, amountTotal: o.amount_total, paymentIntentId: o.payment_intent });
    else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed')
      await rpc(deps, s, 'checkout_expired', { sessionId: o.id });
    else if (event.type === 'account.updated')
      await rpc(deps, s, 'account_update', { accountId: o.id, chargesEnabled: !!o.charges_enabled, payoutsEnabled: !!o.payouts_enabled });
    return { received: true };
  }, false);
}
