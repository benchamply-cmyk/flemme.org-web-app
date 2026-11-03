# Historique des versions — flemme.org-web-app

Chaque PR ajoute une ligne sous « À venir ». À chaque mise en production (`preprod` → `prod`), ces lignes passent dans une section datée et versionnée.

## À venir
- Backend Supabase durci : tables `profiles`, `tasks`, `offers`, `messages`, `events` (schéma `flemme_v2`) à la place du document JSONB, nom affiché décidé par le serveur et modifiable dans « Mon compte », reprise des comptes existants et des pseudos de l'ancien espace, liste paginée (« Voir plus »), migrations gérées par la CLI Supabase dans `supabase/` et testées en CI. Rien n'est appliqué automatiquement sur la base de production.
- Mode réel avec Supabase (projet yktpabnqkhwcshvjuncs) : build bloqué si `VITE_SUPABASE_*` est incomplet ou secret, « Mot de passe oublié ? » et retour des liens e-mail en PKCE pour reprendre les comptes de l'ancien espace, erreurs d'authentification en français, correction de l'appel réseau qui échouait dans le navigateur (« Illegal invocation »), guide `docs/supabase-mise-en-service.md` (après application des migrations `flemme_v2`) avec `supabase/verification.sql`. Rien n'est installé ni réglé automatiquement.
- Référencement : `robots.txt`, `sitemap.xml` (accueil et pages légales) et page 404 en français pour les adresses introuvables (branche chore/seo-robots-404).
- flemme.org (projet Netlify flemmeorg) publie désormais ce dépôt : en-tête noindex retiré, pages Mentions légales et Confidentialité ajoutées (reprises de FlemmeV2.0, stockage adapté au nouveau site), anciennes adresses (/espace, /manager, /rejoindre, /gestionadmin, /services, /demarche, /ambassadeurs) redirigées (branche fix/flemme-org-prod).
- Import initial depuis FlemmeV2.0 (branche feature/import-initial) : `apps/web` (PR #56 de FlemmeV2.0) et `apps/mobile` (PR #49 à #51), dans l'état de `beta` au 3 nov. 2026. S’y ajoutent `netlify.toml`, la CI web et mobile, la documentation Git et l'historique des branches et PR de FlemmeV2.0.
