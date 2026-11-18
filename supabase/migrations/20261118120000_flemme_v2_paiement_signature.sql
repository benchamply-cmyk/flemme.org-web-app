-- FLEMME v2.0.0 : paiement à la signature, accord versionné (contrat v0.2) et webhooks Stripe idempotents.
-- S'applique après 20261116120000_flemme_v2_feature_flags.sql. Additif : aucune table ni colonne supprimée,
-- les flemmes existantes gardent le paiement direct déclaratif (payment_mode = 'direct').
--
-- Décisions de Ben (17-18/11/2026, doc de propositions v2.0.0) :
-- - le paiement de la mission passe par Flemme et se fait EN ENTIER à la signature de l'accord ;
-- - les frais de plateforme (10 % pendant la bêta, flemme_v2.settings.commission_bps) sont dus à la seconde signature ;
-- - statuts de paiement : pending, authorized, paid, failed, refunded, disputed ; webhooks idempotents ;
-- - contrat v0.2 plus robuste ; Supabase actuel réutilisé et adapté.
--
-- Rien ne change tant que settings.payment_mode reste à 'direct' (valeur livrée). Pour essayer :
--   update flemme_v2.settings set payment_mode = 'simulation';  -- parcours complet, aucun argent réel
--   update flemme_v2.settings set payment_mode = 'stripe';      -- Stripe Checkout (fonctions Edge déployées, voir docs/paiement-stripe.md)
-- Le mode est figé sur chaque flemme à sa création : changer le réglage ne touche pas les flemmes en cours.

-- 1. Mode de paiement : réglage général et valeur figée par flemme.
alter table flemme_v2.settings
  add column payment_mode text not null default 'direct' check (payment_mode in ('direct', 'simulation', 'stripe'));
alter table flemme_v2.tasks
  add column payment_mode text not null default 'direct' check (payment_mode in ('direct', 'simulation', 'stripe'));
create function flemme_v2.default_payment_mode()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select payment_mode from flemme_v2.settings limit 1), 'direct');
$$;
alter table flemme_v2.tasks alter column payment_mode set default flemme_v2.default_payment_mode();

-- « 12,50 € » pour l'historique.
create function flemme_v2.euros(cents integer)
returns text language sql immutable set search_path = '' as $$
  select replace(replace(to_char(cents / 100.0, 'FM999999990.00'), '.', ','), ',00', '') || ' €';
$$;

-- 2. Accord versionné : numéro de version, modèle de contrat, date à laquelle les frais deviennent dus.
alter table flemme_v2.agreements
  add column version integer not null default 1 check (version >= 1),
  add column fee_due_at timestamptz;
-- Contrat v0.2 : quatre rubriques de plus, la limite de taille passe de 8 000 à 16 000 octets.
alter table flemme_v2.agreements drop constraint agreements_terms_check;
alter table flemme_v2.agreements add constraint agreements_terms_check
  check (jsonb_typeof(terms) = 'object' and octet_length(terms::text) <= 16000);

-- Chaque version enregistrée est conservée : ce que chacun a relu et signé reste consultable.
create table flemme_v2.agreement_versions (
  task_id uuid not null references flemme_v2.tasks(id) on delete cascade,
  version integer not null,
  terms jsonb not null,
  amount integer,
  saved_by uuid references flemme_v2.profiles(user_id) on delete set null,
  saved_at timestamptz not null default clock_timestamp(),
  owner_signed_at timestamptz, brigadier_signed_at timestamptz,
  primary key (task_id, version)
);
alter table flemme_v2.agreement_versions enable row level security;
revoke all on flemme_v2.agreement_versions from public, anon, authenticated;

-- Versions des accords déjà en base.
insert into flemme_v2.agreement_versions (task_id, version, terms, amount, saved_by, saved_at, owner_signed_at, brigadier_signed_at)
select a.task_id, 1, a.terms, o.amount, a.updated_by, a.updated_at, a.owner_signed_at, a.brigadier_signed_at
from flemme_v2.agreements a join flemme_v2.tasks t on t.id = a.task_id left join flemme_v2.offers o on o.id = t.accepted_offer_id;

-- Un enregistrement (statut remis à « draft ») crée une nouvelle version ; la seconde signature rend les frais dus.
create function flemme_v2.agreement_version_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.status = 'draft' then
    new.version := old.version + 1;
    new.fee_due_at := null;
  end if;
  if new.status = 'signed' and (tg_op = 'INSERT' or old.status <> 'signed') then
    new.fee_due_at := clock_timestamp();
  end if;
  return new;
end $$;
create trigger agreement_version_guard before insert or update on flemme_v2.agreements
  for each row execute function flemme_v2.agreement_version_guard();

create function flemme_v2.agreement_version_log()
returns trigger language plpgsql security definer set search_path = '' as $$
declare t flemme_v2.tasks;
begin
  select * into t from flemme_v2.tasks where id = new.task_id;
  if tg_op = 'INSERT' or new.version <> old.version then
    insert into flemme_v2.agreement_versions (task_id, version, terms, amount, saved_by)
    values (new.task_id, new.version, new.terms, (select amount from flemme_v2.offers where id = t.accepted_offer_id), new.updated_by)
    on conflict (task_id, version) do update set terms = excluded.terms, amount = excluded.amount, saved_by = excluded.saved_by, saved_at = clock_timestamp();
  end if;
  update flemme_v2.agreement_versions set owner_signed_at = new.owner_signed_at, brigadier_signed_at = new.brigadier_signed_at
  where task_id = new.task_id and version = new.version;
  if new.status = 'signed' and (tg_op = 'INSERT' or old.status <> 'signed') and t.payment_mode <> 'direct' and t.commission is not null then
    insert into flemme_v2.events (task_id, actor_id, kind, label) values (t.id, new.updated_by, 'agreement',
      'Frais de plateforme dus : ' || flemme_v2.euros(t.commission) || ' (' || flemme_v2.rate_label(t.commission_bps)
      || ' du prix convenu), à la charge du déposant');
  end if;
  return null;
end $$;
create trigger agreement_version_log after insert or update on flemme_v2.agreements
  for each row execute function flemme_v2.agreement_version_log();

-- 3. Rubriques du contrat v0.2 (mêmes noms et limites que CONTRACT_FIELDS dans packages/shared/src/accord.ts).
--    Les accords v0.1 déjà enregistrés restent valables ; tout nouvel enregistrement suit la v0.2.
create or replace function flemme_v2.agreement_terms(p_data jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare result jsonb;
begin
  result := jsonb_build_object(
    'template', '0.2',
    'scope', flemme_v2.required_text(p_data->'scope', 1000),
    'deliverable', flemme_v2.required_text(p_data->'deliverable', 1000),
    'quality', flemme_v2.required_text(p_data->'quality', 1000),
    'deadline', flemme_v2.required_text(p_data->'deadline', 200),
    'acceptance', flemme_v2.required_text(p_data->'acceptance', 1000),
    'cancellation', flemme_v2.required_text(p_data->'cancellation', 1000),
    'confidentiality', flemme_v2.required_text(p_data->'confidentiality', 1000));
  return result || jsonb_strip_nulls(jsonb_build_object(
    'access', flemme_v2.optional_text(p_data->'access', 1000),
    'liability', flemme_v2.optional_text(p_data->'liability', 1000)));
end $$;

create or replace function flemme_v2.agreement_json(a flemme_v2.agreements)
returns jsonb language sql stable set search_path = '' as $$
  select case when a.task_id is null then null else jsonb_build_object('terms', a.terms, 'status', a.status, 'reviewNote', a.review_note,
    'ownerSignedAt', flemme_v2.iso(a.owner_signed_at), 'ownerSignature', a.owner_signature,
    'brigadierSignedAt', flemme_v2.iso(a.brigadier_signed_at), 'brigadierSignature', a.brigadier_signature,
    'updatedAt', flemme_v2.iso(a.updated_at), 'updatedBy', flemme_v2.actor_json(a.updated_by),
    'version', a.version, 'feeDueAt', flemme_v2.iso(a.fee_due_at)) end;
$$;

-- 4. Paiements : la table existante sert aussi aux paiements à la signature et aux simulations.
alter table flemme_v2.payments drop constraint payments_checkout_session_id_check;
alter table flemme_v2.payments add constraint payments_checkout_session_id_check check (checkout_session_id ~ '^(cs|sim)_[A-Za-z0-9_]+$');
alter table flemme_v2.payments drop constraint payments_status_check;
alter table flemme_v2.payments add constraint payments_status_check
  check (status in ('pending', 'authorized', 'paid', 'failed', 'refunded', 'disputed', 'expired', 'doublon'));
-- À la signature, l'argent est encaissé par Flemme puis versé au membre à la fin : pas de compte connecté au paiement.
alter table flemme_v2.payments alter column stripe_account_id drop not null, alter column checkout_url drop not null;
alter table flemme_v2.payments
  add column stage text not null default 'fin' check (stage in ('fin', 'signature')),
  add column transfer_id text,
  add column transferred_at timestamptz,
  add column refunded_at timestamptz,
  add column disputed_at timestamptz,
  add column updated_at timestamptz not null default clock_timestamp();
create index payments_intent on flemme_v2.payments (payment_intent_id) where payment_intent_id is not null;
-- Un seul paiement en cours ou réussi par flemme (le doublon reste possible, tracé par le webhook).
create unique index payments_one_active_signature on flemme_v2.payments (task_id)
  where stage = 'signature' and status in ('authorized', 'paid', 'disputed');

-- Événements Stripe déjà traités : un webhook rejoué ne fait rien deux fois.
create table flemme_v2.stripe_events (
  id text primary key check (id ~ '^evt_[A-Za-z0-9_]+$'),
  type text not null,
  received_at timestamptz not null default clock_timestamp(),
  result jsonb
);
alter table flemme_v2.stripe_events enable row level security;
revoke all on flemme_v2.stripe_events from public, anon, authenticated;

alter table flemme_v2.events drop constraint events_kind_check;
alter table flemme_v2.events add constraint events_kind_check check (kind in ('create', 'edit', 'offer', 'message', 'accept', 'decline',
  'complete', 'declare_payment', 'confirm_payment', 'report', 'admin', 'online_payment', 'agreement', 'review', 'payout'));

-- 5. Règles des flemmes payées via Flemme, quel que soit le chemin d'écriture.
create function flemme_v2.payment_mode_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.payment_mode <> old.payment_mode and old.accepted_offer_id is not null then
    raise exception 'Le mode de paiement d''une flemme engagée ne change plus';
  end if;
  if new.payment_mode = 'direct' then return new; end if;
  if new.payment_declared and not old.payment_declared then
    raise exception 'Cette mission se paie via Flemme';
  end if;
  if new.status = 'completed' and old.status <> 'completed' then
    if not exists(select 1 from flemme_v2.agreements where task_id = new.id and status = 'signed') then
      raise exception 'L''accord doit être signé par les deux parties avant la fin de la tâche';
    end if;
    if not exists(select 1 from flemme_v2.payments where task_id = new.id and stage = 'signature' and status = 'paid') then
      raise exception 'La mission doit être payée via Flemme avant d''être déclarée terminée';
    end if;
  end if;
  return new;
end $$;
create trigger payment_mode_guard before update on flemme_v2.tasks for each row execute function flemme_v2.payment_mode_guard();

-- 6. Vue d'une flemme : reprise de 20261104140000, avec le mode de paiement et le dernier paiement utile.
create or replace function flemme_v2.task_json(p_task uuid, p_actor uuid)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  t flemme_v2.tasks; chosen flemme_v2.offers; is_owner boolean; is_chosen boolean; doc flemme_v2.agreements;
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
      'slot', o.slot, 'scope', o.scope, 'result', o.result, 'status', o.status, 'review', o.review,
      'reviewNote', case when o.brigadier_id = p_actor then o.review_note end,
      'messages', (select coalesce(jsonb_agg(jsonb_build_object(
          'actor', flemme_v2.actor_json(m.author_id), 'text', m.body, 'at', flemme_v2.iso(m.created_at)) order by m.id), '[]'::jsonb)
        from flemme_v2.messages m where m.offer_id = o.id)
    ) order by o.created_at, o.id), '[]'::jsonb) into offers
  from flemme_v2.offers o
  where o.task_id = t.id and ((is_owner and o.review = 'approved') or o.brigadier_id = p_actor);

  select coalesce(jsonb_agg(jsonb_build_object('text', e.label, 'at', flemme_v2.iso(e.created_at)) order by e.id), '[]'::jsonb) into history
  from flemme_v2.events e where e.task_id = t.id;

  reports := '[]'::jsonb;
  if is_owner or is_chosen then
    select coalesce(jsonb_agg(jsonb_build_object('actor', flemme_v2.actor_json(e.actor_id), 'text', e.body, 'at', flemme_v2.iso(e.created_at)) order by e.id), '[]'::jsonb) into reports
    from flemme_v2.events e where e.task_id = t.id and e.kind = 'report';
  end if;

  result := jsonb_build_object('id', t.id, 'owner', flemme_v2.actor_json(t.owner_id), 'title', t.title,
    'details', t.details, 'place', t.place, 'budget', t.budget, 'status', t.status,
    'category', t.category, 'deadline', t.deadline, 'deadlineNote', t.deadline_note,
    'budgetRange', t.budget_range, 'mode', t.work_mode, 'paymentMode', t.payment_mode,
    'createdAt', flemme_v2.iso(t.created_at), 'offers', offers, 'history', history, 'reports', reports);
  if is_owner then
    result := result || jsonb_build_object('review', t.review, 'reviewNote', t.review_note);
  end if;
  if is_owner or is_chosen then
    result := result || jsonb_build_object('paymentDeclared', t.payment_declared, 'paymentConfirmed', t.payment_confirmed, 'address', t.address);
    if chosen.id is not null then
      result := result || jsonb_build_object('acceptedOfferId', chosen.id, 'agreement', jsonb_build_object(
        'amount', chosen.amount, 'commission', t.commission,
        'total', case when t.commission_model = 'prelevement' then chosen.amount else chosen.amount + t.commission end,
        'payout', case when t.commission_model = 'prelevement' then chosen.amount - t.commission else chosen.amount end,
        'rateBps', t.commission_bps, 'model', t.commission_model,
        'slot', chosen.slot, 'scope', chosen.scope, 'brigadier', flemme_v2.actor_json(chosen.brigadier_id)));
      select * into doc from flemme_v2.agreements where task_id = t.id;
      result := result || jsonb_build_object('contract', flemme_v2.agreement_json(doc),
        'myReview', (select jsonb_build_object('rating', r.rating, 'text', r.body) from flemme_v2.reviews r where r.task_id = t.id and r.author_id = p_actor));
      if t.payment_mode = 'direct' then
        select jsonb_build_object('method', 'stripe', 'status', 'paid', 'total', p.total, 'commission', p.commission,
            'payout', p.payout, 'at', flemme_v2.iso(p.paid_at)) into paid
          from flemme_v2.payments p where p.task_id = t.id and p.status = 'paid';
      else
        select jsonb_build_object('method', case when p.checkout_session_id like 'sim\_%' then 'simulation' else 'stripe' end,
            'status', p.status, 'total', p.total, 'commission', p.commission, 'payout', p.payout,
            'at', flemme_v2.iso(coalesce(p.paid_at, p.updated_at)), 'transferredAt', flemme_v2.iso(p.transferred_at)) into paid
          from flemme_v2.payments p where p.task_id = t.id and p.stage = 'signature' and p.status not in ('expired', 'doublon')
          order by (p.status in ('paid', 'authorized', 'disputed', 'refunded')) desc, p.created_at desc limit 1;
      end if;
      if paid is not null then result := result || jsonb_build_object('payment', paid); end if;
    end if;
  end if;
  return result;
end $$;

-- 7. Actions des membres : prix modifié dans l'accord et paiement simulé. Le reste de l'accord passe par flemme_v2.accord.
create function flemme_v2.reglement(p_action text, p_task uuid, p_data jsonb, p_request uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); t flemme_v2.tasks; chosen flemme_v2.offers; doc flemme_v2.agreements; previous flemme_v2.requests;
  new_amount integer; v_total integer; v_payout integer; result jsonb;
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) or
    not exists(select 1 from auth.users where id = uid and email_confirmed_at is not null) then
    raise exception 'Connexion avec un compte confirmé requise' using errcode = '42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Données invalides'; end if;

  if p_action = 'agreement_save' then
    -- Prix convenu facultatif : recalculé avec le taux figé au choix de la proposition, puis enregistrement habituel
    -- de l'accord (qui efface les signatures et crée une nouvelle version).
    if p_data ? 'amount' and p_data->'amount' <> 'null'::jsonb then
      select * into t from flemme_v2.tasks where id = p_task for update;
      if not found then raise exception 'Flemme introuvable'; end if;
      select * into chosen from flemme_v2.offers where id = t.accepted_offer_id for update;
      if t.owner_id <> uid and chosen.brigadier_id is distinct from uid then raise exception 'Accord inaccessible' using errcode = '42501'; end if;
      if t.status <> 'assigned' then raise exception 'L''accord se prépare une fois le membre choisi, avant la fin de la tâche'; end if;
      if exists(select 1 from flemme_v2.agreements where task_id = t.id and status = 'signed') then raise exception 'Accord déjà signé par les deux parties'; end if;
      new_amount := flemme_v2.amount(p_data->'amount');
      if new_amount <> chosen.amount then
        if t.payment_mode = 'direct' then raise exception 'Le prix de cette mission ne se modifie pas dans l''accord'; end if;
        update flemme_v2.offers set amount = new_amount where id = chosen.id;
        update flemme_v2.tasks set commission = round(new_amount::numeric * commission_bps / 10000)::integer where id = t.id;
        insert into flemme_v2.events (task_id, actor_id, kind, label)
        values (t.id, uid, 'agreement', 'Prix convenu modifié dans l''accord : ' || flemme_v2.euros(new_amount));
      end if;
    end if;
    return flemme_v2.accord(p_action, p_task, p_data - 'amount', p_request);
  end if;

  if p_action <> 'pay' then raise exception 'Action inconnue'; end if;
  if p_request is null then raise exception 'Identifiant de requête requis'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || p_request::text, 0));
  select * into previous from flemme_v2.requests where actor_id = uid and request_id = p_request;
  if found then
    if previous.action <> p_action or previous.task_id is distinct from p_task or previous.payload <> p_data then
      raise exception 'Identifiant déjà utilisé pour une autre action';
    end if;
    return previous.result;
  end if;

  -- Paiement simulé (mode « simulation ») : même parcours que Stripe, sans argent réel.
  select * into t from flemme_v2.tasks where id = p_task for update;
  if not found or t.owner_id <> uid then raise exception 'Paiement indisponible' using errcode = '42501'; end if;
  if t.payment_mode = 'stripe' then raise exception 'Cette mission se paie par carte via Stripe'; end if;
  if t.payment_mode <> 'simulation' then raise exception 'Paiement indisponible'; end if;
  select * into doc from flemme_v2.agreements where task_id = t.id;
  if t.status <> 'assigned' or doc.status is distinct from 'signed' then
    raise exception 'Le paiement s''ouvre une fois l''accord signé par les deux parties';
  end if;
  if exists(select 1 from flemme_v2.payments where task_id = t.id and stage = 'signature' and status in ('paid', 'authorized', 'disputed')) then
    raise exception 'Cette mission est déjà payée';
  end if;
  select * into chosen from flemme_v2.offers where id = t.accepted_offer_id;
  v_total := case when t.commission_model = 'prelevement' then chosen.amount else chosen.amount + t.commission end;
  v_payout := case when t.commission_model = 'prelevement' then chosen.amount - t.commission else chosen.amount end;
  insert into flemme_v2.payments (checkout_session_id, task_id, payer_id, total, commission, payout, status, stage, paid_at)
  values ('sim_' || replace(gen_random_uuid()::text, '-', ''), t.id, uid, v_total, t.commission, v_payout, 'paid', 'signature', clock_timestamp());
  update flemme_v2.tasks set updated_at = clock_timestamp() where id = t.id;
  insert into flemme_v2.events (task_id, actor_id, kind, label) values (t.id, uid, 'online_payment',
    'Paiement via Flemme enregistré · ' || flemme_v2.euros(v_total) || ' dont ' || flemme_v2.euros(t.commission)
    || ' de frais de plateforme · simulation, aucun argent réel');
  result := jsonb_build_object('task', flemme_v2.task_json(t.id, uid));
  insert into flemme_v2.requests (actor_id, request_id, action, task_id, payload, result)
  values (uid, p_request, p_action, p_task, p_data, result);
  return result;
end $$;

-- 8. Stripe à la signature (fonctions Edge, service_role uniquement).
--    Charges séparées : Flemme encaisse le total à la signature, puis verse la part du membre à la fin de la mission.
create function flemme_v2.paiement_signature(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid; tid uuid; t flemme_v2.tasks; chosen flemme_v2.offers; acc flemme_v2.brigadier_accounts; pay flemme_v2.payments;
  v_total integer; v_payout integer; open_url text; ev text; kind text; seen boolean; out jsonb;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Données invalides'; end if;

  if p_action = 'signature_context' then
    uid := (p_data->>'userId')::uuid; tid := (p_data->>'taskId')::uuid;
    select * into t from flemme_v2.tasks where id = tid;
    if not found then raise exception 'Flemme introuvable'; end if;
    if t.owner_id is distinct from uid then raise exception 'Seul le déposant peut payer' using errcode = '42501'; end if;
    if t.payment_mode <> 'stripe' then raise exception 'Cette mission ne se paie pas par Stripe'; end if;
    if t.status <> 'assigned' or not exists(select 1 from flemme_v2.agreements where task_id = tid and status = 'signed') then
      raise exception 'Le paiement s''ouvre une fois l''accord signé par les deux parties';
    end if;
    if exists(select 1 from flemme_v2.payments where task_id = tid and stage = 'signature' and status in ('authorized', 'paid', 'disputed')) then
      raise exception 'Cette mission est déjà payée';
    end if;
    select * into chosen from flemme_v2.offers where id = t.accepted_offer_id;
    v_total := case when t.commission_model = 'prelevement' then chosen.amount else chosen.amount + t.commission end;
    v_payout := case when t.commission_model = 'prelevement' then chosen.amount - t.commission else chosen.amount end;
    -- Une session encore ouverte, au même montant, est réutilisée.
    select checkout_url into open_url from flemme_v2.payments
    where task_id = tid and stage = 'signature' and status = 'pending' and payments.total = v_total
      and created_at > clock_timestamp() - interval '23 hours' order by created_at desc limit 1;
    return jsonb_build_object('title', t.title, 'total', v_total, 'commission', t.commission, 'payout', v_payout, 'openUrl', open_url);

  elsif p_action = 'signature_created' then
    insert into flemme_v2.payments (checkout_session_id, task_id, payer_id, checkout_url, total, commission, payout, stage)
    values (p_data->>'sessionId', (p_data->>'taskId')::uuid, (p_data->>'userId')::uuid, p_data->>'url',
      (p_data->>'total')::integer, (p_data->>'commission')::integer, (p_data->>'payout')::integer, 'signature')
    on conflict (checkout_session_id) do nothing;
    return jsonb_build_object('ok', true);

  elsif p_action = 'payout_context' then
    -- Versement de la part du membre, une fois la mission terminée (déclenché par l'une ou l'autre partie).
    uid := (p_data->>'userId')::uuid; tid := (p_data->>'taskId')::uuid;
    select * into t from flemme_v2.tasks where id = tid;
    if not found then raise exception 'Flemme introuvable'; end if;
    select * into chosen from flemme_v2.offers where id = t.accepted_offer_id;
    if uid is distinct from t.owner_id and uid is distinct from chosen.brigadier_id then raise exception 'Versement inaccessible' using errcode = '42501'; end if;
    if t.status <> 'completed' then raise exception 'Le versement se fait une fois la mission terminée'; end if;
    select * into pay from flemme_v2.payments where task_id = tid and stage = 'signature' and status = 'paid' and checkout_session_id like 'cs\_%';
    if not found then raise exception 'Aucun paiement Stripe encaissé pour cette mission'; end if;
    if pay.transfer_id is not null then return jsonb_build_object('done', true); end if;
    select * into acc from flemme_v2.brigadier_accounts where user_id = chosen.brigadier_id;
    if not found or not acc.payouts_enabled then raise exception 'Le membre doit d''abord activer ses paiements avec Stripe'; end if;
    return jsonb_build_object('accountId', acc.stripe_account_id, 'amount', pay.payout, 'sessionId', pay.checkout_session_id,
      'paymentIntentId', pay.payment_intent_id);

  elsif p_action = 'payout_done' then
    update flemme_v2.payments set transfer_id = p_data->>'transferId', transferred_at = clock_timestamp(), updated_at = clock_timestamp()
    where checkout_session_id = p_data->>'sessionId' and transfer_id is null returning * into pay;
    if found then
      insert into flemme_v2.events (task_id, actor_id, kind, label) values (pay.task_id, (p_data->>'userId')::uuid, 'payout',
        'Part du membre versée par Stripe : ' || flemme_v2.euros(pay.payout));
    end if;
    return jsonb_build_object('ok', true);

  elsif p_action = 'webhook' then
    -- Idempotence : chaque événement Stripe (evt_…) n'est traité qu'une fois. En cas d'erreur, rien n'est
    -- enregistré (même transaction) et Stripe renverra l'événement.
    ev := p_data->>'eventId'; kind := p_data->>'type';
    insert into flemme_v2.stripe_events (id, type) values (ev, kind) on conflict (id) do nothing;
    get diagnostics seen = row_count;
    if not seen then return jsonb_build_object('already', true); end if;

    if kind in ('checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired') then
      select * into pay from flemme_v2.payments where checkout_session_id = p_data->>'sessionId' for update;
      if not found then out := jsonb_build_object('ignored', 'session inconnue');
      elsif pay.stage = 'fin' then
        -- Ancien parcours (paiement après la tâche) : traitement d'origine.
        if kind = 'checkout.session.completed' and p_data->>'paymentStatus' <> 'paid' then
          out := jsonb_build_object('ignored', 'paiement différé pas encore encaissé');
        else
          out := flemme_v2.paiement(case when kind in ('checkout.session.expired', 'checkout.session.async_payment_failed') then 'checkout_expired' else 'checkout_paid' end,
            jsonb_build_object('sessionId', pay.checkout_session_id, 'amountTotal', (p_data->>'amountTotal')::integer, 'paymentIntentId', p_data->>'paymentIntentId'));
        end if;
      elsif kind = 'checkout.session.expired' then
        update flemme_v2.payments set status = 'expired', updated_at = clock_timestamp() where checkout_session_id = pay.checkout_session_id and status = 'pending';
        out := jsonb_build_object('status', 'expired');
      elsif kind = 'checkout.session.async_payment_failed' then
        update flemme_v2.payments set status = 'failed', updated_at = clock_timestamp() where checkout_session_id = pay.checkout_session_id and status in ('pending', 'authorized');
        insert into flemme_v2.events (task_id, actor_id, kind, label) values (pay.task_id, pay.payer_id, 'online_payment', 'Échec du paiement · tu peux réessayer');
        out := jsonb_build_object('status', 'failed');
      elsif kind = 'checkout.session.completed' and p_data->>'paymentStatus' <> 'paid' then
        -- Moyen de paiement différé (prélèvement) : paiement initié, encaissement à confirmer.
        update flemme_v2.payments set status = 'authorized', payment_intent_id = p_data->>'paymentIntentId', updated_at = clock_timestamp()
        where checkout_session_id = pay.checkout_session_id and status = 'pending';
        out := jsonb_build_object('status', 'authorized');
      else
        if pay.status in ('paid', 'doublon', 'refunded', 'disputed') then
          out := jsonb_build_object('already', true);
        elsif (p_data->>'amountTotal')::integer is distinct from pay.total then
          raise exception 'Montant payé différent de l''accord';
        elsif exists(select 1 from flemme_v2.payments where task_id = pay.task_id and stage = 'signature' and status = 'paid') then
          update flemme_v2.payments set status = 'doublon', payment_intent_id = p_data->>'paymentIntentId', paid_at = clock_timestamp(), updated_at = clock_timestamp()
          where checkout_session_id = pay.checkout_session_id;
          out := jsonb_build_object('duplicate', true);
        else
          update flemme_v2.payments set status = 'paid', payment_intent_id = p_data->>'paymentIntentId', paid_at = clock_timestamp(), updated_at = clock_timestamp()
          where checkout_session_id = pay.checkout_session_id;
          insert into flemme_v2.events (task_id, actor_id, kind, label) values (pay.task_id, pay.payer_id, 'online_payment',
            'Paiement via Flemme reçu par Stripe · ' || flemme_v2.euros(pay.total) || ' dont ' || flemme_v2.euros(pay.commission)
            || ' de frais de plateforme · la part du membre est versée à la fin de la mission');
          out := jsonb_build_object('status', 'paid');
        end if;
      end if;

    elsif kind in ('charge.refunded', 'charge.dispute.created', 'charge.dispute.closed') then
      select * into pay from flemme_v2.payments where payment_intent_id = p_data->>'paymentIntentId' and status not in ('expired', 'doublon')
        order by created_at desc limit 1 for update;
      if not found then out := jsonb_build_object('ignored', 'paiement inconnu');
      elsif kind = 'charge.refunded' then
        if coalesce((p_data->>'refunded')::boolean, false) then
          update flemme_v2.payments set status = 'refunded', refunded_at = clock_timestamp(), updated_at = clock_timestamp() where checkout_session_id = pay.checkout_session_id;
          insert into flemme_v2.events (task_id, actor_id, kind, label) values (pay.task_id, pay.payer_id, 'online_payment', 'Paiement remboursé · ' || flemme_v2.euros(pay.total));
          out := jsonb_build_object('status', 'refunded');
        else
          insert into flemme_v2.events (task_id, actor_id, kind, label) values (pay.task_id, pay.payer_id, 'online_payment',
            'Remboursement partiel · ' || flemme_v2.euros((p_data->>'amountRefunded')::integer));
          out := jsonb_build_object('status', pay.status, 'partial', true);
        end if;
      elsif kind = 'charge.dispute.created' then
        update flemme_v2.payments set status = 'disputed', disputed_at = clock_timestamp(), updated_at = clock_timestamp() where checkout_session_id = pay.checkout_session_id;
        insert into flemme_v2.events (task_id, actor_id, kind, label) values (pay.task_id, pay.payer_id, 'online_payment', 'Paiement contesté auprès de la banque · l''équipe Flemme suit le dossier');
        out := jsonb_build_object('status', 'disputed');
      else
        update flemme_v2.payments set status = case when p_data->>'disputeStatus' = 'won' then 'paid' else 'refunded' end,
          refunded_at = case when p_data->>'disputeStatus' = 'won' then refunded_at else clock_timestamp() end, updated_at = clock_timestamp()
        where checkout_session_id = pay.checkout_session_id and status = 'disputed';
        insert into flemme_v2.events (task_id, actor_id, kind, label) values (pay.task_id, pay.payer_id, 'online_payment',
          case when p_data->>'disputeStatus' = 'won' then 'Contestation close en faveur de Flemme · paiement maintenu' else 'Contestation close · paiement rendu au déposant' end);
        out := jsonb_build_object('status', case when p_data->>'disputeStatus' = 'won' then 'paid' else 'refunded' end);
      end if;

    elsif kind = 'account.updated' then
      out := flemme_v2.paiement('account_update', jsonb_build_object('accountId', p_data->>'accountId',
        'chargesEnabled', p_data->'chargesEnabled', 'payoutsEnabled', p_data->'payoutsEnabled'));
    else
      out := jsonb_build_object('ignored', kind);
    end if;
    update flemme_v2.stripe_events set result = out where id = ev;
    return out;
  end if;
  raise exception 'Action inconnue';
end $$;

-- Point d'entrée des fonctions Edge : nouvelles actions, sinon actions d'origine (20261103140000).
create or replace function public.flemme_paiement_api(p_action text, p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_action in ('signature_context', 'signature_created', 'payout_context', 'payout_done', 'webhook') then
    return flemme_v2.paiement_signature(p_action, p_data);
  end if;
  return flemme_v2.paiement(p_action, p_data);
end $$;
revoke all on function public.flemme_paiement_api(text, jsonb) from public, anon, authenticated;
grant execute on function public.flemme_paiement_api(text, jsonb) to service_role;

revoke all on function flemme_v2.default_payment_mode(), flemme_v2.euros(integer), flemme_v2.agreement_version_guard(),
  flemme_v2.agreement_version_log(), flemme_v2.payment_mode_guard(), flemme_v2.reglement(text, uuid, jsonb, uuid),
  flemme_v2.paiement_signature(text, jsonb) from public, anon, authenticated;
grant execute on function flemme_v2.reglement(text, uuid, jsonb, uuid) to authenticated;

-- 9. Points d'entrée : mêmes aiguillages que 20261116120000 (garde des flags comprise), plus « pay » et le prix dans l'accord.
create or replace function public.flemme_mobile_api(p_action text, p_task uuid default null, p_data jsonb default '{}', p_request uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform flemme_v2.flag_guard(p_action);
  return case when p_action = 'search' then flemme_v2.search(p_data)
    when p_action in ('agreement_save', 'pay') then flemme_v2.reglement(p_action, p_task, p_data, p_request)
    when p_action in ('profile_get', 'profile_save', 'apply', 'apply_edit', 'agreement_submit', 'agreement_sign', 'review')
      then flemme_v2.accord(p_action, p_task, p_data, p_request)
    when p_action in ('file_prepare', 'file_list', 'file_delete', 'help_send', 'help_list') then flemme_v2.aide(p_action, p_task, p_data, p_request)
    else flemme_v2.execute(p_action, p_task, p_data, p_request) end;
end $$;
