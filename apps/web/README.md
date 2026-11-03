# FLEMME web — site aligné sur l’app mobile

Nouveau site, indépendant du site historique flemme.org (dossier `flemme-web-beta` du dépôt FlemmeV2.0), qui reprend le modèle de `apps/mobile` : deux actions (« Mes flemmes », « Résoudre une flemme »), des Brigadiers qui proposent un forfait et une commission FLEMME de 10 % ajoutée au forfait accepté.

- `index.html` : vitrine (les deux actions, les quatre étapes, un calculateur du prix et ce que la version de test ne fait pas).
- `app.html` : le parcours de l’app dans le navigateur, avec les mêmes écrans et les mêmes textes que l’app mobile. `src/App.tsx` gère la navigation et choisit l’écran ; chaque écran est un fichier de `src/ecrans/`, avec le même nom que son pendant mobile.

## Une seule source pour les règles

Le site n’a pas sa propre copie des règles métier. Il importe `../../packages/shared` : montants, commission et droits (`domain.ts`), démo locale et connecteur Supabase (`gateway.ts`), état de l’app et envoi des actions (`session.ts`), parcours (`ecrans.ts`) et textes calculés (`textes.ts`). Toute correction faite là s’applique au site et au mobile. Seuls le stockage (`src/storage.ts`) et la navigation diffèrent :

| | Mobile | Web |
|---|---|---|
| Démo locale | fichiers JSON additifs (expo-file-system) | clés `flemme-web-demo:*` additives (localStorage) |
| Jeton de renouvellement | SecureStore | sessionStorage : il faut se reconnecter après avoir fermé l’onglet |
| Retour | BackHandler Android | historique du navigateur |

## Lancer

Depuis ce dossier, avec Node 22.13 ou supérieur :

    npm ci
    npm run dev

Puis ouvrir http://localhost:5173 (vitrine) ou http://localhost:5173/app.html (app). Les liens `app.html#mine` et `app.html#find` ouvrent directement l’une des deux listes.

Sans variables d’environnement : démonstration locale, avec les trois mêmes personnages et tâches fictives que le mobile (bouton de profil en haut à droite). Les données restent dans le navigateur.

## Mode connecté

Même backend que le mobile (`apps/mobile/backend/install.sql`, RPC `flemme_mobile_api`). Copier `.env.example` vers `.env` et renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` : ce sont les valeurs publiques déjà utilisées pour le mobile. Ajouter l’adresse du site aux URL autorisées de l’authentification Supabase. Aucune clé `service_role` ou `sb_secret`.

## Vérifications

    npm run typecheck
    npm test          # tests du site et de packages/shared
    npm run build

`npm run build` produit `dist/` (site statique). Le `netlify.toml` à la racine du dépôt publie ce dossier sur https://flemme.org (projet Netlify flemmeorg) (base `apps/web`, commande `npm run build`, dossier `dist`, Node 22).

Limites : identiques à celles du mobile (pas d’encaissement, paiement direct et déclaratif, pas de pagination, pas de synchronisation continue).
