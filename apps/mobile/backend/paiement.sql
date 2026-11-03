-- FLEMME : encaissement en ligne via Stripe Connect (brouillon, novembre 2026).
-- À appliquer APRÈS install.sql, sur un projet de test d'abord. Additif : ne modifie aucune table existante.
-- Une installation déjà présente échoue et annule la transaction, sans remplacement.
--
-- Principe : le déposant paie en ligne une fois la tâche terminée. Stripe verse directement au Brigadier
-- sa part (compte Stripe Express du Brigadier) et FLEMME garde la commission (application_fee_amount).
-- Les montants viennent de l'accord figé côté serveur (forfait, commission, total, part Brigadier).
--
-- Seules les fonctions Edge (clé service_role, jamais dans une app) appellent public.flemme_paiement_api.
begin;
create table flemme_mobile_v1.brigadier_accounts (
  user_id uuid primary key references auth.users(id),
  stripe_account_id text not null unique check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
create table flemme_mobile_v1.payments (
  checkout_session_id text primary key check (checkout_session_id ~ '^cs_[A-Za-z0-9_]+$'),
  task_id uuid not null references flemme_mobile_v1.tasks(id),
  payer_id uuid not null references auth.users(id),
  stripe_account_id text not null,
  checkout_url text not null,
  total integer not null check (total > 0),
  commission integer not null check (commission >= 0),
  payout integer not null check (payout >= 0 and payout + commission = total),
  status text not null default 'pending' check (status in ('pending','paid','expired','doublon')),
  payment_intent_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
-- Un seul paiement réussi par tâche, même si deux sessions Checkout ont été ouvertes.
create unique index payments_one_paid on flemme_mobile_v1.payments(task_id) where status = 'paid';
alter table flemme_mobile_v1.brigadier_accounts enable row level security;
alter table flemme_mobile_v1.payments enable row level security;
revoke all on flemme_mobile_v1.brigadier_accounts, flemme_mobile_v1.payments from public, anon, authenticated;

create function flemme_mobile_v1.paiement(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  doc jsonb; acc record; pay record; uid uuid; task uuid; open_url text;
  at text := to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Données invalides'; end if;

  if p_action = 'account_get' then
    uid := (p_data->>'userId')::uuid;
    select * into acc from flemme_mobile_v1.brigadier_accounts where user_id = uid;
    if not found then return jsonb_build_object('account', null); end if;
    return jsonb_build_object('account', jsonb_build_object('id', acc.stripe_account_id, 'chargesEnabled', acc.charges_enabled, 'payoutsEnabled', acc.payouts_enabled));

  elsif p_action = 'account_save' then
    uid := (p_data->>'userId')::uuid;
    if not exists(select 1 from auth.users where id = uid and email_confirmed_at is not null) then raise exception 'Compte non confirmé'; end if;
    insert into flemme_mobile_v1.brigadier_accounts(user_id, stripe_account_id) values (uid, p_data->>'accountId')
      on conflict (user_id) do nothing;
    return flemme_mobile_v1.paiement('account_get', p_data);

  elsif p_action = 'account_update' then -- webhook account.updated
    update flemme_mobile_v1.brigadier_accounts set charges_enabled = coalesce((p_data->>'chargesEnabled')::boolean, false),
      payouts_enabled = coalesce((p_data->>'payoutsEnabled')::boolean, false), updated_at = now()
      where stripe_account_id = p_data->>'accountId';
    return jsonb_build_object('updated', found);

  elsif p_action = 'checkout_context' then
    -- Vérifie que le demandeur peut payer cette tâche et renvoie les montants figés de l'accord.
    uid := (p_data->>'userId')::uuid; task := (p_data->>'taskId')::uuid;
    select document into doc from flemme_mobile_v1.tasks where id = task;
    if not found then raise exception 'Flemme introuvable'; end if;
    if doc->'owner'->>'id' is distinct from uid::text then raise exception 'Seul le déposant peut payer' using errcode = '42501'; end if;
    if doc->>'status' <> 'completed' then raise exception 'Le paiement en ligne s''ouvre quand la tâche est terminée'; end if;
    if coalesce((doc->>'paymentDeclared')::boolean, false) or doc ? 'payment' then raise exception 'Paiement déjà enregistré'; end if;
    if doc->'agreement'->>'payout' is null then raise exception 'Accord antérieur au paiement en ligne : régler en direct'; end if;
    select * into acc from flemme_mobile_v1.brigadier_accounts where user_id = (doc->'agreement'->'brigadier'->>'id')::uuid;
    if not found or not acc.charges_enabled then raise exception 'Le Brigadier n''a pas encore activé ses paiements en ligne'; end if;
    -- Réutilise une session encore ouverte (moins de 23 h) plutôt que d'en créer une seconde.
    select checkout_url into open_url from flemme_mobile_v1.payments where task_id = task and status = 'pending' and created_at > now() - interval '23 hours'
      order by created_at desc limit 1;
    return jsonb_build_object('title', doc->>'title', 'accountId', acc.stripe_account_id,
      'total', (doc->'agreement'->>'total')::integer, 'commission', (doc->'agreement'->>'commission')::integer,
      'payout', (doc->'agreement'->>'payout')::integer, 'openUrl', open_url);

  elsif p_action = 'checkout_created' then
    insert into flemme_mobile_v1.payments(checkout_session_id, task_id, payer_id, stripe_account_id, checkout_url, total, commission, payout)
      values (p_data->>'sessionId', (p_data->>'taskId')::uuid, (p_data->>'userId')::uuid, p_data->>'accountId', p_data->>'url',
        (p_data->>'total')::integer, (p_data->>'commission')::integer, (p_data->>'payout')::integer)
      on conflict (checkout_session_id) do nothing;
    return jsonb_build_object('ok', true);

  elsif p_action = 'checkout_paid' then -- webhook checkout.session.completed (payment_status = paid)
    select * into pay from flemme_mobile_v1.payments where checkout_session_id = p_data->>'sessionId' for update;
    if not found then raise exception 'Session de paiement inconnue'; end if;
    if pay.status in ('paid','doublon') then return jsonb_build_object('already', true); end if; -- webhook rejoué
    if (p_data->>'amountTotal')::integer is distinct from pay.total then raise exception 'Montant payé différent de l''accord'; end if;
    if exists(select 1 from flemme_mobile_v1.payments where task_id = pay.task_id and status = 'paid') then
      -- Deux sessions payées pour la même tâche : on garde la trace, remboursement à faire à la main dans Stripe.
      update flemme_mobile_v1.payments set status = 'doublon', payment_intent_id = p_data->>'paymentIntentId', paid_at = now()
        where checkout_session_id = pay.checkout_session_id;
      return jsonb_build_object('duplicate', true);
    end if;
    update flemme_mobile_v1.payments set status = 'paid', payment_intent_id = p_data->>'paymentIntentId', paid_at = now()
      where checkout_session_id = pay.checkout_session_id;
    select document into doc from flemme_mobile_v1.tasks where id = pay.task_id for update;
    doc := doc || jsonb_build_object('paymentDeclared', true, 'paymentConfirmed', true,
      'payment', jsonb_build_object('method', 'stripe', 'status', 'paid', 'total', pay.total, 'commission', pay.commission, 'payout', pay.payout, 'at', at));
    doc := jsonb_set(doc, '{history}', (doc->'history') || jsonb_build_array(jsonb_build_object('text',
      'Paiement en ligne reçu par Stripe · part Brigadier versée sur son compte, commission FLEMME encaissée', 'at', at)));
    update flemme_mobile_v1.tasks set document = doc where id = pay.task_id;
    return jsonb_build_object('ok', true);

  elsif p_action = 'checkout_expired' then
    update flemme_mobile_v1.payments set status = 'expired' where checkout_session_id = p_data->>'sessionId' and status = 'pending';
    return jsonb_build_object('ok', true);
  end if;
  raise exception 'Action inconnue';
end $$;
revoke all on function flemme_mobile_v1.paiement(text, jsonb) from public, anon, authenticated;

-- Point d'entrée PostgREST réservé à service_role (fonctions Edge). Ni anon ni authenticated.
create function public.flemme_paiement_api(p_action text, p_data jsonb default '{}')
returns jsonb language sql security definer set search_path = '' as $$
  select flemme_mobile_v1.paiement(p_action, p_data);
$$;
revoke all on function public.flemme_paiement_api(text, jsonb) from public, anon, authenticated;
grant execute on function public.flemme_paiement_api(text, jsonb) to service_role;
commit;
