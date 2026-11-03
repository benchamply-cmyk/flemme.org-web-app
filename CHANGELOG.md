# Historique des versions — flemme.org-web-app

Chaque PR ajoute une ligne sous « À venir ». À chaque mise en production (`preprod` → `prod`), ces lignes passent dans une section datée et versionnée.

## À venir
- Mentions légales : numéro de portable retiré, champs à compléter laissés vides au lieu des repères surlignés (branche fix/mentions-legales-vides).
- Référencement : `robots.txt`, `sitemap.xml` (accueil et pages légales) et page 404 en français pour les adresses introuvables (branche chore/seo-robots-404).
- flemme.org (projet Netlify flemmeorg) publie désormais ce dépôt : en-tête noindex retiré, pages Mentions légales et Confidentialité ajoutées (reprises de FlemmeV2.0, stockage adapté au nouveau site), anciennes adresses (/espace, /manager, /rejoindre, /gestionadmin, /services, /demarche, /ambassadeurs) redirigées (branche fix/flemme-org-prod).
- Import initial depuis FlemmeV2.0 (branche feature/import-initial) : `apps/web` (PR #56 de FlemmeV2.0) et `apps/mobile` (PR #49 à #51), dans l'état de `beta` au 3 nov. 2026. S’y ajoutent `netlify.toml`, la CI web et mobile, la documentation Git et l'historique des branches et PR de FlemmeV2.0.
