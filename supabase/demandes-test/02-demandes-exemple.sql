-- Demandes de test. Étape 2 : demandes d'exemple pour le compte test.flemmard@example.com.
--
-- Insère 10 demandes, toutes préfixées « [TEST] », qui couvrent les familles du catalogue
-- (démarches, SAV, annonces, logement, voyage, recherche), les catégories, délais, budgets
-- (montant fixe, fourchette ou prix à proposer) et les états de modération :
--   published          visible dans « Flemmes à résoudre » par les Brigadiers connectés
--   pending            à valider dans /admin
--   changes_requested  renvoyée au déposant avec une note
-- Ajoute aussi une proposition validée de test.brigadier@example.com sur l'annonce du canapé,
-- pour tester le choix d'une proposition puis l'accord.
--
-- Montants en centimes, comme dans l'application (budget 2500 = 25 €).
--
-- Insertion directe : aucune ligne flemme_v2.events, donc AUCUNE alerte e-mail et pas
-- d'événement « création » dans l'historique. Pour tester les alertes, créer une demande
-- depuis le site avec le compte test.
--
-- Prérequis : 01-comptes-test.sql (les deux comptes existent).
-- Sans risque à relancer : une demande dont le titre existe déjà pour ce compte est ignorée.
-- Suppression : 03-supprimer-donnees-test.sql.
--
-- PAR DÉFAUT CE SCRIPT S'ANNULE (ROLLBACK, dernière ligne) : il affiche ce qu'il ferait.
-- Pour l'appliquer vraiment, remplacer la dernière ligne « rollback; » par « commit; ».
begin;

do $$
begin
  if not exists (select 1 from auth.users where email = 'test.flemmard@example.com')
     or not exists (select 1 from auth.users where email = 'test.brigadier@example.com') then
    raise exception 'Comptes test absents : lancer d''abord 01-comptes-test.sql.';
  end if;
end $$;

create temporary table demandes_test (
  title text primary key, details text, place text, budget int, budget_range text,
  category text, deadline text, deadline_note text, work_mode text, review text, review_note text
) on commit drop;

insert into demandes_test values
  ('[TEST] Rédiger une annonce Leboncoin pour un canapé',
   'Demande de test : rédiger l''annonce et choisir les photos d''un canapé 3 places à vendre.',
   'Lyon', 2500, null, 'numerique', '3_jours', null, 'distance', 'published', null),
  ('[TEST] Résilier un abonnement de box internet',
   'Demande de test : envoyer la lettre de résiliation et suivre la confirmation.',
   'Paris', null, '10_50', 'administratif', '1_semaine', null, 'distance', 'published', null),
  ('[TEST] Trouver un créneau de contrôle technique',
   'Demande de test : comparer 3 centres et réserver le moins cher la semaine prochaine.',
   'Marseille', null, 'moins_10', 'organisation', '1_semaine', null, 'distance', 'pending', null),
  ('[TEST] Contester une facture d''électricité',
   'Demande de test : la dernière facture est deux fois plus élevée que d''habitude. Rédiger la réclamation et suivre la réponse du fournisseur.',
   'Toulouse', 2900, null, 'administratif', '1_semaine', null, 'distance', 'published', null),
  ('[TEST] Obtenir le remboursement d''un colis jamais livré',
   'Demande de test : commande en ligne de 60 € marquée livrée mais jamais reçue. Contacter le service client et obtenir le remboursement.',
   'Nantes', 1900, null, 'numerique', '3_jours', null, 'distance', 'published', null),
  ('[TEST] Préparer le dossier de location d''un appartement',
   'Demande de test : rassembler les pièces, compléter le dossier en ligne et rédiger un mot de présentation pour le propriétaire.',
   'Bordeaux', 4500, null, 'administratif', 'demain', null, 'distance', 'published', null),
  ('[TEST] Organiser un week-end à Lisbonne pour deux',
   'Demande de test : vols depuis Paris et hôtel pour 2 nuits fin janvier, budget total 500 €. Proposer 2 options.',
   'Paris', null, '50_200', 'organisation', 'autre', 'avant le 15 décembre', 'distance', 'published', null),
  ('[TEST] Comparer trois mutuelles santé',
   'Demande de test : comparer les garanties optique et dentaire de trois mutuelles pour une personne seule et résumer en un tableau.',
   'Lille', 3900, null, 'organisation', '1_mois', null, 'distance', 'pending', null),
  ('[TEST] Monter une étagère murale',
   'Demande de test : fixer une étagère de 1 m sur un mur en placo, chevilles fournies.',
   'Rennes', null, '10_50', 'maison', 'aujourdhui', null, 'sur_place', 'changes_requested',
   'Merci de préciser le quartier et le créneau horaire souhaité.'),
  ('[TEST] Faire une demande de passeport',
   'Demande de test : prendre rendez-vous en mairie, remplir la pré-demande en ligne et acheter le timbre fiscal.',
   'Strasbourg', null, null, 'administratif', 'urgent', null, 'les_deux', 'published', null);

create temporary table demandes_ajoutees on commit drop as
with flemmard as (select id from auth.users where email = 'test.flemmard@example.com')
select d.* from demandes_test d
where not exists (
  select 1 from flemme_v2.tasks t, flemmard f where t.owner_id = f.id and t.title = d.title
);

insert into flemme_v2.tasks (owner_id, title, details, place, budget, budget_range, category,
                             deadline, deadline_note, work_mode, review, review_note)
select (select id from auth.users where email = 'test.flemmard@example.com'),
       title, details, place, budget, budget_range, category, deadline, deadline_note, work_mode, review, review_note
from demandes_ajoutees;

insert into flemme_v2.offers (task_id, brigadier_id, amount, slot, scope, result, review)
select t.id, b.id, 2500, 'Demain soir', 'Rédaction de l''annonce, tri et recadrage de 6 photos, publication sur Leboncoin.',
       'Annonce en ligne avec 6 photos et un prix conseillé.', 'approved'
from flemme_v2.tasks t
join auth.users f on f.id = t.owner_id and f.email = 'test.flemmard@example.com'
cross join (select id from auth.users where email = 'test.brigadier@example.com') b
where t.title = '[TEST] Rédiger une annonce Leboncoin pour un canapé'
  and not exists (select 1 from flemme_v2.offers o where o.task_id = t.id and o.brigadier_id = b.id);

select (select count(*) from demandes_ajoutees) as demandes_ajoutees,
       t.title, t.review, t.status,
       (select count(*) from flemme_v2.offers o where o.task_id = t.id) as propositions
from flemme_v2.tasks t
join auth.users u on u.id = t.owner_id
where u.email = 'test.flemmard@example.com'
order by t.created_at;

rollback;
