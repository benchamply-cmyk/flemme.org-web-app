-- Reprise des comptes de l'ancien /espace. Étape 3 (FACULTATIVE) : reprise des demandes actives.
--
-- Chaque demande encore active (recue, en_etude, acceptee, en_cours) d'un compte confirmé
-- devient une flemme V2 « ouverte » dont la personne est la déposante.
-- ATTENTION : une flemme ouverte est visible par tous les Brigadiers connectés. Ces demandes
-- avaient été confiées à l'équipe Flemme seule : ne lancer ce script qu'après avoir prévenu
-- les personnes concernées (liste : 02-a-contacter.sql).
--
-- Prérequis : apps/mobile/backend/install.sql déjà appliqué.
-- Sans risque à relancer : une demande déjà reprise est ignorée (table reprise_espace).
-- Ne modifie ni ne supprime rien dans public.demandes, public.messages ni auth.users.
--
-- PAR DÉFAUT CE SCRIPT S'ANNULE (ROLLBACK, dernière ligne) : il affiche ce qu'il ferait.
-- Pour l'appliquer vraiment, remplacer la dernière ligne « rollback; » par « commit; ».
begin;

create table if not exists flemme_mobile_v1.reprise_espace (
  demande_id  uuid primary key,
  demande_ref text not null,
  task_id     uuid not null unique references flemme_mobile_v1.tasks (id),
  repris_le   timestamptz not null default now()
);
alter table flemme_mobile_v1.reprise_espace enable row level security;
revoke all on flemme_mobile_v1.reprise_espace from public, anon, authenticated;

create temporary table reprise_lot on commit drop as
with candidates as (
  select distinct on (d.id)
         d.id as demande_id, d.ref, d.besoin, d.precisions, d.statut, d.created_at,
         u.id as owner_id, u.email
  from public.demandes d
  join auth.users u on u.id = d.user_id or (d.user_id is null and lower(u.email) = lower(d.email))
  where d.statut in ('recue', 'en_etude', 'acceptee', 'en_cours')
    and u.email_confirmed_at is not null
    and not exists (select 1 from flemme_mobile_v1.reprise_espace r where r.demande_id = d.id)
  order by d.id, (u.id = d.user_id) desc
)
select c.*, gen_random_uuid() as task_id,
       to_char(c.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as at,
       nullif(regexp_replace(btrim(c.besoin), '\s+', ' ', 'g'), '') as besoin_net
from candidates c;

insert into flemme_mobile_v1.tasks (id, owner_id, document, created_at)
select l.task_id, l.owner_id, jsonb_build_object(
    'id', l.task_id,
    'owner', jsonb_build_object('id', l.owner_id, 'name', left(split_part(coalesce(l.email, 'Membre'), '@', 1), 40)),
    'title', left(coalesce(l.besoin_net, 'Demande ' || l.ref), 100),
    'details', left(coalesce(l.besoin_net, 'Demande ' || l.ref)
                    || coalesce(E'\n\n' || nullif(btrim(l.precisions), ''), ''), 1000),
    'place', 'À préciser',
    'budget', null,
    'status', 'open',
    'createdAt', l.at,
    'offers', '[]'::jsonb,
    'reports', '[]'::jsonb,
    'legacyRef', l.ref,
    'history', jsonb_build_array(jsonb_build_object(
      'text', 'Reprise de la demande ' || l.ref || ' de l''ancien espace flemme.org (statut : ' || l.statut || ')',
      'at', l.at))),
  l.created_at
from reprise_lot l;

insert into flemme_mobile_v1.reprise_espace (demande_id, demande_ref, task_id)
select demande_id, ref, task_id from reprise_lot;

-- Ce que le script a fait (ou ferait) :
select (select count(*) from reprise_lot) as demandes_reprises_maintenant,
       (select count(*) from flemme_mobile_v1.reprise_espace) as demandes_reprises_au_total;

rollback;
