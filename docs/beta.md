# Bêta : audit et mise en service proposée

Audit du 7 novembre 2026. Aucun environnement réel ni secret modifié.

## Constat vérifié

- Dépôt : benchamply-cmyk/flemme.org-web-app ; défaut preprod.
- Base de travail : preprod 82e24f6 ; prod c199dfa. La préprod contient une refonte de la vitrine et des ajustements de parcours absents de prod (41 fichiers différents). Beta part de preprod, pas de prod.
- Netlify flemmeorg (interface authentifiée) : dépôt correct, production = prod, branche déployée = preprod, aperçus automatiques pour les PR vers ces deux branches. Seule une modification de prod peut publier en production. Interface : anciens réglages node build.js / publication racine ; le netlify.toml du dépôt définit apps/web, npm run build, dist. La résolution effective devra être confirmée dans le journal du prochain aperçu autorisé.
- Les valeurs et portées des variables n'ont pas été auditées : lecture détaillée refusée par la vérification automatique, risque de révéler des secrets. Ne pas réutiliser les secrets de production pour la bêta.
- Supabase connecté : yktpabnqkhwcshvjuncs (projet nommé ben.champly@gmail.com's Project). Les 10 tables public inventoriées ont RLS activée et appartiennent à l'ancien espace (demandes, messages, profils, manager…). Aucune table flemme_v2 ni beta_feedback dans ce schéma. La documentation du dépôt désigne pourtant ce projet pour la V2 : incohérence à résoudre avant toute connexion réelle. Aucune donnée métier ou clé récupérée.
- Render My Workspace : flemme-manager-v2-api utilise encore FlemmeV2.0/main, auto-déploiement off, previews off. L'application web actuelle ne l'appelle pas (docs/manager-render.md). Aucun changement nécessaire au configurateur. Test de l'intégration Manager réel hors de cette livraison ; utiliser un service bêta séparé si elle est ajoutée.
- DNS public : flemme.org résout vers 35.157.26.135 et 63.176.8.218 ; NS dns1–4.p06.nsone.net. beta.flemme.org ne renvoie aucune adresse. Cela ne constitue pas un inventaire complet de la zone DNS.

## Parcours examinés

Vitrine et pages de fonctionnement, catalogue, FAQ, Premium, contact, mentions et confidentialité ; app React (inscription/connexion/récupération, dépôt, listes, candidature, accord, compte, signalement) ; admin séparée. Paiement Stripe conditionné par VITE_PAIEMENT_EN_LIGNE. Alertes existantes Supabase → fonction Netlify → Resend : laissées intactes. Audit du code et tests automatisés locaux ; pas de test de transaction ou de compte en production.

## Architecture retenue

Une branche persistante beta issue de preprod ; un site Netlify bêta distinct recommandé pour éviter l'héritage des variables et fonctions de production. Un projet Supabase bêta séparé, comptes et données fictifs ; même technologie et mêmes parcours, sans partager les données de production. beta.flemme.org sera associé seulement après validation et autorisation. Une alternative moins isolée est un branch deploy beta du site actuel, à condition de vérifier chaque variable par contexte.

Le configurateur /beta.html affiche les vraies pages dans un iframe. Les choix sont conservés localement sous flemme.beta.v1 et appliqués au site de la même origine, y compris en plein écran. 3 thèmes, couleurs prédéfinies ou personnalisées, 3 menus ; options actuelles : accès visible à Aide et lien Premium. Ce sont des options de présentation, pas des contrôles d'autorisation ni une désactivation serveur de fonctionnalités métier. Ajouter d'autres variantes dans config.ts et runtime.ts avec leur comportement réel.

Le serveur reçoit le feedback, valide les champs, exige un code testeur et une origine exacte, refuse le projet Supabase de production, enregistre avant l'e-mail et conserve notified_at. Le navigateur ne reçoit aucune clé privilégiée. RLS + révocation anon/authenticated ; uniquement service_role côté fonction. Idempotence par UUID du formulaire, et clé Resend. Le code testeur réduit les soumissions non sollicitées ; il ne remplace pas une authentification individuelle. La limite de débit déclarée doit être confirmée sur le plan Netlify avant ouverture aux testeurs.

## Configuration à autoriser puis effectuer

1. Créer le projet Supabase bêta isolé. Appliquer manuellement supabase/beta/feedback.sql, conservé volontairement hors migrations de production. Vérifier insert/select serveur et refus anon/authenticated. Configurer purge à 90 jours et suivi/reprise des notifications pending (notified_at null) avant collecte réelle : aucun ordonnanceur n'est encore créé.
2. Choisir le site Netlify bêta. Repo identique, branche beta, base apps/web, commande npm run build, publication dist, fonctions netlify/functions. Ne pas copier les secrets. Laisser les paiements et alertes métier inactifs.
3. Variables de build uniquement sur la bêta : VITE_BETA_ENABLED=oui ; VITE_PAIEMENT_EN_LIGNE=non. Sans VITE_SUPABASE_* : démonstration locale. Pour connecter les parcours au projet bêta : VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY dédiées, puis VITE_BETA_BACKEND_VERIFIED=oui après vérification. Ce dernier est une confirmation opérateur, pas une preuve automatique de l'isolation.
4. Variables serveur dédiées, jamais VITE_ : BETA_FEEDBACK_ENABLED=oui, BETA_SUPABASE_URL (projet bêta), BETA_SUPABASE_SECRET_KEY, BETA_ALLOWED_ORIGIN (origine HTTPS exacte, sans slash final), BETA_INVITE_CODE, BETA_RESEND_API_KEY, BETA_EMAIL_FROM (expéditeur vérifié), BETA_EMAIL_TO (adresse personnelle à confirmer). Aucun destinataire n'est codé en dur. Activer e-mail seulement après configuration et accord ; l'enregistrement reste possible si l'e-mail n'est pas configuré.
5. Vérifier Auth Supabase (Site URL/redirects bêta), CORS exact, SMTP et comptes fictifs ; Stripe test uniquement si un chantier futur l'active. Aucun appel Manager tant qu'il n'existe pas de service isolé.
6. Autoriser le premier aperçu. Une PR vers preprod déclenche Netlify automatiquement, y compris en brouillon. Vérifier le contexte avant de l'ouvrir. Le contexte beta du netlify.toml active seulement l'interface, pas le feedback ; un deploy preview nécessite une activation ciblée si souhaitée.
7. Recette : choix/rechargement/plein écran, menus mobile, navigation et app démo ; formulaire invalide/refus origine/code, un enregistrement puis notification, panne e-mail sans perte, nouvelle tentative sans doublon, accès données interdit au navigateur. Puis seulement autoriser DNS beta.flemme.org. Ne pas ouvrir aux testeurs avant validation de la persistance, de l'e-mail et de la rétention.

## Promotion et protection

beta → PR ciblées vers preprod → PR preprod vers prod. Jamais beta → prod. Pour plusieurs expérimentations, commits indépendants ; extraire uniquement les choix retenus dans une branche courte issue de preprod (cherry-pick), PR vers preprod. Ne pas fusionner l'ensemble du laboratoire par défaut. Aucun merge effectué par l'agent.

Le workflow Flux de promotion refuse une PR vers prod sauf depuis preprod, et refuse beta vers une autre branche que preprod. Il faut rendre ce check obligatoire dans les rulesets GitHub pour une protection opposable, avec absence de contournement, suppression et force push interdits sur prod/preprod/beta. Le fichier seul ne bloque pas un administrateur ni un push direct. Protéger beta de la suppression automatique après fusion d'une PR. Réglages GitHub à vérifier/autoriser séparément.

## Retour arrière

Désactiver VITE_BETA_ENABLED / BETA_FEEDBACK_ENABLED sur la bêta, puis déployer le commit précédent autorisé. Aucun retour arrière de production nécessaire. Supprimer le sous-domaine seulement si demandé ; conserver les retours selon la durée annoncée. Ne pas supprimer de données pendant un simple rollback du code.
