-- FLEMME V2 : pièces jointes, photo de profil et demande d'aide humaine (lot 4 du parcours complet).
-- S'applique après 20261104140000_flemme_v2_accord.sql. Additif.
-- Fichiers : bucket privé « flemme-fichiers » (PDF, JPEG, PNG, Word ; 10 Mo au plus). Chaque fichier est d'abord
-- déclaré par l'API (flemme_v2.files), puis envoyé par le membre ; les règles de Storage lisent cette déclaration.
-- L'assistant (réponses prédéfinies) est côté app : seul l'envoi à un humain passe par la base.

create table flemme_v2.files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references flemme_v2.profiles(user_id) on delete cascade,
  task_id uuid references flemme_v2.tasks(id) on delete cascade,
  kind text not null check (kind in ('task', 'avatar')),
  path text not null unique,
  name text not null check (char_length(name) between 1 and 120),
  mime text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  size integer not null check (size between 1 and 10485760),
  created_at timestamptz not null default clock_timestamp(),
  check ((kind = 'task') = (task_id is not null)),
  check (mime in ('image/jpeg', 'image/png') or kind = 'task')
);
create index files_task on flemme_v2.files (task_id, created_at);
alter table flemme_v2.profiles add column avatar_path text;

-- Demande d'aide humaine : envoyée depuis l'assistant, traitée dans /admin, réponse visible du membre.
create table flemme_v2.help_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references flemme_v2.profiles(user_id) on delete cascade,
  task_id uuid references flemme_v2.tasks(id) on delete set null,
  topic text not null check (topic in ('compte', 'demande', 'mission', 'paiement', 'securite', 'autre')),
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  answer text check (char_length(answer) between 1 and 2000),
  answered_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  answered_at timestamptz
);
create index help_open on flemme_v2.help_requests (created_at) where status = 'open';
alter table flemme_v2.files enable row level security;
alter table flemme_v2.help_requests enable row level security;
revoke all on flemme_v2.files, flemme_v2.help_requests from public, anon, authenticated;

alter table flemme_v2.alerts drop constraint alerts_kind_check;
alter table flemme_v2.alerts add constraint alerts_kind_check check (kind in
  ('task_created', 'task_edited', 'report', 'agreement', 'offer_review', 'agreement_review', 'help'));
-- Les demandes d'aide ne concernent pas toujours une flemme.
alter table flemme_v2.alerts alter column task_id drop not null;

-- Qui peut lire ou supprimer un objet du bucket : appelée par les règles de storage.objects.
-- Lecture : l'auteur ; pour une pièce jointe, le déposant et le Brigadier retenu ; une photo de profil, tout membre connecté.
create function flemme_v2.file_access(p_path text, p_op text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); f flemme_v2.files; t flemme_v2.tasks;
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then return false; end if;
  select * into f from flemme_v2.files where path = p_path;
  if not found then return false; end if;
  if p_op in ('insert', 'delete') then return f.owner_id = uid; end if;
  if f.owner_id = uid or f.kind = 'avatar' then return true; end if;
  select * into t from flemme_v2.tasks where id = f.task_id;
  return t.owner_id = uid or exists(select 1 from flemme_v2.offers where id = t.accepted_offer_id and brigadier_id = uid);
end $$;

create function flemme_v2.file_json(f flemme_v2.files)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', f.id, 'name', f.name, 'mime', f.mime, 'size', f.size, 'path', f.path,
    'owner', flemme_v2.actor_json(f.owner_id), 'at', flemme_v2.iso(f.created_at));
$$;
create function flemme_v2.help_json(h flemme_v2.help_requests)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', h.id, 'topic', h.topic, 'text', h.body, 'status', h.status, 'answer', h.answer,
    'taskId', h.task_id, 'at', flemme_v2.iso(h.created_at), 'answeredAt', flemme_v2.iso(h.answered_at));
$$;

-- Photo de profil dans le profil public (chemin dans le bucket privé ; l'app demande une adresse signée).
create or replace function flemme_v2.profile_json(p_user uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.user_id, 'name', p.display_name, 'bio', p.bio, 'skills', to_jsonb(p.skills), 'experience', p.experience,
    'avatar', p.avatar_path, 'since', flemme_v2.iso(p.created_at),
    'missions', (select count(*) from flemme_v2.offers o join flemme_v2.tasks t on t.accepted_offer_id = o.id
      where o.brigadier_id = p.user_id and t.status = 'completed'),
    'rating', (select round(avg(r.rating)::numeric, 1) from flemme_v2.reviews r where r.target_id = p.user_id),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('rating', r.rating, 'text', r.body, 'author', flemme_v2.actor_json(r.author_id),
        'task', t.title, 'at', flemme_v2.iso(r.created_at)) order by r.created_at desc)
      from flemme_v2.reviews r join flemme_v2.tasks t on t.id = r.task_id where r.target_id = p.user_id), '[]'::jsonb))
  from flemme_v2.profiles p where p.user_id = p_user;
$$;

-- Actions du lot 4. Même contrôle d'accès que flemme_v2.execute.
create function flemme_v2.aide(p_action text, p_task uuid, p_data jsonb, p_request uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); t flemme_v2.tasks; f flemme_v2.files; h flemme_v2.help_requests; previous flemme_v2.requests;
  f_kind text; f_name text; f_mime text; f_size integer; f_path text; ext text; result jsonb;
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) or
    not exists(select 1 from auth.users where id = uid and email_confirmed_at is not null) then
    raise exception 'Connexion avec un compte confirmé requise' using errcode = '42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Données invalides'; end if;
  insert into flemme_v2.profiles (user_id, display_name)
  select u.id, flemme_v2.default_display_name(u.raw_user_meta_data, u.email) from auth.users u where u.id = uid
  on conflict do nothing;
  if p_action in ('file_prepare', 'file_delete', 'help_send') and exists(select 1 from flemme_v2.suspensions where user_id = uid) then
    raise exception 'Compte suspendu : contacte FLEMME pour en savoir plus' using errcode = '42501';
  end if;

  if p_action in ('file_prepare', 'file_list') and p_task is not null then
    select * into t from flemme_v2.tasks where id = p_task;
    if not found or (t.owner_id <> uid and not exists(select 1 from flemme_v2.offers where id = t.accepted_offer_id and brigadier_id = uid)) then
      raise exception 'Pièces jointes réservées au déposant et au Brigadier retenu' using errcode = '42501';
    end if;
  end if;

  if p_action = 'file_prepare' then
    -- Déclare un fichier avant son envoi ; renvoie le chemin à utiliser dans le bucket.
    f_kind := case when p_task is null then 'avatar' else 'task' end;
    f_name := flemme_v2.required_text(p_data->'name', 120);
    f_mime := p_data->>'mime';
    ext := case f_mime when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png'
      when 'application/msword' then 'doc' when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' then 'docx' end;
    if ext is null or (f_kind = 'avatar' and ext not in ('jpg', 'png')) then
      raise exception '%', case when f_kind = 'avatar' then 'Photo au format JPEG ou PNG' else 'Format accepté : PDF, JPEG, PNG ou Word' end;
    end if;
    if jsonb_typeof(p_data->'size') is distinct from 'number' or (p_data->>'size')::numeric not between 1 and 10485760
      or (p_data->>'size')::numeric <> trunc((p_data->>'size')::numeric) then
      raise exception 'Fichier trop lourd : 10 Mo au plus';
    end if;
    f_size := (p_data->>'size')::integer;
    if f_kind = 'task' and (select count(*) from flemme_v2.files where task_id = p_task) >= 20 then
      raise exception '20 pièces jointes au plus par flemme';
    end if;
    f_path := uid::text || '/' || gen_random_uuid()::text || '.' || ext;
    insert into flemme_v2.files (owner_id, task_id, kind, path, name, mime, size) values (uid, p_task, f_kind, f_path, f_name, f_mime, f_size)
    returning * into f;
    if f_kind = 'avatar' then
      -- L'ancienne photo reste déclarée : l'app supprime son fichier du bucket, puis sa déclaration (file_delete).
      result := jsonb_build_object('previous', (select flemme_v2.file_json(x) from flemme_v2.files x join flemme_v2.profiles p
        on p.avatar_path = x.path where p.user_id = uid and x.owner_id = uid));
      update flemme_v2.profiles set avatar_path = f.path, updated_at = clock_timestamp() where user_id = uid;
    else
      insert into flemme_v2.events (task_id, actor_id, kind, label) values (p_task, uid, 'message', 'Pièce jointe ajoutée : ' || f.name);
    end if;
    return coalesce(result, '{}'::jsonb) || jsonb_build_object('file', flemme_v2.file_json(f));
  elsif p_action = 'file_list' then
    if p_task is null then raise exception 'Flemme introuvable'; end if;
    return jsonb_build_object('files', coalesce((select jsonb_agg(flemme_v2.file_json(x) order by x.created_at) from flemme_v2.files x where x.task_id = p_task), '[]'::jsonb));
  elsif p_action = 'file_delete' then
    delete from flemme_v2.files where id = flemme_v2.uuid_of(p_data->'id') and owner_id = uid returning * into f;
    if not found then raise exception 'Fichier introuvable'; end if;
    if f.kind = 'avatar' then update flemme_v2.profiles set avatar_path = null where user_id = uid and avatar_path = f.path; end if;
    return jsonb_build_object('path', f.path);
  elsif p_action = 'help_list' then
    return jsonb_build_object('requests', coalesce((select jsonb_agg(flemme_v2.help_json(x) order by x.created_at desc)
      from flemme_v2.help_requests x where x.user_id = uid), '[]'::jsonb));
  elsif p_action = 'help_send' then
    if p_request is null then raise exception 'Identifiant de requête requis'; end if;
    perform pg_advisory_xact_lock(hashtextextended(uid::text || p_request::text, 0));
    select * into previous from flemme_v2.requests where actor_id = uid and request_id = p_request;
    if found then
      if previous.action <> p_action or previous.payload <> p_data then raise exception 'Identifiant déjà utilisé pour une autre action'; end if;
      return previous.result;
    end if;
    if (select count(*) from flemme_v2.help_requests where user_id = uid and status = 'open') >= 5 then
      raise exception 'Tu as déjà 5 demandes en attente : l''équipe te répond au plus vite';
    end if;
    if p_data->'taskId' is not null and p_data->'taskId' <> 'null'::jsonb then
      select * into t from flemme_v2.tasks where id = flemme_v2.uuid_of(p_data->'taskId');
      if not found or (t.owner_id <> uid and not exists(select 1 from flemme_v2.offers where task_id = t.id and brigadier_id = uid)) then
        raise exception 'Flemme introuvable';
      end if;
    end if;
    if p_data->>'topic' is null or p_data->>'topic' not in ('compte', 'demande', 'mission', 'paiement', 'securite', 'autre') then
      raise exception 'Sujet invalide';
    end if;
    insert into flemme_v2.help_requests (user_id, task_id, topic, body)
    values (uid, t.id, p_data->>'topic', flemme_v2.required_text(p_data->'text', 2000)) returning * into h;
    perform flemme_v2.queue_alert('help', h.task_id, jsonb_build_object('topic', h.topic, 'text', h.body,
      'user', flemme_v2.display_name(uid), 'title', t.title));
    result := jsonb_build_object('request', flemme_v2.help_json(h));
    insert into flemme_v2.requests (actor_id, request_id, action, task_id, payload, result) values (uid, p_request, p_action, null, p_data, result);
    return result;
  end if;
  raise exception 'Action inconnue';
end $$;

create function flemme_v2.admin_aide(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := flemme_v2.require_admin(); h flemme_v2.help_requests; note text;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Données invalides'; end if;
  if p_action = 'help_queue' then
    return jsonb_build_object('requests', coalesce((select jsonb_agg(flemme_v2.help_json(x) || jsonb_build_object(
        'user', flemme_v2.actor_json(x.user_id), 'email', u.email, 'title', t.title) order by x.status = 'open' desc, x.created_at desc)
      from (select * from flemme_v2.help_requests order by created_at desc limit 200) x
      left join auth.users u on u.id = x.user_id left join flemme_v2.tasks t on t.id = x.task_id), '[]'::jsonb));
  elsif p_action = 'help_answer' then
    select * into h from flemme_v2.help_requests where id = flemme_v2.uuid_of(p_data->'id') for update;
    if not found then raise exception 'Demande introuvable'; end if;
    if p_data->>'status' = 'closed' then
      update flemme_v2.help_requests set status = 'closed' where id = h.id;
      insert into flemme_v2.admin_log (admin_id, action, target, details) values (uid, 'help_closed', h.id::text, '{}'::jsonb);
    else
      note := flemme_v2.required_text(p_data->'answer', 2000);
      update flemme_v2.help_requests set status = 'answered', answer = note, answered_by = uid, answered_at = clock_timestamp() where id = h.id;
      insert into flemme_v2.admin_log (admin_id, action, target, details) values (uid, 'help_answered', h.id::text, jsonb_build_object('note', note));
    end if;
    return jsonb_build_object('ok', true);
  end if;
  raise exception 'Action inconnue';
end $$;

revoke all on function flemme_v2.file_json(flemme_v2.files), flemme_v2.help_json(flemme_v2.help_requests),
  flemme_v2.aide(text, uuid, jsonb, uuid), flemme_v2.admin_aide(text, jsonb), flemme_v2.file_access(text, text) from public, anon, authenticated;
grant execute on function flemme_v2.aide(text, uuid, jsonb, uuid), flemme_v2.admin_aide(text, jsonb), flemme_v2.file_access(text, text) to authenticated;

-- Bucket et règles de Storage (absents des tests PGlite, qui n'ont pas de schéma storage).
do $$ begin
  if to_regclass('storage.buckets') is null then raise notice 'Storage absent : bucket non créé'; return; end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('flemme-fichiers', 'flemme-fichiers', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  execute $p$create policy flemme_fichiers_lecture on storage.objects for select to authenticated
    using (bucket_id = 'flemme-fichiers' and flemme_v2.file_access(name, 'select'))$p$;
  execute $p$create policy flemme_fichiers_envoi on storage.objects for insert to authenticated
    with check (bucket_id = 'flemme-fichiers' and flemme_v2.file_access(name, 'insert'))$p$;
  execute $p$create policy flemme_fichiers_suppression on storage.objects for delete to authenticated
    using (bucket_id = 'flemme-fichiers' and flemme_v2.file_access(name, 'delete'))$p$;
end $$;

create or replace function public.flemme_mobile_api(p_action text, p_task uuid default null, p_data jsonb default '{}', p_request uuid default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select case when p_action = 'search' then flemme_v2.search(p_data)
    when p_action in ('profile_get', 'profile_save', 'apply', 'apply_edit', 'agreement_save', 'agreement_submit', 'agreement_sign', 'review')
      then flemme_v2.accord(p_action, p_task, p_data, p_request)
    when p_action in ('file_prepare', 'file_list', 'file_delete', 'help_send', 'help_list') then flemme_v2.aide(p_action, p_task, p_data, p_request)
    else flemme_v2.execute(p_action, p_task, p_data, p_request) end;
$$;
create or replace function public.flemme_admin_api(p_action text, p_data jsonb default '{}')
returns jsonb language sql security invoker set search_path = '' as $$
  select case when p_action in ('moderation', 'task_review') then flemme_v2.admin_parcours(p_action, p_data)
    when p_action in ('review_queue', 'offer_review', 'agreement_review') then flemme_v2.admin_accord(p_action, p_data)
    when p_action in ('help_queue', 'help_answer') then flemme_v2.admin_aide(p_action, p_data)
    else flemme_v2.admin_execute(p_action, p_data) end;
$$;
