# Base de données Supabase (CLI)

Le schéma de FLEMME V2 est géré par la [CLI Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started) : chaque changement est une migration datée dans `migrations/`, appliquée dans l'ordre et tracée par Supabase. Plus de script à coller dans l'éditeur SQL.

| Fichier | Contenu |
|---|---|
| `config.toml` | Configuration de la pile locale (`supabase start`) |
| `migrations/20261103120000_flemme_v2_tables.sql` | Schéma privé `flemme_v2` : `profiles`, `tasks`, `offers`, `messages`, `events`, `requests`, RLS sans droit direct, profil créé à l'inscription, reprise des comptes existants |
| `migrations/20261103120100_flemme_v2_api.sql` | Point d'entrée unique `public.flemme_mobile_api` (actions, pagination, profil) |
| `tests/api.test.mjs` | Tests des migrations sur PostgreSQL embarqué (PGlite) |

## Modèle

- **profiles** : un profil par compte (`auth.users`). Le nom affiché vient du serveur ; le client ne l'envoie plus. Il est rempli à l'inscription (métadonnée `display_name`, sinon `pseudo`, sinon début de l'e-mail) et modifiable avec l'action `update_profile`.
- **tasks** : une ligne par flemme. Statut `open` → `assigned` → `completed`, offre retenue, commission figée à l'accord, paiements déclarés/confirmés. Des contraintes empêchent les états incohérents.
- **offers** : propositions des Brigadiers, en centimes. Une seule en attente par Brigadier et par flemme, une seule acceptée par flemme (index uniques).
- **messages** : discussion privée rattachée à une proposition.
- **events** : historique en ajout seul ; les signalements sont des événements `report` avec leur texte.
- **requests** : idempotence des actions (un identifiant rejoué renvoie le même résultat).

Suppression d'un compte : ses profils et flemmes sont supprimés ; ses propositions, messages et événements sur les flemmes des autres restent, signés « Compte supprimé ».

Reprise des comptes : la migration crée un profil pour chaque compte existant. Si la table `public.profils` de l'ancien espace client existe, le pseudo choisi devient le nom affiché. Rien n'est modifié dans les tables existantes.

## API

Un seul appel : `POST /rest/v1/rpc/flemme_mobile_api` avec `{ p_action, p_task, p_data, p_request }`, réservé aux comptes connectés et confirmés.

| Action | `p_data` | Réponse |
|---|---|---|
| `me` | `{}` | `{ profile: { id, name } }` |
| `update_profile` | `{ displayName }` (1 à 40 caractères) | `{ profile }` |
| `list` | `{ limit?: 1..100 (20 par défaut), cursor?: string }` | `{ tasks, nextCursor }` ; `nextCursor` vaut `null` sur la dernière page |
| `create`, `offer`, `message`, `accept`, `decline`, `complete`, `declare_payment`, `confirm_payment`, `report` | comme avant | `{ task }` ; `p_request` obligatoire |

La forme d'une flemme est le type `Task` de `apps/mobile/src/domain.ts`. Le tri de `list` est stable (date de création puis identifiant) et le curseur est opaque : le renvoyer tel quel.

## Travailler en local

    npx supabase start            # Docker requis : Postgres + Auth + API en local
    npx supabase db reset         # rejoue toutes les migrations
    npx supabase migration new nom_du_changement

Tests sans Docker :

    cd supabase/tests && npm ci && npm test

Ils lancent toutes les migrations sur PGlite avec un schéma `auth` simulé. Ils ne remplacent pas un essai sur un vrai projet Supabase.

## Appliquer sur un projet distant

**Ne rien appliquer sur la production (`yktpabnqkhwcshvjuncs`) sans l'accord explicite de Ben.** Essayer d'abord sur un projet de test ou une branche Supabase.

    npx supabase login
    npx supabase link --project-ref <ref-du-projet>
    npx supabase db push --dry-run   # liste ce qui serait appliqué, sans rien changer
    npx supabase db push

Points à vérifier avant la production :

1. **Historique de migrations existant.** Le projet de production contient déjà une migration appliquée par la CLI depuis FlemmeV2.0 (`20261014010810_manager_acquisition_v4`). Si `db push` refuse en signalant des versions distantes absentes en local, récupérer l'historique avec `npx supabase migration fetch`, relire et committer les fichiers obtenus, puis relancer `--dry-run`.
2. **Nom déjà pris.** La migration échoue (et n'applique rien) si `flemme_v2` ou `public.flemme_mobile_api` existe déjà. Vérifier dans l'éditeur SQL : `select to_regnamespace('flemme_v2'), to_regprocedure('public.flemme_mobile_api(text,uuid,jsonb,uuid)');` doit renvoyer deux `null`.
3. **Data API.** Laisser `flemme_v2` hors des schémas exposés ; seul `public` doit l'être, pour la RPC.
4. **Auth.** Connexion e-mail/mot de passe avec confirmation d'e-mail activée, et adresses du site dans les URL de redirection autorisées.
