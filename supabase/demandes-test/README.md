# Demandes de test

Jeu de données pour simuler des demandes sur le site sans toucher aux vrais comptes.
Depuis le 12 nov. 2026, preprod et production ont chacune leur projet Supabase
(voir `docs/supabase-preprod.md`) : lancer les scripts dans le projet voulu. Les données sont toutes rattachées à des comptes marqués `raw_app_meta_data.compte_test = true`
et leurs titres commencent par `[TEST]`.

| Fichier | Rôle |
| --- | --- |
| `01-comptes-test.sql` | Crée `test.flemmard@example.com` (déposant) et `test.brigadier@example.com` (Brigadier), e-mail déjà confirmé. Mots de passe à choisir dans le script, jamais commités. |
| `02-demandes-exemple.sql` | Ajoute 10 demandes `[TEST]` au compte Flemmard (publiées, en attente, à corriger) et une proposition validée du Brigadier sur l'annonce du canapé. |
| `04-verifier.sql` | Lecture seule : comptes test, demandes par état de modération, propositions. Ne modifie rien. |
| `03-supprimer-donnees-test.sql` | Supprime toutes les données des comptes test ; garde les comptes, sauf si `supprimer_comptes` passe à `true`. |

## Utilisation

1. Ouvrir l'éditeur SQL de Supabase et coller le script.
2. Le lancer tel quel : il se termine par `rollback;` et affiche seulement ce qu'il ferait.
3. Si le résultat convient, remplacer la dernière ligne `rollback;` par `commit;` et relancer.

Les scripts peuvent être relancés sans risque : ce qui existe déjà est ignoré.

## État au 12 nov. 2026

| Projet | Comptes test | Demandes `[TEST]` |
| --- | --- | --- |
| `flemme-preprod` (`kklaqwmdphedomsimjim`) | les deux, e-mail confirmé, connexion vérifiée | 10 (7 publiées, 2 en attente, 1 à corriger) + 1 proposition validée, vérifié le 13 nov. avec `04-verifier.sql` |
| production (`yktpabnqkhwcshvjuncs`) | les deux, mêmes mots de passe qu'en preprod | 3 au 12 nov. (script 02 non appliqué en entier ; non revérifié depuis) |

Les mots de passe ont été donnés à Ben dans le fil du projet ; ils ne sont **jamais** dans Git.
Montants en base en **centimes** (`2500` = 25 €).

## À savoir

- Les demandes insérées par le script n'envoient **aucune alerte e-mail** et n'ont pas
  d'événement « création » dans leur historique. Pour tester les alertes, créer une demande
  depuis le site avec le compte test : la modération étant active, elle passe « en attente »
  et l'équipe reçoit « Demande à valider ».
- Les adresses `@example.com` ne reçoivent pas de courrier : « mot de passe oublié » et les
  mails d'inscription ne peuvent pas être testés avec ces comptes.
- Pour retrouver les comptes : `select id, email from auth.users where raw_app_meta_data ->> 'compte_test' = 'true';`
