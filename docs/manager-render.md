# Flemme Manager sur Render : rebrancher le service sur ce dépôt

Le Flemme Manager (agents IA, API FastAPI) fait partie de la V2 (décision de Ben, 03/11/2026). Son code est copié dans `apps/manager/` depuis FlemmeV2.0 (`flemme-managerV1/` et les SQL `supabase/manager-*.sql` et `supabase/migrations/`, état de `beta` et `main` au 03/11/2026, identiques sur ces dossiers). Les tests passent ici : 239 tests Python, tests SQL V2, V3, V4, admin et messages clients.

Le service Render, lui, se construit toujours depuis FlemmeV2.0. Cette page décrit comment le faire pointer sur ce dépôt. **Rien n'a été modifié sur Render** : c'est à Ben de le faire, après fusion de la PR et mise en production (`preprod` → `prod`).

## État actuel du service (lu le 03/11/2026)

| Réglage | Valeur actuelle |
|---|---|
| Service | `flemme-manager-v2-api` (`srv-db7c17q5b2lc73fbs6ng`), https://flemme-manager-v2-api.onrender.com |
| Dépôt / branche | `benchamply-cmyk/FlemmeV2.0`, `main` |
| Root Directory | vide |
| Build Command | `pip install uv && uv sync --project flemme-managerV1 --locked` |
| Start Command | `cd flemme-managerV1 && .venv/bin/uvicorn flemme_manager.main:app --host 0.0.0.0 --port $PORT` |
| Auto-deploy | désactivé |
| Health Check Path | vide |
| Offre / région | free, Frankfurt |

## Nouveaux réglages

Dans le [tableau de bord du service](https://dashboard.render.com/web/srv-db7c17q5b2lc73fbs6ng) → *Settings* :

| Réglage | Nouvelle valeur |
|---|---|
| Repository | `benchamply-cmyk/flemme.org-web-app` (l'app GitHub de Render doit avoir accès à ce dépôt) |
| Branch | `prod` |
| Root Directory | `apps/manager` |
| Build Command | `pip install uv && uv sync --locked` |
| Start Command | `.venv/bin/uvicorn flemme_manager.main:app --host 0.0.0.0 --port $PORT` |
| Build Filters → Included paths | `apps/manager/**` (évite un redéploiement à chaque changement du site) |
| Health Check Path | `/health` |
| Auto-deploy | laisser désactivé tant que le Manager n'est pas revalidé, puis *On Commit* |

Variables d'environnement (*Environment*) : on garde les valeurs actuelles (`OPENAI_API_KEY`, `FLEMME_V2_ENABLED`, `FLEMME_V2_SUPABASE_URL`, `FLEMME_V2_SUPABASE_PUBLISHABLE_KEY`, `FLEMME_V3_ENABLED`, `FLEMME_ACQUISITION_ENABLED`, budgets…), le projet Supabase reste `yktpabnqkhwcshvjuncs`. Une seule change :

    FLEMME_V2_ALLOWED_ORIGINS=https://flemme.org,https://preprod--flemmeorg.netlify.app

Le serveur refuse les origines qui ne sont pas des adresses HTTPS exactes (pas de `*`, pas de chemin). Ajouter `https://www.flemme.org` si le site y répond sans redirection.

## Étapes

1. Fusionner la PR, puis la mise en production `preprod` → `prod`.
2. Faire les réglages ci-dessus, puis *Manual Deploy* → *Deploy latest commit*.
3. Vérifier : `curl https://flemme-manager-v2-api.onrender.com/health` doit répondre 200. L'offre free met jusqu'à une minute à se réveiller.
4. Vérifier que le commit déployé (onglet *Events*) est bien celui de `prod` sur flemme.org-web-app.
5. Ensuite seulement : ouvrir sur FlemmeV2.0 la PR qui supprime `flemme-managerV1/` et les SQL du Manager, puis archiver ce dépôt (voir `docs/archivage-2026-11.md` sur FlemmeV2.0).

**Retour arrière** : remettre Repository = FlemmeV2.0, Branch = `main`, Root Directory vide et les deux commandes d'origine du tableau ci-dessus, puis redéployer.

## Ce qui reste à faire côté site

Le site V2 (`apps/web`) n'appelle pas encore le Manager : l'ancien `/espace` et `/gestionadmin` qui l'utilisaient sont redirigés vers l'app. Brancher le Manager dans l'interface V2 (écran client « écrire au Manager », écran admin) est un chantier à part.
