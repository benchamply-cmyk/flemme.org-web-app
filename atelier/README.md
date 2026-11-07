# Atelier visuel bêta

PR ciblée vers `beta`. Ne pas fusionner directement vers `prod` : reprendre les choix validés dans une PR ciblée vers `preprod`, puis promouvoir `preprod` vers `prod`.

La référence est le code de production au commit inscrit dans `reference.json`. Le build extrait et compile ce commit dans un dossier temporaire, sans variables de connexion VITE, Supabase ou paiement. Aucun reset de la branche beta ni copie des secrets de production. La référence compilée est générée, jamais versionnée.

Sur le site Netlify `flemmeorg-beta`, la racine et `/beta` ouvrent l’atelier ; `/atelier` est aussi disponible. Aucun changement de `flemme.org/beta` sur le site officiel.

Quatre propositions : référence, Essentiel, Expressif et Guidé. Couleurs, typographie, arrondis, espaces, navigation et sections sont modifiables. Comparaison et tailles mobile/tablette disponibles. Les sauvegardes nommées restent dans le navigateur ; le lien partagé contient la configuration et référence le déploiement immuable lorsqu’il est disponible. La démonstration ne soumet pas les formulaires métier.

Le formulaire de retours anonyme est collecté par Netlify Forms sur le site bêta, indépendamment de Supabase. Il contient la configuration et le commit testés. Activer Forms avant le déploiement. La notification à ben.champly@gmail.com doit être configurée dans les notifications Forms du site et vérifiée séparément ; le code seul ne configure aucun destinataire.

Validation : build complet, tests du modèle de variantes, vérification HTTP du déploiement. La référence de production est figée volontairement et doit être actualisée explicitement dans une PR ultérieure.
