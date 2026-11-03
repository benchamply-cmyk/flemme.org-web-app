-- FLEMME V2, exploitation minimale du 03/11/2026 : page admin et alertes e-mail.
-- À appliquer une fois, APRÈS install.sql, sur le même projet Supabase (prod : yktpabnqkhwcshvjuncs).
-- Additif : ne modifie ni les tables ni les fonctions de install.sql, ni celles de l'ancien site.
-- Une installation déjà présente échoue et annule la transaction, sans remplacement.
-- Avant de lancer : le compte ben.champly@gmail.com doit exister et avoir confirmé son e-mail.
-- Alertes : voir apps/mobile/backend/README-admin.md (pg_net et deux secrets dans Vault).
begin;

-- pg_net envoie les alertes. S'il manque (environnement de test), l'installation continue
-- et chaque alerte reste dans flemme_mobile_v1.alerts avec son erreur, visible dans l'admin.
do $$ begin create extension if not exists pg_net; exception when others then raise notice 'pg_net indisponible : alertes conservées sans envoi'; end $$;

create table flemme_mobile_v1.admins (
  user_id uuid primary key references auth.users(id),
  added_at timestamptz not null default now()
);
-- Un litige par flemme signalée. Il se rouvre si un nouveau signalement arrive après sa clôture.
create table flemme_mobile_v1.disputes (
  task_id uuid primary key references flemme_mobile_v1.tasks(id),
  status text not null default 'open' check (status in ('open','in_review','resolved')),
  resolution text,
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create table flemme_mobile_v1.suspensions (
  user_id uuid primary key references auth.users(id),
  reason text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);
-- Journal des décisions de l'équipe, en ajout seulement.
create table flemme_mobile_v1.admin_log (
  id bigint generated always as identity primary key,
  admin_id uuid not null references auth.users(id),
  action text not null, target text not null, details jsonb not null,
  at timestamptz not null default now()
);
-- File des alertes : chaque événement est d'abord enregistré, puis envoyé. Un envoi raté ne perd rien.
create table flemme_mobile_v1.alerts (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('task_created','report','agreement')),
  task_id uuid not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz,
  error text
);
create index alerts_recent on flemme_mobile_v1.alerts(created_at desc);
alter table flemme_mobile_v1.admins enable row level security;
alter table flemme_mobile_v1.disputes enable row level security;
alter table flemme_mobile_v1.suspensions enable row level security;
alter table flemme_mobile_v1.admin_log enable row level security;
alter table flemme_mobile_v1.alerts enable row level security;
revoke all on flemme_mobile_v1.admins, flemme_mobile_v1.disputes, flemme_mobile_v1.suspensions,
  flemme_mobile_v1.admin_log, flemme_mobile_v1.alerts from public, anon, authenticated;

-- Le propriétaire, seul administrateur au départ. Aucun compte ne peut s'ajouter lui-même.
do $$
declare owner uuid;
begin
  select id into owner from auth.users where lower(email) = 'ben.champly@gmail.com' and email_confirmed_at is not null;
  if owner is null then raise exception 'Compte administrateur ben.champly@gmail.com introuvable ou non confirmé'; end if;
  insert into flemme_mobile_v1.admins(user_id) values (owner);
end $$;

-- Envoi d'une alerte vers la fonction Netlify /api/alerte. L'adresse et le secret sont lus dans Vault :
-- aucun secret dans ce fichier. Toute erreur est notée sur l'alerte et ne bloque jamais l'action du membre.
create function flemme_mobile_v1.dispatch_alert(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare a record; target text; secret text;
begin
  select * into a from flemme_mobile_v1.alerts where id = p_id;
  if not found then return; end if;
  select decrypted_secret into target from vault.decrypted_secrets where name = 'flemme_alerte_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'flemme_alerte_secret';
  if target is null or secret is null or target !~ '^https://' then
    update flemme_mobile_v1.alerts set error = 'Alertes non configurées : secrets Vault manquants' where id = p_id;
    return;
  end if;
  perform net.http_post(
    url := target,
    body := jsonb_build_object('source','flemme_v2','id',a.id,'kind',a.kind,'task_id',a.task_id,'payload',a.payload,'created_at',a.created_at),
    headers := jsonb_build_object('Content-Type','application/json','x-alerte-secret',secret)
  );
  update flemme_mobile_v1.alerts set dispatched_at = now(), error = null where id = p_id;
exception when others then
  update flemme_mobile_v1.alerts set error = left(sqlerrm, 300) where id = p_id;
end $$;

create function flemme_mobile_v1.queue_alert(p_kind text, p_task uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare new_id bigint;
begin
  insert into flemme_mobile_v1.alerts(kind, task_id, payload) values (p_kind, p_task, p_payload) returning id into new_id;
  perform flemme_mobile_v1.dispatch_alert(new_id);
end $$;

-- Un compte suspendu garde la lecture de ses flemmes mais ne peut plus rien publier ni modifier.
create function flemme_mobile_v1.block_suspended()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from flemme_mobile_v1.suspensions where user_id = auth.uid()) then
    raise exception 'Compte suspendu : contacte FLEMME pour en savoir plus' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger block_suspended before insert or update on flemme_mobile_v1.tasks
  for each row execute function flemme_mobile_v1.block_suspended();

-- Événements qui méritent une alerte : nouvelle flemme, nouveau signalement (ouvre ou rouvre le litige), accord conclu.
create function flemme_mobile_v1.on_task_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d jsonb := new.document; report jsonb;
begin
  if tg_op = 'INSERT' then
    perform flemme_mobile_v1.queue_alert('task_created', new.id, jsonb_build_object(
      'title', d->>'title', 'place', d->>'place', 'budget', d->'budget', 'owner', d->'owner'->>'name'));
    return new;
  end if;
  if jsonb_array_length(d->'reports') > jsonb_array_length(old.document->'reports') then
    report := d->'reports'->-1;
    insert into flemme_mobile_v1.disputes(task_id) values (new.id)
      on conflict (task_id) do update set status = 'open', updated_at = now()
      where flemme_mobile_v1.disputes.status = 'resolved';
    perform flemme_mobile_v1.queue_alert('report', new.id, jsonb_build_object(
      'title', d->>'title', 'actor', report->'actor'->>'name', 'text', report->>'text',
      'owner', d->'owner'->>'name', 'brigadier', d->'agreement'->'brigadier'->>'name'));
  end if;
  if old.document->>'status' = 'open' and d->>'status' = 'assigned' then
    perform flemme_mobile_v1.queue_alert('agreement', new.id, jsonb_build_object(
      'title', d->>'title', 'owner', d->'owner'->>'name', 'brigadier', d->'agreement'->'brigadier'->>'name',
      'amount', d->'agreement'->'amount', 'commission', d->'agreement'->'commission'));
  end if;
  return new;
end $$;
create trigger on_task_change after insert or update on flemme_mobile_v1.tasks
  for each row execute function flemme_mobile_v1.on_task_change();

create function flemme_mobile_v1.uuid_of(v jsonb)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(v) is distinct from 'string' or (v #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Identifiant invalide';
  end if;
  return (v #>> '{}')::uuid;
end $$;

-- Toutes les opérations de la page admin. SECURITY DEFINER pour lire au-delà des droits d'un membre :
-- le rôle admin est revérifié en base à chaque appel, et chaque décision est journalisée.
create function flemme_mobile_v1.admin_execute(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); target uuid; doc jsonb; note text; next_status text; event_text text; result jsonb;
  at text := to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
    or not exists(select 1 from flemme_mobile_v1.admins a join auth.users u on u.id = a.user_id
                  where a.user_id = uid and u.email_confirmed_at is not null) then
    raise exception 'Accès réservé à l''équipe FLEMME' using errcode = '42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Données invalides'; end if;

  if p_action = 'overview' then
    return jsonb_build_object(
      'tasks', (select jsonb_build_object(
          'open', count(*) filter (where document->>'status' = 'open'),
          'assigned', count(*) filter (where document->>'status' = 'assigned'),
          'completed', count(*) filter (where document->>'status' = 'completed')) from flemme_mobile_v1.tasks),
      'disputes', (select jsonb_build_object(
          'open', count(*) filter (where status = 'open'),
          'in_review', count(*) filter (where status = 'in_review'),
          'resolved', count(*) filter (where status = 'resolved')) from flemme_mobile_v1.disputes),
      'users', (select count(*) from auth.users),
      'suspended', (select count(*) from flemme_mobile_v1.suspensions),
      'alertErrors', (select count(*) from flemme_mobile_v1.alerts where error is not null and created_at > now() - interval '7 days'),
      'log', coalesce((select jsonb_agg(l order by l.at desc) from (
          select g.id, g.action, g.target, g.details, g.at, u.email as admin
          from flemme_mobile_v1.admin_log g left join auth.users u on u.id = g.admin_id
          order by g.at desc limit 30) l), '[]'::jsonb));
  elsif p_action = 'reports' then
    return jsonb_build_object('reports', coalesce((select jsonb_agg(r order by r.at desc) from (
      select t.id as "taskId", t.document->>'title' as title, t.document->>'status' as "taskStatus",
        rep->'actor' as actor, rep->>'text' as text, rep->>'at' as at, coalesce(d.status, 'open') as "disputeStatus"
      from flemme_mobile_v1.tasks t
      cross join lateral jsonb_array_elements(t.document->'reports') rep
      left join flemme_mobile_v1.disputes d on d.task_id = t.id
      order by rep->>'at' desc limit 300) r), '[]'::jsonb));
  elsif p_action = 'disputes' then
    return jsonb_build_object('disputes', coalesce((select jsonb_agg(x order by x."updatedAt" desc) from (
      select d.task_id as "taskId", d.status, d.resolution, d.opened_at as "openedAt", d.updated_at as "updatedAt",
        u.email as "updatedBy", t.document as task
      from flemme_mobile_v1.disputes d
      join flemme_mobile_v1.tasks t on t.id = d.task_id
      left join auth.users u on u.id = d.updated_by) x), '[]'::jsonb));
  elsif p_action = 'users' then
    return jsonb_build_object('users', coalesce((select jsonb_agg(x order by x."createdAt" desc) from (
      select u.id, u.email, u.created_at as "createdAt", u.last_sign_in_at as "lastSignInAt",
        u.email_confirmed_at is not null as confirmed,
        exists(select 1 from flemme_mobile_v1.admins a where a.user_id = u.id) as admin,
        (select count(*) from flemme_mobile_v1.tasks t where t.owner_id = u.id) as tasks,
        (select count(*) from flemme_mobile_v1.tasks t, jsonb_array_elements(t.document->'offers') o
          where o->'brigadier'->>'id' = u.id::text) as offers,
        (select count(*) from flemme_mobile_v1.tasks t where t.document->'agreement'->'brigadier'->>'id' = u.id::text) as missions,
        (select count(*) from flemme_mobile_v1.tasks t, jsonb_array_elements(t.document->'reports') r
          where r->'actor'->>'id' = u.id::text) as reports,
        s.reason as "suspendedReason", s.created_at as "suspendedAt"
      from auth.users u left join flemme_mobile_v1.suspensions s on s.user_id = u.id
      order by u.created_at desc limit 1000) x), '[]'::jsonb));
  elsif p_action = 'alerts' then
    return jsonb_build_object('alerts', coalesce((select jsonb_agg(x order by x.id desc) from (
      select id, kind, task_id as "taskId", payload, created_at as "createdAt", dispatched_at as "dispatchedAt", error
      from flemme_mobile_v1.alerts order by id desc limit 50) x), '[]'::jsonb));
  elsif p_action = 'alert_retry' then
    if jsonb_typeof(p_data->'id') is distinct from 'number' then raise exception 'Alerte introuvable'; end if;
    perform flemme_mobile_v1.dispatch_alert((p_data->>'id')::bigint);
    select to_jsonb(a) into result from flemme_mobile_v1.alerts a where a.id = (p_data->>'id')::bigint;
    if result is null then raise exception 'Alerte introuvable'; end if;
    return jsonb_build_object('alert', result);
  elsif p_action = 'dispute_update' then
    target := flemme_mobile_v1.uuid_of(p_data->'taskId');
    next_status := p_data->>'status';
    if next_status = 'in_review' then
      event_text := 'Litige pris en charge par l''équipe FLEMME';
    elsif next_status = 'resolved' then
      note := flemme_mobile_v1.required_text(p_data->'note', 1000);
      event_text := 'Litige clos par l''équipe FLEMME : ' || note;
    else raise exception 'Statut de litige invalide';
    end if;
    perform 1 from flemme_mobile_v1.disputes where task_id = target for update;
    if not found then raise exception 'Litige introuvable'; end if;
    select document into doc from flemme_mobile_v1.tasks where id = target for update;
    -- La décision est ajoutée à l'historique de la flemme : le déposant et le Brigadier la voient.
    doc := jsonb_set(doc, '{history}', (doc->'history') || jsonb_build_array(jsonb_build_object('text', event_text, 'at', at)));
    update flemme_mobile_v1.tasks set document = doc where id = target;
    update flemme_mobile_v1.disputes set status = next_status, resolution = coalesce(note, resolution),
      updated_at = now(), updated_by = uid where task_id = target;
    insert into flemme_mobile_v1.admin_log(admin_id, action, target, details)
      values (uid, 'dispute_' || next_status, target::text, jsonb_build_object('note', note));
    return jsonb_build_object('ok', true);
  elsif p_action = 'user_suspend' then
    target := flemme_mobile_v1.uuid_of(p_data->'userId');
    note := flemme_mobile_v1.required_text(p_data->'reason', 500);
    if exists(select 1 from flemme_mobile_v1.admins where user_id = target) then raise exception 'Un administrateur ne peut pas être suspendu'; end if;
    if not exists(select 1 from auth.users where id = target) then raise exception 'Compte introuvable'; end if;
    insert into flemme_mobile_v1.suspensions(user_id, reason, created_by) values (target, note, uid)
      on conflict (user_id) do update set reason = excluded.reason, created_at = now(), created_by = uid;
    insert into flemme_mobile_v1.admin_log(admin_id, action, target, details)
      values (uid, 'user_suspend', target::text, jsonb_build_object('reason', note));
    return jsonb_build_object('ok', true);
  elsif p_action = 'user_restore' then
    target := flemme_mobile_v1.uuid_of(p_data->'userId');
    delete from flemme_mobile_v1.suspensions where user_id = target;
    if not found then raise exception 'Ce compte n''est pas suspendu'; end if;
    insert into flemme_mobile_v1.admin_log(admin_id, action, target, details)
      values (uid, 'user_restore', target::text, '{}'::jsonb);
    return jsonb_build_object('ok', true);
  end if;
  raise exception 'Action inconnue';
end $$;

revoke all on function flemme_mobile_v1.dispatch_alert(bigint), flemme_mobile_v1.queue_alert(text,uuid,jsonb),
  flemme_mobile_v1.block_suspended(), flemme_mobile_v1.on_task_change(), flemme_mobile_v1.uuid_of(jsonb),
  flemme_mobile_v1.admin_execute(text,jsonb) from public, anon, authenticated;
grant execute on function flemme_mobile_v1.admin_execute(text,jsonb) to authenticated;
-- Seul point d'entrée exposé, invoker : la page admin n'utilise que la clé publique et la session du membre.
create function public.flemme_admin_api(p_action text, p_data jsonb default '{}')
returns jsonb language sql security invoker set search_path = '' as $$
  select flemme_mobile_v1.admin_execute(p_action, p_data);
$$;
revoke all on function public.flemme_admin_api(text,jsonb) from public, anon;
grant execute on function public.flemme_admin_api(text,jsonb) to authenticated;
commit;
