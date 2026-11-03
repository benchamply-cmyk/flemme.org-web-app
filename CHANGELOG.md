# Historique des versions — flemme.org-web-app

Chaque PR ajoute une ligne sous « À venir ». À chaque mise en production (`preprod` → `prod`), ces lignes passent dans une section datée et versionnée.

## À venir
- Flemme Manager repris de FlemmeV2.0 dans `apps/manager` (code, SQL Supabase, tests et CI `manager.yml`), avec la procédure pour rebrancher le service Render sur ce dépôt (`docs/manager-render.md`). Scripts de reprise des comptes de l'ancien /espace (`apps/mobile/backend/reprise-espace/`, testés) et procédure (`docs/migration-comptes-espace.md`). Rien n'est encore appliqué sur Render ni sur Supabase.
- flemme.org (projet Netlify flemmeorg) publie désormais ce dépôt : en-tête noindex retiré, pages Mentions légales et Confidentialité ajoutées (reprises de FlemmeV2.0, stockage adapté au nouveau site), anciennes adresses (/espace, /manager, /rejoindre, /gestionadmin, /services, /demarche, /ambassadeurs) redirigées (branche fix/flemme-org-prod).
- Import initial depuis FlemmeV2.0 (branche feature/import-initial) : `apps/web` (PR #56 de FlemmeV2.0) et `apps/mobile` (PR #49 à #51), dans l'état de `beta` au 3 nov. 2026. S’y ajoutent `netlify.toml`, la CI web et mobile, la documentation Git et l'historique des branches et PR de FlemmeV2.0.
