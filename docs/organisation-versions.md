# Organisation des versions : beta et tests internes

Audit du 7 novembre 2026 (23 h 30), fait sur l'état GitHub des branches à cette heure. Aucune fusion, aucun secret ni réglage Netlify, Supabase ou GitHub modifié. Source de contexte : mémorandum « FLEMME — Mémorandum des décisions techniques et organisation Git de la bêta ».

## 1. État des branches

| Branche | Dernier commit | Écart avec preprod | Rôle |
|---|---|---|---|
| `preprod` | c86bcad (#45, 07/11) | référence | intégration, défaut du dépôt |
| `prod` | c199dfa (#35, 04/11) | 61 commits de retard | flemme.org (v6.3000) |
| `beta` | 3cd0457 (#46, 07/11) | 6 commits propres, 9 manquants (#44, #45) | site flemmeorg-beta (atelier visuel) |
| `feature/test-interne` | a5ac1f2 (07/11) | 2 commits propres, 5 manquants (#45) | renommage « tests internes » |
| `claude/project-thread-nz6ywm` | ce94a80 (05/11) | 3 commits propres (PR #37 fermée) | abandonnée, remplacée par #38 |
| `preprod-mobile` | 82e24f6 (#38) | 0 commit propre | entièrement fusionnée |
| `prod-mobile` | c199dfa | identique à prod | aucun usage constaté |
| `docs/unification-flemmev2-preprod-mobile` | 31bdbdf | 1 commit de doc (PR #39 fermée) | non fusionnée |

## 2. Incohérences constatées et corrections proposées

1. **La référence de l'atelier n'est pas le design actuel.** Le site beta compile `prod` c199dfa (v6.3000, avant la refonte) comme « Référence PROD ». Les choix de design et de navigation fusionnés dans preprod (#38, #41 : maquette V0.5, Space Grotesk, icônes, menu « ? », titre alterné) n'apparaissent donc pas dans l'atelier, alors que le code de beta les contient. Correction : décider si l'atelier doit tester prod (choix actuel, volontaire selon le mémorandum) ou le design V0.5 de preprod (214a248). Changer la référence demande aussi de revoir les sélecteurs CSS de `apps/web/src/atelier/preview.ts` et les libellés « Référence PROD ».
2. **`feature/test-interne` est en retard sur preprod et va entrer en conflit.** Son commit bb9dca6 est une copie de 9b972d3 (déjà dans preprod via #45), et il lui manque les deux correctifs de #45 (35b8ede session de test reconnue, b8a46b4 retours invités et notification). Une fusion d'essai vers preprod donne 4 conflits : `site.css`, `tests/internes/AccountAccess.tsx`, `tests/internes/main.tsx`, `docs/beta-testeurs.md` (supprimé d'un côté, modifié de l'autre). Correction : repartir de preprod sur une branche courte et rejouer seulement le renommage a5ac1f2, en gardant les correctifs de #45.
3. **Le renommage casse les consignes du dépôt.** `CLAUDE.md` renvoie vers `beta/README.md` et `docs/beta-testeurs.md`, que `feature/test-interne` déplace vers `tests/internes/` et `docs/tests-internes-testeurs.md` sans mettre à jour `CLAUDE.md` ni `AGENTS.md`. À corriger dans la même PR.
4. **Les règles écrites se contredisent.** `AGENTS.md` (preprod) dit « Aucun environnement beta permanent » et `docs/organisation-git.md` (preprod) « aucun environnement permanent beta n'est nécessaire », alors que le site flemmeorg-beta et la branche beta existent pour l'atelier. Sur beta, la même section de `organisation-git.md` dit l'inverse (« Laboratoire beta »), d'où un conflit à chaque synchronisation. Correction : une seule rédaction, celle du mémorandum (tests internes sur preprod, atelier visuel sur beta), à reporter dans preprod.
5. **Deux commits ont été poussés directement sur beta.** 8695a44 (configurateur et feedback Supabase) et 3eb6ffc (adresses Netlify) ne viennent d'aucune PR fusionnée (#42 a été fermée sans fusion). Le ruleset « FLEMME - promotion et versions beta » ne cible que prod et preprod. Correction : ajouter beta au ruleset (suppression et force push interdits, PR obligatoire), réglage à faire par Ben dans GitHub.
6. **Deux configurateurs coexistent sur beta.** L'ancien configurateur `/beta.html` (dossier `apps/web/src/beta`, feedback Supabase) est masqué par l'atelier, qui prend la racine et `/beta` sur flemmeorg-beta. `docs/beta.md` décrit encore l'ancien. Correction : documenter que seul l'atelier est actif sur beta, puis retirer l'ancien configurateur de beta dans une PR dédiée si Ben le confirme.
7. **CHANGELOG de beta incomplet.** La #46 n'a pas de ligne « À venir », et la section « Bêta expérimentale (non déployée) » est dépassée (l'atelier est déployé). Corrigé dans cette PR.
8. **prod a 61 commits de retard.** La refonte (#38, #41), l'app mobile (#40) et les tests internes (#44, #45) sont en preprod seulement. Aucune promotion à faire sans recette ; à planifier par Ben.
9. **Branches à nettoyer (par Ben, les sessions cloud ne peuvent pas supprimer) :** `claude/project-thread-nz6ywm`, `preprod-mobile`, `prod-mobile` (si inutilisée), `docs/unification-flemmev2-preprod-mobile` (reporter d'abord le fichier de doc s'il est utile).
10. **Nom de branche.** La demande parle de `feature/testsinternes`, la branche s'appelle `feature/test-interne` et le code utilise `tests/internes` et `TESTS_INTERNES_*`. À fixer une fois pour toutes ; je propose `feature/tests-internes` pour la prochaine branche.
11. **Points ouverts du mémorandum, toujours vrais :** notification Netlify Forms vers Ben non configurée, contrôle visuel complet de l'atelier non fait, `flemme.org/beta` non raccordé, projet Supabase désigné pour la V2 incohérent avec son contenu (voir `docs/beta.md`).

## 3. Classement des PR et commits

### 3.1 Design et visuel (CSS, couleurs, typographie, icônes)

| PR | Commits | Contenu |
|---|---|---|
| #41 | ae00ca5 | réglages V0.5 : Space Grotesk, en-tête en verre, boutons, contours, cartes, fonds glacier, animations (`site/reglages.css`) |
| #41 | c902e64, 348e1ab | icônes : points pour Résoudre et Comment ça marche, trait fin ailleurs, Connexion en maison |
| #41 | 4a23a31 | effets de transition du titre (fondu, glisse, volet, flou) |
| #41 | e089ad4 | bouton Flemmes à résoudre au style clair |
| #38 | c47f4e1, 494efdd | design de la maquette V0.3 puis fonds chromés V0.4 |
| #38 | a6661a3, e65ce84, 53cb2c7 | fonds Glacier (variantes, puis Glacier aurore retenu) |
| #38 | 22a56db, 310605f, 7489f3f | icône du menu (4 carrés arrondis), bouton Connexion au style de Déléguer |
| #38 | 3066123 puis 974e36a | tailles du carrousel et des boutons (essai annulé, effet nul) |
| #33, #22, #20 | 5c20972, 625f697, 3e14bf9, f561403 | mise en page de l'accueil (espaces, boutons, cartes) |
| #40 | — | visuel V0.4 de l'app mobile (Expo), sans effet sur le site web |
| #46 (beta) | 722ee9b | atelier : 4 directions, couleurs, typo, arrondis, espacements (outil d'essai, pas le design du site) |

### 3.2 UX et navigation (plan du site, menu, pages, sections)

| PR | Commits | Contenu |
|---|---|---|
| #38 | 77ba739 | arborescence V0.3 : vitrine multipage, concept fusionné dans Comment ça marche, `app.html#deposer`, Mon espace avec « À faire », vocabulaire |
| #38 | c037785, bd42f0b, cdc347b | nouveau menu, responsive, boutons Déléguer et Résoudre dans l'en-tête |
| #38 | ab71e3b, a3f2089, 950de30 | ordre de l'en-tête, burger allégé, tous les « Résoudre » vers `resoudre.html` |
| #38 | f05cfcf, 8cfcd4e, c2da5fc, 687917e | sections déplacées, carrousel et exemples tirés du tableur |
| #41 | 9834bc9 | Comment ça marche dans la barre, menu « ? » (FAQ, Contact, langues) |
| #41 | 4629b5d | titre alterné et surtitre de l'accueil |
| #33, #22 | 0fa9879, 7dcc559, ecb574c | parcours en 5 étapes dans Comment ça marche, présentation en pied de page |
| #44 | cbffd59, 3c61a71, ea8ca52 | entrée « Version test » dans Mon compte et sur l'accueil de l'app |
| #45 | 9b972d3, 35b8ede | bouton « Test » à côté du compte |
| #46 (beta) | 1c17901 | atelier prioritaire sur les pages du site beta |
| #21, #29 | — | parcours métier (recherche, accord, profils, fichiers) : fonctionnel, hors périmètre visuel |

Non classées (outillage, données, documentation) : #9 à #14, #23, #26, #27, #31, #34.

## 4. Listes proposées

### Branche `beta` (site flemmeorg-beta, atelier visuel)

- Déjà présentes : #20, #22, #33, #38, #40, #41 (par la synchronisation d42ef30 de preprod vers beta), #46, et les commits directs 8695a44 et 3eb6ffc.
- À ajouter : cette PR (documentation et CHANGELOG).
- Sur décision de Ben : une PR qui fait de preprod 214a248 (#41, design V0.5) la référence de l'atelier, pour faire tester le design actuel plutôt que celui de prod.
- À ne pas ajouter : #44 et #45 (comptes testeurs, invitations, fonctions serveur), qui relèvent des tests internes sur preprod. Une synchronisation complète de preprod vers beta donne aujourd'hui 4 conflits (`commun.ts`, `vite.config.ts`, `organisation-git.md`, `netlify.toml`).

### Branche `feature/test-interne` (tests internes, vers preprod)

- Base attendue : preprod à jour, donc #44 et #45 avec leurs correctifs (35b8ede, b8a46b4).
- À garder : a5ac1f2 (renommage vers `tests/internes`, `TESTS_INTERNES_*`), rejoué sur preprod, avec `CLAUDE.md` et `AGENTS.md` mis à jour.
- À retirer : bb9dca6 (doublon de 9b972d3).
- Design et UX : rien à ajouter, #38 et #41 sont déjà dans preprod ; l'UX propre aux tests internes est celle de #44 et #45.
- À ne pas ajouter : #46 et les commits de beta (8695a44, 3eb6ffc).

## 5. Circuit de promotion (rappel)

Branche courte depuis preprod → PR vers preprod → recette → PR preprod vers prod, en « Create a merge commit ». Un choix validé dans l'atelier est reporté par une branche courte issue de preprod (cherry-pick ou adaptation), jamais par une fusion de beta. Aucune PR beta vers prod.
