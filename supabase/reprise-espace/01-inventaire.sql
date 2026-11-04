-- Reprise des comptes de l'ancien /espace (FlemmeV2.0) dans la V2.
-- Étape 1 : inventaire. LECTURE SEULE, ne renvoie que des nombres (aucune donnée personnelle).
-- À coller dans Supabase (projet yktpabnqkhwcshvjuncs) > SQL Editor > Run.
--
-- Rappel : l'ancien espace et la V2 utilisent le même projet Supabase, donc les mêmes
-- comptes (auth.users). Un compte existant peut se connecter à la V2 s'il remplit deux
-- conditions : adresse confirmée, et mot de passe défini (la V2 ne propose que
-- e-mail + mot de passe, alors que l'ancien espace acceptait aussi le lien magique, Google et Apple).
with u as (
  select id, email_confirmed_at is not null as confirme,
         coalesce(encrypted_password, '') like '$2%' as a_mot_de_passe
  from auth.users
), actives as (
  select d.id, d.user_id, d.email from public.demandes d
  where d.statut in ('recue', 'en_etude', 'acceptee', 'en_cours')
), rattachees as (
  select distinct on (a.id) a.id, x.id as owner_id, x.email_confirmed_at is not null as confirme
  from actives a
  join auth.users x on x.id = a.user_id or (a.user_id is null and lower(x.email) = lower(a.email))
  order by a.id, (x.id = a.user_id) desc
)
select indicateur, valeur from (values
  (1,  'comptes_total',                                 (select count(*) from u)),
  (2,  'comptes_confirmes',                             (select count(*) from u where confirme)),
  (3,  'comptes_non_confirmes (ne peuvent pas se connecter à la V2)', (select count(*) from u where not confirme)),
  (4,  'comptes_prets_pour_la_v2 (confirmés + mot de passe)',         (select count(*) from u where confirme and a_mot_de_passe)),
  (5,  'comptes_confirmes_sans_mot_de_passe (réinitialisation nécessaire)', (select count(*) from u where confirme and not a_mot_de_passe)),
  (6,  'comptes_avec_pseudo',                           (select count(*) from public.profils)),
  (7,  'comptes_equipe',                                (select count(*) from public.equipe)),
  (8,  'demandes_total',                                (select count(*) from public.demandes)),
  (9,  'demandes_actives (recue, en_etude, acceptee, en_cours)', (select count(*) from actives)),
  (10, 'demandes_actives_rattachables (compte confirmé)', (select count(*) from rattachees where confirme)),
  (11, 'demandes_actives_sans_compte_confirme',         (select count(*) from actives) - (select count(*) from rattachees where confirme))
) t(ordre, indicateur, valeur)
order by ordre;
