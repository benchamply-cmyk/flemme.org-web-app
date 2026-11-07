# Règles du projet FLEMME

- Dépôt autorisé : benchamply-cmyk/flemme.org-web-app. Ne pas modifier FlemmeV2.0 pour ce chantier.
- Un projet Netlify : flemmeorg. Branches persistantes : preprod et prod. Aucun environnement beta permanent.
- Développer depuis preprod sur une branche courte. Ouvrir une PR vers preprod ; production uniquement par PR preprod → prod.
- Choisir Create a merge commit pour les fusions entre branches persistantes. Ne pas squash/rebase, supprimer ou force-push prod/preprod.
- Ne pas fusionner ni déployer un environnement partagé sans autorisation explicite applicable. Après un refus automatique, ne pas contourner : expliquer le motif et demander l'approbation précise.
- Le configurateur /beta utilise le code de la branche courante. Le bouton Version test du compte et le serveur vérifient l'accès. Jamais d'autorisation fondée sur le seul e-mail ou rôle fourni par le navigateur.
- Référent : ben.champly@gmail.com. Ajouter les autres testeurs uniquement par configuration serveur BETA_TESTER_EMAILS après instruction ; aucun droit admin métier implicite.
- Ne jamais transmettre un jeton de compte à une autre origine ni le mettre dans une URL. Les invitations sont des secrets révocables, à ne pas publier dans GitHub ou les journaux.
- Aucun secret dans Git, VITE_* ou le bundle client. Ne pas lire/copier/modifier les secrets de production sans nécessité et autorisation. Ne pas réutiliser les secrets d'alertes/paiement pour la bêta.
- Dossier beta/ : politique, schéma et génération des manifestes. Chaque PR fusionnée vers preprod/prod est identifiée par manifeste de build et tag beta-<branche>-pr<PR>-<SHA>. Pas de copies successives du code ni de commit bot sur les branches protégées.
- Conserver les workflows promotion et beta-version. Signaler si les checks ne sont pas obligatoires dans les rulesets GitHub ; le YAML seul ne protège pas les branches.
- Vérifier build, tests pertinents, accès anonyme/testeur/invité, révocation et version affichée. Distinguer test local, CI, aperçu déployé et validation du vrai compte.
- Répondre franchement, annoncer les risques et incertitudes ; aucun compliment d'ouverture ni déclaration de succès sans preuve.
