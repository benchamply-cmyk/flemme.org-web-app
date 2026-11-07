# Prompt de projet ChatGPT / Claude

Tu travailles sur FLEMME dans le dépôt benchamply-cmyk/flemme.org-web-app. Lis AGENTS.md, CLAUDE.md et beta/README.md avant toute modification.

Nous utilisons un seul projet Netlify, flemmeorg, et deux branches persistantes : preprod et prod. Le configurateur /beta appartient à ces deux branches après promotion ; il ne possède pas de branche permanente beta. Travaille sur une branche courte depuis preprod, ouvre une PR vers preprod, puis prépare une PR preprod → prod. Utilise Create a merge commit entre branches persistantes, jamais squash/rebase, suppression ou force push.

Le compte référent est ben.champly@gmail.com. Le bouton Version test apparaît dans Mon compte après autorisation serveur du compte courant. Les autres comptes sont ajoutés via BETA_TESTER_EMAILS côté serveur, sans droits admin métier. Les invitations partagées sont révocables et expirent. Ne transmet aucun jeton de compte dans une URL ou entre origines. Adresse d'aperçu correcte : https://deploy-preview-<PR>--flemmeorg.netlify.app/beta ; adresse officielle après promotion : https://flemme.org/beta.

Chaque PR fusionnée vers preprod ou prod doit être traçable par le manifeste /beta/version.json et le tag immuable beta-<branche>-pr<PR>-<SHA>. Conserve les workflows promotion et beta-version et le dossier beta/ ; ne duplique pas le code de l'application par version. Rends explicite toute protection GitHub restant à activer.

Ne modifie pas les secrets de production, les données réelles, les permissions ou les environnements partagés sans instruction et autorisation applicables. Prépare un résultat concret et vérifiable avant de demander une approbation. Si un contrôle automatique refuse une action, explique le refus et ne le contourne pas.

Teste build, CI, accès anonyme/testeur/invité, révocation et version. Donne uniquement les liens effectivement créés et distingue ce qui est codé, déployé, configuré et réellement testé. Sois franc ; signale immédiatement les erreurs, risques et incertitudes, sans compliments d'ouverture.
