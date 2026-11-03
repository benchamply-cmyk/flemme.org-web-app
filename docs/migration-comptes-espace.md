# Reprise des comptes de l'ancien /espace

Décision de Ben (03/11/2026) : les comptes de l'ancien espace client de FlemmeV2.0 sont repris dans la V2, sur le même projet Supabase `yktpabnqkhwcshvjuncs`.

## Ce qu'il y a vraiment à migrer

L'ancien espace et la V2 utilisent le **même projet Supabase**, donc les mêmes comptes (`auth.users`). Il n'y a pas de comptes à copier : un compte existant peut se connecter à la V2 dès que deux conditions sont réunies.

| Condition V2 | Cas de l'ancien espace | Que faire |
|---|---|---|
| Adresse e-mail confirmée | Inscription jamais confirmée | Rien : la personne se réinscrit. |
| Mot de passe défini | Connexion par lien magique, Google ou Apple uniquement | La personne doit choisir un mot de passe (voir prérequis ci-dessous). |

Le reste de l'ancien espace n'a pas d'équivalent V2 et **reste en place sans modification** : demandes (`public.demandes`), discussions (`public.messages`), pièces jointes, pseudo (`public.profils`, la V2 affiche le début de l'e-mail), équipe (`public.equipe`).

Les demandes encore actives peuvent, en option, devenir des flemmes V2 (script 03).

## Les scripts (`apps/mobile/backend/reprise-espace/`)

Tous se lancent dans Supabase → *SQL Editor*. Ils sont testés sur PGlite par `apps/mobile/backend/reprise-espace.test.mjs` (lancé par la CI mobile).

| Script | Écrit ? | Rôle |
|---|---|---|
| `01-inventaire.sql` | Non | Nombres seulement : comptes prêts pour la V2, comptes sans mot de passe, demandes actives, etc. |
| `02-a-contacter.sql` | Non | Liste des comptes confirmés avec l'action à faire (affiche des e-mails : ne pas exporter). |
| `03-reprise-demandes.sql` | Oui, **s'annule par défaut** | Transforme chaque demande active d'un compte confirmé en flemme V2 ouverte. Relançable sans doublon. |

## Procédure

À faire par Ben. Aucune de ces étapes n'a été lancée sur la base réelle.

1. **Inventaire.** Lancer `01-inventaire.sql` et noter les nombres.
2. **Installer le backend V2** si ce n'est pas fait : `apps/mobile/backend/install.sql` (additif, ne touche à aucune table existante).
3. **Prérequis mot de passe.** Si l'inventaire montre des comptes confirmés sans mot de passe : la V2 n'a pas encore d'écran « mot de passe oublié ». Il faut l'ajouter à `apps/web` et `apps/mobile` (lien de récupération Supabase + page qui enregistre le nouveau mot de passe), et ajouter son adresse dans Supabase → *Authentication* → *URL Configuration* → *Redirect URLs*. Attention : `/espace*` est redirigé vers `/app.html#mine`, ce qui ferait perdre le jeton des liens de récupération envoyés par l'ancien modèle d'e-mail.
4. **Prévenir les personnes.** Lancer `02-a-contacter.sql` et envoyer un message d'information : nouvelle adresse (flemme.org/app.html), action à faire, et, si l'étape 5 est retenue, le fait que leurs demandes actives deviennent visibles par les Brigadiers.
5. **(Option) Reprendre les demandes actives.** Lancer `03-reprise-demandes.sql` tel quel : il affiche combien de demandes il reprendrait puis annule tout. Si c'est bon, remplacer la dernière ligne `rollback;` par `commit;` et relancer. Chaque flemme reprise porte la référence d'origine (`legacyRef`, ex. FL-7KQ2M) et une ligne d'historique. Lieu « À préciser », budget vide.
6. **Vérifier.** Se connecter à la V2 avec un compte de test ancien : la liste « Mes flemmes » doit afficher ses demandes reprises.

## Points d'attention

- **Confidentialité.** Une flemme V2 ouverte est visible par tous les Brigadiers connectés, alors que les demandes de l'ancien espace n'étaient vues que par l'équipe. D'où l'étape 4 avant l'étape 5. Si ce n'est pas acceptable, ne pas lancer le script 03 : les demandes restent dans `public.demandes`.
- **Suppression de compte.** `flemme_mobile_v1.tasks.owner_id` référence `auth.users` sans suppression en cascade. Après reprise, supprimer un compte (bouton RGPD de l'ancien espace ou tableau de bord Supabase) échouera tant que ses flemmes existent. Il faudra une fonction de suppression V2.
- **Retour arrière du script 03** (si appliqué) :

      with r as (
        delete from flemme_mobile_v1.reprise_espace r using flemme_mobile_v1.tasks t
        where t.id = r.task_id and t.document->'offers' = '[]'::jsonb
        returning r.task_id)
      delete from flemme_mobile_v1.tasks where id in (select task_id from r);

  Il ne retire que les flemmes reprises qui n'ont reçu aucune proposition.
