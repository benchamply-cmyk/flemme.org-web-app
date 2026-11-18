// Tests de la migration « paiement à la signature » (20261118120000) sur PGlite, sans Stripe ni réseau.
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
const [owner, member, other] = [randomUUID(), randomUUID(), randomUUID()];
for (const [i, id] of [owner, member, other].entries())
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [id, `m${i}@example.org`]);
const dir = new URL('../migrations/', import.meta.url);
for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, dir), 'utf8'));
await db.exec('update flemme_v2.settings set moderation_tasks = false, moderation_offers = false, moderation_agreements = false');

async function as(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{}',false)", [id]);
  await db.exec('set role authenticated');
}
const api = async (action, task = null, data = {}, request = randomUUID()) =>
  (await db.query('select public.flemme_mobile_api($1,$2,$3::jsonb,$4) as data', [action, task, JSON.stringify(data), request])).rows[0].data;
async function service(action, data) {
  await db.exec('reset role; set role service_role');
  return (await db.query('select public.flemme_paiement_api($1,$2::jsonb) as data', [action, JSON.stringify(data)])).rows[0].data;
}
async function setting(mode) { await db.exec('reset role'); await db.query('update flemme_v2.settings set payment_mode = $1', [mode]); }
const terms = { scope: 'Monter le meuble', deliverable: 'Meuble monté et stable', quality: 'Portes alignées', deadline: 'Samedi',
  acceptance: 'Le déposant vérifie sur place le jour même', cancellation: 'Gratuite jusqu’à 24 h avant', confidentiality: 'Adresse privée' };
async function assigned(amount = 4000) {
  await as(owner); let t = (await api('create', null, { title: 'Meuble', details: 'Un meuble à monter', place: 'Aix' })).task;
  await as(member); t = (await api('offer', t.id, { amount, slot: 'Samedi', scope: 'Montage' })).task;
  await as(owner); return (await api('accept', t.id, { offerId: t.offers[0].id })).task;
}
async function signed(t, amount) {
  await as(owner); await api('agreement_save', t.id, amount ? { ...terms, amount } : terms);
  await api('agreement_submit', t.id);
  await api('agreement_sign', t.id, { signature: 'Déposant', accept: true });
  await as(member); return (await api('agreement_sign', t.id, { signature: 'Membre', accept: true })).task;
}

// 1. Réglage livré : paiement direct, rien ne change (le prix ne se modifie pas dans l'accord).
let t = await assigned();
assert.equal(t.paymentMode, 'direct');
await assert.rejects(api('agreement_save', t.id, { ...terms, amount: 5000 }), /ne se modifie pas/);
await assert.rejects(api('pay', t.id), /Paiement indisponible/);
t = await signed(t);
assert.equal(t.contract.version, 1);
assert.equal(t.contract.feeDueAt !== null, true);
assert.ok(!t.history.some(h => /Frais de plateforme dus/.test(h.text)), 'pas de frais à la signature en mode direct');
await as(owner); await api('complete', t.id); await api('declare_payment', t.id);

// 2. Contrat v0.2 : rubriques obligatoires, rubriques facultatives gardées, modèle noté.
t = await assigned();
await assert.rejects(api('agreement_save', t.id, { ...terms, acceptance: '' }), /./);
await setting('simulation');
t = await assigned(4000);
assert.equal(t.paymentMode, 'simulation');
await as(owner);
t = (await api('agreement_save', t.id, { ...terms, access: 'Clés chez la gardienne', amount: 5000 })).task;
assert.equal(t.contract.terms.template, '0.2');
assert.equal(t.contract.terms.access, 'Clés chez la gardienne');
assert.equal(t.contract.terms.liability, undefined);
assert.deepEqual([t.agreement.amount, t.agreement.commission, t.agreement.total, t.agreement.payout], [5000, 500, 5500, 5000]);
assert.ok(t.history.some(h => h.text === 'Prix convenu modifié dans l’accord : 50 €'.replace('’', "'")));
// Le membre choisi peut aussi proposer un autre prix ; chaque enregistrement crée une version.
await as(member);
t = (await api('agreement_save', t.id, { ...terms, amount: 4550 })).task;
assert.deepEqual([t.contract.version, t.agreement.commission, t.agreement.total], [2, 455, 5005]);
await as(other); await assert.rejects(api('agreement_save', t.id, { ...terms, amount: 1 }), /inaccessible/);

// 3. Signature : les frais deviennent dus à la seconde signature ; fin et déclaration directe bloquées avant paiement.
await as(owner); await api('agreement_submit', t.id); await api('agreement_sign', t.id, { signature: 'Déposant', accept: true });
await assert.rejects(api('pay', t.id), /accord signé/);
await as(member); t = (await api('agreement_sign', t.id, { signature: 'Membre', accept: true })).task;
assert.equal(t.contract.status, 'signed'); assert.ok(t.contract.feeDueAt);
assert.ok(t.history.some(h => h.text === 'Frais de plateforme dus : 4,55 € (10 % du prix convenu), à la charge du déposant'), JSON.stringify(t.history));
await as(member); await assert.rejects(api('agreement_save', t.id, { ...terms, amount: 9000 }), /déjà signé/);
await as(member); await assert.rejects(api('pay', t.id), /Paiement indisponible/);
await as(owner);
await assert.rejects(api('complete', t.id), /payée via Flemme/);
await db.exec('reset role');
await assert.rejects(db.query('update flemme_v2.tasks set payment_declared = true where id = $1', [t.id]), /se paie via Flemme/);
await assert.rejects(db.query("update flemme_v2.tasks set payment_mode = 'direct' where id = $1", [t.id]), /ne change plus/);

// 4. Paiement simulé : une fois, idempotent par identifiant de requête, puis fin de mission possible.
await as(owner);
const req = randomUUID();
t = (await api('pay', t.id, {}, req)).task;
assert.deepEqual([t.payment.method, t.payment.status, t.payment.total, t.payment.commission, t.payment.payout], ['simulation', 'paid', 5005, 455, 4550]);
assert.deepEqual((await api('pay', t.id, {}, req)).task.payment.total, 5005, 'requête rejouée');
await assert.rejects(api('pay', t.id), /déjà payée/);
t = (await api('complete', t.id)).task;
assert.equal(t.status, 'completed');
await db.exec('reset role');
assert.deepEqual((await db.query('select version, amount from flemme_v2.agreement_versions where task_id = $1 order by version', [t.id])).rows,
  [{ version: 1, amount: 5000 }, { version: 2, amount: 4550 }]);
await as(other); await assert.rejects(db.query('select * from flemme_v2.agreement_versions'), /permission denied/);
await assert.rejects(db.query('select * from flemme_v2.stripe_events'), /permission denied/);
await assert.rejects(db.query("select public.flemme_paiement_api('webhook','{}')"), /permission denied/);

// 5. Stripe à la signature : contexte, session, webhooks idempotents et statuts, versement à la fin.
await setting('stripe');
t = await signed(await assigned(3000));
await as(owner); await assert.rejects(api('pay', t.id), /par carte via Stripe/);
await assert.rejects(service('signature_context', { userId: member, taskId: t.id }), /Seul le déposant/);
let ctx = await service('signature_context', { userId: owner, taskId: t.id });
assert.deepEqual([ctx.total, ctx.commission, ctx.payout, ctx.openUrl], [3300, 300, 3000, null]);
await service('signature_created', { userId: owner, taskId: t.id, sessionId: 'cs_test_A', url: 'https://checkout.stripe.com/a', total: 3300, commission: 300, payout: 3000 });
assert.equal((await service('signature_context', { userId: owner, taskId: t.id })).openUrl, 'https://checkout.stripe.com/a');
const hook = (id, type, data) => service('webhook', { eventId: id, type, ...data });
await assert.rejects(hook('evt_bad', 'checkout.session.completed', { sessionId: 'cs_test_A', paymentStatus: 'paid', amountTotal: 1, paymentIntentId: 'pi_A' }), /Montant/);
assert.deepEqual(await hook('evt_1', 'checkout.session.completed', { sessionId: 'cs_test_A', paymentStatus: 'paid', amountTotal: 3300, paymentIntentId: 'pi_A' }), { status: 'paid' });
assert.deepEqual(await hook('evt_1', 'checkout.session.completed', { sessionId: 'cs_test_A', paymentStatus: 'paid', amountTotal: 3300, paymentIntentId: 'pi_A' }), { already: true });
assert.deepEqual(await hook('evt_2', 'payout.paid', {}), { ignored: 'payout.paid' });
await assert.rejects(service('signature_context', { userId: owner, taskId: t.id }), /déjà payée/);
await as(owner); t = (await api('list')).tasks.find(x => x.id === t.id);
assert.deepEqual([t.payment.method, t.payment.status], ['stripe', 'paid']);
await assert.rejects(service('payout_context', { userId: owner, taskId: t.id }), /mission terminée/);
await as(owner); await api('complete', t.id);
await assert.rejects(service('payout_context', { userId: other, taskId: t.id }), /inaccessible/);
await assert.rejects(service('payout_context', { userId: member, taskId: t.id }), /activer ses paiements/);
await db.exec('reset role');
await db.query("insert into flemme_v2.brigadier_accounts(user_id, stripe_account_id, charges_enabled, payouts_enabled) values($1,'acct_M',true,true)", [member]);
assert.deepEqual(await service('payout_context', { userId: member, taskId: t.id }), { accountId: 'acct_M', amount: 3000, sessionId: 'cs_test_A', paymentIntentId: 'pi_A' });
await service('payout_done', { userId: member, sessionId: 'cs_test_A', transferId: 'tr_1' });
await service('payout_done', { userId: member, sessionId: 'cs_test_A', transferId: 'tr_2' });
assert.deepEqual(await service('payout_context', { userId: member, taskId: t.id }), { done: true });
await as(member); t = (await api('list')).tasks.find(x => x.id === t.id);
assert.ok(t.payment.transferredAt);
assert.equal(t.history.filter(h => /Part du membre versée/.test(h.text)).length, 1);

// Contestation puis remboursement : statuts disputed, paid (gagnée), refunded.
assert.deepEqual(await hook('evt_3', 'charge.dispute.created', { paymentIntentId: 'pi_A' }), { status: 'disputed' });
assert.deepEqual(await hook('evt_4', 'charge.dispute.closed', { paymentIntentId: 'pi_A', disputeStatus: 'won' }), { status: 'paid' });
assert.deepEqual(await hook('evt_5', 'charge.refunded', { paymentIntentId: 'pi_A', refunded: false, amountRefunded: 500 }), { status: 'paid', partial: true });
assert.deepEqual(await hook('evt_6', 'charge.refunded', { paymentIntentId: 'pi_A', refunded: true, amountRefunded: 3300 }), { status: 'refunded' });

// Moyen de paiement différé : authorized puis failed ; session expirée.
t = await signed(await assigned(2000));
await service('signature_created', { userId: owner, taskId: t.id, sessionId: 'cs_test_B', url: 'u', total: 2200, commission: 200, payout: 2000 });
assert.deepEqual(await hook('evt_7', 'checkout.session.completed', { sessionId: 'cs_test_B', paymentStatus: 'unpaid', paymentIntentId: 'pi_B' }), { status: 'authorized' });
await as(owner); assert.equal((await api('list')).tasks.find(x => x.id === t.id).payment.status, 'authorized');
assert.deepEqual(await hook('evt_8', 'checkout.session.async_payment_failed', { sessionId: 'cs_test_B' }), { status: 'failed' });
await service('signature_created', { userId: owner, taskId: t.id, sessionId: 'cs_test_C', url: 'u', total: 2200, commission: 200, payout: 2000 });
assert.deepEqual(await hook('evt_9', 'checkout.session.expired', { sessionId: 'cs_test_C' }), { status: 'expired' });
assert.deepEqual(await hook('evt_10', 'checkout.session.completed', { sessionId: 'cs_inconnue', paymentStatus: 'paid' }), { ignored: 'session inconnue' });

// Ancien parcours (paiement après la tâche) : toujours servi par le même webhook.
await db.exec('reset role');
await db.query("insert into flemme_v2.payments(checkout_session_id, task_id, payer_id, stripe_account_id, checkout_url, total, commission, payout) values('cs_test_old', null, $1, 'acct_M', 'u', 1100, 100, 1000)", [owner]);
assert.deepEqual(await hook('evt_11', 'checkout.session.completed', { sessionId: 'cs_test_old', paymentStatus: 'paid', amountTotal: 1100, paymentIntentId: 'pi_old' }), { ok: true });
console.log('signature.test.mjs : ok');
