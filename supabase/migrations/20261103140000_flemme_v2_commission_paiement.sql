-- FLEMME V2 : commission configurable et encaissement en ligne avec Stripe Connect.
-- Additif, après 20261103130000_flemme_v2_admin.sql (le type d'événement « admin » est conservé). Sans changement de réglage, le comportement reste
-- identique : commission de 10 % ajoutée au forfait (décision de Ben du 03/11/2026).
-- Le paiement en ligne ne sert que si les fonctions Edge de supabase/functions sont déployées
-- (voir docs/paiement-stripe.md). Sinon le paiement direct déclaratif continue comme avant.

-- 1. Réglage de la commission (une seule ligne). Doit rester identique à COMMISSION dans
--    packages/shared/src/domain.ts (vérifié par supabase/tests/paiement.test.mjs).
--      ajout       : commission ajoutée au forfait du Brigadier (1000 = 10 %).
--      prelevement : commission prise sur le forfait (3500 = 65 % reversés au Brigadier).
--    Un changement ne vaut que pour les accords conclus ensuite.
create table flemme_v2.settings (
  id boolean primary key default true check (id),
  commission_model text not null default 'ajout' check (commission_model in ('ajout', 'prelevement')),
  commission_bps integer not null default 1000 check (commission_bps between 0 and 10000)
);
insert into flemme_v2.settings default values;

-- 2. Chaque accord garde le taux et le modèle appliqués. Accords existants : 10 % ajoutés.
alter table flemme_v2.tasks add column commission_bps integer check (commission_bps between 0 and 10000),
  add column commission_model text check (commission_model in ('ajout', 'prelevement'));
update flemme_v2.tasks set commission_bps = 1000, commission_model = 'ajout' where commission is not null;
alter table flemme_v2.tasks add constraint tasks_commission_rule
  check ((commission is null) = (commission_bps is null) and (commission is null) = (commission_model is null));

-- 3. Paiement en ligne : comptes Stripe Express des Brigadiers et sessions Stripe Checkout.
create table flemme_v2.brigadier_accounts (
  user_id uuid primary key references flemme_v2.profiles(user_id) on delete cascade,
  stripe_account_id text not null unique check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  updated_at timestamptz not null default clock_timestamp()
);
-- Trace comptable : conservée même si la flemme ou le compte disparaît.
create table flemme_v2.payments (
  checkout_session_id text primary key check (checkout_session_id ~ '^cs_[A-Za-z0-9_]+$'),
  task_id uuid references flemme_v2.tasks(id) on delete set null,
  payer_id uuid references flemme_v2.profiles(user_id) on delete set null,
  stripe_account_id text not null,
  checkout_url text not null,
  total integer not null check (total > 0),
  commission integer not null check (commission >= 0),
  payout integer not null check (payout >= 0 and payout + commission = total),
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'doublon')),
  payment_intent_id text,
  created_at timestamptz not null default clock_timestamp(),
  paid_at timestamptz
);
-- Un seul paiement réussi par flemme, même si deux sessions Checkout ont été ouvertes.
create unique index payments_one_paid on flemme_v2.payments (task_id) where status = 'paid';
create index payments_task on flemme_v2.payments (task_id, created_at desc);
alter table flemme_v2.events drop constraint events_kind_check;
alter table flemme_v2.events add constraint events_kind_check check (kind in ('create', 'offer', 'message', 'accept', 'decline',
  'complete', 'declare_payment', 'confirm_payment', 'report', 'admin', 'online_payment'));

alter table flemme_v2.settings enable row level security;
alter table flemme_v2.brigadier_accounts enable row level security;
alter table flemme_v2.payments enable row level security;
revoke all on flemme_v2.settings, flemme_v2.brigadier_accounts, flemme_v2.payments from public, anon, authenticated;

-- « 10 », « 12,5 », « 35 » suivi de « % ».
create function flemme_v2.rate_label(bps integer)
returns text language sql immutable set search_path = '' as $$
  select replace(trim(trailing '.' from trim(trailing '0' from to_char(bps / 100.0, 'FM99990.00'))), '.', ',') || ' %';
$$;

-- 4. Vue d'une flemme : l'accord expose aussi total, part Brigadier, taux, modèle et paiement en ligne.
create or replace function flemme_v2.task_json(p_task uuid, p_actor uuid)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  t flemme_v2.tasks; chosen flemme_v2.offers; is_owner boolean; is_chosen boolean;
  offers jsonb; history jsonb; reports jsonb; result jsonb; paid jsonb;
begin
  select * into t from flemme_v2.tasks where id = p_task;
  if not found then return null; end if;
  is_owner := t.owner_id = p_actor;
  if t.accepted_offer_id is not null then
    select * into chosen from flemme_v2.offers where id = t.accepted_offer_id;
  end if;
  is_chosen := coalesce(chosen.brigadier_id = p_actor, false);

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id, 'brigadier', flemme_v2.actor_json(o.brigadier_id), 'amount', o.amount,
      'slot', o.slot, 'scope', o.scope, 'status', o.status,
      'messages', (select coalesce(jsonb_agg(jsonb_build_object(
          'actor', flemme_v2.actor_json(m.author_id), 'text', m.body, 'at', flemme_v2.iso(m.created_at)) order by m.id), '[]'::jsonb)
        from flemme_v2.messages m where m.offer_id = o.id)
    ) order by o.created_at, o.id), '[]'::jsonb) into offers
  from flemme_v2.offers o
  where o.task_id = t.id and (is_owner or o.brigadier_id = p_actor);

  select coalesce(jsonb_agg(jsonb_build_object('text', e.label, 'at', flemme_v2.iso(e.created_at)) order by e.id), '[]'::jsonb) into history
  from flemme_v2.events e where e.task_id = t.id;

  reports := '[]'::jsonb;
  if is_owner or is_chosen then
    select coalesce(jsonb_agg(jsonb_build_object('actor', flemme_v2.actor_json(e.actor_id), 'text', e.body, 'at', flemme_v2.iso(e.created_at)) order by e.id), '[]'::jsonb) into reports
    from flemme_v2.events e where e.task_id = t.id and e.kind = 'report';
  end if;

  result := jsonb_build_object('id', t.id, 'owner', flemme_v2.actor_json(t.owner_id), 'title', t.title,
    'details', t.details, 'place', t.place, 'budget', t.budget, 'status', t.status,
    'createdAt', flemme_v2.iso(t.created_at), 'offers', offers, 'history', history, 'reports', reports);
  if is_owner or is_chosen then
    result := result || jsonb_build_object('paymentDeclared', t.payment_declared, 'paymentConfirmed', t.payment_confirmed);
    if chosen.id is not null then
      -- Modèle « ajout » : le déposant paie forfait + commission. « prelevement » : la commission est prise sur le forfait.
      result := result || jsonb_build_object('acceptedOfferId', chosen.id, 'agreement', jsonb_build_object(
        'amount', chosen.amount, 'commission', t.commission,
        'total', case when t.commission_model = 'prelevement' then chosen.amount else chosen.amount + t.commission end,
        'payout', case when t.commission_model = 'prelevement' then chosen.amount - t.commission else chosen.amount end,
        'rateBps', t.commission_bps, 'model', t.commission_model,
        'slot', chosen.slot, 'scope', chosen.scope, 'brigadier', flemme_v2.actor_json(chosen.brigadier_id)));
      select jsonb_build_object('method', 'stripe', 'status', 'paid', 'total', p.total, 'commission', p.commission,
          'payout', p.payout, 'at', flemme_v2.iso(p.paid_at)) into paid
        from flemme_v2.payments p where p.task_id = t.id and p.status = 'paid';
      if paid is not null then result := result || jsonb_build_object('payment', paid); end if;
    end if;
  end if;
  return result;
end $$;

-- 5. Acceptation : commission calculée avec le réglage courant (le reste est inchangé).
create or replace function flemme_v2.execute(p_action text, p_task uuid, p_data jsonb, p_request uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); t flemme_v2.tasks; o flemme_v2.offers; previous flemme_v2.requests;
  is_owner boolean; is_chosen boolean; tid uuid; oid uuid; budget integer; page_size integer;
  cursor_at timestamptz; cursor_id uuid; ids uuid[]; last_at timestamptz; next_cursor text;
  event_text text; event_body text; result jsonb; cfg flemme_v2.settings;
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) or
    not exists(select 1 from auth.users where id = uid and email_confirmed_at is not null) then
    raise exception 'Connexion avec un compte confirmé requise' using errcode = '42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Données invalides'; end if;
  -- Filet de sécurité si le déclencheur d'inscription n'a pas créé le profil.
  insert into flemme_v2.profiles (user_id, display_name)
  select u.id, flemme_v2.default_display_name(u.raw_user_meta_data, u.email) from auth.users u where u.id = uid
  on conflict do nothing;

  if p_action = 'me' then
    return jsonb_build_object('profile', flemme_v2.actor_json(uid));
  end if;
  if p_action = 'update_profile' then
    update flemme_v2.profiles set display_name = flemme_v2.required_text(p_data->'displayName', 40), updated_at = clock_timestamp()
    where user_id = uid;
    return jsonb_build_object('profile', flemme_v2.actor_json(uid));
  end if;

  if p_action = 'list' then
    if p_data->'limit' is null or p_data->'limit' = 'null'::jsonb then page_size := 20;
    else
      page_size := flemme_v2.amount(p_data->'limit');
      if page_size > 100 then raise exception 'Taille de page invalide'; end if;
    end if;
    if p_data->'cursor' is not null and p_data->'cursor' <> 'null'::jsonb then
      begin
        cursor_at := split_part(p_data->>'cursor', '|', 1)::timestamptz;
        cursor_id := split_part(p_data->>'cursor', '|', 2)::uuid;
      exception when others then raise exception 'Curseur invalide';
      end;
      if cursor_at is null or cursor_id is null then raise exception 'Curseur invalide'; end if;
    end if;
    -- Ordre stable (date puis id) : le curseur reprend exactement après la dernière flemme reçue.
    select array_agg(x.id order by x.created_at desc, x.id desc) into ids from (
      select v.id, v.created_at from flemme_v2.tasks v
      where (v.status = 'open' or v.owner_id = uid
          or exists(select 1 from flemme_v2.offers b where b.task_id = v.id and b.brigadier_id = uid))
        and (cursor_at is null or (v.created_at, v.id) < (cursor_at, cursor_id))
      order by v.created_at desc, v.id desc
      limit page_size + 1) x;
    ids := coalesce(ids, '{}');
    if cardinality(ids) > page_size then
      ids := ids[1:page_size];
      select created_at into last_at from flemme_v2.tasks where id = ids[page_size];
      -- Précision à la microseconde : un curseur arrondi sauterait ou répéterait des flemmes.
      next_cursor := to_char(last_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' || ids[page_size]::text;
    end if;
    select coalesce(jsonb_agg(flemme_v2.task_json(i.id, uid) order by i.n), '[]'::jsonb) into result
    from unnest(ids) with ordinality as i(id, n);
    return jsonb_build_object('tasks', result, 'nextCursor', next_cursor);
  end if;

  if p_request is null then raise exception 'Identifiant de requête requis'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || p_request::text, 0));
  select * into previous from flemme_v2.requests where actor_id = uid and request_id = p_request;
  if found then
    if previous.action <> p_action or previous.task_id is distinct from p_task or previous.payload <> p_data then
      raise exception 'Identifiant déjà utilisé pour une autre action';
    end if;
    return previous.result;
  end if;

  if p_action = 'create' then
    if p_data->'budget' is not null and p_data->'budget' <> 'null'::jsonb then budget := flemme_v2.amount(p_data->'budget'); end if;
    insert into flemme_v2.tasks (owner_id, title, details, place, budget)
    values (uid, flemme_v2.required_text(p_data->'title', 100), flemme_v2.required_text(p_data->'details', 1000),
      flemme_v2.required_text(p_data->'place', 100), budget)
    returning id into tid;
    event_text := 'Flemme publiée · sans expiration';
  else
    select * into t from flemme_v2.tasks where id = p_task for update;
    if not found then raise exception 'Flemme introuvable'; end if;
    tid := t.id;
    is_owner := t.owner_id = uid;
    is_chosen := t.accepted_offer_id is not null
      and exists(select 1 from flemme_v2.offers where id = t.accepted_offer_id and brigadier_id = uid);
    if p_action in ('accept', 'decline', 'message') then
      begin oid := (p_data->>'offerId')::uuid;
      exception when others then raise exception 'Proposition introuvable';
      end;
      select * into o from flemme_v2.offers where id = oid and task_id = t.id for update;
      if not found then raise exception 'Proposition introuvable'; end if;
    end if;

    if p_action = 'offer' then
      if is_owner or t.status <> 'open' then raise exception 'Flemme indisponible'; end if;
      if exists(select 1 from flemme_v2.offers where task_id = t.id and brigadier_id = uid and status = 'pending') then
        raise exception 'Proposition déjà en attente';
      end if;
      insert into flemme_v2.offers (task_id, brigadier_id, amount, slot, scope)
      values (t.id, uid, flemme_v2.amount(p_data->'amount'), flemme_v2.required_text(p_data->'slot', 100),
        flemme_v2.required_text(p_data->'scope', 1000));
      event_text := 'Proposition reçue';
    elsif p_action = 'message' then
      if not is_owner and o.brigadier_id is distinct from uid then raise exception 'Discussion inaccessible' using errcode = '42501'; end if;
      insert into flemme_v2.messages (offer_id, author_id, body) values (o.id, uid, flemme_v2.required_text(p_data->'text', 1000));
      event_text := 'Message ajouté à une discussion';
    elsif p_action in ('accept', 'decline') then
      if not is_owner or t.status <> 'open' or o.status <> 'pending' then raise exception 'Offre indisponible' using errcode = '42501'; end if;
      if p_action = 'decline' then
        update flemme_v2.offers set status = 'declined' where id = o.id;
        event_text := 'Proposition déclinée · historique conservé';
      else
        -- Prix et commission calculés ici, jamais repris du client.
        update flemme_v2.offers set status = case when id = o.id then 'accepted' else 'not_selected' end
        where task_id = t.id and status = 'pending';
        -- Taux et modèle lus dans flemme_v2.settings puis figés sur la flemme.
        select * into strict cfg from flemme_v2.settings;
        update flemme_v2.tasks set status = 'assigned', accepted_offer_id = o.id,
          commission = round(o.amount::numeric * cfg.commission_bps / 10000)::integer,
          commission_bps = cfg.commission_bps, commission_model = cfg.commission_model where id = t.id;
        event_text := 'Accord accepté · forfait et commission de ' || flemme_v2.rate_label(cfg.commission_bps) || ' confirmés';
      end if;
    elsif p_action = 'complete' then
      if not is_owner or t.status <> 'assigned' then raise exception 'Fin de tâche non autorisée' using errcode = '42501'; end if;
      update flemme_v2.tasks set status = 'completed' where id = t.id;
      event_text := 'Tâche déclarée terminée par le déposant';
    elsif p_action = 'declare_payment' then
      if not is_owner or t.status <> 'completed' or t.payment_declared then raise exception 'Déclaration non autorisée' using errcode = '42501'; end if;
      update flemme_v2.tasks set payment_declared = true where id = t.id;
      event_text := 'Paiement direct déclaré par le déposant · non vérifié';
    elsif p_action = 'confirm_payment' then
      if not is_chosen or not t.payment_declared or t.payment_confirmed then raise exception 'Confirmation non autorisée' using errcode = '42501'; end if;
      update flemme_v2.tasks set payment_confirmed = true where id = t.id;
      event_text := 'Réception du paiement confirmée par le Brigadier · non vérifiée par une banque';
    elsif p_action = 'report' then
      if not is_owner and not is_chosen then raise exception 'Signalement inaccessible' using errcode = '42501'; end if;
      event_body := flemme_v2.required_text(p_data->'text', 1000);
      event_text := 'Désaccord signalé · examen humain demandé';
    else raise exception 'Action inconnue';
    end if;
    update flemme_v2.tasks set updated_at = clock_timestamp() where id = t.id;
  end if;

  insert into flemme_v2.events (task_id, actor_id, kind, label, body) values (tid, uid, p_action, event_text, event_body);
  result := jsonb_build_object('task', flemme_v2.task_json(tid, uid));
  insert into flemme_v2.requests (actor_id, request_id, action, task_id, payload, result)
  values (uid, p_request, p_action, p_task, p_data, result);
  return result;
end $$;

-- 6. API des fonctions Edge, réservée à service_role (jamais dans une app).
create function flemme_v2.paiement(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t flemme_v2.tasks; chosen flemme_v2.offers; acc flemme_v2.brigadier_accounts; pay flemme_v2.payments;
  uid uuid; tid uuid; open_url text; total integer; payout integer;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Données invalides'; end if;

  if p_action = 'account_get' then
    select * into acc from flemme_v2.brigadier_accounts where user_id = (p_data->>'userId')::uuid;
    if not found then return jsonb_build_object('account', null); end if;
    return jsonb_build_object('account', jsonb_build_object('id', acc.stripe_account_id,
      'chargesEnabled', acc.charges_enabled, 'payoutsEnabled', acc.payouts_enabled));

  elsif p_action = 'account_save' then
    uid := (p_data->>'userId')::uuid;
    if not exists(select 1 from auth.users where id = uid and email_confirmed_at is not null)
      or not exists(select 1 from flemme_v2.profiles where user_id = uid) then raise exception 'Compte non confirmé'; end if;
    insert into flemme_v2.brigadier_accounts (user_id, stripe_account_id) values (uid, p_data->>'accountId')
    on conflict (user_id) do nothing;
    return flemme_v2.paiement('account_get', p_data);

  elsif p_action = 'account_update' then -- webhook account.updated
    update flemme_v2.brigadier_accounts set charges_enabled = coalesce((p_data->>'chargesEnabled')::boolean, false),
      payouts_enabled = coalesce((p_data->>'payoutsEnabled')::boolean, false), updated_at = clock_timestamp()
    where stripe_account_id = p_data->>'accountId';
    return jsonb_build_object('updated', found);

  elsif p_action = 'checkout_context' then
    -- Vérifie que le demandeur peut payer et renvoie les montants figés de l'accord.
    uid := (p_data->>'userId')::uuid; tid := (p_data->>'taskId')::uuid;
    select * into t from flemme_v2.tasks where id = tid;
    if not found then raise exception 'Flemme introuvable'; end if;
    if t.owner_id is distinct from uid then raise exception 'Seul le déposant peut payer' using errcode = '42501'; end if;
    if t.status <> 'completed' then raise exception 'Le paiement en ligne s''ouvre quand la tâche est terminée'; end if;
    if t.payment_declared then raise exception 'Paiement déjà enregistré'; end if;
    select * into chosen from flemme_v2.offers where id = t.accepted_offer_id;
    select * into acc from flemme_v2.brigadier_accounts where user_id = chosen.brigadier_id;
    if not found or not acc.charges_enabled then raise exception 'Le Brigadier n''a pas encore activé ses paiements en ligne'; end if;
    total := case when t.commission_model = 'prelevement' then chosen.amount else chosen.amount + t.commission end;
    payout := case when t.commission_model = 'prelevement' then chosen.amount - t.commission else chosen.amount end;
    -- Réutilise une session encore ouverte (moins de 23 h) plutôt que d'en créer une seconde.
    select checkout_url into open_url from flemme_v2.payments
    where task_id = tid and status = 'pending' and created_at > clock_timestamp() - interval '23 hours'
    order by created_at desc limit 1;
    return jsonb_build_object('title', t.title, 'accountId', acc.stripe_account_id,
      'total', total, 'commission', t.commission, 'payout', payout, 'openUrl', open_url);

  elsif p_action = 'checkout_created' then
    insert into flemme_v2.payments (checkout_session_id, task_id, payer_id, stripe_account_id, checkout_url, total, commission, payout)
    values (p_data->>'sessionId', (p_data->>'taskId')::uuid, (p_data->>'userId')::uuid, p_data->>'accountId', p_data->>'url',
      (p_data->>'total')::integer, (p_data->>'commission')::integer, (p_data->>'payout')::integer)
    on conflict (checkout_session_id) do nothing;
    return jsonb_build_object('ok', true);

  elsif p_action = 'checkout_paid' then -- webhook checkout.session.completed (payment_status = paid)
    select * into pay from flemme_v2.payments where checkout_session_id = p_data->>'sessionId' for update;
    if not found then raise exception 'Session de paiement inconnue'; end if;
    if pay.status in ('paid', 'doublon') then return jsonb_build_object('already', true); end if; -- webhook rejoué
    if (p_data->>'amountTotal')::integer is distinct from pay.total then raise exception 'Montant payé différent de l''accord'; end if;
    if exists(select 1 from flemme_v2.payments where task_id = pay.task_id and status = 'paid') then
      -- Deux sessions payées pour la même flemme : trace gardée, remboursement à faire dans Stripe.
      update flemme_v2.payments set status = 'doublon', payment_intent_id = p_data->>'paymentIntentId', paid_at = clock_timestamp()
      where checkout_session_id = pay.checkout_session_id;
      return jsonb_build_object('duplicate', true);
    end if;
    update flemme_v2.payments set status = 'paid', payment_intent_id = p_data->>'paymentIntentId', paid_at = clock_timestamp()
    where checkout_session_id = pay.checkout_session_id;
    if pay.task_id is not null then
      update flemme_v2.tasks set payment_declared = true, payment_confirmed = true, updated_at = clock_timestamp()
      where id = pay.task_id and status = 'completed';
      insert into flemme_v2.events (task_id, actor_id, kind, label) values (pay.task_id, pay.payer_id, 'online_payment',
        'Paiement en ligne reçu par Stripe · part Brigadier versée sur son compte, commission FLEMME encaissée');
    end if;
    return jsonb_build_object('ok', true);

  elsif p_action = 'checkout_expired' then
    update flemme_v2.payments set status = 'expired' where checkout_session_id = p_data->>'sessionId' and status = 'pending';
    return jsonb_build_object('ok', true);
  end if;
  raise exception 'Action inconnue';
end $$;

-- Seules les nouvelles fonctions sont fermées : les droits existants (execute, admin_execute...) restent tels quels.
revoke all on function flemme_v2.rate_label(integer), flemme_v2.paiement(text, jsonb) from public, anon, authenticated;

-- Point d'entrée PostgREST des fonctions Edge : ni anon ni authenticated.
create function public.flemme_paiement_api(p_action text, p_data jsonb default '{}')
returns jsonb language sql security definer set search_path = '' as $$
  select flemme_v2.paiement(p_action, p_data);
$$;
revoke all on function public.flemme_paiement_api(text, jsonb) from public, anon, authenticated;
grant execute on function public.flemme_paiement_api(text, jsonb) to service_role;
