-- Feature flags FLEMME (16/11/2026). S'applique après 20261104150000_flemme_v2_fichiers_aide.sql. Additif.
-- Registre des flags : packages/shared/src/flags.ts (clés, libellés, valeurs par défaut). Cette table ne porte que
-- l'interrupteur réglé depuis /admin, par environnement (local, beta, preprod, prod) : un même projet Supabase peut
-- servir plusieurs sites, chacun lit sa colonne. Une clé absente de la table = la valeur par défaut du registre.
-- Un flag masque ou montre de l'interface ; il ne donne aucun droit. Seules deux écritures sont revérifiées ici :
-- nouvelle demande (formulaires.deleguer) et candidature (formulaires.resoudre), refusées si le flag est « off »
-- dans l'environnement serveur (flemme_v2.settings.flag_environment, prod par défaut).

create table flemme_v2.feature_flags (
  key text not null check (key ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$' and length(key) <= 80),
  environment text not null check (environment in ('local', 'beta', 'preprod', 'prod')),
  state text not null check (state in ('off', 'testeurs', 'tous')),
  value text check (value is null or value ~ '^[a-z0-9_-]{1,40}$'),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (key, environment)
);
alter table flemme_v2.feature_flags enable row level security;
revoke all on flemme_v2.feature_flags from public, anon, authenticated;

alter table flemme_v2.settings
  add column flag_environment text not null default 'prod' check (flag_environment in ('local', 'beta', 'preprod', 'prod'));

-- Lecture publique (visiteurs anonymes compris) : uniquement clé, état et valeur d'un environnement, jamais l'auteur.
create function public.flemme_flags(p_environment text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('environment', p_environment, 'flags', coalesce(jsonb_agg(jsonb_build_object('key', f.key, 'state', f.state, 'value', f.value) order by f.key), '[]'::jsonb))
  from flemme_v2.feature_flags f where f.environment = p_environment;
$$;
revoke all on function public.flemme_flags(text) from public;
grant execute on function public.flemme_flags(text) to anon, authenticated;

-- Garde serveur : refuse une écriture dont le formulaire est éteint dans l'environnement serveur.
create function flemme_v2.flag_guard(p_action text)
returns void language plpgsql stable security definer set search_path = '' as $$
declare flag text; env text;
begin
  flag := case when p_action = 'create' then 'formulaires.deleguer' when p_action = 'apply' then 'formulaires.resoudre' end;
  if flag is null then return; end if;
  select s.flag_environment into env from flemme_v2.settings s;
  if exists(select 1 from flemme_v2.feature_flags f where f.key = flag and f.environment = coalesce(env, 'prod') and f.state = 'off') then
    raise exception 'Fonctionnalité momentanément indisponible' using errcode = '42501';
  end if;
end $$;

-- Écran « Fonctionnalités » de /admin : liste et bascule, rôle admin revérifié, chaque bascule journalisée.
create function flemme_v2.admin_flags(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); k text; env text; st text; val text; before jsonb;
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
    or not exists(select 1 from flemme_v2.admins a join auth.users u on u.id = a.user_id
                  where a.user_id = uid and u.email_confirmed_at is not null) then
    raise exception 'Accès réservé à l''équipe FLEMME' using errcode = '42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Données invalides'; end if;

  if p_action = 'flags' then
    return jsonb_build_object(
      'serverEnvironment', (select s.flag_environment from flemme_v2.settings s),
      'flags', coalesce((select jsonb_agg(jsonb_build_object('key', f.key, 'environment', f.environment, 'state', f.state, 'value', f.value,
        'updatedAt', f.updated_at, 'updatedBy', u.email) order by f.key, f.environment)
        from flemme_v2.feature_flags f left join auth.users u on u.id = f.updated_by), '[]'::jsonb));
  end if;

  if p_action = 'flag_set' then
    k := p_data->>'key'; env := p_data->>'environment'; st := p_data->>'state'; val := nullif(p_data->>'value', '');
    if k is null or k !~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$' or length(k) > 80 then raise exception 'Clé de flag invalide'; end if;
    if env is null or env not in ('local', 'beta', 'preprod', 'prod') then raise exception 'Environnement invalide'; end if;
    if st is null or st not in ('off', 'testeurs', 'tous') then raise exception 'État invalide'; end if;
    if val is not null and val !~ '^[a-z0-9_-]{1,40}$' then raise exception 'Valeur invalide'; end if;
    select jsonb_build_object('state', f.state, 'value', f.value) into before from flemme_v2.feature_flags f where f.key = k and f.environment = env;
    insert into flemme_v2.feature_flags(key, environment, state, value, updated_at, updated_by)
      values (k, env, st, val, clock_timestamp(), uid)
      on conflict (key, environment) do update set state = excluded.state, value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
    insert into flemme_v2.admin_log(admin_id, action, target, details)
      values (uid, 'flag_set', k, jsonb_build_object('environment', env, 'state', st, 'value', val, 'before', before));
    return jsonb_build_object('ok', true);
  end if;

  if p_action = 'flag_reset' then
    k := p_data->>'key'; env := p_data->>'environment';
    delete from flemme_v2.feature_flags f where f.key = k and f.environment = env;
    if not found then raise exception 'Ce flag suit déjà le registre'; end if;
    insert into flemme_v2.admin_log(admin_id, action, target, details) values (uid, 'flag_reset', k, jsonb_build_object('environment', env));
    return jsonb_build_object('ok', true);
  end if;

  if p_action = 'flag_environment' then
    env := p_data->>'environment';
    if env is null or env not in ('local', 'beta', 'preprod', 'prod') then raise exception 'Environnement invalide'; end if;
    update flemme_v2.settings set flag_environment = env;
    insert into flemme_v2.admin_log(admin_id, action, target, details) values (uid, 'flag_environment', env, '{}'::jsonb);
    return jsonb_build_object('ok', true);
  end if;
  raise exception 'Action inconnue';
end $$;

revoke all on function flemme_v2.flag_guard(text), flemme_v2.admin_flags(text, jsonb) from public, anon, authenticated;
grant execute on function flemme_v2.flag_guard(text), flemme_v2.admin_flags(text, jsonb) to authenticated;

-- Points d'entrée : mêmes aiguillages que 20261104150000, plus la garde des formulaires et les actions des flags.
create or replace function public.flemme_mobile_api(p_action text, p_task uuid default null, p_data jsonb default '{}', p_request uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform flemme_v2.flag_guard(p_action);
  return case when p_action = 'search' then flemme_v2.search(p_data)
    when p_action in ('profile_get', 'profile_save', 'apply', 'apply_edit', 'agreement_save', 'agreement_submit', 'agreement_sign', 'review')
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
    else flemme_v2.admin_execute(p_action, p_data) end;
$$;
