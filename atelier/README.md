# Atelier visuel bêta

PR ciblée vers `beta`. Ne pas fusionner directement vers `prod` : reprendre les choix validés dans une PR ciblée vers `preprod`, puis promouvoir `preprod` vers `prod`.

La référence est le commit inscrit dans `reference.json` : depuis le 7 novembre 2026, le design V0.5 de preprod (PR #41, 214a248), choisi par Ben à la place de prod c199dfa. Le build extrait et compile ce commit dans un dossier temporaire, sans variables de connexion VITE, Supabase ou paiement. Aucun reset de la branche beta ni copie des secrets de production. La référence compilée est générée, jamais versionnée.

Sur le site Netlify `flemmeorg-beta`, la racine et `/beta` ouvrent l’atelier ; `/atelier` est aussi disponible. Aucun changement de `flemme.org/beta` sur le site officiel.

Quatre propositions : Référence V0.5, Essentiel, Expressif et Guidé, appliquées aux sélecteurs du site V0.5 (`apps/web/src/atelier/model.ts`). Blocs de l’accueil réglables : présentation, trois étapes, exemples, « Tu gardes la main », « Écris-nous », pied de page ; seuls les quatre blocs centraux se déplacent. Pages essayables : accueil, Comment ça marche, Flemmes à résoudre, FAQ, Contact, Premium, app. Couleurs, typographie, arrondis, espaces, navigation et sections sont modifiables. Comparaison et tailles mobile/tablette disponibles. Les sauvegardes nommées restent dans le navigateur ; le lien partagé contient la configuration et référence le déploiement immuable lorsqu’il est disponible. La démonstration ne soumet pas les formulaires métier.

Le formulaire de retours anonyme est collecté par Netlify Forms sur le site bêta, indépendamment de Supabase. Il contient la configuration et le commit testés. Activer Forms avant le déploiement. La notification à ben.champly@gmail.com doit être configurée dans les notifications Forms du site et vérifiée séparément ; le code seul ne configure aucun destinataire.

Validation : build complet, tests du modèle de variantes, vérification HTTP du déploiement. La référence est figée sur un commit : toute actualisation se fait explicitement dans une PR, avec mise à jour des sélecteurs si le site change. Les liens partagés et variantes enregistrées avec l’ancienne référence ne s’ouvrent plus (clés locales passées en v2).

## Versions et directions (PR #48)

`reference.json` liste les versions sélectionnables (`versions`, `default`) : Design V0.5 (#41, 214a248), Refonte V0.4 (#38, 82e24f6), site en ligne v6.3000 (c199dfa, avec #20, #22, #33). Chaque version est compilée dans `atelier-reference/<id>/`. Les familles de structure `v05` et `v63` ont chacune leurs blocs et sélecteurs (`apps/web/src/atelier/model.ts`). Les directions personnelles se créent depuis les réglages actuels, par version, et restent dans le navigateur ; le lien partagé contient la version, son commit et les réglages. #44 et #45 (tests internes) ne sont pas proposées.
