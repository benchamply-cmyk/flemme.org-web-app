# Historique du dépôt FlemmeV2.0

Ce document décrit [benchamply-cmyk/FlemmeV2.0](https://github.com/benchamply-cmyk/FlemmeV2.0) dans son état au 3 novembre 2026. Ce dépôt-ci en reprend `apps/web` et `apps/mobile`, tout le reste y est resté.

## Ce que contient FlemmeV2.0

| Dossier | Contenu | Repris ici ? |
|---|---|---|
| `flemme-web-beta/` | Site historique flemme.org (HTML/CSS/JS, Netlify Forms, `/espace`, `/gestionadmin`, Decap CMS) | Non, il reste en production depuis FlemmeV2.0 |
| `flemme-managerV1/` | Flemme Manager : agents IA, API sur Render (`flemme-manager-v2-api`) | Non |
| `supabase/` | Schémas SQL de l'espace client et du Manager | Non |
| `apps/mobile/` | App Expo SDK 58 et backend Supabase | **Oui** |
| `apps/web/` | Nouveau site Vite + React aligné sur l'app | **Oui** |
| `apercu/`, `flemme-web-V2.2/`, fichiers V2.0 à la racine | Outils d'aperçu et anciennes versions | Non (obsolètes) |

## Branches (3 novembre 2026)

| Branche | Rôle | État |
|---|---|---|
| `main` | Production de flemme.org (Netlify `flemmeorg`) | Dernière fusion : #53, le 28/10 |
| `beta` | Intégration, branche par défaut | Contient en plus `apps/web` (#56) |
| `feature/candidature-brigade` | PR #54 : candidature Brigade limitée à 4 métiers | Ouverte, prête à fusionner |
| `docs/changelog-v5` | PR #58 : nettoyage du CHANGELOG | Ouverte |
| `feature/apps-web-netlify` | PR #59 : site Netlify de test pour `apps/web` dans FlemmeV2.0 | Ouverte, remplacée par ce dépôt-ci |
| `archive/v4.1100` | Variante V4.1100 « Métal intense » (#30, #32) | Figée |
| `archive/pr34-illustrations` | Illustrations animées (#34, jamais fusionnée) | Figée |
| `archive/sauvegarde-v3-2026-10-20` | Sauvegarde complète de la V3 (#26) | Figée |

Tags : `v4.1000` (V4, 20/10) et `V.5.1000` (mise en production de la V5, 21/10).

## Les PR, par période

### 1. Les premières versions du site (1er au 5 octobre)
Toutes ces PR vont vers `main`.
- **#1 `V2.1`, #2 `V2.2`** : versions V2.1 et V2.2 du site, ajoutées par upload.
- **#3 `claude/project-thread-65r4iw`** : V2.3, la bêta publique.
- **#4** : report de #3 dans la branche `V2.3.beta`.
- **#5** : Netlify publie la bêta depuis le dépôt, avec le style de la refonte.
- **#6 à #8 `claude/project-thread-e0e5b8`** : espace personnel. Inscription par e-mail, suivi des demandes, connexion par mot de passe, pseudo facultatif et e-mails en français.
- **#9** : page équipe et alertes e-mail sur les demandes clients.

### 2. Contenu, Brigade et premiers agents IA (8 au 14 octobre)
Ces PR vont aussi vers `main`.
- **#10** : accueil construit autour de 7 résultats concrets, formulaire de demande enrichi.
- **#11 `brigade-anti-flemme`** : page de recrutement de la Brigade (`rejoindre.html`).
- **#13** : assistant IA qui guide la création d'une demande.
- **#14** : centre de contrôle privé `/gestionadmin`.
- **#15** : chatbot de qualification, fermée sans fusion.
- **#16, #17** : Flemme Manager V1 (la même PR, fusionnée deux fois).
- **#18** : spécialistes branchés sur des sources fournies au Manager Netlify.
- **#19 à #21** : Manager V1.1. Stabilisation, validation sur 10 appels réels, correctif F04.
- **#22, #23** : Manager V2. Mémoire Supabase, missions, serveur Render et espace conversations.
- **#24** : Manager V3, avec quatre spécialistes exécutants et des livrables persistants.
- **#25** : recherche web réelle et comparaison documentaire avec citations.

### 3. La journée du 20 octobre (V4)
De nombreuses PR, souvent en cascade : c'est elle qui a conduit à créer `beta`.
- **#26 `StableVersion/…`** : sauvegarde de la V3, fusionnée malgré la mention « NE PAS FUSIONNER ». Elle est conservée dans `archive/sauvegarde-v3-2026-10-20`.
- **#27, #28 `BetaVersion/V4.1000-…`** : V4, avec un menu qui sépare les services disponibles des services à venir.
- **#29 (fermée), #30** : variantes UI/UX V4.1100.
- **#31** : fond bleu métal. **#32** : son alternative « Métal intense ». **#33** : doublon de #32, fermée.
- **#34** : illustrations animées, jamais fusionnée. Conservée dans `archive/pr34-illustrations`.
- **#35** : version PR #28 indépendante (textes et typo « Affiche condensée »), fusionnée dans `main`. Tag `v4.1000`.
- **#36** : PR d'archive, fermée.

### 4. V5 et organisation main/beta (21 octobre)
- **#37 `feature/design-v5`** → `beta` : design V5. Menus déroulants, pages dédiées, recherche, bleu glacier.
- **#38** `beta` → `main` : mise en production de la V5. Tag `V.5.1000`.
- **#39 `feat/admin-agent-routing-…`** → `main` directement : plans d'agents validés par les administrateurs.
- **#40 `feature/manager-espace-v5`** → `beta` : refonte V5 de Mon espace et de Mes conversations. **#41** la met en production.
- **#42 `feature/espace-admin-separes`** → `beta` : séparation de `/espace` (client) et `/gestionadmin` (admin). **#43** la met en production.
- **#44 `fix/accroche-accueil`** → `beta` : nouvelle accroche, vert espoir, fond Glacier profond. **#46** la met en production.
- **#45 `feature/espace-ecrire-manager`** → `beta` : le client écrit à Flemme Manager depuis `/espace`. **#47** la met en production.

### 5. Manager unifié et app mobile (26 au 28 octobre)
- **#48 `feat/unified-flemme-manager-…`** → `main` directement : Manager, outils internes et API unifiés.
- **#49 `feature/flemme-mobile`** → `beta` : app mobile. Délégation, Brigadiers, commission de 10 %. **Repris ici dans `apps/mobile`.**
- **#50 `fix/mobile-expo-go-sdk58`** → `beta` : compatibilité Expo Go SDK 58. **Repris ici.**
- **#51 `feature/mobile-accueil-deux-actions`** → `beta` : accueil à deux actions, identité Glacier, logo. **Repris ici.**
- **#52** `main` → `beta` : report de #48 dans `beta`.
- **#53** `beta` → `main` en squash : réunit les deux branches côté contenu, mais sépare leurs historiques.

### 6. Nouveau site web (2 au 3 novembre)
- **#54 `feature/candidature-brigade`** → `beta` : Brigade limitée à 4 métiers, profils de démonstration, personas. Ouverte. Elle concerne le site historique.
- **#55 `feature/flemme-web`** : brouillon de #56, fermé.
- **#56 `feature/flemmeV3-web-app`** → `beta` : nouveau site `apps/web`. **Repris ici.**
- **#57** `main` → `beta` en merge commit : réaligne les historiques. Ouverte.
- **#58 `docs/changelog-v5`** : rangement du CHANGELOG. Ouverte.
- **#59 `feature/apps-web-netlify`** : site Netlify de test pour `apps/web` dans FlemmeV2.0. Ouverte, rendue inutile par ce dépôt.

Le numéro #12 n’est pas une PR : c’est l’issue « Réorganisation — Références et suivi du domaine ».

## Incohérences relevées dans FlemmeV2.0

Elles ont servi à fixer les règles de [organisation-git.md](organisation-git.md).

1. `main` et `beta` ont le même contenu, mais des historiques séparés à cause des squash de #48 et #53 (corrigé par #57).
2. Des PR directes vers `main` : #39 et #48.
3. La section « À venir » du CHANGELOG n'a pas été mise à jour entre le 21/10 et le 3/11 (corrigé par #58).
4. Des noms de branche hors convention : `claude/…`, `feat/…` avec une date, `BetaVersion/…/20/10/2016`, `StableVersion/…`, et des branches sans préfixe (`V2.1`, `brigade-anti-flemme`).
5. Des tags incohérents : `v4.1000` et `V.5.1000`.
