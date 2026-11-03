# Organisation Git

Ces règles reprennent celles de FlemmeV2.0 (en place depuis le 20/10/2026) et corrigent ce qui y avait posé problème.

## Branches

| Branche | Rôle | Déploiement Netlify |
|---|---|---|
| `main` | Production, ce qui est en ligne | https://flemme-web-app.netlify.app |
| `beta` | Intégration, branche par défaut | adresse de branche `beta--flemme-web-app.netlify.app` |
| `type/sujet` | Travail en cours, branche courte créée depuis `beta` | aperçu de PR |

Les préfixes autorisés sont `feature/`, `fix/`, `docs/`, `chore/` et `mobile/`. Le sujet est court, en minuscules, avec des tirets, sans date ni barre oblique : par exemple `feature/paiement-forfait` ou `fix/connexion-expo`.

## Cycle d'une modification

1. Créer `type/sujet` depuis `beta`.
2. Ajouter une ligne sous « À venir » dans `CHANGELOG.md`.
3. Ouvrir une PR vers `beta`. La CI doit être verte.
4. Ben relit et fusionne. Claude peut ouvrir des PR, mais ne fusionne jamais.
5. Mise en production : une PR `beta` → `main`, fusionnée avec **« Create a merge commit »**. Les lignes « À venir » passent alors dans une section versionnée du CHANGELOG, et Ben crée la release et le tag `vX.YYYY` sur GitHub.

## Leçons tirées de FlemmeV2.0

- **Pas de squash entre `beta` et `main`.** Sur FlemmeV2.0, les squash de #48 et #53 ont séparé les deux historiques alors que leur contenu était identique.
- **Pas de PR directe vers `main`.** #39 et #48 l'ont fait et ont dû être reportées dans `beta` après coup.
- **Une PR par sujet.** Le 20/10, #29 à #35 ont été fusionnées en série, en cascade et entre elles, ce qui a rendu l'état du site illisible.
- **Pas de branche de sauvegarde.** Pour garder une version, on pose un tag, pas une branche `archive/…` ou `StableVersion/…`.
- **Des noms de branche simples.** Pas de `claude/project-thread-…`, pas de date, pas de `/` dans le sujet (`BetaVersion/V4.1000-coveredServices-20/10/2016`).
- **Tags homogènes :** `v5.1000` et pas `V.5.1000`.

## Réglages GitHub à faire (Ben)

- Créer la branche `beta` depuis `main` une fois l'import fusionné, puis la mettre en branche par défaut.
- Créer un ruleset sur `main` et `beta` : PR obligatoire, pas de suppression, pas de force push, CI `Site web (apps/web)` requise.
- Activer la suppression automatique des branches fusionnées.
- Dans « Pull requests », n'autoriser que les merge commits (désactiver squash et rebase).
