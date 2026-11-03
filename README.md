# flemme.org-web-app

Nouvelle base de FLEMME. Il y a deux applications, un site web et une app mobile, et un dossier de code commun (`packages/shared`). Elles partagent les mêmes règles métier : deux actions (« Mes flemmes », « Résoudre une flemme »), des Brigadiers qui proposent un forfait, et une commission FLEMME de 10 % ajoutée au forfait accepté.

Le site historique flemme.org reste dans le dépôt [FlemmeV2.0](https://github.com/benchamply-cmyk/FlemmeV2.0). Ce dépôt-ci repart sur une base propre, avec seulement ce qui sert à la nouvelle version.

## Contenu

| Dossier | Contenu | Publié sur |
|---|---|---|
| `apps/web` | Site Vite + React : vitrine (`index.html`) et parcours de l'app dans le navigateur (`app.html`) | https://flemme.org |
| `apps/mobile` | App Expo SDK 58 (iOS, Android, Expo Go) | Expo Go (pas encore sur les stores) |
| `packages/shared` | Code commun aux deux apps : règles métier, accès aux données (démo et Supabase), état de l'app, droits et textes. Sans React ni dépendance | — |
| `apps/mobile/backend` | Schéma Supabase (`install.sql`, RPC `flemme_mobile_api`) et ses tests | Supabase (à installer à la main) |
| `docs/` | Organisation Git et historique du dépôt FlemmeV2.0 | — |
| `netlify.toml` | Configuration du projet Netlify `flemmeorg` (flemme.org) | — |
| `.github/workflows/` | CI : `web.yml` (typecheck, tests, build) et `mobile.yml` (typecheck, tests, export iOS/Android, tests backend). Les deux se lancent aussi quand `packages/shared` change | — |

Une seule source pour la logique : le site et l'app importent `packages/shared`, donc une correction faite à cet endroit vaut pour les deux. Chaque app ne garde que son affichage (`App.tsx`, qui choisit l'écran, et un fichier par écran dans `src/ecrans/`), son stockage local et sa navigation. Voir [packages/shared/README.md](packages/shared/README.md).

## Lancer en local

Il faut Node 22.13 ou plus récent (voir `.nvmrc`).

    cd apps/web && npm ci && npm run dev        # http://localhost:5173
    cd apps/mobile && npm ci && npx expo start  # Expo Go

Sans variables d'environnement, les deux applications tournent en démonstration locale avec des données fictives. Pour le mode connecté, voir `apps/web/README.md` et `apps/mobile/README.md` : seules des clés Supabase publiques sont utilisées, jamais `service_role` ni `sb_secret`.

## Publication Netlify

Le projet Netlify `flemmeorg` (domaine flemme.org, avec ses variables d’environnement) est relié à ce dépôt depuis le 03/11/2026, à la place de FlemmeV2.0. Toute la configuration de build vient de `netlify.toml` : base `apps/web`, commande `npm run build`, dossier `dist`, Node 22, et redirection des anciennes adresses. Netlify publie `prod` sur flemme.org et `preprod` sur son adresse de branche. L’ancien projet de test `flemme-web-app` n’est plus nécessaire.

## Travailler sur ce dépôt

Voir [docs/organisation-git.md](docs/organisation-git.md). En bref : on crée des branches courtes `type/sujet` depuis `preprod`, les PR vont vers `preprod`, et on passe en production par une PR `preprod` → `prod` en merge commit. Seul Ben fusionne.

## Historique

[docs/historique-flemmev2.md](docs/historique-flemmev2.md) explique les branches et les 59 PR du dépôt FlemmeV2.0, d'où vient ce code.
