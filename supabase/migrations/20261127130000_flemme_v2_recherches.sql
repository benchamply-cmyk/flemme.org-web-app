-- Recherches enregistrées (27/11/2026, demande de Ben) : les alertes de Mon espace (onglet Trouver) quittent le navigateur
-- pour le compte, comme le promet /bientot (« vos recherches vous attendent »). S'applique après 20261127120000_flemme_v2_pre_beta.sql.
-- Additif : une table et une fonction nouvelles ; public.flemme_mobile_api est remplacée avec les mêmes aiguillages
-- que 20261118140000, plus les trois actions ci-dessous.
--
-- Actions (membre à l'adresse confirmée, uniquement ses propres recherches) :
--   searches        → { searches: [...] }, la plus récente d'abord
--   search_save     → { search }   données : id (uuid du client, renvoyer le même id ne crée pas de doublon), filter, label, seenAt
--   search_delete   → { ok: true } données : id
-- Au plus 5 recherches par compte. Rien n'est public : aucune lecture par un autre membre ni par anon.
-- Supprimées avec le compte (on delete cascade).

create table flemme_v2.saved_searches (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  filter jsonb not null check (jsonb_typeof(filter) = 'object' and length(filter::text) <= 1000),
  label text not null check (length(label) between 1 and 200),
  seen_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index saved_searches_owner on flemme_v2.saved_searches (owner_id, updated_at desc);
alter table flemme_v2.saved_searches enable row level security;
revoke all on flemme_v2.saved_searches from public, anon, authenticated;

create function flemme_v2.search_json(s flemme_v2.saved_searches)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', s.id, 'filter', s.filter, 'label', s.label, 'seenAt', s.seen_at, 'createdAt', s.created_at);
$$;

create function flemme_v2.recherches(p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); sid uuid; f jsonb := '{}'; k text; s flemme_v2.saved_searches;
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) or
    not exists(select 1 from auth.users where id = uid and email_confirmed_at is not null) then
    raise exception 'Connexion avec un compte confirmé requise' using errcode = '42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Données invalides'; end if;

  if p_action = 'searches' then
    return jsonb_build_object('searches', coalesce((select jsonb_agg(flemme_v2.search_json(x) order by x.updated_at desc)
      from flemme_v2.saved_searches x where x.owner_id = uid), '[]'::jsonb));

  elsif p_action = 'search_save' then
    sid := flemme_v2.uuid_of(p_data->'id');
    if jsonb_typeof(p_data->'filter') is distinct from 'object' then raise exception 'Recherche invalide'; end if;
    -- Seuls les filtres connus sont gardés, en texte court (comme SearchFilter côté client, sans le tri).
    foreach k in array array['q', 'category', 'mode', 'place', 'budget', 'deadline'] loop
      if jsonb_typeof(p_data->'filter'->k) = 'string' and btrim(p_data->'filter'->>k) <> '' then
        f := f || jsonb_build_object(k, left(btrim(p_data->'filter'->>k), 100));
      end if;
    end loop;
    select * into s from flemme_v2.saved_searches where id = sid;
    if found and s.owner_id <> uid then raise exception 'Recherche introuvable'; end if;
    if not found and (select count(*) from flemme_v2.saved_searches where owner_id = uid) >= 5 then
      raise exception 'Cinq recherches au plus : supprimez-en une avant d''en créer une autre';
    end if;
    insert into flemme_v2.saved_searches (id, owner_id, filter, label, seen_at)
    values (sid, uid, f, left(coalesce(nullif(btrim(p_data->>'label'), ''), 'toutes les demandes'), 200),
            coalesce(case when jsonb_typeof(p_data->'seenAt') = 'string' then (p_data->>'seenAt')::timestamptz end, clock_timestamp()))
    on conflict (id) do update set filter = excluded.filter, label = excluded.label, seen_at = excluded.seen_at, updated_at = clock_timestamp()
    returning * into s;
    return jsonb_build_object('search', flemme_v2.search_json(s));

  elsif p_action = 'search_delete' then
    delete from flemme_v2.saved_searches where id = flemme_v2.uuid_of(p_data->'id') and owner_id = uid;
    return jsonb_build_object('ok', true);
  end if;
  raise exception 'Action inconnue';
end $$;
revoke all on function flemme_v2.search_json(flemme_v2.saved_searches), flemme_v2.recherches(text, jsonb) from public, anon, authenticated;
grant execute on function flemme_v2.recherches(text, jsonb) to authenticated;

-- Point d'entrée : mêmes aiguillages que 20261118140000, plus les recherches enregistrées.
create or replace function public.flemme_mobile_api(p_action text, p_task uuid default null, p_data jsonb default '{}', p_request uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform flemme_v2.flag_guard(p_action);
  return case when p_action = 'search' then flemme_v2.search(p_data)
    when p_action in ('searches', 'search_save', 'search_delete') then flemme_v2.recherches(p_action, p_data)
    when p_action = 'subscriptions' then flemme_v2.abonnements(p_action, p_data)
    when p_action in ('agreement_save', 'pay') then flemme_v2.reglement(p_action, p_task, p_data, p_request)
    when p_action in ('apply', 'apply_edit', 'offer', 'message', 'ask', 'answer', 'deliver', 'complete')
      then flemme_v2.confiance(p_action, p_task, p_data, p_request)
    when p_action in ('profile_get', 'profile_save', 'agreement_submit', 'agreement_sign', 'review')
      then flemme_v2.accord(p_action, p_task, p_data, p_request)
    when p_action in ('file_prepare', 'file_list', 'file_delete', 'help_send', 'help_list') then flemme_v2.aide(p_action, p_task, p_data, p_request)
    else flemme_v2.execute(p_action, p_task, p_data, p_request) end;
end $$;
