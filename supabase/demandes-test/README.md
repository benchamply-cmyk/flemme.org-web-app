# Demandes de test

Jeu de données pour simuler des demandes sur le site sans toucher aux vrais comptes.
Preprod et prod utilisent la même base Supabase : ces données arrivent donc en production.
Elles sont toutes rattachées à des comptes marqués `raw_app_meta_data.compte_test = true`
et leurs titres commencent par `[TEST]`.

| Fichier | Rôle |
| --- | --- |
| `01-comptes-test.sql` | Crée `test.flemmard@example.com` (déposant) et `test.brigadier@example.com` (Brigadier), e-mail déjà confirmé. Mots de passe à choisir dans le script, jamais commités. |
| `02-demandes-exemple.sql` | Ajoute 10 demandes `[TEST]` au compte Flemmard (publiées, en attente, à corriger) et une proposition validée du Brigadier sur l'annonce du canapé. |
| `03-supprimer-donnees-test.sql` | Supprime toutes les données des comptes test ; garde les comptes, sauf si `supprimer_comptes` passe à `true`. |

## Utilisation

1. Ouvrir l'éditeur SQL de Supabase et coller le script.
2. Le lancer tel quel : il se termine par `rollback;` et affiche seulement ce qu'il ferait.
3. Si le résultat convient, remplacer la dernière ligne `rollback;` par `commit;` et relancer.

Les scripts peuvent être relancés sans risque : ce qui existe déjà est ignoré.

## À savoir

- Les demandes insérées par le script n'envoient **aucune alerte e-mail** et n'ont pas
  d'événement « création » dans leur historique. Pour tester les alertes, créer une demande
  depuis le site avec le compte test : la modération étant active, elle passe « en attente »
  et l'équipe reçoit « Demande à valider ».
- Les adresses `@example.com` ne reçoivent pas de courrier : « mot de passe oublié » et les
  mails d'inscription ne peuvent pas être testés avec ces comptes.
- Pour retrouver les comptes : `select id, email from auth.users where raw_app_meta_data ->> 'compte_test' = 'true';`
