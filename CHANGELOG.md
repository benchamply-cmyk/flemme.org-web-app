# Historique des versions — flemme.org-web-app

Chaque PR ajoute une ligne sous « À venir ». À chaque mise en production (`preprod` → `prod`), ces lignes passent dans une section datée et versionnée.

## À venir
- Paiement (brouillon) : commission FLEMME configurable (modèle « ajout » à 10 % ou « prélèvement », taux figé dans chaque accord) et encaissement en ligne avec Stripe Connect (migration `flemme_v2_commission_paiement`, fonctions Edge dans `supabase/functions`), désactivé tant que `VITE_PAIEMENT_EN_LIGNE` n’est pas à « oui ». Voir `docs/paiement-stripe.md`.
- Backend Supabase durci : tables `profiles`, `tasks`, `offers`, `messages`, `events` (schéma `flemme_v2`) à la place du document JSONB, nom affiché décidé par le serveur et modifiable dans « Mon compte », reprise des comptes existants et des pseudos de l'ancien espace, liste paginée (« Voir plus »), migrations gérées par la CLI Supabase dans `supabase/` et testées en CI. Rien n'est appliqué automatiquement sur la base de production.
- Référencement : `robots.txt`, `sitemap.xml` (accueil et pages légales) et page 404 en français pour les adresses introuvables (branche chore/seo-robots-404).
- flemme.org (projet Netlify flemmeorg) publie désormais ce dépôt : en-tête noindex retiré, pages Mentions légales et Confidentialité ajoutées (reprises de FlemmeV2.0, stockage adapté au nouveau site), anciennes adresses (/espace, /manager, /rejoindre, /gestionadmin, /services, /demarche, /ambassadeurs) redirigées (branche fix/flemme-org-prod).
- Import initial depuis FlemmeV2.0 (branche feature/import-initial) : `apps/web` (PR #56 de FlemmeV2.0) et `apps/mobile` (PR #49 à #51), dans l'état de `beta` au 3 nov. 2026. S’y ajoutent `netlify.toml`, la CI web et mobile, la documentation Git et l'historique des branches et PR de FlemmeV2.0.
