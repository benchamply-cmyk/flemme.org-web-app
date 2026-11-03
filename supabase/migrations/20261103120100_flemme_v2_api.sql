-- FLEMME V2 : point d'entrée unique public.flemme_mobile_api, sur les tables de flemme_v2.
-- Même contrat JSON que l'ancien install.sql (type Task de apps/mobile/src/domain.ts), avec en plus :
--   * nom affiché lu dans flemme_v2.profiles (le champ actorName envoyé par le client est ignoré) ;
--   * actions « me » et « update_profile » ;
--   * « list » paginé : p_data = { limit?: 1..100 (20 par défaut), cursor?: string } -> { tasks, nextCursor }.

create function flemme_v2.required_text(v jsonb, max_length integer)
returns text language plpgsql immutable set search_path = '' as $$
declare result text;
begin
  if jsonb_typeof(v) is distinct from 'string' then raise exception 'Texte requis'; end if;
  result := btrim(v #>> '{}');
  if length(result) < 1 or length(result) > max_length then raise exception 'Texte invalide'; end if;
  return result;
end $$;

create function flemme_v2.amount(v jsonb)
returns integer language plpgsql immutable set search_path = '' as $$
declare result numeric;
begin
  if jsonb_typeof(v) is distinct from 'number' then raise exception 'Montant invalide'; end if;
  result := (v #>> '{}')::numeric;
  if result <> trunc(result) or result < 1 or result > 1000000 then raise exception 'Montant invalide'; end if;
  return result::integer;
end $$;

create function flemme_v2.iso(at timestamptz)
returns text language sql immutable set search_path = '' as $$
  select to_char(at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
$$;

create function flemme_v2.actor_json(p_user uuid)
returns jsonb language sql stable set search_path = '' as $$
  select case when p_user is null then jsonb_build_object('id', null, 'name', 'Compte supprimé')
    else jsonb_build_object('id', p_user, 'name', coalesce((select display_name from flemme_v2.profiles where user_id = p_user), 'Membre')) end;
$$;

-- Vue d'une flemme pour un membre : le déposant voit tout ; un Brigadier ne voit que ses propres
-- propositions et discussions ; l'accord, les paiements et les signalements sont réservés aux deux parties.
create function flemme_v2.task_json(p_task uuid, p_actor uuid)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  t flemme_v2.tasks; chosen flemme_v2.offers; is_owner boolean; is_chosen boolean;
  offers jsonb; history jsonb; reports jsonb; result jsonb;
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
      result := result || jsonb_build_object('acceptedOfferId', chosen.id, 'agreement', jsonb_build_object(
        'amount', chosen.amount, 'commission', t.commission, 'total', chosen.amount + t.commission,
        'slot', chosen.slot, 'scope', chosen.scope, 'brigadier', flemme_v2.actor_json(chosen.brigadier_id)));
    end if;
  end if;
  return result;
end $$;

-- SECURITY DEFINER nécessaire pour écrire de façon atomique sans accorder de droits sur les tables.
-- Hors des schémas exposés, search_path vide, authentification + droits vérifiés à chaque action.
create function flemme_v2.execute(p_action text, p_task uuid, p_data jsonb, p_request uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); t flemme_v2.tasks; o flemme_v2.offers; previous flemme_v2.requests;
  is_owner boolean; is_chosen boolean; tid uuid; oid uuid; budget integer; page_size integer;
  cursor_at timestamptz; cursor_id uuid; ids uuid[]; last_at timestamptz; next_cursor text;
  event_text text; event_body text; result jsonb;
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
        update flemme_v2.tasks set status = 'assigned', accepted_offer_id = o.id,
          commission = round(o.amount::numeric / 10)::integer where id = t.id;
        event_text := 'Accord accepté · forfait et commission de 10 % confirmés';
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

revoke all on all functions in schema flemme_v2 from public, anon, authenticated;
grant usage on schema flemme_v2 to authenticated;
grant execute on function flemme_v2.execute(text, uuid, jsonb, uuid) to authenticated;

-- Seul point d'entrée exposé, invoker : aucune clé privilégiée côté client.
create function public.flemme_mobile_api(p_action text, p_task uuid default null, p_data jsonb default '{}', p_request uuid default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select flemme_v2.execute(p_action, p_task, p_data, p_request);
$$;
revoke all on function public.flemme_mobile_api(text, uuid, jsonb, uuid) from public, anon;
grant execute on function public.flemme_mobile_api(text, uuid, jsonb, uuid) to authenticated;
