# Feature flags FLEMME

Proposition validée par Ben le 16/11/2026 (première version sur l'ancienne branche beta, PR #81), reprise depuis preprod le 17/11/2026 dans le nouveau modèle Git (`docs/organisation-git.md`).

## Principe

- **Registre** : `packages/shared/src/flags.ts`. Liste officielle des flags (clé `domaine.fonction`, libellé, type, valeur par défaut par environnement). Ajouter un flag = une ligne, dans une PR.
- **Interrupteur** : table `flemme_v2.feature_flags` (migration `20261116120000_flemme_v2_feature_flags.sql`), une ligne par flag et par environnement (`beta`, `preprod`, `prod`, `local`). États : `off`, `testeurs`, `tous`. Réglage dans /admin, onglet « Fonctionnalités », effet immédiat sans déploiement, chaque bascule inscrite au journal admin.
- **Repli** : clé absente de la table ou Supabase injoignable = valeur par défaut du registre.
- **Testeurs** : « testeurs » = visible seulement avec l'accès bêta vérifié par le serveur (`beta-auth`).
- Un flag masque ou montre de l'interface, il ne donne aucun droit. La base refuse en plus une nouvelle demande (`formulaires.deleguer`) ou une candidature (`formulaires.resoudre`) quand le flag est `off` dans l'environnement serveur (`flemme_v2.settings.flag_environment`, `prod` par défaut, réglable dans l'onglet). L'état `testeurs` n'est pas vérifié côté base.

## Modèle affiché : `modele.version`

Flag « variante » ajouté le 17/11/2026 (décision de Ben : garder le modèle hybride en preprod derrière un flag).

- Valeurs : `hybride` (catalogue à prix fixes, formules de « Déléguer », section Devenir Brigadier) et `ouvert` (mise en relation ouverte, future v2.0.0).
- Défaut sans réglage : `ouvert` partout (local, beta, preprod et aperçus de PR, prod) depuis le 18/11/2026, choix de Ben ; avant, `hybride` hors prod. Un réglage enregistré dans /admin reste prioritaire sur ce défaut.
- Un bloc propre à un modèle porte `data-modele="hybride"` ou `data-modele="ouvert"` ; il est masqué dans l'autre modèle (`apps/web/src/flags/flags.css`, attribut `data-modele` posé sur `<html>`).
- Blocs marqués `hybride` : accueil `#modele`, `#services` et la garantie « Un prix fixe » ; liens Services de l'en-tête et du pied ; `/deleguer#formules` ; `/resoudre#devenir-brigadier`.
- Limite : les textes qui parlent de prix fixe ailleurs (titres, descriptions, page `/services`) ne sont pas encore séparés. La v2.0.0 (modèle ouvert) les réécrira derrière ce flag.

## Confiance : `espace.confiance`

Flag de lancement ajouté le 18/11/2026 : questions publiques sous les demandes, bouton « J’ai terminé la mission » du membre retenu et clôture par le membre 7 jours après la livraison. Allumé en local (démo), éteint en beta, preprod et prod. À allumer dans /admin une fois la migration `20261118140000_flemme_v2_confiance.sql` appliquée sur la base de l’environnement. Le masquage des coordonnées (côté serveur dès la migration) et les repères du profil public ne dépendent pas du flag.

## Lecture

- Environnement fixé au build (`vite.config.ts`, `__FLEMME_ENV__`) : `BRANCH` Netlify `prod` ou `preprod` (`beta` reste accepté pour les anciennes lignes) ; un aperçu de PR lit `preprod` ; le poste local lit `local`.
- `apps/web/src/flags/runtime.ts` : chargé sur toutes les pages via `beta/runtime.ts`. Un élément `data-flag="cle"` est masqué quand le flag est éteint ; `data-flag-off="cle"` est montré seulement dans ce cas. Quelques liens existants sont rattachés sans toucher au HTML (Premium, aide, `#services`, Résoudre).
- App React : `useFlag('cle')` et `<BientotDisponible/>` (`apps/web/src/flags/useFlag.tsx`).
- Variantes `design.theme` et `navigation.style` : appliquées à tous ; le configurateur /beta d'un testeur reste prioritaire.
- App mobile : non branchée (gelée), le module partagé est prêt.

## Git

Branche courte depuis `preprod`, code derrière un flag `off` par défaut en prod, PR, fusion par Ben en merge commit, puis bascule dans /admin. Une fois un flag de lancement stable (deux semaines à « tous »), une PR retire le flag et l'ancien code.

## Mise en service

1. Appliquer la migration `20261116120000_flemme_v2_feature_flags.sql` sur `flemme-preprod`, puis sur la production avant la promotion qui contient cette PR (action de Ben). Sans la migration, le site applique les valeurs par défaut du registre.
2. Sur `flemme-preprod`, régler l'environnement serveur sur `preprod` dans /admin, onglet « Fonctionnalités ».
3. Vérifier dans /admin, onglet « Fonctionnalités », puis l'environnement serveur.
