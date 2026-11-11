-- FLEMME V2 : commission partagée entre le déposant et le Brigadier (option B, mise en relation nationale).
-- S'applique après 20261104150000_flemme_v2_fichiers_aide.sql. Proposition en PR brouillon : rien n'est décidé tant que Ben n'a pas fusionné.
-- Nouveau modèle « partage » : le déposant paie forfait + commission_bps (12 %), le Brigadier reçoit forfait − commission_brigadier_bps (13 %).
-- FLEMME garde les deux parts (25 % du forfait). Les modèles « ajout » et « prelevement » restent possibles.
-- Les accords déjà conclus gardent leurs montants : commission_brigadier est rempli d'après leur modèle.
-- Doit rester identique à COMMISSION dans packages/shared/src/domain.ts (vérifié par supabase/tests/paiement.test.mjs).

-- 1. Réglage : nouveau modèle et part retenue au Brigadier (0 hors modèle « partage »).
alter table flemme_v2.settings drop constraint settings_commission_model_check;
alter table flemme_v2.settings add constraint settings_commission_model_check check (commission_model in ('ajout', 'prelevement', 'partage'));
alter table flemme_v2.settings add column commission_brigadier_bps integer not null default 0 check (commission_brigadier_bps between 0 and 10000);
alter table flemme_v2.settings add constraint settings_commission_brigadier_rule check (commission_model = 'partage' or commission_brigadier_bps = 0);
update flemme_v2.settings set commission_model = 'partage', commission_bps = 1200, commission_brigadier_bps = 1300;

-- 2. Chaque accord garde la part retenue au Brigadier, en centimes et en points de base.
--    total = forfait + commission − commission_brigadier ; payout = forfait − commission_brigadier.
alter table flemme_v2.tasks drop constraint tasks_commission_model_check;
alter table flemme_v2.tasks add constraint tasks_commission_model_check check (commission_model in ('ajout', 'prelevement', 'partage'));
alter table flemme_v2.tasks add column commission_brigadier integer check (commission_brigadier >= 0),
  add column commission_brigadier_bps integer check (commission_brigadier_bps between 0 and 10000);
update flemme_v2.tasks set commission_brigadier = case when commission_model = 'prelevement' then commission else 0 end,
  commission_brigadier_bps = 0 where commission is not null;
alter table flemme_v2.tasks add constraint tasks_commission_brigadier_rule
  check ((commission is null) = (commission_brigadier is null) and (commission is null) = (commission_brigadier_bps is null));

-- 3. Part en centimes, arrondie au centime le plus proche (comme Math.round dans domain.ts).
create function flemme_v2.fee(amount integer, bps integer)
returns integer language sql immutable set search_path = '' as $$
  select round(amount::numeric * bps / 10000)::integer;
$$;

-- 4. Affichage de l'accord : montants calculés avec la part retenue au Brigadier (copie de 20261104140000, seules ces lignes changent).
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
    'budgetRange', t.budget_range, 'mode', t.work_mode,
    'createdAt', flemme_v2.iso(t.created_at), 'offers', offers, 'history', history, 'reports', reports);
  if is_owner then
    result := result || jsonb_build_object('review', t.review, 'reviewNote', t.review_note);
  end if;
  if is_owner or is_chosen then
    result := result || jsonb_build_object('paymentDeclared', t.payment_declared, 'paymentConfirmed', t.payment_confirmed, 'address', t.address);
    if chosen.id is not null then
      result := result || jsonb_build_object('acceptedOfferId', chosen.id, 'agreement', jsonb_build_object(
        'amount', chosen.amount, 'commission', t.commission,
        'total', chosen.amount + t.commission - t.commission_brigadier,
        'payout', chosen.amount - t.commission_brigadier,
        'rateBps', t.commission_bps, 'brigadierBps', t.commission_brigadier_bps, 'model', t.commission_model,
        'slot', chosen.slot, 'scope', chosen.scope, 'brigadier', flemme_v2.actor_json(chosen.brigadier_id)));
      select * into doc from flemme_v2.agreements where task_id = t.id;
      result := result || jsonb_build_object('contract', flemme_v2.agreement_json(doc),
        'myReview', (select jsonb_build_object('rating', r.rating, 'text', r.body) from flemme_v2.reviews r where r.task_id = t.id and r.author_id = p_actor));
      select jsonb_build_object('method', 'stripe', 'status', 'paid', 'total', p.total, 'commission', p.commission,
          'payout', p.payout, 'at', flemme_v2.iso(p.paid_at)) into paid
        from flemme_v2.payments p where p.task_id = t.id and p.status = 'paid';
      if paid is not null then result := result || jsonb_build_object('payment', paid); end if;
    end if;
  end if;
  return result;
end $$;

-- 5. Acceptation d'une proposition : commission des deux côtés (copie de 20261104120000, seul le bloc « accept » change).
create or replace function flemme_v2.execute(p_action text, p_task uuid, p_data jsonb, p_request uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); t flemme_v2.tasks; o flemme_v2.offers; previous flemme_v2.requests; d flemme_v2.drafts;
  input flemme_v2.tasks; is_owner boolean; is_chosen boolean; tid uuid; oid uuid; did uuid;
  event_text text; event_body text; result jsonb; cfg flemme_v2.settings;
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) or
    not exists(select 1 from auth.users where id = uid and email_confirmed_at is not null) then
    raise exception 'Connexion avec un compte confirmé requise' using errcode = '42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Données invalides'; end if;
  insert into flemme_v2.profiles (user_id, display_name)
  select u.id, flemme_v2.default_display_name(u.raw_user_meta_data, u.email) from auth.users u where u.id = uid
  on conflict do nothing;
  select * into strict cfg from flemme_v2.settings;

  -- Lectures et réglages personnels : sans historique ni idempotence.
  if p_action = 'me' then
    return jsonb_build_object('profile', flemme_v2.actor_json(uid));
  elsif p_action = 'update_profile' then
    update flemme_v2.profiles set display_name = flemme_v2.required_text(p_data->'displayName', 40), updated_at = clock_timestamp()
    where user_id = uid;
    return jsonb_build_object('profile', flemme_v2.actor_json(uid));
  elsif p_action = 'list' then
    return flemme_v2.list_tasks(uid, p_data);
  elsif p_action = 'drafts' then
    return jsonb_build_object('drafts', coalesce((select jsonb_agg(flemme_v2.draft_json(x) order by x.updated_at desc)
      from flemme_v2.drafts x where x.owner_id = uid), '[]'::jsonb));
  elsif p_action = 'draft_save' then
    -- L'identifiant vient du client : renvoyer le même brouillon ne crée pas de doublon.
    did := flemme_v2.uuid_of(p_data->'id');
    if jsonb_typeof(p_data->'fields') is distinct from 'object' then raise exception 'Brouillon invalide'; end if;
    if p_data->>'kind' = 'offer' then
      tid := flemme_v2.uuid_of(p_data->'taskId');
      if not exists(select 1 from flemme_v2.tasks where id = tid and owner_id <> uid and status = 'open' and review = 'published') then
        raise exception 'Flemme indisponible';
      end if;
    elsif p_data->>'kind' is distinct from 'task' then raise exception 'Brouillon invalide';
    end if;
    select * into d from flemme_v2.drafts where id = did;
    if found and d.owner_id <> uid then raise exception 'Brouillon introuvable'; end if;
    if not found and (select count(*) from flemme_v2.drafts where owner_id = uid) >= 50 then
      raise exception 'Trop de brouillons : supprimes-en avant d''en créer un autre';
    end if;
    insert into flemme_v2.drafts (id, owner_id, kind, task_id, fields) values (did, uid, p_data->>'kind', tid, p_data->'fields')
    on conflict (id) do update set fields = excluded.fields, updated_at = clock_timestamp()
    returning * into d;
    return jsonb_build_object('draft', flemme_v2.draft_json(d));
  elsif p_action = 'draft_delete' then
    delete from flemme_v2.drafts where id = flemme_v2.uuid_of(p_data->'id') and owner_id = uid;
    return jsonb_build_object('ok', true);
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
    input := flemme_v2.task_input(p_data);
    insert into flemme_v2.tasks (owner_id, title, details, place, budget, category, deadline, deadline_note, budget_range, work_mode, address, review)
    values (uid, input.title, input.details, input.place, input.budget, input.category, input.deadline, input.deadline_note,
      input.budget_range, input.work_mode, input.address, flemme_v2.default_review())
    returning id into tid;
    -- Le brouillon d'origine disparaît avec l'envoi : il n'y a plus deux versions de la même demande.
    if p_data->'draftId' is not null and p_data->'draftId' <> 'null'::jsonb then
      delete from flemme_v2.drafts where id = flemme_v2.uuid_of(p_data->'draftId') and owner_id = uid;
    end if;
    event_text := case when cfg.moderation_tasks then 'Demande envoyée · privée jusqu''à sa validation par l''équipe FLEMME'
      else 'Flemme publiée · sans expiration' end;
  else
    select * into t from flemme_v2.tasks where id = p_task for update;
    if not found then raise exception 'Flemme introuvable'; end if;
    tid := t.id;
    is_owner := t.owner_id = uid;
    is_chosen := t.accepted_offer_id is not null
      and exists(select 1 from flemme_v2.offers where id = t.accepted_offer_id and brigadier_id = uid);
    -- Une demande non publiée n'existe que pour son déposant.
    if not is_owner and t.review <> 'published' then raise exception 'Flemme introuvable'; end if;
    if p_action in ('accept', 'decline', 'message') then
      begin oid := (p_data->>'offerId')::uuid;
      exception when others then raise exception 'Proposition introuvable';
      end;
      select * into o from flemme_v2.offers where id = oid and task_id = t.id for update;
      if not found then raise exception 'Proposition introuvable'; end if;
    end if;

    if p_action = 'edit' then
      -- Modifiable tant que personne n'a été retenu et qu'aucune proposition n'attend de réponse.
      if not is_owner or t.status <> 'open' or t.review = 'rejected'
        or exists(select 1 from flemme_v2.offers where task_id = t.id and status = 'pending') then
        raise exception 'Cette demande ne peut plus être modifiée' using errcode = '42501';
      end if;
      input := flemme_v2.task_input(p_data);
      update flemme_v2.tasks set title = input.title, details = input.details, place = input.place, budget = input.budget,
        category = input.category, deadline = input.deadline, deadline_note = input.deadline_note, budget_range = input.budget_range,
        work_mode = input.work_mode, address = input.address, review_note = null,
        review = case when cfg.moderation_tasks then 'pending' else 'published' end
      where id = t.id;
      event_text := case when cfg.moderation_tasks then 'Demande modifiée · renvoyée pour validation' else 'Demande modifiée' end;
    elsif p_action = 'offer' then
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
        update flemme_v2.offers set status = case when id = o.id then 'accepted' else 'not_selected' end
        where task_id = t.id and status = 'pending';
        update flemme_v2.tasks set status = 'assigned', accepted_offer_id = o.id,
          commission = flemme_v2.fee(o.amount, cfg.commission_bps) + flemme_v2.fee(o.amount, cfg.commission_brigadier_bps),
          commission_brigadier = case cfg.commission_model when 'prelevement' then flemme_v2.fee(o.amount, cfg.commission_bps)
            when 'partage' then flemme_v2.fee(o.amount, cfg.commission_brigadier_bps) else 0 end,
          commission_bps = cfg.commission_bps, commission_brigadier_bps = cfg.commission_brigadier_bps,
          commission_model = cfg.commission_model where id = t.id;
        event_text := 'Accord accepté · forfait et commission de ' || flemme_v2.rate_label(cfg.commission_bps)
          || case when cfg.commission_model = 'partage' then ' + ' || flemme_v2.rate_label(cfg.commission_brigadier_bps) else '' end || ' confirmés';
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

-- 6. Paiement en ligne : mêmes montants que l'accord (copie de 20261103140000, seules les lignes total et payout changent).
create or replace function flemme_v2.paiement(p_action text, p_data jsonb)
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
    total := chosen.amount + t.commission - t.commission_brigadier;
    payout := chosen.amount - t.commission_brigadier;
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
