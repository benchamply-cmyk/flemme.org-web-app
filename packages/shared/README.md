# packages/shared — code commun au site et à l’app

Tout ce qui doit se comporter pareil sur flemme.org (`apps/web`) et dans l’app (`apps/mobile`). Pas de React, pas de DOM, pas de React Native, aucune dépendance : seulement du TypeScript lisible par Vite, Metro et Node.

| Fichier | Contenu |
|---|---|
| `src/domain.ts` | Types (flemme, proposition, accord), montants en centimes, commission de 10 %, règles de chaque action et de visibilité |
| `src/gateway.ts` | Accès aux données : démo locale (`DemoGateway`) et Supabase (`RemoteGateway`, RPC `flemme_mobile_api`) |
| `src/session.ts` | État de l’app (`FlemmeSession`) : chargement, connexion, une action à la fois, identifiant de requête réutilisé en cas de nouvel essai, erreurs affichées |
| `src/ecrans.ts` | Parcours (écran parent, libellé du bouton Retour), répartition des listes, droits d’affichage sur une flemme |
| `src/textes.ts` | Libellés de statut, messages de confirmation, ligne d’appel des cartes, état du paiement, pied de page |
| `src/brand.ts` | Palette et fond (utilisés par le mobile ; le site a les mêmes valeurs dans `styles.css`) |
| `src/index.ts` | Point d’entrée : réexporte tout |

Chaque app s’abonne à la session avec `useSyncExternalStore` (`src/session.ts` de chaque app) et ne garde que l’affichage, la navigation et le stockage local (localStorage et sessionStorage sur le web, fichiers et SecureStore sur mobile).

## Règles

- Le code d’ici doit rester exécutable par Node sans compilation (`--experimental-strip-types`) : pas d’`enum`, pas de propriétés déclarées dans le constructeur, imports avec l’extension `.ts`.
- Pas d’import de `react`, `react-native` ou du DOM : ce dossier n’a pas de `node_modules`.
- Une règle métier se corrige ici, jamais dans une seule app.

## Tests

    npm test

Aussi lancés par `npm test` dans `apps/web` et `apps/mobile`, donc par les deux CI.
