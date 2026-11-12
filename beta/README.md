# Versions de test FLEMME

Ce dossier est commun aux branches preprod et prod après promotion par PR. Il décrit une seule version du configurateur, implémentée dans apps/web/src/beta, pas des copies successives du site.

À chaque build, scripts/version.mjs produit /beta/version.json : version de schéma, branche, contexte, SHA et PR fusionnées disponibles dans l'historique Git. L'écran /beta affiche l'identifiant de la version réellement déployée. Un aperçu de PR est explicitement distingué d'une version fusionnée.

Après chaque merge de PR vers preprod ou prod, le workflow beta-version.yml pose un tag annoté immuable beta-<branche>-pr<PR>-<SHA>. Il publie aussi le manifeste comme artefact GitHub Actions. Aucun commit automatique ni push direct sur les branches protégées. La liste des tags conserve les versions même après suppression d'un aperçu Netlify.

Accès : bouton Version test dans Mon compte, visible après vérification serveur du compte courant. BETA_ADMIN_EMAILS contient le compte référent ; BETA_TESTER_EMAILS ajoute les comptes testeurs (adresses confirmées, séparées par des virgules). Les variables sont uniquement côté Functions, par environnement. Être testeur ne donne aucun droit administrateur métier.

Adresse stable : /beta sur chaque environnement. Adresse d'aperçu correcte : https://deploy-preview-<PR>--flemmeorg.netlify.app/beta. Un cookie ou jeton d'un environnement ne doit jamais être transmis à une autre origine ; une connexion ou invitation distincte est requise sur l'aperçu.

Règles de promotion : branche courte → PR preprod → PR preprod vers prod, avec Create a merge commit. Ni squash ni rebase entre branches persistantes. Jamais de merge direct vers prod depuis une branche de fonctionnalité. Ruleset actif GitHub « FLEMME - promotion et versions beta » (26773580), ciblant prod et preprod : PR avec une approbation, web et promotion obligatoires, branche à jour, merge commit uniquement, suppression/force push interdits, aucun contournement. La source est beta/github-ruleset.json. Une approbation doit venir d’un autre compte que l’auteur de la PR.
