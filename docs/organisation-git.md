# Organisation Git et versions

Modèle validé par Ben le 17 novembre 2026. Il remplace les règles précédentes (branches `beta`, numéros `v6.xxxx`, tags `beta-*`). Document de référence complet : « Flemme — nouveau modèle de gestion du code et des versions » (Claude Doc du projet).

En bref : deux branches permanentes, un numéro de version à chaque mise en production, des tags d'archive à la place des branches de sauvegarde, et des feature flags pour livrer sans attendre.

## Branches

| Branche | Rôle | Déploiement Netlify (projet `flemmeorg`) |
|---|---|---|
| `prod` | Production, ce qui est en ligne | https://flemme.org |
| `preprod` | Intégration, branche par défaut : toutes les PR y sont fusionnées avant la production | https://preprod--flemmeorg.netlify.app |
| `type/sujet` | Travail en cours, branche courte créée depuis `preprod`, supprimée après fusion | aperçu `deploy-preview-N--flemmeorg.netlify.app` |

- Préfixes : `feature/`, `fix/`, `docs/`, `chore/`, `mobile/`. Sujet court, en minuscules, avec des tirets, sans date ni `/`.
- Pas de branche `beta`, `V1`, `V2` ni de branche de sauvegarde. Une expérience passe par l'aperçu de sa PR ou derrière un flag en preprod.
- Une piste abandonnée ou mise de côté devient un tag `archive/<sujet>-<date>`, puis sa branche est supprimée (après le contrôle ci-dessous).
- Jamais de PR dont la source est `prod`, ni de PR directe vers `prod` depuis une autre branche que `preprod` (le contrôle `promotion` le refuse).

## Numéros de version

- Format `vMAJEUR.MINEUR.CORRECTIF`, en minuscules, sans zéros de remplissage : `v1.4.0`, `v1.4.1`, `v2.0.0`.
- MAJEUR : changement de modèle (v1 = Flemme V1, v2 = mise en relation ouverte). MINEUR : une fonctionnalité. CORRECTIF : une correction seule.
- Un seul numéro pour tout le dépôt (site, app, Manager, base). Les maquettes de design (« maquette 1 à 7 », « maquette PR55 ») ne sont pas des versions.

### Correspondance des anciennes versions (renumérotation du 17/11/2026)

| Ancien nom | Nouveau numéro | Commit |
|---|---|---|
| ZIP V1 à V2.3, FlemmeV2.0 `v4.1000`, `V.5.1000`, `v5.9000-archive` | avant la v1 : tags `archive/flemmev2/…` | dépôt FlemmeV2.0 |
| `v6.100` | `v1.0.0` | `6c5f029` |
| `v6.1000` | `v1.1.0` | `ee10777` |
| `v6.2000` | `v1.2.0` | `1214ab6` |
| v6.3000 (jamais taguée) | `v1.3.0` | `c199dfa` |
| prod #52 (jamais taguée) | `v1.4.0` | `28a2996` |
| promotion #86 : modèle hybride derrière le flag `modele.version`, feature flags, import de FlemmeV2.0 | `v1.5.0` | `07f84bc` (17/11/2026, candidate `v1.5.0-rc.1` sur `0e2a9cf`) |
| mise en relation ouverte | `v2.0.0` | à la promotion |

Les anciens tags `v6.*` et `V5.9000-archive` sont conservés comme anciens noms ; les nouveaux tags sont posés sur les mêmes commits.

## Tags

| Tag | Quand | Qui |
|---|---|---|
| `vX.Y.Z-rc.N` + pré-release GitHub | Au gel de `preprod` avant une promotion (`-rc.2` après une correction) | Ben pose le tag, Claude prépare les notes |
| `vX.Y.Z` + release GitHub « Latest » | À la fusion de la PR de promotion, sur le merge commit de `prod` | Ben |
| `archive/<sujet>-<date>` | Avant de supprimer une branche dont le travail n'est pas fusionné | Ben, d'après la liste de Claude |
| `build/<branche>-pr<N>-<sha>` | Automatique à chaque fusion dans `preprod` ou `prod` (workflow `beta-version.yml`), sans release | GitHub Actions |

Les tags `v*` et `archive/*` ne se suppriment ni ne se déplacent (ruleset des tags, `beta/github-ruleset-tags.json`). Les anciens tags `beta-*` restent en place.

Les releases sont **immuables** (option « Enable release immutability », choix de Ben du 17/11/2026) : une fois publiée, une release garde son tag et ses fichiers ; seuls le titre et le texte se modifient. On la prépare donc en brouillon, et une erreur de code publiée se corrige par une version corrective (`v1.5.1`), jamais en réécrivant la version. Les releases v6.100, v6.1000 et v6.2000 restent sur leurs tags v6, avec « (Now v1.x.0) » dans le titre.

## Cycle d'une modification

1. Créer `type/sujet` depuis `preprod`.
2. Ajouter une ligne sous « À venir » dans `CHANGELOG.md`, et poser une étiquette sur la PR : `nouveaute`, `correction`, `migration`, `docs` ou `promotion`.
3. Ouvrir une PR vers `preprod`, avec le modèle de PR. Les contrôles doivent être verts.
4. Ben relit et fusionne (« Create a merge commit »). Claude ouvre des PR mais ne fusionne que sur instruction explicite de Ben.
5. La branche courte est supprimée automatiquement après la fusion.

Aucun numéro, tag ni release à cette étape : seulement la ligne de CHANGELOG et l'étiquette.

## Mise en production

Rythme : une promotion à chaque fonctionnalité terminée et vérifiée en preprod. Une correction urgente part seule, en version corrective.

1. Gel de `preprod` : Claude choisit le numéro, transforme « À venir » en « vX.Y.Z (candidate) » par une PR `chore/version-x-y-z`, et rédige les notes. Ben pose `vX.Y.Z-rc.1` et publie la pré-release.
2. Migrations : appliquées sur `flemme-preprod`, vérifiées, puis sur la base de production juste avant la fusion.
3. PR `preprod` → `prod` intitulée « Promotion vX.Y.Z », avec la liste des PR embarquées et des migrations. Fusion en « Create a merge commit ».
4. Ben pose `vX.Y.Z` sur le merge commit de `prod` et publie la release avec « Generate release notes » (PR classées par `.github/release.yml`).
5. Vérifier flemme.org (si le déploiement de prod est verrouillé dans Netlify, « Start auto publishing » puis publier le dernier déploiement), relancer un Manual Deploy du Manager sur Render (auto-deploy désactivé), renommer le déploiement Netlify « vX.Y.Z », mettre à jour le registre des versions (Drive) et la section du CHANGELOG (date).

## Consulter ou republier une version

- Consulter : le tag (onglet Tags ou Releases, ZIP joint à chaque release), le déploiement Netlify de la version, ou le registre des versions.
- Urgence : dans Netlify, ancien déploiement de prod → « Publish deploy ». C'est temporaire : le prochain déploiement le remplace, il faut donc corriger ensuite par Git.
- Retour durable : branche `fix/retour-vX-Y-Z` créée depuis le tag, PR vers `preprod`, puis promotion. Une nouvelle version est publiée.
- Reprendre une piste archivée : branche `feature/<sujet>` créée depuis le tag `archive/…`, adaptée à `preprod`, derrière un flag si besoin.

La base Supabase ne revient pas en arrière avec le code : les migrations restent additives (on ajoute, on ne supprime ni ne renomme dans la même version). Avant de republier une ancienne version, vérifier dans le CHANGELOG qu'elle ne dépend pas d'une table ou colonne retirée depuis.

## Contrôle avant toute suppression

Avant de supprimer une branche, un tag ou un dépôt, Claude vérifie que le dernier commit de chaque branche est dans `preprod`, dans `prod`, dans une PR ou sous un tag, et donne la liste « conservé par … ». Ben ne supprime rien qui n'y figure pas. Les PR, elles, ne se suppriment jamais sur GitHub et gardent leurs commits.

## Feature flags

Une fonctionnalité non terminée peut être fusionnée dans `preprod` derrière un flag (états `off`, `testeurs`, `tous`). Le flag `modele.version` choisit entre le modèle `hybride` (preprod actuelle) et le modèle `ouvert` (v2). Deux semaines après le passage à « tous », une PR retire le flag et l'ancien code ; le tag `archive/…` garde l'ancien code. Voir `docs/feature-flags.md`.

## Réglages GitHub (Ben)

| Où | Réglage | Valeur |
|---|---|---|
| Settings › General | Méthodes de fusion | Merge commit seulement |
| Settings › General | Automatically delete head branches | Activé |
| Rules › Rulesets | Branches (`beta/github-ruleset.json`) | `prod`, `preprod` : PR obligatoire, 0 approbation, contrôle `promotion` requis, pas de suppression ni de force push |
| Rules › Rulesets | Tags (`beta/github-ruleset-tags.json`) | `v*`, `archive/*` : ni suppression ni modification |
| Issues › Labels | Étiquettes | `nouveaute`, `correction`, `migration`, `docs`, `promotion` |
| Settings › General › Releases | Enable release immutability | Activé |

Le ruleset des tags doit être créé comme **tag ruleset** (Rulesets › New ruleset › New tag ruleset, ou import de `beta/github-ruleset-tags.json`) : un ruleset de branche nommé « tags » ne protège aucun tag.

Seul `promotion` est requis par le ruleset, car il tourne sur toutes les PR. Il vérifie aussi, pour toute PR vers `preprod`, la présence d'une des cinq étiquettes et une modification de `CHANGELOG.md` (depuis le 17/11/2026). Dans le ruleset des branches, « Allowed merge methods » est réglé sur Merge seulement. Les contrôles `web`, `native`, `migrations` et `python` ne tournent que si leurs dossiers changent : rendus obligatoires, ils bloqueraient les PR qui ne touchent pas ces dossiers. Ils doivent tout de même être verts avant de fusionner.

## Leçons retenues

- Pas de squash entre `preprod` et `prod` (FlemmeV2.0 #48, #53 ; flemme.org #24).
- Pas de PR depuis `prod` : le 04/11/2026, #25 et #32 ont effacé `prod` par suppression automatique de la branche source. Pour réaligner `preprod`, passer par `chore/realigner-preprod`.
- Une PR par sujet ; pas de fusions en cascade.
- Pas de branche de sauvegarde : un tag `archive/…`.
