-- FLEMME V2, exploitation minimale : page admin (/admin) et alertes e-mail.
-- S'applique après les migrations flemme_v2 (tables + API). Additif, sauf un point : le type d'événement
-- « admin » est ajouté à flemme_v2.events pour que les décisions de l'équipe apparaissent dans l'historique.
-- Alertes : voir supabase/README-admin.md (pg_net et deux secrets dans Vault, aucun secret ici).

-- pg_net envoie les alertes. S'il manque (tests PGlite), chaque alerte reste en file avec son erreur.
do $$ begin create extension if not exists pg_net; exception when others then raise notice 'pg_net indisponible : alertes conservées sans envoi'; end $$;

alter table flemme_v2.events drop constraint events_kind_check;
alter table flemme_v2.events add constraint events_kind_check check (kind in
  ('create', 'offer', 'message', 'accept', 'decline', 'complete', 'declare_payment', 'confirm_payment', 'report', 'admin'));

create table flemme_v2.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default clock_timestamp()
);
-- Un litige par flemme signalée. Il se rouvre si un nouveau signalement arrive après sa clôture.
create table flemme_v2.disputes (
  task_id uuid primary key references flemme_v2.tasks(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'in_review', 'resolved')),
  resolution text,
  opened_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references auth.users(id) on delete set null
);
-- Un compte suspendu lit encore ses flemmes mais ne peut plus rien publier ni modifier.
create table flemme_v2.suspensions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid references auth.users(id) on delete set null
);
-- Journal des décisions de l'équipe, en ajout seul.
create table flemme_v2.admin_log (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users(id) on delete set null,
  action text not null, target text not null, details jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
-- File des alertes : chaque événement est enregistré, puis envoyé. Un envoi raté ne perd rien.
create table flemme_v2.alerts (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('task_created', 'report', 'agreement')),
  task_id uuid not null,
  payload jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  dispatched_at timestamptz,
  error text
);
create index alerts_recent on flemme_v2.alerts (id desc);
alter table flemme_v2.admins enable row level security;
alter table flemme_v2.disputes enable row level security;
alter table flemme_v2.suspensions enable row level security;
alter table flemme_v2.admin_log enable row level security;
alter table flemme_v2.alerts enable row level security;
revoke all on flemme_v2.admins, flemme_v2.disputes, flemme_v2.suspensions, flemme_v2.admin_log, flemme_v2.alerts
  from public, anon, authenticated;
revoke all on all sequences in schema flemme_v2 from public, anon, authenticated;

-- Le propriétaire, seul administrateur au départ, s'il a déjà un compte confirmé sur ce projet.
-- Sinon (projet de test), voir README-admin.md pour l'ajouter plus tard. Aucun compte ne peut s'ajouter lui-même.
insert into flemme_v2.admins (user_id)
select id from auth.users where lower(email) = 'ben.champly@gmail.com' and email_confirmed_at is not null
on conflict do nothing;

-- Envoi d'une alerte vers la fonction Netlify /api/alerte. Adresse et secret lus dans Vault.
-- Toute erreur est notée sur l'alerte et ne bloque jamais l'action du membre.
create function flemme_v2.dispatch_alert(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare a flemme_v2.alerts; target text; secret text;
begin
  select * into a from flemme_v2.alerts where id = p_id;
  if not found then return; end if;
  select decrypted_secret into target from vault.decrypted_secrets where name = 'flemme_alerte_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'flemme_alerte_secret';
  if target is null or secret is null or target !~ '^https://' then
    update flemme_v2.alerts set error = 'Alertes non configurées : secrets Vault manquants' where id = p_id;
    return;
  end if;
  perform net.http_post(
    url := target,
    body := jsonb_build_object('source', 'flemme_v2', 'id', a.id, 'kind', a.kind, 'task_id', a.task_id, 'payload', a.payload, 'created_at', a.created_at),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-alerte-secret', secret)
  );
  update flemme_v2.alerts set dispatched_at = clock_timestamp(), error = null where id = p_id;
exception when others then
  update flemme_v2.alerts set error = left(sqlerrm, 300) where id = p_id;
end $$;

create function flemme_v2.queue_alert(p_kind text, p_task uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare new_id bigint;
begin
  insert into flemme_v2.alerts (kind, task_id, payload) values (p_kind, p_task, p_payload) returning id into new_id;
  perform flemme_v2.dispatch_alert(new_id);
end $$;

create function flemme_v2.display_name(p_user uuid)
returns text language sql stable set search_path = '' as $$
  select coalesce((select display_name from flemme_v2.profiles where user_id = p_user), case when p_user is null then 'Compte supprimé' else 'Membre' end);
$$;

-- Chaque action d'un membre ajoute un événement : c'est le point unique pour bloquer un compte suspendu.
create function flemme_v2.block_suspended()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from flemme_v2.suspensions where user_id = auth.uid()) then
    raise exception 'Compte suspendu : contacte FLEMME pour en savoir plus' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger block_suspended before insert on flemme_v2.events
  for each row when (new.kind <> 'admin') execute function flemme_v2.block_suspended();

-- Alertes : nouvelle flemme, accord conclu, signalement (qui ouvre ou rouvre le litige).
create function flemme_v2.on_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare t flemme_v2.tasks; chosen flemme_v2.offers;
begin
  select * into t from flemme_v2.tasks where id = new.task_id;
  if t.accepted_offer_id is not null then select * into chosen from flemme_v2.offers where id = t.accepted_offer_id; end if;
  if new.kind = 'create' then
    perform flemme_v2.queue_alert('task_created', t.id, jsonb_build_object(
      'title', t.title, 'place', t.place, 'budget', t.budget, 'owner', flemme_v2.display_name(t.owner_id)));
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
create trigger on_event after insert on flemme_v2.events
  for each row when (new.kind in ('create', 'accept', 'report')) execute function flemme_v2.on_event();

create function flemme_v2.uuid_of(v jsonb)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(v) is distinct from 'string' or (v #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Identifiant invalide';
  end if;
  return (v #>> '{}')::uuid;
end $$;

-- Toutes les opérations de la page admin. SECURITY DEFINER pour lire au-delà des droits d'un membre :
-- le rôle admin est revérifié en base à chaque appel, et chaque décision est journalisée.
create function flemme_v2.admin_execute(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); target uuid; note text; next_status text; event_text text; result jsonb;
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
    or not exists(select 1 from flemme_v2.admins a join auth.users u on u.id = a.user_id
                  where a.user_id = uid and u.email_confirmed_at is not null) then
    raise exception 'Accès réservé à l''équipe FLEMME' using errcode = '42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Données invalides'; end if;

  if p_action = 'overview' then
    return jsonb_build_object(
      'tasks', (select jsonb_build_object(
          'open', count(*) filter (where status = 'open'),
          'assigned', count(*) filter (where status = 'assigned'),
          'completed', count(*) filter (where status = 'completed')) from flemme_v2.tasks),
      'disputes', (select jsonb_build_object(
          'open', count(*) filter (where status = 'open'),
          'in_review', count(*) filter (where status = 'in_review'),
          'resolved', count(*) filter (where status = 'resolved')) from flemme_v2.disputes),
      'users', (select count(*) from auth.users),
      'suspended', (select count(*) from flemme_v2.suspensions),
      'alertErrors', (select count(*) from flemme_v2.alerts where error is not null and created_at > now() - interval '7 days'),
      'log', coalesce((select jsonb_agg(l order by l.id desc) from (
          select g.id, g.action, g.target, g.details, flemme_v2.iso(g.created_at) as at, u.email as admin
          from flemme_v2.admin_log g left join auth.users u on u.id = g.admin_id
          order by g.id desc limit 30) l), '[]'::jsonb));
  elsif p_action = 'reports' then
    return jsonb_build_object('reports', coalesce((select jsonb_agg(x order by x.id desc) from (
      select e.id, t.id as "taskId", t.title, t.status as "taskStatus", flemme_v2.actor_json(e.actor_id) as actor,
        e.body as text, flemme_v2.iso(e.created_at) as at, coalesce(d.status, 'open') as "disputeStatus"
      from flemme_v2.events e join flemme_v2.tasks t on t.id = e.task_id
      left join flemme_v2.disputes d on d.task_id = t.id
      where e.kind = 'report' order by e.id desc limit 300) x), '[]'::jsonb));
  elsif p_action = 'disputes' then
    -- La flemme est vue comme son déposant la voit : propositions, accord, paiements, signalements, historique.
    return jsonb_build_object('disputes', coalesce((select jsonb_agg(x order by x."updatedAt" desc) from (
      select d.task_id as "taskId", d.status, d.resolution, flemme_v2.iso(d.opened_at) as "openedAt",
        flemme_v2.iso(d.updated_at) as "updatedAt", u.email as "updatedBy", flemme_v2.task_json(t.id, t.owner_id) as task
      from flemme_v2.disputes d join flemme_v2.tasks t on t.id = d.task_id
      left join auth.users u on u.id = d.updated_by) x), '[]'::jsonb));
  elsif p_action = 'users' then
    return jsonb_build_object('users', coalesce((select jsonb_agg(x order by x."createdAt" desc) from (
      select u.id, u.email, p.display_name as "displayName", flemme_v2.iso(u.created_at) as "createdAt",
        flemme_v2.iso(u.last_sign_in_at) as "lastSignInAt", u.email_confirmed_at is not null as confirmed,
        exists(select 1 from flemme_v2.admins a where a.user_id = u.id) as admin,
        (select count(*) from flemme_v2.tasks t where t.owner_id = u.id) as tasks,
        (select count(*) from flemme_v2.offers o where o.brigadier_id = u.id) as offers,
        (select count(*) from flemme_v2.offers o where o.brigadier_id = u.id and o.status = 'accepted') as missions,
        (select count(*) from flemme_v2.events e where e.actor_id = u.id and e.kind = 'report') as reports,
        s.reason as "suspendedReason", flemme_v2.iso(s.created_at) as "suspendedAt"
      from auth.users u
      left join flemme_v2.profiles p on p.user_id = u.id
      left join flemme_v2.suspensions s on s.user_id = u.id
      order by u.created_at desc limit 1000) x), '[]'::jsonb));
  elsif p_action = 'alerts' then
    return jsonb_build_object('alerts', coalesce((select jsonb_agg(x order by x.id desc) from (
      select id, kind, task_id as "taskId", payload, flemme_v2.iso(created_at) as "createdAt",
        flemme_v2.iso(dispatched_at) as "dispatchedAt", error
      from flemme_v2.alerts order by id desc limit 50) x), '[]'::jsonb));
  elsif p_action = 'alert_retry' then
    if jsonb_typeof(p_data->'id') is distinct from 'number' then raise exception 'Alerte introuvable'; end if;
    perform flemme_v2.dispatch_alert((p_data->>'id')::bigint);
    select to_jsonb(a) into result from flemme_v2.alerts a where a.id = (p_data->>'id')::bigint;
    if result is null then raise exception 'Alerte introuvable'; end if;
    return jsonb_build_object('alert', result);
  elsif p_action = 'dispute_update' then
    target := flemme_v2.uuid_of(p_data->'taskId');
    next_status := p_data->>'status';
    if next_status = 'in_review' then
      event_text := 'Litige pris en charge par l''équipe FLEMME';
    elsif next_status = 'resolved' then
      note := flemme_v2.required_text(p_data->'note', 900);
      event_text := 'Litige clos par l''équipe FLEMME : ' || note;
    else raise exception 'Statut de litige invalide';
    end if;
    perform 1 from flemme_v2.disputes where task_id = target for update;
    if not found then raise exception 'Litige introuvable'; end if;
    -- La décision rejoint l'historique de la flemme : le déposant et le Brigadier la voient.
    insert into flemme_v2.profiles (user_id, display_name) values (uid, 'Équipe FLEMME') on conflict do nothing;
    insert into flemme_v2.events (task_id, actor_id, kind, label) values (target, uid, 'admin', event_text);
    update flemme_v2.tasks set updated_at = clock_timestamp() where id = target;
    update flemme_v2.disputes set status = next_status, resolution = coalesce(note, resolution),
      updated_at = clock_timestamp(), updated_by = uid where task_id = target;
    insert into flemme_v2.admin_log (admin_id, action, target, details)
      values (uid, 'dispute_' || next_status, target::text, jsonb_build_object('note', note));
    return jsonb_build_object('ok', true);
  elsif p_action = 'user_suspend' then
    target := flemme_v2.uuid_of(p_data->'userId');
    note := flemme_v2.required_text(p_data->'reason', 500);
    if exists(select 1 from flemme_v2.admins where user_id = target) then raise exception 'Un administrateur ne peut pas être suspendu'; end if;
    if not exists(select 1 from auth.users where id = target) then raise exception 'Compte introuvable'; end if;
    insert into flemme_v2.suspensions (user_id, reason, created_by) values (target, note, uid)
      on conflict (user_id) do update set reason = excluded.reason, created_at = clock_timestamp(), created_by = uid;
    insert into flemme_v2.admin_log (admin_id, action, target, details)
      values (uid, 'user_suspend', target::text, jsonb_build_object('reason', note));
    return jsonb_build_object('ok', true);
  elsif p_action = 'user_restore' then
    target := flemme_v2.uuid_of(p_data->'userId');
    delete from flemme_v2.suspensions where user_id = target;
    if not found then raise exception 'Ce compte n''est pas suspendu'; end if;
    insert into flemme_v2.admin_log (admin_id, action, target, details)
      values (uid, 'user_restore', target::text, '{}'::jsonb);
    return jsonb_build_object('ok', true);
  end if;
  raise exception 'Action inconnue';
end $$;

revoke all on all functions in schema flemme_v2 from public, anon, authenticated;
grant execute on function flemme_v2.execute(text, uuid, jsonb, uuid) to authenticated;
grant execute on function flemme_v2.admin_execute(text, jsonb) to authenticated;
-- Seul point d'entrée exposé, invoker : la page admin n'utilise que la clé publique et la session du membre.
create function public.flemme_admin_api(p_action text, p_data jsonb default '{}')
returns jsonb language sql security invoker set search_path = '' as $$
  select flemme_v2.admin_execute(p_action, p_data);
$$;
revoke all on function public.flemme_admin_api(text, jsonb) from public, anon;
grant execute on function public.flemme_admin_api(text, jsonb) to authenticated;
