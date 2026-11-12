# Organisation Git

Ces règles reprennent celles de FlemmeV2.0 (en place depuis le 20/10/2026) et corrigent ce qui y avait posé problème.

## Branches

| Branche | Rôle | Déploiement Netlify |
|---|---|---|
| `prod` | Production, ce qui est en ligne | https://flemme.org |
| `preprod` | Intégration : toutes les PR y sont fusionnées avant la production | adresse de branche `preprod--flemmeorg.netlify.app` |
| `type/sujet` | Travail en cours, branche courte créée depuis `preprod` | aperçu de PR |

Les préfixes autorisés sont `feature/`, `fix/`, `docs/`, `chore/` et `mobile/`. Le sujet est court, en minuscules, avec des tirets, sans date ni barre oblique : par exemple `feature/paiement-forfait` ou `fix/connexion-expo`.

## Cycle d'une modification

1. Créer `type/sujet` depuis `preprod`.
2. Ajouter une ligne sous « À venir » dans `CHANGELOG.md`.
3. Ouvrir une PR vers `preprod`. La CI doit être verte.
4. Ben relit et fusionne. Claude peut ouvrir des PR, mais ne fusionne jamais.
5. Mise en production : une PR `preprod` → `prod`, fusionnée avec **« Create a merge commit »**. Les lignes « À venir » passent alors dans une section versionnée du CHANGELOG, et Ben crée la release et le tag `vX.YYYY` sur GitHub.

## Leçons tirées de FlemmeV2.0

- **Pas de squash entre `preprod` et `prod`.** Sur FlemmeV2.0, les squash de #48 et #53 ont séparé les deux historiques alors que leur contenu était identique.
- **Pas de PR directe vers `prod`.** Sur FlemmeV2.0, #39 et #48 sont allées directement sur `main` et ont dû être reportées dans `beta` après coup.
- **Une PR par sujet.** Le 20/10, #29 à #35 ont été fusionnées en série, en cascade et entre elles, ce qui a rendu l'état du site illisible.
- **Pas de branche de sauvegarde.** Pour garder une version, on pose un tag, pas une branche `archive/…` ou `StableVersion/…`.
- **Des noms de branche simples.** Pas de `claude/project-thread-…`, pas de date, pas de `/` dans le sujet (`BetaVersion/V4.1000-coveredServices-20/10/2016`).
- **Tags homogènes :** `v5.1000` et pas `V.5.1000`.

## Incident du 04/11/2026 : branche `prod` supprimée

- 05:17 : PR #24 `preprod` → `prod` fusionnée en **squash** (contraire à la règle ci-dessus). flemme.org publie le commit `4c9bf8c`.
- 05:18-05:19 : pour réaligner, PR #25 ouverte **depuis `prod` vers `preprod`** puis fusionnée. La suppression automatique des branches fusionnées a alors effacé `prod`, qui était la branche source de la PR. Même risque avec #18 la veille.
- Rien n'est perdu : `prod` a été recréée sur son dernier commit `7b87ed6`, dont le contenu est identique à celui en ligne et à `preprod`.

À retenir :

- **Ne jamais ouvrir de PR dont la branche source est `prod` ou `preprod` vers une autre branche que `prod`.** Pour réaligner `preprod` sur `prod` après un incident, passer par une branche `chore/realigner-preprod`.
- La règle « pas de suppression » sur `prod` et `preprod` (ruleset ci-dessous) empêche ce cas, même avec la suppression automatique activée.

## Réglages GitHub à faire (Ben)

- ~~Renommer `main` en `prod` et créer `preprod`~~ (fait par Ben le 03/11/2026). Mettre `preprod` en branche par défaut, pour que les nouvelles PR la visent d'office.
- Netlify : Production branch = `prod`, et activer les déploiements de branche pour `preprod`.
- **Urgent (04/11)** : créer un ruleset sur `prod` et `preprod` : PR obligatoire, **pas de suppression** (Restrict deletions), pas de force push, CI `Site web (apps/web)` requise. Settings → Rules → Rulesets → New branch ruleset, cibles `prod` et `preprod`.
- Activer la suppression automatique des branches fusionnées.
- Dans « Pull requests », n'autoriser que les merge commits (désactiver squash et rebase). Pas encore fait : #24 a été squashée le 04/11.

## Laboratoire beta

Branche persistante issue de preprod, isolée des environnements réels. Flux obligatoire : beta → PR ciblées preprod → PR preprod vers prod. Aucune PR beta vers prod. Ne pas supprimer beta après fusion ; protéger cette branche. Voir [audit et configuration](beta.md).

Depuis la PR #46, la branche beta publie l’atelier visuel sur le site Netlify flemmeorg-beta ; les tests internes (comptes testeurs, invitations, PR #44 et #45) restent sur preprod. Répartition des PR et incohérences à corriger : [organisation des versions](organisation-versions.md).
## Tests de variantes (décision du 7 novembre 2026)

Le configurateur fait partie des branches preprod et prod ; aucun environnement permanent beta n’est nécessaire. Une branche courte feature/beta-testeurs remplace les PR #42/#43. Voir [configuration et invitations](beta-testeurs.md). Promotion : PR vers preprod, recette, puis PR preprod vers prod avec merge commit.
