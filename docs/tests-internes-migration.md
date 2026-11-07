# Migration des tests internes

Périmètre : branche feature/test-interne uniquement. Aucune fusion vers preprod/prod ni modification d’un environnement partagé.

- Point d’entrée et liens : /tests/internes.
- Page Vite : apps/web/tests/internes/index.html.
- Interface : apps/web/src/tests/internes/.
- Authentification : /.netlify/functions/tests-internes-auth.
- Retours : /.netlify/functions/tests-internes-feedback.
- Variables serveur : préfixe TESTS_INTERNES_.
- Cookie : flemme_tests_internes ; choix navigateur : flemme.tests.internes.v1.
- Table de retours : public.tests_internes_feedback ; SQL manuel dans supabase/tests/internes/feedback.sql.
- Manifestes : /tests/internes/version.json ; tags et artefacts : préfixe tests-internes-.
- Texte de présentation : Tests Version Interne.

Les identifiants techniques utilisent des tirets, des underscores ou la casse camelCase : un slash n’est pas valide dans un nom de variable d’environnement, une table SQL ou un identifiant TypeScript. Les URL et répertoires utilisent bien tests/internes.

Avant tout déploiement, configurer les nouvelles variables côté Functions pour le contexte concerné. Ne pas lire ni copier les secrets de production. Les sessions, choix locaux et anciens liens ne sont pas réutilisés automatiquement. Mettre à jour les invitations partagées. Aucun secret distant n’est renommé par cette modification de code.

Aucune migration SQL n’a été appliquée. Si une table de retours existe déjà dans un environnement, préparer un renommage transactionnel et vérifier ses droits avant changement du code ; ne pas recréer la table ni perdre les réponses. Le stockage et l’e-mail restent soumis à configuration.

Les noms et versions de dépendances tierces restent strictement inchangés. Les descriptions d’archives sont formulées par rôle pour ne pas inventer de nouveaux chemins dans l’ancien dépôt. L’historique Git, les tags existants et les anciennes PR restent intacts.
