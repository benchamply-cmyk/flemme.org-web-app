# FLEMME mobile — bêta native

## Liens profonds — 14/11/2026

Chaque écran a la même adresse que sur le site (plan d'adresses validé par Ben, table dans `packages/shared/src/adresses.ts`) : `flemme-mobile://mes-demandes`, `flemme-mobile://flemmes?categorie=maison`, `flemme-mobile://deleguer/nouvelle`, `flemme-mobile://flemme/123` (+ `/modifier`, `/accord`, `/signaler`, `/proposition/456`), `flemme-mobile://compte`, `flemme-mobile://profil/789`, `flemme-mobile://aide`. `App.tsx` ouvre l'écran au démarrage ou pendant que l'app tourne, empilé sur l'accueil. `flemme-mobile://lien` reste réservé aux liens e-mail de connexion. Les liens `https://flemme.org/…` sont déjà reconnus (`lireLien`), mais n'ouvriront l'app qu'avec la publication sur les stores : il faudra alors déclarer le domaine (`associatedDomains` iOS, `intentFilters` Android) et publier sur le site `/.well-known/apple-app-site-association` et `/.well-known/assetlinks.json`. Le formulaire « autre » ou « devis » (`?formule=`) n'existe pas encore sur mobile : le lien ouvre le formulaire classique.

## Visuel V0.4 et écrans du site — 06/11/2026

L'app reprend l'habillage V0.4 retenu pour le site (`src/ui/styles.ts`, valeurs tirées de `apps/web/src/site/site.css`) : fond blanc et rubans chromés en haut, logo « FLEMME. » vert, loupe (recherche) et silhouette (connexion), menu du bas fixe (Accueil, Flemmes, Contact, Mon compte) sur fond nuit, titres en casse normale, boutons glacier contour encre, cartes contour noir, pied de page nuit. Sur iOS et Android, la police reste celle du système ; le navigateur utilise Archivo.

Textes et parcours alignés sur `app.html` (audit UX : demande, proposition, accord ; « Mon espace » avec « À faire »). Écrans ajoutés, mêmes règles que le site via `packages/shared` :

- Accord écrit (`src/ecrans/Accord.tsx`) et signature sur la fiche : rédaction à deux, relecture par l'équipe, signature électronique simple horodatée.
- Avis après la mission (note de 1 à 5 et commentaire) sur la fiche, visibles sur le profil.
- Mot de passe oublié (`Connexion.tsx`) et choix du nouveau mot de passe (`MotDePasse.tsx`). Le lien e-mail rouvre l'app par `flemme-mobile://lien` en flux PKCE (`src/liens.ts`, `expo-crypto`) : **cette adresse doit être ajoutée dans Supabase, Authentication › URL Configuration › Redirect URLs**, sinon le lien renvoie vers le site.
- Aide (`Aide.tsx`) : réponses toutes prêtes puis message à l'équipe FLEMME.
- Profil public (`Profil.tsx`) : présentation, compétences, photo, avis reçus.
- Recherche : loupe dans l'en-tête (et sur la carte « Résoudre une flemme ») qui ouvre « Flemmes à résoudre » avec la barre de recherche et les filtres du site (catégorie, où, ville, budget, délai, tri), via `session.search`.
- Pièces jointes (`Pieces.tsx`, `src/fichiers.ts`, `expo-document-picker`) : PDF, JPEG, PNG ou Word, 10 Mo au plus.

Navigation : une pile d'écrans (`App.tsx`), le bouton Retour et le Retour Android dépilent. Pas encore portés : paiement en ligne Stripe, dictée.

## Aperçu dans un navigateur — 06/11/2026

`npm run export:web` produit dans `dist-web/` une version navigateur de l'app (react-native-web), en démonstration locale uniquement. Elle sert à montrer et commenter les écrans sans téléphone ni Expo Go. `src/storage.web.ts` remplace alors `src/storage.ts` (Metro choisit le fichier `.web.ts`) : les instantanés de démo vont dans le stockage du navigateur et le jeton de connexion reste en mémoire. Les builds iOS et Android ne changent pas. Ce n'est pas une version publiée de l'app.

## Organisation du code — 03/11/2026

Les règles métier, l’accès aux données (démo et Supabase), l’état de l’app et les textes communs sont dans `packages/shared`, partagé avec le site. Ici restent `App.tsx` (navigation, bouton Retour Android, choix de l’écran), un fichier par écran dans `src/ecrans/`, les composants et styles natifs dans `src/ui/`, et le stockage natif (`src/storage.ts`). `metro.config.js` autorise Metro à lire `packages/shared`. `npm test` lance les tests de `packages/shared`.

Implémentation iOS et Android de la maquette mobile validée dans la conversation du 28 octobre 2026 : deux onglets, vert sauge pastel #d8e7ce, budget facultatif et commission FLEMME de 10 % ajoutée au forfait du Brigadier.

## Correction Expo Go du 28/10/2026

La version 0.1.1 cible Expo SDK 58 et Expo Go SDK 58 sur iPhone : React 19.3, React Native 0.88 et modules natifs alignés. Le paragraphe SDK 54 ci-dessous décrit le choix historique initial, remplacé par cette correction. Les options de configuration devenues inutiles newArchEnabled et android.edgeToEdgeEnabled sont retirées. Le stockage expo-file-system/legacy reste compatible et conserve les snapshots existants.

Après récupération de cette version, arrêter Metro avec Ctrl+C, exécuter npm ci, puis npm start -- --clear --port 8082 et scanner le nouveau QR code. Le code métier, les comptes et la commission de 10 % ne changent pas.

Sources vérifiées le 28/10/2026 : https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/ ; https://expo.dev/changelog/sdk-58 ; https://github.com/expo/expo/blob/sdk-58/packages/expo/bundledNativeModules.json

## Identité flemme.org — 28/10/2026

Le thème natif reprend les valeurs finales du CSS du site : bleu glacier #a5ccff, fond #e3eeff, surface douce #f3f7ff, encre #16131f, violet #3a2fa0 et bleu profond #4f86d9. Les variables historiques vertes du CSS sont surchargées par la version V5 ; ce sont bien les valeurs finales qui sont utilisées. Source : https://github.com/benchamply-cmyk/FlemmeV2.0/blob/beta/flemme-web-beta/styles.css ; aspect également vérifié sur https://flemme.org/ le 28/10/2026.

packages/shared/src/brand.ts (anciennement src/brand.ts) centralise la palette et le fond statique à dégradés lilas, rose, aqua et glacier. Les contours sombres, ombres violettes décalées, boutons pilules et titres en capitales reprennent les traitements du site. Le navigateur utilise Archivo via Google Fonts ; le natif utilise des caractères système condensés disponibles sur iOS/Android, sans téléchargement de police ni nouvelle dépendance.

assets/flemme-logo.png est une adaptation sur fond transparent du logo sticker de la planche fournie par l’utilisateur (lettrage noir, vert, contour blanc et ombre violette). assets/flemme-icon.png est sa déclinaison carrée opaque sur fond glacier/lilas, référencée par expo.icon. Les deux images sont dérivées du visuel fourni avec l’outil d’image ; elles ne constituent pas des fichiers vectoriels originaux. Le logo conserve son vert ; la couleur d’action de l’interface devient le bleu glacier.

Recharger Expo actualise l’interface. L’icône système ne se remplace pas dans Expo Go, qui garde sa propre icône ; elle est utilisée lors d’une compilation native de FLEMME.

## Accueil à deux actions — 28/10/2026

L’écran initial affiche deux grands boutons centraux, Mes flemmes et Résoudre une flemme. Les listes apparaissent uniquement après le choix. Mes flemmes donne accès au dépôt et au suivi des demandes ; Résoudre une flemme montre les tâches disponibles et les propositions du Brigadier. Le bouton Accueil revient au choix initial ; la navigation Android suit le même parcours. La barre d’onglets inférieure est remplacée par cet accueil. Les descriptions antérieures avec deux onglets restent ci-dessous comme historique de la première version.

## Décision d’architecture

Même dépôt que le site, application indépendante dans apps/mobile, branche feature/flemme-mobile issue de beta. Aucune dépendance à l’interface web, aucun déplacement ni remplacement de fichiers existants. L’app n’est pas une WebView. Un nouveau dépôt serait utile si une équipe, des droits d’accès ou un cycle de livraison séparés le justifient ; ce n’est pas nécessaire pour ce premier test.

React Native / Expo et TypeScript. SDK 54.0.37, React Native 0.81.5 et React 19.1.0, versions épinglées et verrouillées, effectivement vérifiées dans cet environnement. Le SDK n’est pas le dernier publié : il a été retenu pour une chaîne disponible et reproductible. Pour tester sur un téléphone dont Expo Go ne prend plus en charge SDK 54, utiliser une compilation native de cette version. L’évolution du SDK et la validation des exigences des stores précèdent une distribution publique.

## Lancer

Depuis ce dossier, avec Node 22.13 ou supérieur :

    npm ci
    npm start

Pour compiler et lancer en développement :

    npm run ios
    npm run android

iOS requiert macOS et Xcode ; Android requiert son SDK. Sur un téléphone physique, prévoir les outils et la signature de développement appropriés. Les identifiants org.flemme.mobile sont proposés et devront être confirmés avant la distribution.

Sans variables d’environnement : démonstration locale. Le bouton de profil permet de passer entre Benjamin, Lou et Camille et de vérifier les deux rôles. Trois tâches fictives sont disponibles. Les mutations sont sauvegardées dans de nouveaux snapshots locaux, sans effacer les précédents. La dernière version lisible est restaurée ; des données illisibles ne sont jamais remplacées par une remise à zéro. La démo ne partage aucune donnée entre téléphones.

## Mode connecté et comptes réels

Le connecteur Supabase REST est implémenté ; il n’est activé que si l’URL et la clé publique sont renseignées. Une configuration partielle produit une erreur plutôt qu’une bascule silencieuse vers la démo.

1. Projet Supabase : celui de production (`yktpabnqkhwcshvjuncs`, décision du 03/11/2026 ; mise en service du site : `docs/supabase-mise-en-service.md`). Y appliquer les migrations du dossier supabase/ à la racine du dépôt avec la CLI Supabase (voir supabase/README.md). Elles créent un schéma privé distinct, flemme_v2, et le seul point d’entrée public flemme_mobile_api. Elles ne touchent pas aux tables, fonctions ni données du site ou du Manager, et échouent si leurs objets existent déjà plutôt que de les remplacer.
2. Garder flemme_v2 hors de la liste des schémas exposés dans Data API. Le schéma public doit être exposé pour la RPC. Les tables privées n’ont aucun droit d’accès direct pour anon/authenticated ; RLS est activée. La RPC vérifie un compte confirmé, les propriétaires et les participants à chaque action.
3. Copier .env.example vers .env et renseigner EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY avec les valeurs publiques du projet. Aucune clé service_role ou sb_secret ne doit être embarquée. Redémarrer Metro après modification.
4. Activer l’authentification e-mail/mot de passe et la confirmation d’e-mail dans Supabase. Configurer l’adresse de retour du mail de confirmation ; l’utilisateur revient ensuite se connecter dans l’app. La création de compte et la connexion sont disponibles dans l’application.
5. Tester avec deux comptes sur deux appareils. Tirer la liste vers le bas pour actualiser les offres, messages et états ; pas de synchronisation continue ni de notifications push.

Les jetons d’accès restent en mémoire. Seul le jeton de renouvellement est conservé dans le coffre natif SecureStore ; aucun mot de passe n’est sauvegardé. Les renouvellements concurrents sont regroupés. Les annonces privées, conversations et paiements ne sont pas copiés dans la démo locale.

## Parcours et rémunération

- Déposer une flemme : titre, description, lieu, budget facultatif. Aucun champ ni traitement d’expiration.
- Proposer son aide : forfait, créneau, périmètre inclus/non inclus. Une proposition active par Brigadier et par tâche.
- Discussion privée entre déposant et auteur de l’offre. Pour renégocier le forfait, décliner l’ancienne offre et en proposer une nouvelle ; les versions restent dans l’historique.
- Accepter : écran récapitulatif distinct, prix Brigadier + frais FLEMME + total, puis attribution à un seul Brigadier. Le serveur verrouille la tâche et fige l’accord. Les autres offres restent enregistrées.
- Terminer : le déposant confirme la réalisation. Il peut déclarer avoir payé ; le Brigadier peut confirmer la réception. Ces indications restent déclaratives.
- Désaccord : l’un des deux participants à l’accord peut enregistrer un signalement. Aucune suppression d’offre, de message ou d’historique n’est disponible.

Calcul exclusivement en centimes : commission = arrondi au centime de forfait / 10 (réglage par défaut, configurable : voir `docs/paiement-stripe.md` à la racine du dépôt). Exemple : 40 € au Brigadier, 4 € à FLEMME, total 44 €. Pour 40,05 €, frais de 4,01 €, total 44,06 €. Aucun frais minimal : les forfaits très faibles peuvent donner une commission arrondie à zéro.

La commission est calculée côté serveur et enregistrée dans l’accord, jamais acceptée depuis un total envoyé par le client. Paiement direct au Brigadier et commission séparée correspondent au test accompagné choisi. **Cette version n’encaisse ni la prestation ni les frais FLEMME.** Aucun écran ne prétend qu’une commission est payée. Le branchement d’un prestataire de paiement et ses remboursements constituent une étape distincte avant de percevoir automatiquement les frais.

## Support et mesure du test

Les signalements du mode connecté sont enregistrés en base, sans notification automatique ni interface d’administration mobile. Pour le test accompagné, une personne habilitée doit consulter les événements « report » de flemme_v2.events depuis l’outil d’administration de la base, puis contacter les participants dans les discussions. L’app ne promet pas de réponse ni de remboursement automatique.

Les tâches, accords, dates de création, événements et déclarations de paiement permettent d’extraire les taux d’attribution, de réalisation et de paiement confirmé. Le retour d’un utilisateur se mesure sur ses créations et propositions successives. Aucune mesure de paiement bancaire réel n’est disponible tant que l’encaissement n’est pas connecté.

## Vérifications

    npm run typecheck
    npm test
    npm run export:android
    npm run export:ios
    cd ../../supabase/tests
    npm ci
    npm test

Les tests SQL utilisent PostgreSQL embarqué (PGlite), un schéma auth simulé et les rôles anon/authenticated. Ils exécutent les vraies migrations et vérifient les refus d’accès, la confidentialité des discussions, la commission calculée côté serveur, l’attribution unique, le rejeu idempotent et les déclarations de paiement. Ce n’est pas une validation du service Supabase déployé.

Les exports Metro vérifient les bundles natifs ; ils ne remplacent pas les tests sur appareil ni les compilations signées. Aucun projet Supabase n’est modifié automatiquement, aucun build n’est envoyé aux stores et aucune configuration Netlify n’est changée.

Limites du premier test : pagination simple (50 flemmes par page, bouton « Voir plus »), pas d’achats avancés, pas de tarification horaire, pas d’annulation automatique, pas de changement de prix après accord. Les identifiants de reprise réseau sont conservés pendant la session d’édition ; après fermeture brutale de l’app, actualiser avant de recréer une tâche. Les snapshots de démonstration restent sur le téléphone jusqu’à désinstallation et ne constituent pas une sauvegarde distante.

## Sources et références — 28/10/2026

- Brief utilisateur et maquette sauge de cette conversation, avec confirmation des 10 % ajoutés au forfait.
- Base de code : https://github.com/benchamply-cmyk/FlemmeV2.0/commit/fe2e736ca2f5641db2d3b0b6026167e3525fea15
- Suivi projet : https://benchp.atlassian.net/browse/FLEMME-6
- Documentation projet : https://benchp.atlassian.net/wiki/spaces/DCHPLY/pages/131097
- Expo, développement natif : https://docs.expo.dev/develop/development-builds/introduction/
- Versions SDK : https://expo.dev/sdk ; correspondances vérifiées dans expo/bundledNativeModules.json du paquet 54.0.37 installé.
- Supabase Auth REST : https://supabase.github.io/auth/
- Fonctions et privilèges : https://supabase.com/docs/guides/database/functions
- RLS : https://supabase.com/docs/guides/database/postgres/row-level-security

Références uniquement : aucune synchronisation continue Confluence/Jira/GitHub.
