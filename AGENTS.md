# Règles du projet FLEMME

Ces règles s'appliquent à tout assistant (Claude, ChatGPT/Codex, Copilot ou autre) et à toute tâche déléguée. Référence complète : `docs/organisation-git.md`. En cas de doute, demander à Ben plutôt que deviner.

## Dépôt et environnements

- Dépôt unique : `benchamply-cmyk/flemme.org-web-app`. FlemmeV2.0 est archivé (lecture seule) ; son historique est dans `historique/flemmev2/` et sous les tags `archive/flemmev2/…`. Ne rien y modifier.
- Netlify : projet `flemmeorg` seulement. `prod` publie https://flemme.org, `preprod` publie https://preprod--flemmeorg.netlify.app, chaque PR a son aperçu `deploy-preview-N--flemmeorg.netlify.app`.
- Supabase : prod = `yktpabnqkhwcshvjuncs`, preprod = `flemme-preprod` (`kklaqwmdphedomsimjim`). Render : `flemme-manager-v2-api` construit `apps/manager` depuis `prod` (Manual Deploy, auto-deploy désactivé).

## Branches

- Deux branches permanentes seulement : `prod` et `preprod` (branche par défaut). Pas de branche `beta`, `V1`, `V2`, de sauvegarde ni de `claude/…`.
- Tout travail part de `preprod` sur une branche courte `type/sujet` : préfixes `feature/`, `fix/`, `docs/`, `chore/`, `mobile/` ; sujet en minuscules avec tirets, sans date ni `/`. Elle est supprimée automatiquement après fusion.
- PR vers `preprod` uniquement. La production ne reçoit que la PR `preprod` → `prod` intitulée « Promotion vX.Y.Z ».
- Jamais de PR dont la source est `prod`. Jamais de push direct, de force push, de rebase ou de suppression sur `prod` ou `preprod`.
- Fusions : **« Create a merge commit » uniquement**. Jamais squash ni rebase.

## Chaque PR

1. Une PR par sujet. Remplir le modèle `.github/pull_request_template.md`.
2. Ajouter une ligne sous « ## À venir » dans `CHANGELOG.md` : quoi, date, demande de Ben, migration ou « Aucune migration ».
3. Poser (ou demander à Ben de poser) une étiquette : `nouveaute`, `correction`, `migration`, `docs` ou `promotion`.
   Le check obligatoire `promotion` refuse toute PR vers `preprod` sans l'une de ces étiquettes ou sans modification de `CHANGELOG.md`.
4. Lancer les tests et le build pertinents ; les contrôles CI doivent être verts (`promotion` est obligatoire ; `web`, `native`, `migrations`, `python` tournent selon les dossiers modifiés).
5. Ne poser **aucun** numéro de version, tag ni release pour une PR ordinaire.

## Versions, tags et releases

- Numéro unique `vMAJEUR.MINEUR.CORRECTIF` (`v1.5.0`, `v1.5.1`, `v2.0.0`). MAJEUR = changement de modèle (v2 = mise en relation ouverte), MINEUR = une fonctionnalité, CORRECTIF = une correction seule. Dernière version : voir le haut du CHANGELOG et les releases GitHub.
- Une promotion par fonctionnalité terminée. Au gel : PR `chore/version-x-y-z` qui transforme « À venir » en « vX.Y.Z (candidate) », notes de version, tag `vX.Y.Z-rc.N` et pré-release. À la promotion, **après la fusion seulement** : tag `vX.Y.Z` sur le merge commit de `prod` (vérifier le SHA avant de publier) et release « Latest » (« Generate release notes »).
- Les releases sont immuables : les préparer en brouillon ; une erreur publiée se corrige par une nouvelle version, jamais en déplaçant un tag.
- Tags `v*` et `archive/*` : jamais supprimés ni déplacés. Tags automatiques `build/<branche>-pr<N>-<sha>` (workflow `beta-version.yml`). Anciens noms `v6.*` et `beta-*` conservés.
- Les maquettes de design (« maquette 1 à 7 ») ne sont pas des versions.

## Ne rien perdre

- Avant toute suppression (branche, tag, dépôt, site), vérifier que le dernier commit est dans `preprod`, `prod`, une PR ou sous un tag, et donner la liste « conservé par … ». Une piste abandonnée devient un tag `archive/<sujet>-<date>` avant que sa branche soit supprimée.
- Republier une ancienne version : branche `fix/retour-vX-Y-Z` depuis le tag, PR vers `preprod`, puis promotion. En urgence seulement : « Publish deploy » d'un ancien déploiement Netlify, à corriger ensuite par Git.

## Feature flags et migrations

- Une fonctionnalité non terminée peut entrer dans `preprod` derrière un flag (`packages/shared/src/flags.ts`, états `off`/`testeurs`/`tous`, réglés dans /admin › Fonctionnalités). `modele.version` = `hybride` en preprod, `ouvert` en prod. Voir `docs/feature-flags.md`. Un flag masque de l'interface, il ne donne aucun droit.
- Migrations Supabase : additives (ajouter, ne pas supprimer ni renommer dans la même version), nommées `AAAAMMJJHHMMSS_sujet.sql`, appliquées d'abord sur preprod puis sur prod juste avant la fusion de la promotion, et inscrites dans `supabase_migrations.schema_migrations`. Montants en centimes.

## Ce que l'assistant fait seul, et ce qu'il ne fait pas

- Seul : créer une branche courte, coder, tester, ouvrir une PR, tenir le CHANGELOG, rédiger les notes de version, vérifier (lecture) GitHub, Netlify, Render, Supabase.
- Uniquement sur demande explicite de Ben pour cette action (« fusionne », « applique », « supprime ») : fusionner une PR, appliquer une migration, publier ou déployer, poser un tag, créer une release, supprimer quoi que ce soit, modifier un réglage GitHub, Netlify, Render ou Supabase, accorder un rôle.
- Jamais : contourner un refus de contrôle automatique ou de permission (expliquer le motif et demander l'approbation précise), désactiver un test pour passer au vert, réécrire l'historique de `prod`/`preprod`, annoncer qu'une version est en ligne sans avoir vérifié le déploiement.

## Bêta, accès et secrets

- Le configurateur /beta utilise le code de la branche courante. Le bouton Version test du compte et le serveur vérifient l'accès. Jamais d'autorisation fondée sur le seul e-mail ou rôle fourni par le navigateur.
- Référent : ben.champly@gmail.com. Ajouter les autres testeurs uniquement par configuration serveur BETA_TESTER_EMAILS après instruction ; aucun droit admin métier implicite.
- Ne jamais transmettre un jeton de compte à une autre origine ni le mettre dans une URL. Les invitations sont des secrets révocables, à ne pas publier dans GitHub ou les journaux.
- Aucun secret dans Git, VITE_* ou le bundle client. Ne pas lire, copier ni modifier les secrets de production sans nécessité et autorisation. Ne pas réutiliser les secrets d'alertes ou de paiement pour la bêta.

## Compte rendu

- Écrire en français. Répondre franchement, annoncer risques et incertitudes ; aucun compliment d'ouverture ni déclaration de succès sans preuve.
- Après chaque intervention : liens réellement créés (PR, commits, tags), contrôles exécutés et leur résultat, ce qui reste à faire par Ben. Distinguer test local, CI, aperçu déployé et production vérifiée.
