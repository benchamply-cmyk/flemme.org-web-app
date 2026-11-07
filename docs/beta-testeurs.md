# Configurateur de test : un dépôt, un projet Netlify, deux branches

Décision du 7 novembre 2026 : remplace l'architecture de la PR #42. Branche de travail courte depuis preprod, intégration preprod puis PR preprod → prod. Aucun besoin d'une branche beta permanente, ni d'un second site Netlify. Les PR #42 et #43 sont devenues obsolètes ; aucune de leurs branches persistantes ne doit être supprimée automatiquement lors d'une fusion.

## Adresses

- flemme.org/beta : configurateur du code de prod.
- preprod--flemmeorg.netlify.app/beta : configurateur du code de preprod.
- /beta/testprod redirige vers https://flemme.org/beta.
- /beta/testpreprod redirige vers https://preprod--flemmeorg.netlify.app/beta.

Les raccourcis sur flemme.org n'existeront qu'après promotion du code vers prod. Aucun sous-domaine prodtest n'est créé. Les chemins et liens internes du configurateur sont absolus pour fonctionner sous /beta.

## Accès

Compte référent initial : ben.champly@gmail.com, authentifié auprès du Supabase configuré pour l'environnement. Une connexion spécifique au mode test est proposée sur /beta (même compte Supabase, cookie séparé de la session de l'app). Aucun rôle d'administration métier n'est ajouté en base et aucun compte n'est créé. Le serveur vérifie l'adresse confirmée via Auth /user ; aucune autorisation issue de user_metadata ou du navigateur.

Les invités utilisent /beta?invite=<jeton>. L'interface efface le jeton de l'adresse dès son démarrage ; Referrer-Policy: no-referrer empêche sa transmission par le navigateur. Ce lien reste un secret partageable : quiconque le possède peut le transmettre. Il peut apparaître dans l'historique ou les journaux d'accès. Ne pas le publier dans GitHub, le dépôt ou un canal public.

Après validation : cookie signé HMAC, HttpOnly, Secure, SameSite=Lax, durée une heure. Le cookie d'invité contient une empreinte du jeton, pas sa valeur. L'invitation a une date limite ; changer BETA_INVITE_TOKEN invalide les accès invités existants. Changer BETA_SESSION_SECRET invalide toutes les sessions de test. GET revérifie l'identité Supabase pour les sessions de compte. Aucun refresh token ou mot de passe n'est conservé par le serveur. Quitter le mode test supprime le cookie et désactive les variantes ; les autres onglets sont revérifiés au focus et chaque minute.

Les visiteurs sans session ne voient pas le menu Bêta et ne reçoivent pas les variantes, même si des choix existent déjà dans leur stockage local. Le code CSS/JS de présentation demeure public : ce mécanisme protège l'accès au configurateur et au feedback, pas le secret du code ni les autorisations métier. Les pages normales continuent à fonctionner.

## Variables à configurer par contexte, portée Functions

- BETA_ENABLED=oui ; sans activation explicite, aucun accès.
- BETA_SESSION_SECRET : secret aléatoire au moins 32 caractères.
- BETA_ADMIN_EMAILS=ben.champly@gmail.com (valeur initiale par défaut côté serveur).
- BETA_TESTER_EMAILS : autres comptes autorisés, adresses confirmées séparées par des virgules. Retirer un compte révoque son accès au prochain contrôle serveur.
- Le dossier beta/ décrit les versions, génère /beta/version.json et porte les instructions de projet. Le workflow beta-version tague chaque merge commit de PR vers preprod/prod, sans push sur ces branches.
- VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY : valeurs publiques du même environnement que l'app ; doivent aussi être disponibles aux fonctions pour la vérification du compte. Ne jamais copier de clé privilégiée au frontend.
- BETA_INVITE_TOKEN : jeton aléatoire d'au moins 32 caractères.
- BETA_INVITE_EXPIRES_AT : date ISO explicite. Aucune invitation acceptée sans date valide future.

Ne pas réutiliser les secrets d'alertes ou de paiement. Ne pas écraser les variables existantes. Configurer et valider d'abord preprod ; configurer production lors de la promotion autorisée. Les cookies sont propres à chaque origine : un lien prod ne connecte pas automatiquement à preprod.

## Feedback

La fonction beta-feedback exige la même autorisation serveur (compte ou invitation). Enregistrement puis notification Resend, idempotence par UUID. La configuration de stockage reste volontairement indépendante : projet Supabase dédié au feedback, BETA_SUPABASE_URL, BETA_SUPABASE_SECRET_KEY, BETA_ALLOWED_ORIGIN exacte, BETA_FEEDBACK_ENABLED=oui ; e-mail : BETA_RESEND_API_KEY, BETA_EMAIL_TO, BETA_EMAIL_FROM. Le SQL supabase/beta/feedback.sql reste hors des migrations de production. Sans ces réglages, l'interface annonce l'indisponibilité ; aucun succès fictif. Purge à 90 jours et reprise des notifications à mettre en service avant collecte.

## Validation et promotion

Tester refus anonyme, lien erroné/expiré, rotation et révocation, connexion compte référent confirmée, exclusion d'un autre compte même avec un mot de passe valide, suppression du cookie, absence de variantes chez le visiteur normal, liens Premium avec Pretty URLs, formulaires et navigation. Les tests serveur utilisent des identités et secrets fictifs ; recette réelle de compte requise avant ouverture.

Les tests sur prod utilisent les connexions de prod : écritures, e-mails et paiements restent réels. Les options du configurateur ne donnent aucun droit supplémentaire et ne modifient aucune configuration backend. Les paiements ne sont pas activés par ce chantier.

Intégration via PR vers preprod avec marqueur [skip netlify] jusqu'à vérification des contextes ; puis recette preprod, puis PR preprod → prod avec merge commit. Le site flemmeorg-beta et la branche beta restent conservés tant que le remplacement n'est pas validé ; les retirer demande une action séparée, sans perte des retours.
