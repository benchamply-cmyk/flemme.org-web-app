-- Demandes de test. Étape 4 : vérification (lecture seule, ne modifie rien).
--
-- À lancer dans l'éditeur SQL du projet voulu (flemme-preprod ou production) pour savoir
-- où en sont les données de test. Ne lit que les comptes marqués
-- raw_app_meta_data.compte_test = true et ce qui leur est rattaché.
--
-- Résultat attendu après 01 + 02 (état de flemme-preprod au 12 nov. 2026) :
--   2 comptes test, e-mail confirmé, chacun avec un profil flemme_v2 ;
--   10 demandes « [TEST] » : 7 published, 2 pending, 1 changes_requested ;
--   1 proposition de test.brigadier sur l'annonce du canapé (2500 = 25 €, approved).
-- Montants en CENTIMES : budget 2500 = 25 €.

-- 1. Volume total de la base (preprod : quelques comptes ; production : bien plus).
--    Le projet interrogé est celui choisi en haut du tableau de bord Supabase.
select (select count(*) from flemme_v2.tasks) as demandes_toutes,
       (select count(*) from auth.users) as comptes_tous;

-- 2. Comptes test.
select u.email, u.email_confirmed_at is not null as confirme, p.user_id is not null as profil
from auth.users u
left join flemme_v2.profiles p on p.user_id = u.id
where u.raw_app_meta_data ->> 'compte_test' = 'true'
order by u.email;

-- 3. Demandes test par état de modération.
select t.review, count(*) as demandes, min(t.budget) as budget_min_centimes, max(t.budget) as budget_max_centimes
from flemme_v2.tasks t
join auth.users u on u.id = t.owner_id and u.raw_app_meta_data ->> 'compte_test' = 'true'
group by t.review
order by t.review;

-- 4. Propositions faites sur les demandes test (le Brigadier doit être un compte test).
select t.title, o.amount as montant_centimes, o.review,
       coalesce(b.raw_app_meta_data ->> 'compte_test', 'false') = 'true' as brigadier_test
from flemme_v2.offers o
join flemme_v2.tasks t on t.id = o.task_id
join auth.users u on u.id = t.owner_id and u.raw_app_meta_data ->> 'compte_test' = 'true'
left join auth.users b on b.id = o.brigadier_id
order by t.title;
