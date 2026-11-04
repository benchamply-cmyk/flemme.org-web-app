-- FLEMME V2 : le parcours de l'aperçu /apercu.html devient réel dans l'app connectée.
-- S'applique après 20261103140000_flemme_v2_commission_paiement.sql. Additif : les flemmes déjà en ligne restent publiées,
-- les anciennes versions de l'app (mobile) continuent de fonctionner, les nouveaux champs sont facultatifs pour elles.
--   1. Dépôt enrichi (catégorie, délai, fourchette de budget, mode, adresse privée), brouillons, validation admin.
-- Aucune clé ni secret ici. Rien n'est appliqué automatiquement : voir supabase/README-parcours.md.

-- 1. Réglages de modération (une seule ligne, comme la commission).
alter table flemme_v2.settings
  add column moderation_tasks boolean not null default true;

-- 2. Demandes enrichies. Les codes sont traduits dans packages/shared/src/parcours.ts.
alter table flemme_v2.tasks
  add column category text check (category in ('administratif', 'maison', 'numerique', 'organisation', 'autre')),
  add column deadline text check (deadline in ('urgent', 'aujourdhui', 'demain', '3_jours', '1_semaine', '1_mois', '1_an', 'autre')),
  add column deadline_note text check (char_length(deadline_note) between 1 and 100),
  add column budget_range text check (budget_range in ('moins_10', '10_50', '50_200', 'plus_200')),
  add column work_mode text check (work_mode in ('distance', 'sur_place', 'les_deux')),
  -- Adresse précise : visible du déposant, du Brigadier retenu et de l'équipe, jamais sur la fiche publique.
  add column address text check (char_length(address) between 1 and 200),
  -- Les flemmes existantes restent publiées ; le défaut passe ensuite à « pending » pour les nouvelles.
  add column review text not null default 'published' check (review in ('pending', 'changes_requested', 'published', 'rejected')),
  add column review_note text check (char_length(review_note) between 1 and 900),
  add constraint tasks_budget_choice check (budget is null or budget_range is null),
  add constraint tasks_deadline_note check (deadline_note is null or deadline = 'autre'),
  -- Une demande non publiée ne peut pas avoir été attribuée.
  add constraint tasks_review_open check (review = 'published' or status = 'open');
-- Nouvelles demandes (app ou script de reprise de l'ancien espace) : en attente si la validation est activée.
create function flemme_v2.default_review()
returns text language sql stable security definer set search_path = '' as $$
  select case when coalesce((select moderation_tasks from flemme_v2.settings limit 1), true) then 'pending' else 'published' end;
$$;
alter table flemme_v2.tasks alter column review set default flemme_v2.default_review();
create index tasks_review_queue on flemme_v2.tasks (created_at) where review = 'pending';

-- 3. Brouillons enregistrés sur le compte (retrouvés sur tous les appareils), jamais visibles d'un autre membre.
create table flemme_v2.drafts (
  id uuid primary key,
  owner_id uuid not null references flemme_v2.profiles(user_id) on delete cascade,
  kind text not null check (kind in ('task', 'offer')),
  task_id uuid references flemme_v2.tasks(id) on delete cascade,
  fields jsonb not null check (jsonb_typeof(fields) = 'object' and octet_length(fields::text) <= 8000),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint drafts_offer_task check ((kind = 'offer') = (task_id is not null))
);
create index drafts_owner on flemme_v2.drafts (owner_id, updated_at desc);
alter table flemme_v2.drafts enable row level security;
revoke all on flemme_v2.drafts from public, anon, authenticated;

alter table flemme_v2.events drop constraint events_kind_check;
alter table flemme_v2.events add constraint events_kind_check check (kind in ('create', 'edit', 'offer', 'message', 'accept', 'decline',
  'complete', 'declare_payment', 'confirm_payment', 'report', 'admin', 'online_payment'));

alter table flemme_v2.alerts drop constraint alerts_kind_check;
alter table flemme_v2.alerts add constraint alerts_kind_check check (kind in ('task_created', 'task_edited', 'report', 'agreement'));

-- 4. Aides de validation.
create function flemme_v2.optional_text(v jsonb, max_length integer)
returns text language plpgsql immutable set search_path = '' as $$
begin
  if v is null or v = 'null'::jsonb or (jsonb_typeof(v) = 'string' and btrim(v #>> '{}') = '') then return null; end if;
  return flemme_v2.required_text(v, max_length);
end $$;

create function flemme_v2.choice(v jsonb, allowed text[], label text)
returns text language plpgsql immutable set search_path = '' as $$
begin
  if v is null or v = 'null'::jsonb or v = '""'::jsonb then return null; end if;
  if jsonb_typeof(v) <> 'string' or not ((v #>> '{}') = any(allowed)) then raise exception '% invalide', label; end if;
  return v #>> '{}';
end $$;

-- Champs d'une demande, validés. Les anciennes versions de l'app n'envoient que title, details, place, budget.
create function flemme_v2.task_input(p_data jsonb)
returns flemme_v2.tasks language plpgsql immutable set search_path = '' as $$
declare r flemme_v2.tasks;
begin
  r.title := flemme_v2.required_text(p_data->'title', 100);
  r.details := flemme_v2.required_text(p_data->'details', 1000);
  r.category := flemme_v2.choice(p_data->'category', array['administratif', 'maison', 'numerique', 'organisation', 'autre'], 'Catégorie');
  r.deadline := flemme_v2.choice(p_data->'deadline', array['urgent', 'aujourdhui', 'demain', '3_jours', '1_semaine', '1_mois', '1_an', 'autre'], 'Délai');
  r.deadline_note := flemme_v2.optional_text(p_data->'deadlineNote', 100);
  if r.deadline = 'autre' and r.deadline_note is null then raise exception 'Précise le délai approximatif'; end if;
  if r.deadline is distinct from 'autre' then r.deadline_note := null; end if;
  if p_data->'budget' is not null and p_data->'budget' <> 'null'::jsonb then r.budget := flemme_v2.amount(p_data->'budget'); end if;
  r.budget_range := flemme_v2.choice(p_data->'budgetRange', array['moins_10', '10_50', '50_200', 'plus_200'], 'Fourchette');
  if r.budget is not null and r.budget_range is not null then
    raise exception 'Choisis un budget libre ou une fourchette, pas les deux';
  end if;
  r.work_mode := flemme_v2.choice(p_data->'mode', array['distance', 'sur_place', 'les_deux'], 'Lieu');
  r.place := flemme_v2.optional_text(p_data->'place', 100);
  if r.work_mode = 'distance' then
    r.place := coalesce(r.place, 'À distance');
  elsif r.place is null then
    raise exception 'Indique une ville ou un secteur pour une tâche sur place';
  end if;
  if r.work_mode in ('sur_place', 'les_deux') then r.address := flemme_v2.optional_text(p_data->'address', 200); end if;
  return r;
end $$;

-- 5. Vue d'une flemme : nouveaux champs. Adresse réservée aux deux parties, statut de validation au déposant.
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

create function flemme_v2.draft_json(d flemme_v2.drafts)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', d.id, 'kind', d.kind, 'taskId', d.task_id, 'fields', d.fields, 'updatedAt', flemme_v2.iso(d.updated_at));
$$;

-- 6. Liste des flemmes : une demande n'est visible des autres membres qu'une fois validée.
create function flemme_v2.list_tasks(uid uuid, p_data jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  page_size integer; cursor_at timestamptz; cursor_id uuid; ids uuid[]; last_at timestamptz; next_cursor text; result jsonb;
begin
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
    where ((v.status = 'open' and v.review = 'published') or v.owner_id = uid
        or exists(select 1 from flemme_v2.offers b where b.task_id = v.id and b.brigadier_id = uid))
      and (cursor_at is null or (v.created_at, v.id) < (cursor_at, cursor_id))
    order by v.created_at desc, v.id desc
    limit page_size + 1) x;
  ids := coalesce(ids, '{}');
  if cardinality(ids) > page_size then
    ids := ids[1:page_size];
    select created_at into last_at from flemme_v2.tasks where id = ids[page_size];
    next_cursor := to_char(last_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' || ids[page_size]::text;
  end if;
  select coalesce(jsonb_agg(flemme_v2.task_json(i.id, uid) order by i.n), '[]'::jsonb) into result
  from unnest(ids) with ordinality as i(id, n);
  return jsonb_build_object('tasks', result, 'nextCursor', next_cursor);
end $$;

-- 7. Point d'entrée des membres, réécrit : mêmes actions qu'avant, plus brouillons et modification d'une demande.
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

-- 8. Alertes : une demande modifiée est signalée à l'équipe comme une nouvelle (elle attend une validation).
create or replace function flemme_v2.on_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare t flemme_v2.tasks; chosen flemme_v2.offers;
begin
  select * into t from flemme_v2.tasks where id = new.task_id;
  if t.accepted_offer_id is not null then select * into chosen from flemme_v2.offers where id = t.accepted_offer_id; end if;
  if new.kind in ('create', 'edit') then
    perform flemme_v2.queue_alert(case when new.kind = 'create' then 'task_created' else 'task_edited' end, t.id, jsonb_build_object(
      'title', t.title, 'place', t.place, 'budget', t.budget, 'owner', flemme_v2.display_name(t.owner_id),
      'review', t.review, 'category', t.category));
  elsif new.kind = 'accept' then
    perform flemme_v2.queue_alert('agreement', t.id, jsonb_build_object(
      'title', t.title, 'owner', flemme_v2.display_name(t.owner_id), 'brigadier', flemme_v2.display_name(chosen.brigadier_id),
      'amount', chosen.amount, 'commission', t.commission));
  elsif new.kind = 'report' then
    insert into flemme_v2.disputes (task_id) values (t.id)
      on conflict (task_id) do update set status = 'open', updated_at = clock_timestamp()
      where flemme_v2.disputes.status = 'resolved';
    perform flemme_v2.queue_alert('report', t.id, jsonb_build_object(
      'title', t.title, 'actor', flemme_v2.display_name(new.actor_id), 'text', new.body,
      'owner', flemme_v2.display_name(t.owner_id), 'brigadier', case when chosen.id is null then null else flemme_v2.display_name(chosen.brigadier_id) end));
  end if;
  return new;
end $$;
drop trigger on_event on flemme_v2.events;
create trigger on_event after insert on flemme_v2.events
  for each row when (new.kind in ('create', 'edit', 'accept', 'report')) execute function flemme_v2.on_event();

-- 9. Page admin : validation des demandes. Nouvelle fonction appelée par public.flemme_admin_api
-- pour ses propres actions ; les actions existantes restent dans flemme_v2.admin_execute.
create function flemme_v2.require_admin()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
    or not exists(select 1 from flemme_v2.admins a join auth.users u on u.id = a.user_id
                  where a.user_id = uid and u.email_confirmed_at is not null) then
    raise exception 'Accès réservé à l''équipe FLEMME' using errcode = '42501';
  end if;
  return uid;
end $$;

-- Vue complète d'une demande pour l'équipe : celle du déposant, avec son e-mail.
create function flemme_v2.admin_task_json(p_task uuid)
returns jsonb language sql stable set search_path = '' as $$
  select flemme_v2.task_json(t.id, t.owner_id) || jsonb_build_object('ownerEmail', u.email, 'updatedAt', flemme_v2.iso(t.updated_at))
  from flemme_v2.tasks t left join auth.users u on u.id = t.owner_id where t.id = p_task;
$$;

create function flemme_v2.admin_parcours(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := flemme_v2.require_admin(); target uuid; note text; decision text; t flemme_v2.tasks; event_text text;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Données invalides'; end if;
  if p_action = 'moderation' then
    return jsonb_build_object(
      'tasks', coalesce((select jsonb_agg(flemme_v2.admin_task_json(x.id) order by x.updated_at)
        from flemme_v2.tasks x where x.review = 'pending'), '[]'::jsonb),
      'waiting', (select count(*) from flemme_v2.tasks where review = 'changes_requested'));
  elsif p_action = 'task_review' then
    target := flemme_v2.uuid_of(p_data->'taskId');
    decision := p_data->>'decision';
    select * into t from flemme_v2.tasks where id = target for update;
    if not found then raise exception 'Demande introuvable'; end if;
    if t.review <> 'pending' then raise exception 'Cette demande n''attend plus de validation'; end if;
    if decision = 'publish' then
      note := flemme_v2.optional_text(p_data->'note', 900);
      event_text := 'Demande validée et publiée par l''équipe FLEMME';
    elsif decision in ('changes', 'reject') then
      note := flemme_v2.required_text(p_data->'note', 900);
      event_text := case when decision = 'changes' then 'Correction demandée par l''équipe FLEMME : ' else 'Demande refusée par l''équipe FLEMME : ' end || note;
    else raise exception 'Décision invalide';
    end if;
    update flemme_v2.tasks set review = case decision when 'publish' then 'published' when 'changes' then 'changes_requested' else 'rejected' end,
      review_note = case when decision = 'publish' then null else note end, updated_at = clock_timestamp()
    where id = target;
    insert into flemme_v2.profiles (user_id, display_name) values (uid, 'Équipe FLEMME') on conflict do nothing;
    insert into flemme_v2.events (task_id, actor_id, kind, label) values (target, uid, 'admin', event_text);
    insert into flemme_v2.admin_log (admin_id, action, target, details)
      values (uid, 'task_' || decision, target::text, jsonb_build_object('note', note, 'title', t.title));
    return jsonb_build_object('task', flemme_v2.admin_task_json(target));
  end if;
  raise exception 'Action inconnue';
end $$;

revoke all on all functions in schema flemme_v2 from public, anon, authenticated;
grant execute on function flemme_v2.execute(text, uuid, jsonb, uuid) to authenticated;
grant execute on function flemme_v2.admin_execute(text, jsonb) to authenticated;
grant execute on function flemme_v2.admin_parcours(text, jsonb) to authenticated;

create or replace function public.flemme_admin_api(p_action text, p_data jsonb default '{}')
returns jsonb language sql security invoker set search_path = '' as $$
  select case when p_action in ('moderation', 'task_review')
    then flemme_v2.admin_parcours(p_action, p_data) else flemme_v2.admin_execute(p_action, p_data) end;
$$;
