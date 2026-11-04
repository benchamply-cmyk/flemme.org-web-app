-- FLEMME V2 : profils, avis, candidatures validées, accord écrit et signatures (lot 3 du parcours complet).
-- S'applique après 20261104130000_flemme_v2_recherche.sql. Additif : flemme_v2.execute n'est pas modifiée.
-- Les nouvelles actions passent par flemme_v2.accord, aiguillée par public.flemme_mobile_api.
-- Signature = acceptation électronique simple, horodatée et nominative (pas une signature qualifiée).

-- 1. Réglages : validation des candidatures et des accords par l'équipe.
alter table flemme_v2.settings
  add column moderation_offers boolean not null default true,
  add column moderation_agreements boolean not null default true;

-- 2. Profil public.
alter table flemme_v2.profiles
  add column bio text check (char_length(bio) between 1 and 600),
  add column skills text[] not null default '{}' check (cardinality(skills) <= 10),
  add column experience text check (char_length(experience) between 1 and 1000);

-- 3. Candidatures : résultat promis et validation. Les propositions existantes restent visibles.
alter table flemme_v2.offers
  add column result text check (char_length(result) between 1 and 1000),
  add column review text not null default 'approved' check (review in ('pending', 'changes_requested', 'approved', 'rejected')),
  add column review_note text check (char_length(review_note) between 1 and 900);
create function flemme_v2.default_offer_review()
returns text language sql stable security definer set search_path = '' as $$
  select case when coalesce((select moderation_offers from flemme_v2.settings limit 1), true) then 'pending' else 'approved' end;
$$;
alter table flemme_v2.offers alter column review set default flemme_v2.default_offer_review();
create index offers_review_queue on flemme_v2.offers (created_at) where review = 'pending';
-- Une candidature non validée ne peut pas être acceptée, quel que soit le chemin (ancienne action « accept » comprise).
create function flemme_v2.offer_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'accepted' and new.review <> 'approved' then
    raise exception 'Cette candidature attend la validation de l''équipe FLEMME';
  end if;
  return new;
end $$;
create trigger offer_guard before update on flemme_v2.offers for each row execute function flemme_v2.offer_guard();

-- 4. Avis après une mission terminée : un par personne et par flemme, sur l'autre partie.
create table flemme_v2.reviews (
  task_id uuid not null references flemme_v2.tasks(id) on delete cascade,
  author_id uuid not null references flemme_v2.profiles(user_id) on delete cascade,
  target_id uuid not null references flemme_v2.profiles(user_id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text check (char_length(body) between 1 and 600),
  created_at timestamptz not null default clock_timestamp(),
  primary key (task_id, author_id),
  check (author_id <> target_id)
);
create index reviews_target on flemme_v2.reviews (target_id, created_at desc);

-- 5. Accord écrit, préparé par les deux parties après le choix du Brigadier.
create table flemme_v2.agreements (
  task_id uuid primary key references flemme_v2.tasks(id) on delete cascade,
  terms jsonb not null check (jsonb_typeof(terms) = 'object' and octet_length(terms::text) <= 8000),
  status text not null default 'draft' check (status in ('draft', 'pending', 'changes_requested', 'approved', 'signed')),
  review_note text check (char_length(review_note) between 1 and 900),
  owner_signed_at timestamptz, owner_signature text,
  brigadier_signed_at timestamptz, brigadier_signature text,
  updated_by uuid references flemme_v2.profiles(user_id) on delete set null,
  updated_at timestamptz not null default clock_timestamp(),
  check ((status = 'signed') = (owner_signed_at is not null and brigadier_signed_at is not null))
);
alter table flemme_v2.reviews enable row level security;
alter table flemme_v2.agreements enable row level security;
revoke all on flemme_v2.reviews, flemme_v2.agreements from public, anon, authenticated;

-- Un accord commencé doit être signé par les deux parties avant de déclarer la tâche terminée.
create function flemme_v2.complete_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'completed' and old.status <> 'completed'
    and exists(select 1 from flemme_v2.agreements where task_id = new.id and status <> 'signed') then
    raise exception 'L''accord doit être signé par les deux parties avant la fin de la tâche';
  end if;
  return new;
end $$;
create trigger complete_guard before update on flemme_v2.tasks for each row execute function flemme_v2.complete_guard();

alter table flemme_v2.events drop constraint events_kind_check;
alter table flemme_v2.events add constraint events_kind_check check (kind in ('create', 'edit', 'offer', 'message', 'accept', 'decline',
  'complete', 'declare_payment', 'confirm_payment', 'report', 'admin', 'online_payment', 'agreement', 'review'));
alter table flemme_v2.alerts drop constraint alerts_kind_check;
alter table flemme_v2.alerts add constraint alerts_kind_check check (kind in
  ('task_created', 'task_edited', 'report', 'agreement', 'offer_review', 'agreement_review'));

-- 6. Vues JSON.
create function flemme_v2.agreement_json(a flemme_v2.agreements)
returns jsonb language sql stable set search_path = '' as $$
  select case when a.task_id is null then null else jsonb_build_object('terms', a.terms, 'status', a.status, 'reviewNote', a.review_note,
    'ownerSignedAt', flemme_v2.iso(a.owner_signed_at), 'ownerSignature', a.owner_signature,
    'brigadierSignedAt', flemme_v2.iso(a.brigadier_signed_at), 'brigadierSignature', a.brigadier_signature,
    'updatedAt', flemme_v2.iso(a.updated_at), 'updatedBy', flemme_v2.actor_json(a.updated_by)) end;
$$;

create function flemme_v2.profile_json(p_user uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.user_id, 'name', p.display_name, 'bio', p.bio, 'skills', to_jsonb(p.skills), 'experience', p.experience,
    'since', flemme_v2.iso(p.created_at),
    'missions', (select count(*) from flemme_v2.offers o join flemme_v2.tasks t on t.accepted_offer_id = o.id
      where o.brigadier_id = p.user_id and t.status = 'completed'),
    'rating', (select round(avg(r.rating)::numeric, 1) from flemme_v2.reviews r where r.target_id = p.user_id),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('rating', r.rating, 'text', r.body, 'author', flemme_v2.actor_json(r.author_id),
        'task', t.title, 'at', flemme_v2.iso(r.created_at)) order by r.created_at desc)
      from flemme_v2.reviews r join flemme_v2.tasks t on t.id = r.task_id where r.target_id = p.user_id), '[]'::jsonb))
  from flemme_v2.profiles p where p.user_id = p_user;
$$;

-- Vue d'une flemme : candidatures avec résultat promis et validation ; le déposant ne voit que celles validées ;
-- accord écrit et avis pour les deux parties.
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
        'total', case when t.commission_model = 'prelevement' then chosen.amount else chosen.amount + t.commission end,
        'payout', case when t.commission_model = 'prelevement' then chosen.amount - t.commission else chosen.amount end,
        'rateBps', t.commission_bps, 'model', t.commission_model,
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

-- Champs d'un accord : six rubriques obligatoires, le prix reste celui de la candidature retenue.
create function flemme_v2.agreement_terms(p_data jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
begin
  return jsonb_build_object(
    'scope', flemme_v2.required_text(p_data->'scope', 1000),
    'quality', flemme_v2.required_text(p_data->'quality', 1000),
    'deadline', flemme_v2.required_text(p_data->'deadline', 200),
    'cancellation', flemme_v2.required_text(p_data->'cancellation', 1000),
    'confidentiality', flemme_v2.required_text(p_data->'confidentiality', 1000));
end $$;

-- 7. Actions du lot 3. Mêmes contrôles d'accès que flemme_v2.execute ; les écritures sur une flemme sont idempotentes.
create function flemme_v2.accord(p_action text, p_task uuid, p_data jsonb, p_request uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); cfg flemme_v2.settings; t flemme_v2.tasks; o flemme_v2.offers; doc flemme_v2.agreements;
  previous flemme_v2.requests; is_owner boolean; is_chosen boolean; target uuid; f_skills text[]; s text;
  event_kind text; event_text text; alert text; result jsonb;
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

  -- Profils : lecture publique entre membres, modification de son propre profil.
  if p_action = 'profile_get' then
    target := coalesce(flemme_v2.uuid_of(p_data->'userId'), uid);
    result := flemme_v2.profile_json(target);
    if result is null then raise exception 'Profil introuvable'; end if;
    return jsonb_build_object('profile', result);
  elsif p_action = 'profile_save' then
    if exists(select 1 from flemme_v2.suspensions where user_id = uid) then
      raise exception 'Compte suspendu : contacte FLEMME pour en savoir plus' using errcode = '42501';
    end if;
    if p_data->'skills' is not null and jsonb_typeof(p_data->'skills') <> 'array' then raise exception 'Compétences invalides'; end if;
    f_skills := '{}';
    for s in select btrim(x) from jsonb_array_elements_text(coalesce(p_data->'skills', '[]'::jsonb)) x loop
      if s = '' then continue; end if;
      if char_length(s) > 40 then raise exception 'Compétence trop longue (40 caractères au plus)'; end if;
      if not s = any(f_skills) then f_skills := f_skills || s; end if;
    end loop;
    if cardinality(f_skills) > 10 then raise exception '10 compétences au plus'; end if;
    update flemme_v2.profiles set bio = flemme_v2.optional_text(p_data->'bio', 600), experience = flemme_v2.optional_text(p_data->'experience', 1000),
      skills = f_skills, display_name = coalesce(flemme_v2.optional_text(p_data->'displayName', 40), display_name), updated_at = clock_timestamp()
    where user_id = uid;
    return jsonb_build_object('profile', flemme_v2.profile_json(uid));
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

  select * into t from flemme_v2.tasks where id = p_task for update;
  if not found then raise exception 'Flemme introuvable'; end if;
  is_owner := t.owner_id = uid;
  is_chosen := t.accepted_offer_id is not null
    and exists(select 1 from flemme_v2.offers where id = t.accepted_offer_id and brigadier_id = uid);
  if not is_owner and t.review <> 'published' then raise exception 'Flemme introuvable'; end if;

  if p_action = 'apply' then
    -- Candidature : forfait, disponibilités, périmètre et résultat promis ; validée par l'équipe avant d'être transmise.
    if is_owner or t.status <> 'open' then raise exception 'Flemme indisponible'; end if;
    if exists(select 1 from flemme_v2.offers where task_id = t.id and brigadier_id = uid and status = 'pending') then
      raise exception 'Proposition déjà en attente';
    end if;
    insert into flemme_v2.offers (task_id, brigadier_id, amount, slot, scope, result)
    values (t.id, uid, flemme_v2.amount(p_data->'amount'), flemme_v2.required_text(p_data->'slot', 100),
      flemme_v2.required_text(p_data->'scope', 1000), flemme_v2.optional_text(p_data->'result', 1000))
    returning * into o;
    if p_data->'draftId' is not null and p_data->'draftId' <> 'null'::jsonb then
      delete from flemme_v2.drafts where id = flemme_v2.uuid_of(p_data->'draftId') and owner_id = uid;
    end if;
    event_kind := 'offer';
    event_text := case when o.review = 'pending' then 'Candidature envoyée · en attente de validation par l''équipe FLEMME' else 'Proposition reçue' end;
    if o.review = 'pending' then alert := 'offer_review'; end if;
  elsif p_action = 'apply_edit' then
    select * into o from flemme_v2.offers where id = flemme_v2.uuid_of(p_data->'offerId') and task_id = t.id for update;
    if not found or o.brigadier_id is distinct from uid then raise exception 'Proposition introuvable'; end if;
    if o.status <> 'pending' or o.review not in ('pending', 'changes_requested') or t.status <> 'open' then
      raise exception 'Cette candidature ne peut plus être modifiée';
    end if;
    update flemme_v2.offers set amount = flemme_v2.amount(p_data->'amount'), slot = flemme_v2.required_text(p_data->'slot', 100),
      scope = flemme_v2.required_text(p_data->'scope', 1000), result = flemme_v2.optional_text(p_data->'result', 1000),
      review = flemme_v2.default_offer_review(), review_note = null
    where id = o.id returning * into o;
    event_kind := 'offer';
    event_text := case when o.review = 'pending' then 'Candidature corrigée · renvoyée pour validation' else 'Candidature modifiée' end;
    if o.review = 'pending' then alert := 'offer_review'; end if;
  elsif p_action in ('agreement_save', 'agreement_submit', 'agreement_sign') then
    if not is_owner and not is_chosen then raise exception 'Accord inaccessible' using errcode = '42501'; end if;
    if t.status <> 'assigned' then raise exception 'L''accord se prépare une fois le Brigadier choisi, avant la fin de la tâche'; end if;
    select * into doc from flemme_v2.agreements where task_id = t.id for update;
    event_kind := 'agreement';
    if p_action = 'agreement_save' then
      if doc.status = 'signed' then raise exception 'Accord déjà signé par les deux parties'; end if;
      -- Toute modification annule la validation et les signatures : chacun relit la nouvelle version.
      insert into flemme_v2.agreements (task_id, terms, status, updated_by)
      values (t.id, flemme_v2.agreement_terms(p_data), 'draft', uid)
      on conflict (task_id) do update set terms = excluded.terms, status = 'draft', review_note = null,
        owner_signed_at = null, owner_signature = null, brigadier_signed_at = null, brigadier_signature = null,
        updated_by = uid, updated_at = clock_timestamp();
      event_text := 'Accord écrit modifié par ' || flemme_v2.display_name(uid);
    elsif p_action = 'agreement_submit' then
      if doc.task_id is null or doc.status not in ('draft', 'changes_requested') then raise exception 'Aucun brouillon d''accord à soumettre'; end if;
      update flemme_v2.agreements set status = case when cfg.moderation_agreements then 'pending' else 'approved' end,
        updated_by = uid, updated_at = clock_timestamp() where task_id = t.id;
      event_text := case when cfg.moderation_agreements then 'Accord soumis au contrôle de l''équipe FLEMME' else 'Accord prêt à signer' end;
      if cfg.moderation_agreements then alert := 'agreement_review'; end if;
    else
      if doc.task_id is null or doc.status <> 'approved' then raise exception 'L''accord doit être validé avant d''être signé'; end if;
      s := flemme_v2.required_text(p_data->'signature', 80);
      if p_data->'accept' is distinct from 'true'::jsonb then raise exception 'Coche la case pour accepter l''accord'; end if;
      if is_owner then
        if doc.owner_signed_at is not null then raise exception 'Tu as déjà signé'; end if;
        update flemme_v2.agreements set owner_signed_at = clock_timestamp(), owner_signature = s,
          status = case when brigadier_signed_at is not null then 'signed' else status end where task_id = t.id;
      else
        if doc.brigadier_signed_at is not null then raise exception 'Tu as déjà signé'; end if;
        update flemme_v2.agreements set brigadier_signed_at = clock_timestamp(), brigadier_signature = s,
          status = case when owner_signed_at is not null then 'signed' else status end where task_id = t.id;
      end if;
      event_text := 'Accord signé par ' || flemme_v2.display_name(uid) || ' (« ' || s || ' »)';
    end if;
  elsif p_action = 'review' then
    if t.status <> 'completed' or (not is_owner and not is_chosen) then raise exception 'Avis possible seulement après une mission terminée' using errcode = '42501'; end if;
    if jsonb_typeof(p_data->'rating') is distinct from 'number' or (p_data->>'rating')::numeric not in (1, 2, 3, 4, 5) then
      raise exception 'Note invalide (1 à 5)';
    end if;
    insert into flemme_v2.reviews (task_id, author_id, target_id, rating, body)
    values (t.id, uid, case when is_owner then (select brigadier_id from flemme_v2.offers where id = t.accepted_offer_id) else t.owner_id end,
      (p_data->>'rating')::integer, flemme_v2.optional_text(p_data->'text', 600))
    on conflict (task_id, author_id) do nothing;
    if not found then raise exception 'Tu as déjà donné ton avis sur cette mission'; end if;
    event_kind := 'review';
    event_text := 'Avis publié par ' || flemme_v2.display_name(uid);
  else raise exception 'Action inconnue';
  end if;

  update flemme_v2.tasks set updated_at = clock_timestamp() where id = t.id;
  insert into flemme_v2.events (task_id, actor_id, kind, label) values (t.id, uid, event_kind, event_text);
  if alert is not null then
    perform flemme_v2.queue_alert(alert, t.id, jsonb_build_object('title', t.title, 'owner', flemme_v2.display_name(t.owner_id),
      'brigadier', flemme_v2.display_name(case when alert = 'offer_review' then uid
        else (select brigadier_id from flemme_v2.offers where id = t.accepted_offer_id) end),
      'amount', case when alert = 'offer_review' then o.amount end));
  end if;
  result := jsonb_build_object('task', flemme_v2.task_json(t.id, uid));
  insert into flemme_v2.requests (actor_id, request_id, action, task_id, payload, result)
  values (uid, p_request, p_action, p_task, p_data, result);
  return result;
end $$;

-- 8. Équipe : validation des candidatures et des accords.
create function flemme_v2.admin_accord(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := flemme_v2.require_admin(); decision text; note text; o flemme_v2.offers; doc flemme_v2.agreements; event_text text;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Données invalides'; end if;
  if p_action = 'review_queue' then
    return jsonb_build_object(
      'offers', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'task', jsonb_build_object('id', t.id, 'title', t.title, 'owner', flemme_v2.actor_json(t.owner_id)),
          'brigadier', flemme_v2.actor_json(x.brigadier_id), 'amount', x.amount, 'slot', x.slot, 'scope', x.scope, 'result', x.result,
          'createdAt', flemme_v2.iso(x.created_at)) order by x.created_at)
        from flemme_v2.offers x join flemme_v2.tasks t on t.id = x.task_id where x.review = 'pending' and x.status = 'pending'), '[]'::jsonb),
      'agreements', coalesce((select jsonb_agg(flemme_v2.agreement_json(a) || jsonb_build_object('taskId', t.id, 'title', t.title,
          'owner', flemme_v2.actor_json(t.owner_id), 'brigadier', flemme_v2.actor_json(c.brigadier_id), 'amount', c.amount) order by a.updated_at)
        from flemme_v2.agreements a join flemme_v2.tasks t on t.id = a.task_id left join flemme_v2.offers c on c.id = t.accepted_offer_id
        where a.status = 'pending'), '[]'::jsonb));
  elsif p_action = 'offer_review' then
    select * into o from flemme_v2.offers where id = flemme_v2.uuid_of(p_data->'offerId') for update;
    if not found then raise exception 'Candidature introuvable'; end if;
    if o.review <> 'pending' then raise exception 'Cette candidature n''attend plus de validation'; end if;
    decision := p_data->>'decision';
    if decision = 'approve' then note := null; event_text := 'Candidature validée par l''équipe FLEMME et transmise au déposant';
    elsif decision in ('changes', 'reject') then
      note := flemme_v2.required_text(p_data->'note', 900);
      event_text := case when decision = 'changes' then 'Correction de candidature demandée par l''équipe FLEMME' else 'Candidature refusée par l''équipe FLEMME' end;
    else raise exception 'Décision invalide';
    end if;
    update flemme_v2.offers set review = case decision when 'approve' then 'approved' when 'changes' then 'changes_requested' else 'rejected' end,
      review_note = note, status = case when decision = 'reject' then 'declined' else status end
    where id = o.id;
    insert into flemme_v2.profiles (user_id, display_name) values (uid, 'Équipe FLEMME') on conflict do nothing;
    insert into flemme_v2.events (task_id, actor_id, kind, label) values (o.task_id, uid, 'admin', event_text);
    insert into flemme_v2.admin_log (admin_id, action, target, details) values (uid, 'offer_' || decision, o.id::text, jsonb_build_object('note', note));
    return jsonb_build_object('ok', true);
  elsif p_action = 'agreement_review' then
    select * into doc from flemme_v2.agreements where task_id = flemme_v2.uuid_of(p_data->'taskId') for update;
    if not found then raise exception 'Accord introuvable'; end if;
    if doc.status <> 'pending' then raise exception 'Cet accord n''attend plus de contrôle'; end if;
    decision := p_data->>'decision';
    if decision = 'approve' then note := flemme_v2.optional_text(p_data->'note', 900); event_text := 'Accord contrôlé par l''équipe FLEMME · prêt à signer';
    elsif decision = 'changes' then note := flemme_v2.required_text(p_data->'note', 900); event_text := 'Correction de l''accord demandée par l''équipe FLEMME : ' || note;
    else raise exception 'Décision invalide';
    end if;
    update flemme_v2.agreements set status = case when decision = 'approve' then 'approved' else 'changes_requested' end,
      review_note = note, updated_at = clock_timestamp() where task_id = doc.task_id;
    insert into flemme_v2.profiles (user_id, display_name) values (uid, 'Équipe FLEMME') on conflict do nothing;
    insert into flemme_v2.events (task_id, actor_id, kind, label) values (doc.task_id, uid, 'admin', event_text);
    insert into flemme_v2.admin_log (admin_id, action, target, details) values (uid, 'agreement_' || decision, doc.task_id::text, jsonb_build_object('note', note));
    return jsonb_build_object('ok', true);
  end if;
  raise exception 'Action inconnue';
end $$;

revoke all on function flemme_v2.default_offer_review(), flemme_v2.offer_guard(), flemme_v2.complete_guard(),
  flemme_v2.agreement_json(flemme_v2.agreements), flemme_v2.profile_json(uuid), flemme_v2.agreement_terms(jsonb),
  flemme_v2.accord(text, uuid, jsonb, uuid), flemme_v2.admin_accord(text, jsonb) from public, anon, authenticated;
grant execute on function flemme_v2.accord(text, uuid, jsonb, uuid), flemme_v2.admin_accord(text, jsonb) to authenticated;

create or replace function public.flemme_mobile_api(p_action text, p_task uuid default null, p_data jsonb default '{}', p_request uuid default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select case when p_action = 'search' then flemme_v2.search(p_data)
    when p_action in ('profile_get', 'profile_save', 'apply', 'apply_edit', 'agreement_save', 'agreement_submit', 'agreement_sign', 'review')
      then flemme_v2.accord(p_action, p_task, p_data, p_request)
    else flemme_v2.execute(p_action, p_task, p_data, p_request) end;
$$;
create or replace function public.flemme_admin_api(p_action text, p_data jsonb default '{}')
returns jsonb language sql security invoker set search_path = '' as $$
  select case when p_action in ('moderation', 'task_review') then flemme_v2.admin_parcours(p_action, p_data)
    when p_action in ('review_queue', 'offer_review', 'agreement_review') then flemme_v2.admin_accord(p_action, p_data)
    else flemme_v2.admin_execute(p_action, p_data) end;
$$;
