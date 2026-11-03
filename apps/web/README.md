# FLEMME web — site aligné sur l’app mobile

Nouveau site, indépendant du site historique flemme.org (dossier `flemme-web-beta` du dépôt FlemmeV2.0), qui reprend le modèle de `apps/mobile` : deux actions (« Mes flemmes », « Résoudre une flemme »), des Brigadiers qui proposent un forfait et une commission FLEMME de 10 % ajoutée au forfait accepté.

- `index.html` : vitrine (les deux actions, les quatre étapes, un calculateur du prix et ce que la version de test ne fait pas).
- `app.html` : le parcours de l’app dans le navigateur, avec les mêmes écrans et les mêmes textes que `apps/mobile/App.tsx`.

## Une seule source pour les règles

Le site n’a pas sa propre copie des règles métier. Il importe directement `../mobile/src/domain.ts` (montants, commission, droits, historique) et `../mobile/src/gateway.ts` (démo locale et connecteur Supabase). Toute correction faite pour le mobile s’applique donc au site, et inversement. Seul le stockage diffère (`src/storage.ts`) :

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

Même backend que le mobile (migrations `supabase/migrations`, RPC `flemme_mobile_api`, voir `supabase/README.md`). Copier `.env.example` vers `.env` et renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` : ce sont les valeurs publiques déjà utilisées pour le mobile. Ajouter `…/app.html` aux Redirect URLs de l’authentification Supabase. Aucune clé `service_role` ou `sb_secret`.

Le build échoue si une seule des deux variables est remplie, si l’URL n’est pas en HTTPS ou si la clé est secrète (`src/supabaseConfig.ts`). En mode connecté, l’écran de connexion propose aussi « Mot de passe oublié ? » : c’est ainsi que les comptes de l’ancien espace ouverts par lien e-mail, Google ou Apple se créent un mot de passe. Les liens des e-mails reviennent sur `app.html` en flux PKCE (`src/authLinks.ts`).

Mise en service sur flemme.org (installation SQL, réglages Supabase et Netlify, recette, retour arrière) : `docs/supabase-mise-en-service.md`.

## Vérifications

    npm run typecheck
    npm test
    npm run build

`npm run build` produit `dist/` (site statique). Le `netlify.toml` à la racine du dépôt publie ce dossier sur https://flemme.org (projet Netlify flemmeorg) (base `apps/web`, commande `npm run build`, dossier `dist`, Node 22).

Limites : identiques à celles du mobile (pas d’encaissement, paiement direct et déclaratif, pas de pagination, pas de synchronisation continue).
