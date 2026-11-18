-- Confiance dans la marketplace ouverte (18/11/2026). S'applique après 20261118130000_flemme_v2_abonnements.sql. Additif.
-- Demande de Ben (commentaire sur le comparatif Airtasker / TaskRabbit) : intégrer les recommandations 1 à 4,
-- livrées dans la v2.1.0 (décision de Ben du 18/11/2026, après le gel v2.0.0-rc.1).
--   1. Questions publiques sous une demande : posées par les membres, réponse du déposant, masquables par l'équipe.
--   2. Téléphones, e-mails et liens masqués avant la signature de l'accord (questions publiques : toujours).
--   3. Livraison déclarée par le membre retenu, confirmation du déposant (« je libère le paiement »), ou clôture par le membre
--      7 jours après la livraison si aucun désaccord n'a été signalé depuis (libération automatique, sans tâche planifiée).
--   4. Profil public : missions en cours et demandes menées à terme comme déposant.
-- Mêmes règles côté client : packages/shared/src/confiance.ts et domain.ts. Interface derrière le flag espace.confiance.

-- 1. Données.
alter table flemme_v2.tasks add column delivered_at timestamptz;

create table flemme_v2.questions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references flemme_v2.tasks(id) on delete cascade,
  author_id uuid references flemme_v2.profiles(user_id) on delete set null,
  body text not null check (char_length(body) between 1 and 600),
  answer text check (answer is null or char_length(answer) between 1 and 1000),
  answered_at timestamptz,
  hidden boolean not null default false,
  hidden_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp()
);
create index questions_task on flemme_v2.questions (task_id, created_at);
alter table flemme_v2.questions enable row level security;
revoke all on flemme_v2.questions from public, anon, authenticated;

alter table flemme_v2.events drop constraint events_kind_check;
alter table flemme_v2.events add constraint events_kind_check check (kind in ('create', 'edit', 'offer', 'message', 'accept', 'decline',
  'complete', 'declare_payment', 'confirm_payment', 'report', 'admin', 'online_payment', 'agreement', 'review', 'payout',
  'question', 'answer', 'deliver'));

-- 2. Masquage : mêmes motifs que masquerCoordonnees (packages/shared/src/confiance.ts).
create function flemme_v2.masquer(p_text text)
returns text language sql immutable set search_path = '' as $$
  select regexp_replace(regexp_replace(regexp_replace(p_text,
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[coordonnées masquées]', 'g'),
    '(https?://|www\.)[^[:space:]]+', '[coordonnées masquées]', 'gi'),
    '\+?[0-9]([[:space:].()-]{0,2}[0-9]){8,14}', '[coordonnées masquées]', 'g');
$$;
-- Données d'une candidature avec les textes libres masqués (une candidature précède toujours la signature).
create function flemme_v2.masquer_offre(p_data jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select p_data
    || case when jsonb_typeof(p_data->'scope') = 'string' then jsonb_build_object('scope', flemme_v2.masquer(p_data->>'scope')) else '{}'::jsonb end
    || case when jsonb_typeof(p_data->'slot') = 'string' then jsonb_build_object('slot', flemme_v2.masquer(p_data->>'slot')) else '{}'::jsonb end
    || case when jsonb_typeof(p_data->'result') = 'string' then jsonb_build_object('result', flemme_v2.masquer(p_data->>'result')) else '{}'::jsonb end;
$$;

-- 3. Profil public : reprise de 20261104150000, avec les missions en cours et les demandes menées à terme.
create or replace function flemme_v2.profile_json(p_user uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.user_id, 'name', p.display_name, 'bio', p.bio, 'skills', to_jsonb(p.skills), 'experience', p.experience,
    'avatar', p.avatar_path, 'since', flemme_v2.iso(p.created_at),
    'missions', (select count(*) from flemme_v2.offers o join flemme_v2.tasks t on t.accepted_offer_id = o.id
      where o.brigadier_id = p.user_id and t.status = 'completed'),
    'ongoing', (select count(*) from flemme_v2.offers o join flemme_v2.tasks t on t.accepted_offer_id = o.id
      where o.brigadier_id = p.user_id and t.status = 'assigned'),
    'requests', (select count(*) from flemme_v2.tasks t where t.owner_id = p.user_id and t.status = 'completed'),
    'rating', (select round(avg(r.rating)::numeric, 1) from flemme_v2.reviews r where r.target_id = p.user_id),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('rating', r.rating, 'text', r.body, 'author', flemme_v2.actor_json(r.author_id),
        'task', t.title, 'at', flemme_v2.iso(r.created_at)) order by r.created_at desc)
      from flemme_v2.reviews r join flemme_v2.tasks t on t.id = r.task_id where r.target_id = p.user_id), '[]'::jsonb))
  from flemme_v2.profiles p where p.user_id = p_user;
$$;

-- 4. Vue d'une flemme : reprise de 20261118120000, avec les questions publiques et la date de livraison.
create or replace function flemme_v2.task_json(p_task uuid, p_actor uuid)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  t flemme_v2.tasks; chosen flemme_v2.offers; is_owner boolean; is_chosen boolean; doc flemme_v2.agreements;
  offers jsonb; history jsonb; reports jsonb; questions jsonb; result jsonb; paid jsonb;
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

  -- Questions publiques (non masquées par l'équipe) : visibles de tous ceux qui voient la flemme.
  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'author', flemme_v2.actor_json(q.author_id), 'text', q.body,
      'at', flemme_v2.iso(q.created_at), 'answer', q.answer, 'answeredAt', flemme_v2.iso(q.answered_at)) order by q.created_at, q.id), '[]'::jsonb) into questions
  from flemme_v2.questions q where q.task_id = t.id and not q.hidden;

  reports := '[]'::jsonb;
  if is_owner or is_chosen then
    select coalesce(jsonb_agg(jsonb_build_object('actor', flemme_v2.actor_json(e.actor_id), 'text', e.body, 'at', flemme_v2.iso(e.created_at)) order by e.id), '[]'::jsonb) into reports
    from flemme_v2.events e where e.task_id = t.id and e.kind = 'report';
  end if;

  result := jsonb_build_object('id', t.id, 'owner', flemme_v2.actor_json(t.owner_id), 'title', t.title,
    'details', t.details, 'place', t.place, 'budget', t.budget, 'status', t.status,
    'category', t.category, 'deadline', t.deadline, 'deadlineNote', t.deadline_note,
    'budgetRange', t.budget_range, 'mode', t.work_mode, 'paymentMode', t.payment_mode,
    'createdAt', flemme_v2.iso(t.created_at), 'offers', offers, 'history', history, 'reports', reports, 'questions', questions);
  if is_owner then
    result := result || jsonb_build_object('review', t.review, 'reviewNote', t.review_note);
  end if;
  if is_owner or is_chosen then
    result := result || jsonb_build_object('paymentDeclared', t.payment_declared, 'paymentConfirmed', t.payment_confirmed, 'address', t.address,
      'deliveredAt', flemme_v2.iso(t.delivered_at));
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

-- 5. Actions : questions, livraison, fin de mission, et masquage avant les actions d'origine.
create function flemme_v2.confiance(p_action text, p_task uuid, p_data jsonb, p_request uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); t flemme_v2.tasks; chosen flemme_v2.offers; q flemme_v2.questions; previous flemme_v2.requests;
  is_owner boolean; is_chosen boolean; signed boolean; auto boolean; label text; result jsonb;
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) or
    not exists(select 1 from auth.users where id = uid and email_confirmed_at is not null) then
    raise exception 'Connexion avec un compte confirmé requise' using errcode = '42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Données invalides'; end if;

  -- Masquage puis action d'origine (mêmes contrôles, même idempotence).
  if p_action in ('apply', 'apply_edit') then
    return flemme_v2.accord(p_action, p_task, flemme_v2.masquer_offre(p_data), p_request);
  elsif p_action = 'offer' then
    return flemme_v2.execute(p_action, p_task, flemme_v2.masquer_offre(p_data), p_request);
  elsif p_action = 'message' then
    signed := exists(select 1 from flemme_v2.agreements where task_id = p_task and status = 'signed');
    if not signed and jsonb_typeof(p_data->'text') = 'string' then
      p_data := p_data || jsonb_build_object('text', flemme_v2.masquer(p_data->>'text'));
    end if;
    return flemme_v2.execute(p_action, p_task, p_data, p_request);
  end if;

  if p_action not in ('ask', 'answer', 'deliver', 'complete') then raise exception 'Action inconnue'; end if;
  if p_request is null then raise exception 'Identifiant de requête requis'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || p_request::text, 0));
  select * into previous from flemme_v2.requests where actor_id = uid and request_id = p_request;
  if found then
    if previous.action <> p_action or previous.task_id is distinct from p_task or previous.payload <> p_data then
      raise exception 'Identifiant déjà utilisé pour une autre action';
    end if;
    return previous.result;
  end if;

  select * into t from flemme_v2.tasks where id = p_task for update;
  if not found then raise exception 'Flemme introuvable'; end if;
  is_owner := t.owner_id = uid;
  if not is_owner and t.review <> 'published' then raise exception 'Flemme introuvable'; end if;
  if t.accepted_offer_id is not null then select * into chosen from flemme_v2.offers where id = t.accepted_offer_id; end if;
  is_chosen := coalesce(chosen.brigadier_id = uid, false);
  signed := exists(select 1 from flemme_v2.agreements where task_id = t.id and status = 'signed');

  if p_action = 'ask' then
    if exists(select 1 from flemme_v2.suspensions where user_id = uid) then
      raise exception 'Compte suspendu : contacte FLEMME pour en savoir plus' using errcode = '42501';
    end if;
    if is_owner or t.status <> 'open' then raise exception 'Questions fermées pour cette demande'; end if;
    if (select count(*) from flemme_v2.questions where task_id = t.id and author_id = uid and answer is null and not hidden) >= 3 then
      raise exception 'Tu as déjà 3 questions sans réponse sur cette demande';
    end if;
    insert into flemme_v2.profiles (user_id, display_name)
    select u.id, flemme_v2.default_display_name(u.raw_user_meta_data, u.email) from auth.users u where u.id = uid
    on conflict do nothing;
    insert into flemme_v2.questions (task_id, author_id, body) values (t.id, uid, flemme_v2.masquer(flemme_v2.required_text(p_data->'text', 600)));
    label := 'Question publique posée';
  elsif p_action = 'answer' then
    if not is_owner then raise exception 'Question introuvable' using errcode = '42501'; end if;
    select * into q from flemme_v2.questions where id = flemme_v2.uuid_of(p_data->'questionId') and task_id = t.id and not hidden for update;
    if not found then raise exception 'Question introuvable'; end if;
    if q.answer is not null then raise exception 'Tu as déjà répondu à cette question'; end if;
    update flemme_v2.questions set answer = flemme_v2.masquer(flemme_v2.required_text(p_data->'text', 1000)), answered_at = clock_timestamp() where id = q.id;
    label := 'Réponse publique du déposant';
  elsif p_action = 'deliver' then
    if not is_chosen or t.status <> 'assigned' then raise exception 'Seul le membre retenu peut déclarer la mission livrée' using errcode = '42501'; end if;
    if (t.payment_mode <> 'direct' or exists(select 1 from flemme_v2.agreements where task_id = t.id)) and not signed then
      raise exception 'L''accord doit être signé par les deux parties avant la livraison';
    end if;
    if t.payment_mode <> 'direct' and not exists(select 1 from flemme_v2.payments where task_id = t.id and stage = 'signature' and status = 'paid') then
      raise exception 'La mission doit être payée via Flemme avant la livraison';
    end if;
    if t.delivered_at is not null then raise exception 'Mission déjà déclarée livrée'; end if;
    update flemme_v2.tasks set delivered_at = clock_timestamp() where id = t.id;
    label := 'Mission déclarée livrée par ' || coalesce((select display_name from flemme_v2.profiles where user_id = uid), 'le membre')
      || ' · le déposant a 7 jours pour confirmer ou signaler un désaccord';
  else
    -- Fin de mission : le déposant à tout moment ; le membre retenu seul, 7 jours après la livraison, sans désaccord signalé depuis.
    auto := not is_owner and is_chosen and t.delivered_at is not null and clock_timestamp() >= t.delivered_at + interval '7 days'
      and not exists(select 1 from flemme_v2.events where task_id = t.id and kind = 'report' and created_at >= t.delivered_at);
    if t.status <> 'assigned' or not (is_owner or auto) then
      raise exception '%', case when is_chosen then 'Tu pourras clôturer toi-même 7 jours après avoir déclaré la mission livrée, sauf désaccord signalé'
        else 'Fin de tâche non autorisée' end using errcode = '42501';
    end if;
    if exists(select 1 from flemme_v2.agreements where task_id = t.id) and not signed then
      raise exception 'L''accord doit être signé par les deux parties avant la fin de la tâche';
    end if;
    -- Paiement via Flemme exigé par le déclencheur payment_mode_guard (20261118120000).
    update flemme_v2.tasks set status = 'completed' where id = t.id;
    label := case when auto then 'Paiement libéré automatiquement · 7 jours sans réponse du déposant après la livraison'
      when t.payment_mode <> 'direct' then 'Mission confirmée terminée par le déposant · paiement libéré pour le membre'
      else 'Tâche déclarée terminée par le déposant' end;
  end if;

  update flemme_v2.tasks set updated_at = clock_timestamp() where id = t.id;
  insert into flemme_v2.events (task_id, actor_id, kind, label)
  values (t.id, uid, case p_action when 'ask' then 'question' else p_action end, label);
  result := jsonb_build_object('task', flemme_v2.task_json(t.id, uid));
  insert into flemme_v2.requests (actor_id, request_id, action, task_id, payload, result)
  values (uid, p_request, p_action, p_task, p_data, result);
  return result;
end $$;

-- Modération : l'équipe masque une question (et sa réponse). Rôle admin revérifié, action journalisée.
create function flemme_v2.admin_confiance(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); q flemme_v2.questions;
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
    or not exists(select 1 from flemme_v2.admins a join auth.users u on u.id = a.user_id
                  where a.user_id = uid and u.email_confirmed_at is not null) then
    raise exception 'Accès réservé à l''équipe FLEMME' using errcode = '42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Données invalides'; end if;
  if p_action <> 'question_hide' then raise exception 'Action inconnue'; end if;
  update flemme_v2.questions set hidden = true, hidden_by = uid where id = flemme_v2.uuid_of(p_data->'questionId') and not hidden returning * into q;
  if not found then raise exception 'Question introuvable ou déjà masquée'; end if;
  insert into flemme_v2.admin_log(admin_id, action, target, details)
  values (uid, 'question_hide', q.id::text, jsonb_build_object('taskId', q.task_id, 'body', q.body, 'answer', q.answer));
  return jsonb_build_object('ok', true);
end $$;

revoke all on function flemme_v2.masquer(text), flemme_v2.masquer_offre(jsonb), flemme_v2.confiance(text, uuid, jsonb, uuid),
  flemme_v2.admin_confiance(text, jsonb) from public, anon, authenticated;
grant execute on function flemme_v2.confiance(text, uuid, jsonb, uuid), flemme_v2.admin_confiance(text, jsonb) to authenticated;

-- 6. Points d'entrée : mêmes aiguillages que 20261118130000, plus les actions de confiance.
create or replace function public.flemme_mobile_api(p_action text, p_task uuid default null, p_data jsonb default '{}', p_request uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform flemme_v2.flag_guard(p_action);
  return case when p_action = 'search' then flemme_v2.search(p_data)
    when p_action = 'subscriptions' then flemme_v2.abonnements(p_action, p_data)
    when p_action in ('agreement_save', 'pay') then flemme_v2.reglement(p_action, p_task, p_data, p_request)
    when p_action in ('apply', 'apply_edit', 'offer', 'message', 'ask', 'answer', 'deliver', 'complete')
      then flemme_v2.confiance(p_action, p_task, p_data, p_request)
    when p_action in ('profile_get', 'profile_save', 'agreement_submit', 'agreement_sign', 'review')
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
    when p_action = 'question_hide' then flemme_v2.admin_confiance(p_action, p_data)
    else flemme_v2.admin_execute(p_action, p_data) end;
$$;
