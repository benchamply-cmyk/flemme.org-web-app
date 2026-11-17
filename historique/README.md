# Historique

Ce dossier garde, pour référence, le code des dépôts précédents. Il n'est ni construit, ni publié, ni testé : Netlify (`netlify.toml`, base `apps/web`), les contrôles GitHub (filtres de chemins) et Render (`apps/manager`) l'ignorent.

| Dossier | Origine | État importé |
|---|---|---|
| `flemmev2/` | dépôt `benchamply-cmyk/FlemmeV2.0`, branche `main` | commit `27b15ee` du 03/11/2026, avec tout son historique (fusion « ours » puis `read-tree`) |

Les autres branches et tags de FlemmeV2.0 sont conservés en tags `archive/flemmev2/…` dans ce dépôt. Les PR, releases et réglages restent lisibles dans FlemmeV2.0, archivé en lecture seule (jamais supprimé).

Pour réutiliser un morceau : le copier dans le code actif (`apps/`, `packages/`, `supabase/`) par une PR normale. Ne pas modifier ce dossier, sauf pour le retirer un jour par une PR dédiée.

Voir `git log -- historique/flemmev2` ou `git log refs/…` du commit de fusion pour l'historique, et `docs/organisation-git.md` (correspondance des versions).
