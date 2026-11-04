-- FLEMME V2 : recherche « Résoudre une flemme » (lot 2 du parcours complet).
-- S'applique après 20261104120000_flemme_v2_parcours.sql. Additif : nouvelles fonctions, et public.flemme_mobile_api
-- aiguille l'action « search » vers elles ; flemme_v2.execute n'est pas modifiée.
-- Mots clés, filtres et tri sont faits ici, pour que la pagination reste juste.

-- p_data = { q?, category?, mode?, place?, budget?: moins_50|50_200|plus_200|a_discuter, deadline?, sort?: recent|deadline|budget,
--            limit?: 1..100, cursor?: rang de départ (texte) }. Pagination par rang : le tri peut ne pas être chronologique.
create function flemme_v2.deadline_rank(d text)
returns integer language sql immutable set search_path = '' as $$
  select coalesce(array_position(array['urgent', 'aujourdhui', 'demain', '3_jours', '1_semaine', '1_mois', '1_an', 'autre'], d), 9);
$$;
-- Budget comparable en centimes : montant libre, sinon milieu de la fourchette (plus de 200 € : juste au-dessus).
create function flemme_v2.budget_value(budget integer, budget_range text)
returns integer language sql immutable set search_path = '' as $$
  select coalesce(budget, case budget_range when 'moins_10' then 500 when '10_50' then 3000 when '50_200' then 12500 when 'plus_200' then 20001 end);
$$;

create function flemme_v2.search_tasks(uid uuid, p_data jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  f_q text := lower(flemme_v2.optional_text(p_data->'q', 100)); f_place text := lower(flemme_v2.optional_text(p_data->'place', 100));
  f_category text := flemme_v2.choice(p_data->'category', array['administratif', 'maison', 'numerique', 'organisation', 'autre'], 'Catégorie');
  f_mode text := flemme_v2.choice(p_data->'mode', array['distance', 'sur_place', 'les_deux'], 'Lieu');
  f_deadline text := flemme_v2.choice(p_data->'deadline', array['urgent', 'aujourdhui', 'demain', '3_jours', '1_semaine', '1_mois', '1_an', 'autre'], 'Délai');
  f_budget text := flemme_v2.choice(p_data->'budget', array['moins_50', '50_200', 'plus_200', 'a_discuter'], 'Budget');
  f_sort text := coalesce(flemme_v2.choice(p_data->'sort', array['recent', 'deadline', 'budget'], 'Tri'), 'recent');
  page_size integer := 20; start integer := 0; ids uuid[]; total integer; result jsonb;
begin
  if p_data->'limit' is not null and p_data->'limit' <> 'null'::jsonb then
    page_size := flemme_v2.amount(p_data->'limit');
    if page_size > 100 then raise exception 'Taille de page invalide'; end if;
  end if;
  if p_data->'cursor' is not null and p_data->'cursor' <> 'null'::jsonb then
    if coalesce(p_data->>'cursor', '') !~ '^[0-9]{1,6}$' then raise exception 'Curseur invalide'; end if;
    start := (p_data->>'cursor')::integer;
  end if;
  with found as (
    select v.id, v.created_at, flemme_v2.deadline_rank(v.deadline) as rank, flemme_v2.budget_value(v.budget, v.budget_range) as price
    from flemme_v2.tasks v
    where v.status = 'open' and v.review = 'published' and v.owner_id <> uid
      and (f_q is null or position(f_q in lower(v.title || ' ' || v.details || ' ' || v.place || ' ' || coalesce(v.category, ''))) > 0)
      and (f_category is null or v.category = f_category)
      -- « Sur place » trouve aussi « Les deux » ; « À distance » aussi.
      and (f_mode is null or v.work_mode = f_mode or v.work_mode = 'les_deux' or (f_mode = 'distance' and v.work_mode is null and v.place = 'À distance'))
      and (f_place is null or position(f_place in lower(v.place)) > 0)
      and (f_deadline is null or v.deadline = f_deadline)
      and (f_budget is null
        or (f_budget = 'a_discuter' and v.budget is null and v.budget_range is null)
        or (f_budget = 'moins_50' and (v.budget < 5000 or v.budget_range in ('moins_10', '10_50')))
        or (f_budget = '50_200' and (v.budget between 5000 and 20000 or v.budget_range = '50_200'))
        or (f_budget = 'plus_200' and (v.budget > 20000 or v.budget_range = 'plus_200')))
  ), ordered as (
    select f.id, row_number() over (order by
      case when f_sort = 'deadline' then f.rank end, case when f_sort = 'budget' then coalesce(f.price, 2147483647) end,
      f.created_at desc, f.id desc) as n, count(*) over () as total
    from found f
  )
  select array_agg(o.id order by o.n) filter (where o.n > start and o.n <= start + page_size), max(o.total) into ids, total from ordered o;
  ids := coalesce(ids, '{}');
  select coalesce(jsonb_agg(flemme_v2.task_json(i.id, uid) order by i.n), '[]'::jsonb) into result
  from unnest(ids) with ordinality as i(id, n);
  return jsonb_build_object('tasks', result, 'total', coalesce(total, 0),
    'nextCursor', case when start + page_size < coalesce(total, 0) then (start + page_size)::text end);
end $$;

-- Point d'entrée de la recherche : mêmes contrôles d'accès que flemme_v2.execute.
create function flemme_v2.search(p_data jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) or
    not exists(select 1 from auth.users where id = uid and email_confirmed_at is not null) then
    raise exception 'Connexion avec un compte confirmé requise' using errcode = '42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Données invalides'; end if;
  return flemme_v2.search_tasks(uid, p_data);
end $$;

revoke all on function flemme_v2.deadline_rank(text), flemme_v2.budget_value(integer, text),
  flemme_v2.search_tasks(uuid, jsonb), flemme_v2.search(jsonb) from public, anon, authenticated;
grant execute on function flemme_v2.search(jsonb) to authenticated;

create or replace function public.flemme_mobile_api(p_action text, p_task uuid default null, p_data jsonb default '{}', p_request uuid default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select case when p_action = 'search' then flemme_v2.search(p_data)
    else flemme_v2.execute(p_action, p_task, p_data, p_request) end;
$$;
