# Modifier les services du site (sans code)

Tout le catalogue de l’accueil est dans **`apps/web/contenu/services.json`** : familles, services, prix, option urgence, cartes « Autres services » et « Demande de devis », exemples du carrousel. Les liens « Nos services » du pied de page suivent les familles.

## Depuis le téléphone : l’atelier

Ouvrir `/atelier-services.html` sur le site déployé (aperçu de PR, puis preprod). On modifie dans l’onglet « Modifier », on voit le rendu réel dans « Aperçu » (côte à côte sur ordinateur). Le brouillon reste dans le navigateur. « Enregistrer… » copie le fichier et ouvre GitHub sur la bonne branche : tout sélectionner, coller, « Commit changes ». L’atelier ne publie rien lui-même (aucun jeton GitHub dans le site).

## Depuis GitHub, en 4 clics

1. Ouvrir le fichier sur la branche voulue, puis cliquer sur le crayon (Edit this file).
   - Version de préproduction en cours : branche `feature/services-modifiables` (l’aperçu de la PR se met à jour tout seul).
   - Après fusion dans `preprod` : GitHub propose de créer une branche et une PR, ce qui est la bonne voie (les branches persistantes sont protégées).
2. Modifier les textes entre guillemets et les prix (chiffres seuls).
3. « Commit changes ».
4. Attendre 1 à 2 minutes : Netlify reconstruit l’aperçu. Si le fichier est mal rempli, le build s’arrête et le journal Netlify dit quoi corriger (ex. `familles[2] « SAV et réclamations ».services[1].prix : prix à écrire en chiffres`). Rien de cassé n’est publié.

## Ce qu’on peut changer

| Je veux… | Je fais… |
|---|---|
| changer un prix | `"prix": 19` → `"prix": 24` (pas de guillemets, pas de €) |
| renommer un service ou une famille | changer le texte de `"nom"` |
| ajouter un service | copier une ligne `{ "nom": "…", "prix": 19 },` dans `services` |
| masquer sans effacer | ajouter `"visible": false` au service, à la famille, à `urgence` ou à une carte hors catalogue |
| ajouter une famille | copier un bloc famille entier (de `{` à `}`), avec `couleur`, `icone`, `services` et, si on veut la voir dans le carrousel, `exemple` |
| changer le carrousel | modifier le bloc `exemple` de la famille (titre, prix, délai, ce que le client reçoit) |

Couleurs : `glacier-clair`, `vert-tendre`, `peche`, `lagon`, `menthe`, `lavande`, `ciel`, `glacier`.
Icônes : `courrier`, `sav`, `annonce`, `maison`, `voyage`, `loupe`, `etoile`, `outil`, `calendrier`, `cle`.

Pièges du format JSON : une virgule entre deux éléments, **pas** de virgule après le dernier ; guillemets droits `"` ; une apostrophe `’` ou `'` dans un texte ne pose pas de problème. Les espaces avant `? ! : ;` et `€` sont mises en forme automatiquement.

Ce fichier ne change que l’affichage de la vitrine : il ne crée ni paiement ni tarif côté app. Les formules « Autres services » et « Demande de devis » de l’app restent dans `src/formules.ts`.
