# Configurateur de test : un dépôt, un projet Netlify, deux branches

Décision du 7 novembre 2026 : remplace l'architecture de la PR #42. Branche de travail courte depuis preprod, intégration preprod puis PR preprod → prod. Aucun besoin d'une branche tests/internes permanente, ni d'un second site Netlify. Les PR #42 et #43 sont devenues obsolètes ; aucune de leurs branches persistantes ne doit être supprimée automatiquement lors d'une fusion.

## Adresses

- flemme.org/tests/internes : configurateur du code de prod.
- preprod--flemmeorg.netlify.app/tests/internes : configurateur du code de preprod.
- /tests/internes/testprod redirige vers https://flemme.org/tests/internes.
- /tests/internes/testpreprod redirige vers https://preprod--flemmeorg.netlify.app/tests/internes.

Les raccourcis sur flemme.org n'existeront qu'après promotion du code vers prod. Aucun sous-domaine prodtest n'est créé. Les chemins et liens internes du configurateur sont absolus pour fonctionner sous /tests/internes.

## Accès

Compte référent initial : ben.champly@gmail.com, authentifié auprès du Supabase configuré pour l'environnement. Une connexion spécifique au mode test est proposée sur /tests/internes (même compte Supabase, cookie séparé de la session de l'app). Aucun rôle d'administration métier n'est ajouté en base et aucun compte n'est créé. Le serveur vérifie l'adresse confirmée via Auth /user ; aucune autorisation issue de user_metadata ou du navigateur.

Les invités utilisent /tests/internes?invite=<jeton>. L'interface efface le jeton de l'adresse dès son démarrage ; Referrer-Policy: no-referrer empêche sa transmission par le navigateur. Ce lien reste un secret partageable : quiconque le possède peut le transmettre. Il peut apparaître dans l'historique ou les journaux d'accès. Ne pas le publier dans GitHub, le dépôt ou un canal public.

Après validation : cookie signé HMAC, HttpOnly, Secure, SameSite=Lax, durée une heure. Le cookie d'invité contient une empreinte du jeton, pas sa valeur. L'invitation a une date limite ; changer TESTS_INTERNES_INVITE_TOKEN invalide les accès invités existants. Changer TESTS_INTERNES_SESSION_SECRET invalide toutes les sessions de test. GET revérifie l'identité Supabase pour les sessions de compte. Aucun refresh token ou mot de passe n'est conservé par le serveur. Quitter le mode test supprime le cookie et désactive les variantes ; les autres onglets sont revérifiés au focus et chaque minute.

Les visiteurs sans session ne voient pas le menu tests/internes et ne reçoivent pas les variantes, même si des choix existent déjà dans leur stockage local. Le code CSS/JS de présentation demeure public : ce mécanisme protège l'accès au configurateur et au feedback, pas le secret du code ni les autorisations métier. Les pages normales continuent à fonctionner.

## Variables à configurer par contexte, portée Functions

- TESTS_INTERNES_ENABLED=oui ; sans activation explicite, aucun accès.
- TESTS_INTERNES_SESSION_SECRET : secret aléatoire au moins 32 caractères.
- TESTS_INTERNES_ADMIN_EMAILS=ben.champly@gmail.com (valeur initiale par défaut côté serveur).
- TESTS_INTERNES_TESTER_EMAILS : autres comptes autorisés, adresses confirmées séparées par des virgules. Retirer un compte révoque son accès au prochain contrôle serveur.
- Le dossier tests/internes/ décrit les versions, génère /tests/internes/version.json et porte les instructions de projet. Le workflow tests-internes-version tague chaque merge commit de PR vers preprod/prod, sans push sur ces branches.
- VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY : valeurs publiques du même environnement que l'app ; doivent aussi être disponibles aux fonctions pour la vérification du compte. Ne jamais copier de clé privilégiée au frontend.
- TESTS_INTERNES_INVITE_TOKEN : jeton aléatoire d'au moins 32 caractères.
- TESTS_INTERNES_INVITE_EXPIRES_AT : date ISO explicite. Aucune invitation acceptée sans date valide future.

Ne pas réutiliser les secrets d'alertes ou de paiement. Ne pas écraser les variables existantes. Configurer et valider d'abord preprod ; configurer production lors de la promotion autorisée. Les cookies sont propres à chaque origine : un lien prod ne connecte pas automatiquement à preprod.

## Feedback

La fonction tests-internes-feedback exige la même autorisation serveur (compte ou invitation). Enregistrement puis notification Resend, idempotence par UUID. La configuration de stockage reste volontairement indépendante : projet Supabase dédié au feedback, TESTS_INTERNES_SUPABASE_URL, TESTS_INTERNES_SUPABASE_SECRET_KEY, TESTS_INTERNES_ALLOWED_ORIGIN exacte, TESTS_INTERNES_FEEDBACK_ENABLED=oui ; e-mail : TESTS_INTERNES_RESEND_API_KEY, TESTS_INTERNES_EMAIL_TO, TESTS_INTERNES_EMAIL_FROM. Le SQL supabase/tests/internes/feedback.sql reste hors des migrations de production. Sans ces réglages, l'interface annonce l'indisponibilité ; aucun succès fictif. Purge à 90 jours et reprise des notifications à mettre en service avant collecte.

## Validation et promotion

Tester refus anonyme, lien erroné/expiré, rotation et révocation, connexion compte référent confirmée, exclusion d'un autre compte même avec un mot de passe valide, suppression du cookie, absence de variantes chez le visiteur normal, liens Premium avec Pretty URLs, formulaires et navigation. Les tests serveur utilisent des identités et secrets fictifs ; recette réelle de compte requise avant ouverture.

Les tests sur prod utilisent les connexions de prod : écritures, e-mails et paiements restent réels. Les options du configurateur ne donnent aucun droit supplémentaire et ne modifient aucune configuration backend. Les paiements ne sont pas activés par ce chantier.

Intégration via PR vers preprod avec marqueur [skip netlify] jusqu'à vérification des contextes ; puis recette preprod, puis PR preprod → prod avec merge commit. L’ancien site de test séparé et son ancienne branche restent conservés tant que le remplacement n'est pas validé ; les retirer demande une action séparée, sans perte des retours.

## Protection GitHub effective

Ruleset 26773580 actif sur prod et preprod : PR, une approbation par un autre compte que l’auteur, contrôles web et promotion obligatoires, branche à jour, discussions résolues, merge commit uniquement, suppression/force push interdits et aucun contournement. Les anciens rulesets sont conservés. Source versionnée : tests/internes/github-ruleset.json.
