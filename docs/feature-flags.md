# Feature flags FLEMME

Proposition validée par Ben le 16/11/2026, première implémentation sur la branche beta.

## Principe

- **Registre** : `packages/shared/src/flags.ts`. Liste officielle des flags (clé `domaine.fonction`, libellé, type, valeur par défaut par environnement). Ajouter un flag = une ligne, dans une PR.
- **Interrupteur** : table `flemme_v2.feature_flags` (migration `20261116120000_flemme_v2_feature_flags.sql`), une ligne par flag et par environnement (`beta`, `preprod`, `prod`, `local`). États : `off`, `testeurs`, `tous`. Réglage dans /admin, onglet « Fonctionnalités », effet immédiat sans déploiement, chaque bascule inscrite au journal admin.
- **Repli** : clé absente de la table ou Supabase injoignable = valeur par défaut du registre.
- **Testeurs** : « testeurs » = visible seulement avec l'accès bêta vérifié par le serveur (`beta-auth`).
- Un flag masque ou montre de l'interface, il ne donne aucun droit. La base refuse en plus une nouvelle demande (`formulaires.deleguer`) ou une candidature (`formulaires.resoudre`) quand le flag est `off` dans l'environnement serveur (`flemme_v2.settings.flag_environment`, `prod` par défaut, réglable dans l'onglet). L'état `testeurs` n'est pas vérifié côté base.

## Lecture

- Environnement fixé au build (`vite.config.ts`, `__FLEMME_ENV__`) : `BRANCH` Netlify `prod`, `preprod` ou `beta` ; un aperçu de PR lit `preprod` ; le poste local lit `local`.
- `apps/web/src/flags/runtime.ts` : chargé sur toutes les pages via `beta/runtime.ts`. Un élément `data-flag="cle"` est masqué quand le flag est éteint ; `data-flag-off="cle"` est montré seulement dans ce cas. Quelques liens existants sont rattachés sans toucher au HTML (Premium, aide, `#services`, Résoudre).
- App React : `useFlag('cle')` et `<BientotDisponible/>` (`apps/web/src/flags/useFlag.tsx`).
- Variantes `design.theme` et `navigation.style` : appliquées à tous ; le configurateur /beta d'un testeur reste prioritaire.
- App mobile : non branchée (gelée), le module partagé est prêt.

## Git

Branche courte depuis la branche cible, code derrière un flag `off` par défaut en prod, PR, fusion par Ben en merge commit, puis bascule dans /admin. Une fois un flag de lancement stable (deux semaines à « tous »), une PR retire le flag et l'ancien code.

## Mise en service

1. Appliquer la migration sur le projet Supabase concerné (action de Ben).
2. Vérifier dans /admin, onglet « Fonctionnalités », puis l'environnement serveur.
