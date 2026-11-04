-- FLEMME V2 : modèle relationnel (remplace le document JSONB de apps/mobile/backend/install.sql).
-- Additif : crée le schéma privé flemme_v2 et un déclencheur sur auth.users.
-- Ne modifie ni ne supprime aucun objet existant (public.profils, public.messages, fm_v*, Manager...).
-- Appliquer avec la CLI Supabase (`supabase db push`), voir supabase/README.md.

create schema flemme_v2;
revoke all on schema flemme_v2 from public, anon, authenticated;

-- Profils : le nom affiché est décidé côté serveur, plus par le client.
create table flemme_v2.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null
    check (char_length(display_name) between 1 and 40 and display_name = btrim(display_name)),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

-- Flemmes. Un compte supprimé emporte ses flemmes (RGPD) ; ailleurs, l'auteur passe à « Compte supprimé ».
create table flemme_v2.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references flemme_v2.profiles(user_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  details text not null check (char_length(details) between 1 and 1000),
  place text not null check (char_length(place) between 1 and 100),
  budget integer check (budget between 1 and 1000000),
  status text not null default 'open' check (status in ('open', 'assigned', 'completed')),
  accepted_offer_id uuid,
  commission integer check (commission >= 0),
  payment_declared boolean not null default false,
  payment_confirmed boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint tasks_agreement check ((status = 'open') = (accepted_offer_id is null) and (accepted_offer_id is null) = (commission is null)),
  constraint tasks_payment check ((not payment_declared or status = 'completed') and (not payment_confirmed or payment_declared))
);
create index tasks_open_page on flemme_v2.tasks (created_at desc, id desc) where status = 'open';
create index tasks_owner_page on flemme_v2.tasks (owner_id, created_at desc, id desc);

-- Propositions des Brigadiers (montants en centimes).
create table flemme_v2.offers (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references flemme_v2.tasks(id) on delete cascade,
  brigadier_id uuid references flemme_v2.profiles(user_id) on delete set null,
  amount integer not null check (amount between 1 and 1000000),
  slot text not null check (char_length(slot) between 1 and 100),
  scope text not null check (char_length(scope) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'not_selected')),
  created_at timestamptz not null default clock_timestamp(),
  unique (id, task_id)
);
create index offers_task on flemme_v2.offers (task_id, created_at, id);
create index offers_brigadier on flemme_v2.offers (brigadier_id, task_id);
-- Une seule proposition en attente par Brigadier et par flemme, une seule acceptée par flemme.
create unique index offers_one_pending on flemme_v2.offers (task_id, brigadier_id) where status = 'pending';
create unique index offers_one_accepted on flemme_v2.offers (task_id) where status = 'accepted';
-- L'offre retenue appartient forcément à la même flemme.
alter table flemme_v2.tasks add constraint tasks_accepted_offer
  foreign key (accepted_offer_id, id) references flemme_v2.offers (id, task_id);

-- Discussion privée entre le déposant et un Brigadier, rattachée à une proposition.
create table flemme_v2.messages (
  id bigint generated always as identity primary key,
  offer_id uuid not null references flemme_v2.offers(id) on delete cascade,
  author_id uuid references flemme_v2.profiles(user_id) on delete set null,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default clock_timestamp()
);
create index messages_offer on flemme_v2.messages (offer_id, id);

-- Historique conservé (ajout seul). Les signalements sont des événements « report » avec un texte.
create table flemme_v2.events (
  id bigint generated always as identity primary key,
  task_id uuid not null references flemme_v2.tasks(id) on delete cascade,
  actor_id uuid references flemme_v2.profiles(user_id) on delete set null,
  kind text not null check (kind in ('create', 'offer', 'message', 'accept', 'decline', 'complete', 'declare_payment', 'confirm_payment', 'report')),
  label text not null,
  body text check (body is null or char_length(body) between 1 and 1000),
  created_at timestamptz not null default clock_timestamp()
);
create index events_task on flemme_v2.events (task_id, id);
create index events_reports on flemme_v2.events (task_id, id) where kind = 'report';

-- Idempotence : une action rejouée avec le même identifiant renvoie le même résultat.
create table flemme_v2.requests (
  actor_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  action text not null,
  task_id uuid,
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (actor_id, request_id)
);

-- RLS activée partout, aucune politique ni aucun droit direct : seul flemme_v2.execute lit et écrit.
alter table flemme_v2.profiles enable row level security;
alter table flemme_v2.tasks enable row level security;
alter table flemme_v2.offers enable row level security;
alter table flemme_v2.messages enable row level security;
alter table flemme_v2.events enable row level security;
alter table flemme_v2.requests enable row level security;
revoke all on all tables in schema flemme_v2 from public, anon, authenticated;
revoke all on all sequences in schema flemme_v2 from public, anon, authenticated;

-- Nom affiché par défaut : métadonnées d'inscription (display_name, puis pseudo de l'ancien espace),
-- sinon le début de l'e-mail, sinon « Membre ».
create function flemme_v2.default_display_name(meta jsonb, email text)
returns text language sql immutable set search_path = '' as $$
  select btrim(left(coalesce(
    nullif(btrim(meta->>'display_name'), ''),
    nullif(btrim(meta->>'pseudo'), ''),
    nullif(btrim(split_part(coalesce(email, ''), '@', 1)), ''),
    'Membre'), 40));
$$;

create function flemme_v2.profile_on_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into flemme_v2.profiles (user_id, display_name)
  values (new.id, flemme_v2.default_display_name(new.raw_user_meta_data, new.email))
  on conflict do nothing;
  return new;
end $$;
create trigger flemme_v2_profile_on_signup after insert on auth.users
  for each row execute function flemme_v2.profile_on_signup();

-- Reprise des comptes existants (dont ceux de l'ancien /espace) : un profil par compte.
insert into flemme_v2.profiles (user_id, display_name)
select u.id, flemme_v2.default_display_name(u.raw_user_meta_data, u.email) from auth.users u
on conflict do nothing;
-- Le pseudo choisi dans l'ancien espace client (public.profils) devient le nom affiché.
do $reprise$
begin
  if to_regclass('public.profils') is not null then
    execute $sql$
      update flemme_v2.profiles p set display_name = o.pseudo, updated_at = clock_timestamp()
      from public.profils o
      where o.user_id = p.user_id and char_length(btrim(o.pseudo)) between 1 and 40
    $sql$;
  end if;
end $reprise$;

revoke all on all functions in schema flemme_v2 from public, anon, authenticated;
