# Atelier visuel bêta

PR ciblée vers `beta`. Ne pas fusionner directement vers `prod` : reprendre les choix validés dans une PR ciblée vers `preprod`, puis promouvoir `preprod` vers `prod`.

La référence est le commit inscrit dans `reference.json` : depuis le 7 novembre 2026, le design V0.5 de preprod (PR #41, 214a248), choisi par Ben à la place de prod c199dfa. Le build extrait et compile ce commit dans un dossier temporaire, sans variables de connexion VITE, Supabase ou paiement. Aucun reset de la branche beta ni copie des secrets de production. La référence compilée est générée, jamais versionnée.

Sur le site Netlify `flemmeorg-beta`, la racine et `/beta` ouvrent l’atelier ; `/atelier` est aussi disponible. Aucun changement de `flemme.org/beta` sur le site officiel.

Quatre propositions : Référence V0.5, Essentiel, Expressif et Guidé, appliquées aux sélecteurs du site V0.5 (`apps/web/src/atelier/model.ts`). Blocs de l’accueil réglables : présentation, trois étapes, exemples, « Tu gardes la main », « Écris-nous », pied de page ; seuls les quatre blocs centraux se déplacent. Pages essayables : accueil, Comment ça marche, Flemmes à résoudre, FAQ, Contact, Premium, app. Couleurs, typographie, arrondis, espaces, navigation et sections sont modifiables. Comparaison et tailles mobile/tablette disponibles. Les sauvegardes nommées restent dans le navigateur ; le lien partagé contient la configuration et référence le déploiement immuable lorsqu’il est disponible. La démonstration ne soumet pas les formulaires métier.

Le formulaire de retours anonyme est collecté par Netlify Forms sur le site bêta, indépendamment de Supabase. Il contient la configuration et le commit testés. Activer Forms avant le déploiement. La notification à ben.champly@gmail.com doit être configurée dans les notifications Forms du site et vérifiée séparément ; le code seul ne configure aucun destinataire.

Validation : build complet, tests du modèle de variantes, vérification HTTP du déploiement. La référence est figée sur un commit : toute actualisation se fait explicitement dans une PR, avec mise à jour des sélecteurs si le site change. Les liens partagés et variantes enregistrées avec l’ancienne référence ne s’ouvrent plus (clés locales passées en v2).

## Versions et directions (PR #48)

`reference.json` liste les versions sélectionnables (`versions`, `default`) : Design V0.5 (#41, 214a248), Refonte V0.4 (#38, 82e24f6), site en ligne v6.3000 (c199dfa, avec #20, #22, #33), maquette V0.3 (#36, 494efdd), essais du 5 nov. (#37, ce94a80, non fusionnée), version de base (#18, prod 9aa2c16). Les anciennes versions qui importaient `apps/mobile/src` sont compilées avec ce dossier. Pour #37 et #18 (famille `v63`), seuls les blocs reconnus sont réglables. Chaque version est compilée dans `atelier-reference/<id>/`. Les familles de structure `v05` et `v63` ont chacune leurs blocs et sélecteurs (`apps/web/src/atelier/model.ts`). Les directions personnelles se créent depuis les réglages actuels, par version, et restent dans le navigateur ; le lien partagé contient la version, son commit et les réglages. #44 et #45 (tests internes) ne sont pas proposées.

## Version V0.6 (PR #49)

Version `v06` ajoutée en tête et par défaut : commit 494264e de la PR brouillon #49 (`feature/v0-6`), visuel V0.5. Famille `v06` : accueil à 5 blocs réglables (trois étapes, « Qu’est-ce que tu aimerais déléguer ? », Confiance, Écris-nous, appel final) et deux options propres : effet des accroches alternées (flou d’origine, fondu, glisse, volet, ou fixe) et boutons de l’en-tête (icône et texte, texte seul, icônes seules). Ces options et les blocs ne modifient pas le style de la référence. Si #49 reçoit d’autres commits, mettre à jour le commit de `v06` dans une PR. Le build extrait aussi le dossier `beta/` des versions qui en ont besoin (preprod depuis #44).

## Tweaks du canevas, boutons et plan de page (12 nov. 2026)

Panneau « 04 · Tweaks du canevas » : les réglages des artboards « 00 · Réglages communs » des pages V0.5, V0.6, V0.7 et Design PR55 du canevas 63uk3vECEJaGSNwhxWcXeB (69 Tweaks, dont les 16 options B6). L’aperçu reçoit les classes `t-<réglage>-<option>` sur `<body>` et les règles CSS du canevas (mêmes classes que le site, familles v05, v06 et p55 ; pas la v6.3000). « Référence » laisse un réglage tel qu’il est dans la version ; un bouton par page du canevas applique ses valeurs par défaut (correspondance par libellé pour V0.5, dont la numérotation diffère). Les anciennes options retirées du canevas (classes `t-…-x…`) ne sont pas reprises, sauf « Bleu V0.3 » (fond du haut, option 14).

`src/atelier/tweaks.ts` est généré : lire les quatre artboards 00 du canevas dans un dossier, puis `python3 -I atelier/canevas/extraire-tweaks.py <dossier>`. Ne pas le modifier à la main.

Panneau « 05 · Les boutons » : fond, texte et contour libres des grands boutons et pastilles. Panneau « 06 · Plan de la page » : pour la page affichée, masquer ou déplacer les boutons de l’en-tête, les entrées des menus ☰ et « ? », le haut de page, les boutons, les sections, les colonnes et liens du pied de page. Les éléments sont repérés par leur position d’origine ; les textes modifiés restent attachés à leur élément quand on déplace un bloc. Version « Preprod · PR #55 » (famille p55, preprod d2170d7) ajoutée pour essayer les Tweaks « Design PR55 » sur le site correspondant.
