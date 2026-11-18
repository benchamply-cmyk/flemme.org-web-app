-- FLEMME v2.0.0 : abonnements (souscription prête, rien d'ouvert). S'applique après 20261118120000_flemme_v2_paiement_signature.sql.
-- Additif. Demande de Ben (18/11/2026) : « implémenter le code nécessaire pour une souscription à abonnement, avec conditions
-- et détails encore modifiables, et un modèle générique ».
--
-- Double verrou : une formule n'est proposée que si elle est « open » avec un prix Stripe (stripe_price_id), ET si le flag
-- abonnements.souscription est allumé (ligne « tous » ou « testeurs ») dans l'environnement de la base. Sans ligne : éteint.
-- Les formules se modifient en base (prix, avantages, conditions, essai, statut) sans changer le code ;
-- le texte de la page /premium vient de packages/shared/src/abonnements.ts (mêmes identifiants).

-- 1. Formules (modèle générique).
create table flemme_v2.subscription_plans (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{1,39}$'),
  name text not null check (char_length(name) between 1 and 60),
  audience text not null default 'tous' check (audience in ('membre', 'deposant', 'tous')),
  monthly_amount integer check (monthly_amount between 1 and 100000),
  yearly_amount integer check (yearly_amount between 1 and 100000),
  trial_days integer not null default 0 check (trial_days between 0 and 90),
  perks jsonb not null default '[]' check (jsonb_typeof(perks) = 'array' and jsonb_array_length(perks) <= 8),
  conditions jsonb not null default '[]' check (jsonb_typeof(conditions) = 'array' and jsonb_array_length(conditions) <= 8),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  -- Prix Stripe (price_…) par période ; renseignés par Ben une fois les prix créés dans Stripe.
  stripe_price_monthly text check (stripe_price_monthly ~ '^price_[A-Za-z0-9]+$'),
  stripe_price_yearly text check (stripe_price_yearly ~ '^price_[A-Za-z0-9]+$'),
  updated_at timestamptz not null default clock_timestamp(),
  check (status <> 'open' or monthly_amount is not null or yearly_amount is not null)
);
insert into flemme_v2.subscription_plans (id, name, audience, perks) values ('membre-premium', 'Membre Premium', 'membre',
  '["Alertes en priorité sur les nouvelles flemmes", "Profil mis en avant et badge Premium", "Suivi des prestations et des revenus dans l’app"]');

-- 2. Abonnements des membres, tenus à jour par les webhooks Stripe.
create table flemme_v2.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references flemme_v2.profiles(user_id) on delete cascade,
  plan_id text not null references flemme_v2.subscription_plans(id),
  period text not null check (period in ('month', 'year')),
  status text not null default 'incomplete' check (status in ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  checkout_session_id text unique check (checkout_session_id ~ '^cs_[A-Za-z0-9_]+$'),
  stripe_subscription_id text unique check (stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  stripe_customer_id text check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
-- Un seul abonnement vivant par membre et par formule.
create unique index subscriptions_one_live on flemme_v2.subscriptions (user_id, plan_id) where status in ('trialing', 'active', 'past_due');
create index subscriptions_user on flemme_v2.subscriptions (user_id, created_at desc);
alter table flemme_v2.subscription_plans enable row level security;
alter table flemme_v2.subscriptions enable row level security;
revoke all on flemme_v2.subscription_plans, flemme_v2.subscriptions from public, anon, authenticated;

-- 3. Verrou du flag (éteint sans ligne en base, contrairement aux coupe-circuits).
create function flemme_v2.abonnements_ouverts()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from flemme_v2.feature_flags f join flemme_v2.settings s on f.environment = coalesce(s.flag_environment, 'prod')
    where f.key = 'abonnements.souscription' and f.state in ('tous', 'testeurs'));
$$;

create function flemme_v2.plan_json(p flemme_v2.subscription_plans)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'name', p.name, 'audience', p.audience, 'monthlyAmount', p.monthly_amount, 'yearlyAmount', p.yearly_amount,
    'trialDays', p.trial_days, 'perks', p.perks, 'conditions', p.conditions, 'status', p.status,
    'stripePriceMonthly', p.stripe_price_monthly, 'stripePriceYearly', p.stripe_price_yearly, 'updatedAt', flemme_v2.iso(p.updated_at));
$$;

-- 4. Membre : formules proposées et ses abonnements (lecture seule ; la souscription passe par la fonction Edge).
create function flemme_v2.abonnements(p_action text, p_data jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Connexion avec un compte confirmé requise' using errcode = '42501';
  end if;
  if p_action <> 'subscriptions' then raise exception 'Action inconnue'; end if;
  return jsonb_build_object('open', flemme_v2.abonnements_ouverts(),
    'plans', case when flemme_v2.abonnements_ouverts() then coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name,
        'monthlyAmount', case when p.stripe_price_monthly is not null then p.monthly_amount end,
        'yearlyAmount', case when p.stripe_price_yearly is not null then p.yearly_amount end,
        'trialDays', p.trial_days, 'perks', p.perks, 'conditions', p.conditions) order by p.id)
      from flemme_v2.subscription_plans p where p.status = 'open' and (p.stripe_price_monthly is not null or p.stripe_price_yearly is not null)), '[]'::jsonb)
      else '[]'::jsonb end,
    'mine', coalesce((select jsonb_agg(jsonb_build_object('planId', s.plan_id, 'period', s.period, 'status', s.status,
        'currentPeriodEnd', flemme_v2.iso(s.current_period_end), 'cancelAtPeriodEnd', s.cancel_at_period_end) order by s.created_at desc)
      from flemme_v2.subscriptions s where s.user_id = uid and s.status <> 'incomplete'), '[]'::jsonb));
end $$;

-- 5. Équipe : lire et modifier les formules sans toucher au code (conditions et détails modifiables).
create function flemme_v2.admin_abonnements(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := flemme_v2.require_admin(); pid text; before jsonb; p flemme_v2.subscription_plans;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Données invalides'; end if;
  if p_action = 'plans' then
    return jsonb_build_object('open', flemme_v2.abonnements_ouverts(),
      'plans', coalesce((select jsonb_agg(flemme_v2.plan_json(x) order by x.id) from flemme_v2.subscription_plans x), '[]'::jsonb),
      'subscriptions', (select jsonb_object_agg(status, n) from (select status, count(*) n from flemme_v2.subscriptions group by status) c));
  elsif p_action = 'plan_save' then
    pid := p_data->>'id';
    select flemme_v2.plan_json(x) into before from flemme_v2.subscription_plans x where x.id = pid;
    insert into flemme_v2.subscription_plans (id, name, audience, monthly_amount, yearly_amount, trial_days, perks, conditions, status,
      stripe_price_monthly, stripe_price_yearly)
    values (pid, flemme_v2.required_text(p_data->'name', 60), coalesce(p_data->>'audience', 'tous'),
      (p_data->>'monthlyAmount')::integer, (p_data->>'yearlyAmount')::integer, coalesce((p_data->>'trialDays')::integer, 0),
      coalesce(p_data->'perks', '[]'), coalesce(p_data->'conditions', '[]'), coalesce(p_data->>'status', 'draft'),
      nullif(p_data->>'stripePriceMonthly', ''), nullif(p_data->>'stripePriceYearly', ''))
    on conflict (id) do update set name = excluded.name, audience = excluded.audience, monthly_amount = excluded.monthly_amount,
      yearly_amount = excluded.yearly_amount, trial_days = excluded.trial_days, perks = excluded.perks, conditions = excluded.conditions,
      status = excluded.status, stripe_price_monthly = excluded.stripe_price_monthly, stripe_price_yearly = excluded.stripe_price_yearly,
      updated_at = clock_timestamp()
    returning * into p;
    insert into flemme_v2.admin_log (admin_id, action, target, details) values (uid, 'plan_save', pid,
      jsonb_build_object('before', before, 'after', flemme_v2.plan_json(p)));
    return jsonb_build_object('plan', flemme_v2.plan_json(p));
  end if;
  raise exception 'Action inconnue';
end $$;

-- 6. Fonctions Edge (service_role) : contexte de souscription, session créée, portail client et webhooks.
create function flemme_v2.abonnement_stripe(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid; p flemme_v2.subscription_plans; s flemme_v2.subscriptions; per text; price text; customer text;
  ev text; kind text; seen boolean; out jsonb;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Données invalides'; end if;

  if p_action = 'subscription_context' then
    uid := (p_data->>'userId')::uuid; per := coalesce(p_data->>'period', 'month');
    if not flemme_v2.abonnements_ouverts() then raise exception 'Les abonnements ne sont pas encore ouverts' using errcode = '42501'; end if;
    if per not in ('month', 'year') then raise exception 'Période invalide'; end if;
    select * into p from flemme_v2.subscription_plans where id = p_data->>'planId';
    if not found or p.status <> 'open' then raise exception 'Formule indisponible'; end if;
    price := case per when 'month' then p.stripe_price_monthly else p.stripe_price_yearly end;
    if price is null then raise exception 'Formule indisponible pour cette période'; end if;
    if exists(select 1 from flemme_v2.subscriptions where user_id = uid and plan_id = p.id and status in ('trialing', 'active', 'past_due')) then
      raise exception 'Tu as déjà cet abonnement';
    end if;
    select stripe_customer_id into customer from flemme_v2.subscriptions where user_id = uid and stripe_customer_id is not null order by created_at desc limit 1;
    return jsonb_build_object('planId', p.id, 'name', p.name, 'priceId', price, 'trialDays', p.trial_days, 'customerId', customer);

  elsif p_action = 'subscription_created' then
    insert into flemme_v2.subscriptions (user_id, plan_id, period, checkout_session_id)
    values ((p_data->>'userId')::uuid, p_data->>'planId', p_data->>'period', p_data->>'sessionId')
    on conflict (checkout_session_id) do nothing;
    return jsonb_build_object('ok', true);

  elsif p_action = 'subscription_customer' then
    -- Portail client Stripe : résiliation, carte, factures.
    select stripe_customer_id into customer from flemme_v2.subscriptions
    where user_id = (p_data->>'userId')::uuid and stripe_customer_id is not null order by created_at desc limit 1;
    if customer is null then raise exception 'Aucun abonnement à gérer'; end if;
    return jsonb_build_object('customerId', customer);

  elsif p_action = 'webhook' then
    ev := p_data->>'eventId'; kind := p_data->>'type';
    insert into flemme_v2.stripe_events (id, type) values (ev, kind) on conflict (id) do nothing;
    get diagnostics seen = row_count;
    if not seen then return jsonb_build_object('already', true); end if;
    if kind = 'checkout.session.completed' then
      update flemme_v2.subscriptions set stripe_subscription_id = p_data->>'subscriptionId', stripe_customer_id = p_data->>'customerId',
        updated_at = clock_timestamp()
      where checkout_session_id = p_data->>'sessionId' and stripe_subscription_id is null returning * into s;
      out := case when found then jsonb_build_object('linked', s.id) else jsonb_build_object('ignored', 'session inconnue') end;
    elsif kind = 'checkout.session.expired' then
      delete from flemme_v2.subscriptions where checkout_session_id = p_data->>'sessionId' and status = 'incomplete' and stripe_subscription_id is null;
      out := jsonb_build_object('status', 'expired');
    else -- customer.subscription.created / updated / deleted
      update flemme_v2.subscriptions set
        status = case when kind = 'customer.subscription.deleted' then 'canceled'
          when p_data->>'status' in ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid') then p_data->>'status'
          when p_data->>'status' = 'incomplete_expired' then 'canceled' else status end,
        current_period_end = coalesce(to_timestamp((p_data->>'currentPeriodEnd')::bigint), current_period_end),
        cancel_at_period_end = coalesce((p_data->>'cancelAtPeriodEnd')::boolean, cancel_at_period_end),
        stripe_customer_id = coalesce(stripe_customer_id, p_data->>'customerId'), updated_at = clock_timestamp()
      where stripe_subscription_id = p_data->>'subscriptionId' returning * into s;
      out := case when found then jsonb_build_object('status', s.status) else jsonb_build_object('ignored', 'abonnement inconnu') end;
    end if;
    update flemme_v2.stripe_events set result = out where id = ev;
    return out;
  end if;
  raise exception 'Action inconnue';
end $$;

revoke all on function flemme_v2.abonnements_ouverts(), flemme_v2.plan_json(flemme_v2.subscription_plans), flemme_v2.abonnements(text, jsonb),
  flemme_v2.admin_abonnements(text, jsonb), flemme_v2.abonnement_stripe(text, jsonb) from public, anon, authenticated;
grant execute on function flemme_v2.abonnements(text, jsonb), flemme_v2.admin_abonnements(text, jsonb) to authenticated;

-- 7. Points d'entrée : mêmes aiguillages que 20261118120000, plus les abonnements.
create or replace function public.flemme_paiement_api(p_action text, p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_action in ('subscription_context', 'subscription_created', 'subscription_customer') then
    return flemme_v2.abonnement_stripe(p_action, p_data);
  end if;
  -- Événements Stripe des abonnements : session Checkout en mode « subscription » et cycle de vie de l'abonnement.
  if p_action = 'webhook' and (p_data->>'type' like 'customer.subscription.%' or p_data->>'mode' = 'subscription') then
    return flemme_v2.abonnement_stripe(p_action, p_data);
  end if;
  if p_action in ('signature_context', 'signature_created', 'payout_context', 'payout_done', 'webhook') then
    return flemme_v2.paiement_signature(p_action, p_data);
  end if;
  return flemme_v2.paiement(p_action, p_data);
end $$;
revoke all on function public.flemme_paiement_api(text, jsonb) from public, anon, authenticated;
grant execute on function public.flemme_paiement_api(text, jsonb) to service_role;

create or replace function public.flemme_mobile_api(p_action text, p_task uuid default null, p_data jsonb default '{}', p_request uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform flemme_v2.flag_guard(p_action);
  return case when p_action = 'search' then flemme_v2.search(p_data)
    when p_action = 'subscriptions' then flemme_v2.abonnements(p_action, p_data)
    when p_action in ('agreement_save', 'pay') then flemme_v2.reglement(p_action, p_task, p_data, p_request)
    when p_action in ('profile_get', 'profile_save', 'apply', 'apply_edit', 'agreement_submit', 'agreement_sign', 'review')
      then flemme_v2.accord(p_action, p_task, p_data, p_request)
    when p_action in ('file_prepare', 'file_list', 'file_delete', 'help_send', 'help_list') then flemme_v2.aide(p_action, p_task, p_data, p_request)
    else flemme_v2.execute(p_action, p_task, p_data, p_request) end;
end $$;

create or replace function public.flemme_admin_api(p_action text, p_data jsonb default '{}')
returns jsonb language sql security invoker set search_path = '' as $$
  select case when p_action in ('moderation', 'task_review') then flemme_v2.admin_parcours(p_action, p_data)
    when p_action in ('review_queue', 'offer_review', 'agreement_review') then flemme_v2.admin_accord(p_action, p_data)
    when p_action in ('help_queue', 'help_answer') then flemme_v2.admin_aide(p_action, p_data)
    when p_action in ('flags', 'flag_set', 'flag_reset', 'flag_environment') then flemme_v2.admin_flags(p_action, p_data)
    when p_action in ('plans', 'plan_save') then flemme_v2.admin_abonnements(p_action, p_data)
    else flemme_v2.admin_execute(p_action, p_data) end;
$$;
