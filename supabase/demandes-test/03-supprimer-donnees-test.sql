-- Demandes de test. Étape 3 : suppression des données de test.
--
-- Supprime tout ce qui appartient aux comptes marqués raw_app_meta_data.compte_test = true :
-- demandes et tout ce qui y est rattaché (propositions, messages, événements, accords, avis,
-- fichiers, brouillons, demandes d'aide, alertes, litiges, paiements), puis leurs profils.
-- Ne touche à aucun autre compte : le script s'arrête si une demande de test a reçu une
-- proposition d'un compte réel.
--
-- Par défaut les comptes eux-mêmes (auth.users) sont CONSERVÉS, pour pouvoir relancer
-- 02-demandes-exemple.sql. Pour les supprimer aussi, passer supprimer_comptes à true
-- ci-dessous (le profil est alors supprimé avec le compte).
-- Les fichiers éventuellement envoyés dans le bucket flemme-fichiers ne sont pas effacés
-- du stockage : les supprimer depuis le tableau de bord Supabase (Storage).
--
-- PAR DÉFAUT CE SCRIPT S'ANNULE (ROLLBACK, dernière ligne) : il affiche ce qu'il ferait.
-- Pour l'appliquer vraiment, remplacer la dernière ligne « rollback; » par « commit; ».
begin;

create temporary table options_suppression on commit drop as select false as supprimer_comptes;

create temporary table comptes_test on commit drop as
select id, email from auth.users where raw_app_meta_data ->> 'compte_test' = 'true';

create temporary table taches_test on commit drop as
select id from flemme_v2.tasks where owner_id in (select id from comptes_test);

do $$
begin
  if exists (
    select 1 from flemme_v2.offers
    where task_id in (select id from taches_test)
      and brigadier_id is not null and brigadier_id not in (select id from comptes_test)
  ) then
    raise exception 'Une demande de test a une proposition d''un compte réel : vérifier avant de supprimer.';
  end if;
end $$;

select 'comptes' as quoi, count(*) from comptes_test
union all select 'demandes', count(*) from taches_test
union all select 'propositions', count(*) from flemme_v2.offers
  where task_id in (select id from taches_test) or brigadier_id in (select id from comptes_test);

update flemme_v2.tasks set accepted_offer_id = null, commission = null, commission_bps = null,
       commission_model = null, status = 'open', payment_declared = false, payment_confirmed = false
where id in (select id from taches_test) and accepted_offer_id is not null;

delete from flemme_v2.messages where offer_id in (
  select id from flemme_v2.offers where task_id in (select id from taches_test) or brigadier_id in (select id from comptes_test))
  or author_id in (select id from comptes_test);
delete from flemme_v2.events     where task_id in (select id from taches_test) or actor_id in (select id from comptes_test);
delete from flemme_v2.alerts     where task_id in (select id from taches_test);
delete from flemme_v2.disputes   where task_id in (select id from taches_test);
delete from flemme_v2.agreements where task_id in (select id from taches_test);
delete from flemme_v2.reviews    where task_id in (select id from taches_test)
  or author_id in (select id from comptes_test) or target_id in (select id from comptes_test);
delete from flemme_v2.payments   where task_id in (select id from taches_test) or payer_id in (select id from comptes_test);
delete from flemme_v2.files      where task_id in (select id from taches_test) or owner_id in (select id from comptes_test);
delete from flemme_v2.drafts     where task_id in (select id from taches_test) or owner_id in (select id from comptes_test);
delete from flemme_v2.help_requests where task_id in (select id from taches_test) or user_id in (select id from comptes_test);
delete from flemme_v2.offers     where task_id in (select id from taches_test) or brigadier_id in (select id from comptes_test);
delete from flemme_v2.tasks      where id in (select id from taches_test);
delete from flemme_v2.requests   where actor_id in (select id from comptes_test);
delete from flemme_v2.brigadier_accounts where user_id in (select id from comptes_test);

delete from flemme_v2.profiles where user_id in (select id from comptes_test)
  and (select supprimer_comptes from options_suppression);
delete from auth.users where id in (select id from comptes_test)
  and (select supprimer_comptes from options_suppression);

select c.email,
       (select count(*) from flemme_v2.tasks t where t.owner_id = c.id) as demandes_restantes,
       exists (select 1 from auth.users u where u.id = c.id) as compte_conserve
from comptes_test c;

rollback;
