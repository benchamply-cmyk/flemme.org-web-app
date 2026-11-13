# Supabase de preprod (`flemme-preprod`)

Depuis le 12 nov. 2026, preprod et production n'utilisent plus la même base. Cette page décrit la configuration en place et comment la refaire si le projet de preprod devait être recréé. **Tout ce qui suit a été réglé à la main dans les tableaux de bord Supabase et Netlify** : le dépôt ne contient aucun secret et ne modifie rien automatiquement.

## Les deux projets

| | Production | Preprod |
|---|---|---|
| Projet Supabase | `yktpabnqkhwcshvjuncs` | `flemme-preprod` (`kklaqwmdphedomsimjim`), eu-central-1, organisation « Flemme » (offre gratuite) |
| Site qui l'utilise | https://flemme.org (contexte Netlify *Production*) | https://preprod--flemmeorg.netlify.app et les aperçus de PR (*Branch deploys*, *Deploy Previews*, *Local development*) |
| Migrations `flemme_v2` | les 8 de `supabase/migrations/` | les 8, mêmes versions que le dépôt |
| Admin `/admin` | Ben | Ben |
| Comptes test | `test.flemmard` / `test.brigadier` @example.com | les mêmes |

## Recréer la preprod, étape par étape

### 1. Projet et migrations

1. Supabase : nouveau projet dans l'organisation « Flemme », région Frankfurt (eu-central-1).
2. Appliquer les 8 fichiers de `supabase/migrations/` **dans l'ordre**, soit avec la CLI (`npx supabase link --project-ref <ref>` puis `npx supabase db push`, voir `supabase/README.md`), soit en les collant un par un dans l'éditeur SQL.
3. Si les migrations ont été passées par l'éditeur SQL ou par un connecteur, l'historique peut garder d'autres numéros de version (le 12/11, les deux premières avaient été enregistrées en `20261112073410` et `20261112073456`). Les réaligner sur le dépôt, sinon un futur `db push` les rejouerait :

       select version, name from supabase_migrations.schema_migrations order by version;
       -- versions attendues : 20261103120000, 20261103120100, 20261103130000, 20261103140000,
       --                      20261104120000, 20261104130000, 20261104140000, 20261104150000

4. Contrôle : `supabase/verification.sql` (requête 1 : tout à `true`).

### 2. Authentification

- Authentication > URL Configuration : *Site URL* `https://preprod--flemmeorg.netlify.app/app.html` ; *Redirect URLs* : celle-ci, `https://deploy-preview-*--flemmeorg.netlify.app/app.html` et `http://localhost:5173/app.html`.
- Providers > Email activé, « Confirm email » activé.
- **SMTP personnalisé (Resend)**, sinon Supabase n'envoie des e-mails qu'aux membres de l'organisation : Authentication > Emails > SMTP Settings, hôte `smtp.resend.com`, port 465, utilisateur `resend`, mot de passe = une clé API Resend **active**, expéditeur sur le domaine vérifié `flemme.org`. Une erreur `535` à l'envoi signifie un mauvais mot de passe (clé révoquée ou utilisateur autre que `resend`).

### 3. Compte admin

Ben s'inscrit sur https://preprod--flemmeorg.netlify.app/app.html, confirme son e-mail, puis dans l'éditeur SQL de `flemme-preprod` :

    insert into flemme_v2.admins(user_id) select id from auth.users where lower(email) = 'ben.champly@gmail.com';

### 4. Alertes e-mail

Voir `supabase/README-admin.md`. Pour la preprod, l'adresse et le secret lui sont propres :

    select vault.create_secret('https://preprod--flemmeorg.netlify.app/api/alerte', 'flemme_alerte_url');
    select vault.create_secret('<secret de preprod, différent de celui de production>', 'flemme_alerte_secret');

Le même secret va dans la variable Netlify `ALERTE_SECRET` des contextes *Branch deploys* et *Deploy Previews* (étape 5). Contrôle : créer une demande depuis le site avec un compte test, elle passe « en attente » et l'e-mail « Demande à valider » arrive.

### 5. Netlify (projet `flemmeorg`)

Site configuration > Environment variables. Chaque variable a **une valeur par contexte** :

| Variable | Production | Branch deploys, Deploy Previews (et Local development) |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://yktpabnqkhwcshvjuncs.supabase.co` | `https://kklaqwmdphedomsimjim.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | clé `sb_publishable_…` de la production | clé `sb_publishable_…` de `flemme-preprod` (Project Settings > API Keys) |
| `ALERTE_SECRET` (secret) | valeur du Vault de production | valeur du Vault de `flemme-preprod` |

Les deux variables `VITE_SUPABASE_*` doivent être remplies ensemble dans chaque contexte, sinon le build échoue (garde-fou de `vite.config.ts`). Jamais de clé `sb_secret_…` ni `service_role`.

**Redéployer** : ces valeurs sont lues au build. Le bouton *Trigger deploy* ne relance que la production ; pour la preprod, ouvrir le dernier déploiement de la branche `preprod` et faire *Retry deploy*.

### 6. Comptes et demandes de test

Scripts de `supabase/demandes-test/` (voir son README), dans l'éditeur SQL de `flemme-preprod` :

1. `01-comptes-test.sql` avec des mots de passe choisis (jamais commités), puis `commit;` ;
2. `02-demandes-exemple.sql`, puis `commit;` ;
3. `04-verifier.sql` pour contrôler (lecture seule).

Montants en base en **centimes**.

## Recette rapide

- Le pied de page de https://preprod--flemmeorg.netlify.app/app.html n'affiche pas « Démo locale ».
- Connexion avec `test.brigadier@example.com` : « Flemmes à résoudre » montre les 7 demandes `[TEST]` publiées.
- Connexion avec `test.flemmard@example.com` : ses 10 demandes, avec la proposition sur l'annonce du canapé.
- Une nouvelle demande déposée depuis le site déclenche l'alerte « Demande à valider ».
- https://flemme.org continue de lire la production : aucune demande `[TEST]` de preprod n'y apparaît.

## Limites

- Offre gratuite : la protection contre les mots de passe fuités n'est pas disponible ; le projet peut être mis en pause après une semaine sans activité (le relancer depuis le tableau de bord).
- Le Flemme Manager (Render, `docs/manager-render.md`) lit toujours la production : rien n'est branché sur `flemme-preprod`.
- L'app mobile choisit sa base par `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` : mettre les valeurs de preprod pour un build de test.
