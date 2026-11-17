# Versions de test FLEMME

Ce dossier est commun aux branches preprod et prod après promotion par PR. Il décrit une seule version du configurateur, implémentée dans apps/web/src/beta, pas des copies successives du site.

À chaque build, scripts/version.mjs produit /beta/version.json : version de schéma, branche, contexte, SHA et PR fusionnées disponibles dans l'historique Git. L'écran /beta affiche l'identifiant de la version réellement déployée. Un aperçu de PR est explicitement distingué d'une version fusionnée.

Après chaque merge de PR vers preprod ou prod, le workflow beta-version.yml pose un tag annoté immuable build/<branche>-pr<PR>-<SHA> (les anciens tags beta-… restent en place). Ces tags ne sont pas des versions : les versions sont les tags vX.Y.Z décrits dans docs/organisation-git.md. Il publie aussi le manifeste comme artefact GitHub Actions. Aucun commit automatique ni push direct sur les branches protégées. La liste des tags conserve les versions même après suppression d'un aperçu Netlify.

Accès : bouton Version test dans Mon compte, visible après vérification serveur du compte courant. BETA_ADMIN_EMAILS contient le compte référent ; BETA_TESTER_EMAILS ajoute les comptes testeurs (adresses confirmées, séparées par des virgules). Les variables sont uniquement côté Functions, par environnement. Être testeur ne donne aucun droit administrateur métier.

Adresse stable : /beta sur chaque environnement. Adresse d'aperçu correcte : https://deploy-preview-<PR>--flemmeorg.netlify.app/beta. Un cookie ou jeton d'un environnement ne doit jamais être transmis à une autre origine ; une connexion ou invitation distincte est requise sur l'aperçu.

Règles de promotion : branche courte → PR preprod → PR preprod vers prod, avec Create a merge commit. Ni squash ni rebase entre branches persistantes. Jamais de merge direct vers prod depuis une branche de fonctionnalité. Rulesets GitHub (décision du 17/11/2026) : « FLEMME - branches prod et preprod » (26773580), PR obligatoire, 0 approbation, contrôle promotion obligatoire, merge commit uniquement, suppression et force push interdits — source beta/github-ruleset.json ; « FLEMME - tags de version et d'archive », tags v* et archive/* ni supprimés ni déplacés — source beta/github-ruleset-tags.json.
