# flemme.org-web-app

Nouvelle base de FLEMME. Il y a deux applications : un site web et une app mobile. Elles partagent les mêmes règles métier : deux actions (« Mes flemmes », « Résoudre une flemme »), des Brigadiers qui proposent un forfait, et une commission FLEMME de 10 % ajoutée au forfait accepté.

Le site historique flemme.org reste dans le dépôt [FlemmeV2.0](https://github.com/benchamply-cmyk/FlemmeV2.0). Ce dépôt-ci repart sur une base propre, avec seulement ce qui sert à la nouvelle version.

## Contenu

| Dossier | Contenu | Publié sur |
|---|---|---|
| `apps/web` | Site Vite + React : vitrine (`index.html`) et parcours de l'app dans le navigateur (`app.html`) | https://flemme-web-app.netlify.app |
| `apps/mobile` | App Expo SDK 58 (iOS, Android, Expo Go). `src/` contient les règles métier partagées avec le site | Expo Go (pas encore sur les stores) |
| `apps/mobile/backend` | Schéma Supabase (`install.sql`, RPC `flemme_mobile_api`) et ses tests | Supabase (à installer à la main) |
| `docs/` | Organisation Git et historique du dépôt FlemmeV2.0 | — |
| `netlify.toml` | Configuration du projet Netlify `flemme-web-app` | — |
| `.github/workflows/` | CI : `web.yml` (typecheck, tests, build) et `mobile.yml` (typecheck, tests, export iOS/Android, tests backend) | — |

Le site n'a pas sa propre copie des règles métier. Il importe `apps/mobile/src/domain.ts` et `apps/mobile/src/gateway.ts`, donc une correction faite d'un côté vaut pour les deux.

## Lancer en local

Il faut Node 22.13 ou plus récent (voir `.nvmrc`).

    cd apps/web && npm ci && npm run dev        # http://localhost:5173
    cd apps/mobile && npm ci && npx expo start  # Expo Go

Sans variables d'environnement, les deux applications tournent en démonstration locale avec des données fictives. Pour le mode connecté, voir `apps/web/README.md` et `apps/mobile/README.md` : seules des clés Supabase publiques sont utilisées, jamais `service_role` ni `sb_secret`.

## Publication Netlify

Le projet Netlify `flemme-web-app` doit être relié à ce dépôt. Toute la configuration vient de `netlify.toml` : base `apps/web`, commande `npm run build`, dossier `dist`, Node 22 et en-tête `noindex` tant que c'est une version de test. Netlify publie `main` en production, et la branche `beta` sur sa propre adresse de branche.

## Travailler sur ce dépôt

Voir [docs/organisation-git.md](docs/organisation-git.md). En bref : on crée des branches courtes `type/sujet` depuis `beta`, les PR vont vers `beta`, et on passe en production par une PR `beta` → `main` en merge commit. Seul Ben fusionne.

## Historique

[docs/historique-flemmev2.md](docs/historique-flemmev2.md) explique les branches et les 59 PR du dépôt FlemmeV2.0, d'où vient ce code.
