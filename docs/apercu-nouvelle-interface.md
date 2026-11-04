# Aperçu séparé de la nouvelle interface Flemme

État : démonstration interactive, 4 novembre 2026. URL de page : `/apercu.html`.

Cette page reprend l’aperçu local `Flemme-demo.html` examiné le 4 novembre 2026. Elle s’appuie sur le logo existant, la police Archivo, la palette glacier/pastel, les cartes bordées et les ombres violettes de la branche `prod` consultée à cette date. La PR est créée depuis `preprod` et vise `preprod`, conformément au choix de Ben d’ajouter une **page de démonstration séparée**.

## Accès et isolation

Lancer `npm ci`, puis `npm run dev` depuis `apps/web`, et ouvrir `/apercu.html`. La page est aussi incluse dans `npm run build` grâce à une entrée Vite dédiée. Elle porte `noindex,nofollow` : il s’agit d’une indication aux robots, pas d’un contrôle d’accès.

L’accueil actuel et l’application connectée sont conservés. La démo ne lit aucune variable de connexion, n’importe pas de passerelle distante et n’appelle pas le backend. Ses données sont stockées uniquement dans ce navigateur, sous la clé distincte `flemme-preview-20261104-v1`. Sur le navigateur utilisé pour la démo locale précédente, les saisies peuvent donc être retrouvées. Aucun compte réel n’est créé.

## Inventaire des interactions implémentées

| Partie | Implémentation dans la démonstration |
| --- | --- |
| Accueil | Deux actions dans l’ordre « Déléguer ma flemme », « Résoudre une flemme », explication en une phrase, « Décrire · Échanger · S’accorder », exemples de demandes et accès aux deux espaces. |
| Navigation | Pages par fragments d’URL, retour navigateur, menu Comment ça marche / Questions fréquentes / Mon espace, confidentialité, aide et lien d’évitement clavier. |
| Déposer | Titre, description libre, catégorie, délai urgent/aujourd’hui/demain/3 jours/1 semaine/1 mois/1 an/autre, précision du délai autre. |
| Budget | Montant libre facultatif ou fourchette ; contrôle de leur incompatibilité. Fourchettes sans chevauchement : [0,10[, [10,50[, [50,200], >200 €. Sans montant : « À discuter ». |
| Localisation | À distance / sur place / les deux ; ville/secteur et adresse conditionnels. Ville publique dans le parcours prévu, adresse précise privée. |
| Fichiers | Sélecteur PDF/JPEG/PNG/Word, limite illustrative de 10 Mo par fichier et conservation locale des noms. Autres formats à cadrer. Aucun transfert. |
| Dictée | Bouton insérant une transcription d’exemple modifiable. Aucun micro ni moteur de transcription actif. |
| Brouillons de demande | Enregistrement local, liste, reprise et modification. Conservation après envoi. |
| Envoi | Connexion ou création de compte de démonstration exigée à l’envoi ; demande privée en attente de validation admin, jamais ajoutée automatiquement à la liste publique. |
| Correction | Exemple de demande privée avec correction demandée ; formulaire de reprise et nouvel envoi pour examen. Modification des demandes créées localement. |
| Recherche | Mots clés dans titre/description/catégorie, filtres catégorie/localisation/budget/délai, tri par délai ou budget, compteur, absence de résultats et réinitialisation. |
| Fiche | Description, budget indicatif, mode, délai, auteur, fichiers illustratifs et action explicite pour écrire. La consultation ne crée pas de conversation. |
| Compte et rôles | Un compte démo, deux espaces distincts, rôle actif affiché et bascule visible. Modification locale du nom affiché. |
| Flemmard | Vue d’ensemble, prochaines actions, demandes, brouillons de demande, conversations, prestations, fichiers et contrats. |
| Brigadier | Vue d’ensemble, profil, candidatures, engagements, brouillons de candidature, prestations, conversations, fichiers et contrats. |
| Profil | Nom, présentation, compétences et expériences enregistrés localement ; sélection d’une photo affichée pendant la session ; note 5/5 illustrative et recommandation reliée à une mission fictive terminée. |
| Candidatures | Périmètre, résultat, disponibilités et prix ; brouillon sauvegardable/reprenable ; correction illustrative puis statut en attente d’examen admin, non transmise. |
| Conversations | Messages saisis enregistrés localement, sélection d’un nom de fichier, accès candidature/accord/aide et emplacement du futur paiement. |
| Accord | Tâche/résultat, qualité/critères d’acceptation, délai, prix, annulation/remboursement, confidentialité/fichiers ; brouillon, soumission admin, retour admin simulé et représentation des deux signatures. |
| Accompagnement | Assistant à réponse prédéfinie puis sollicitation humaine simulée depuis la conversation. Aucun message externe envoyé ; téléphone reporté. |
| Pédagogie | Parcours détaillé, FAQ et page confidentialité, limites de la mise en relation et absence de garantie de résultat. |
| Mobile et accessibilité | Grilles réorganisées en une colonne, navigation d’espace horizontale, champs étiquetés, focus visible et annonces de statut. |

## Simulations et limites explicites

- Comptes, participants, demandes publiques, prestations et engagements sont fictifs. Il n’existe pas de contrôle d’accès serveur ou d’échange entre appareils dans cette page.
- Les statuts de validation admin sont des représentations, pas un service de modération connecté.
- Aucun fichier n’est envoyé. Seuls ses noms sont mémorisés. La photo sélectionnée reste en mémoire pendant la session.
- La conversation conserve des messages locaux sans les transmettre. Le chatbot répond avec un texte prédéfini et la demande d’aide humaine ne contacte personne.
- Aucune signature juridique réelle, aucun avis réel, aucune vérification de mission réellement effectuée. Le lien entre avis et mission est illustratif.
- Paiement désactivé : aucun prestataire externe connecté, aucun argent demandé ni encaissé. La commission est **arrêtée** (décision du 3 novembre 2026) : 10 % ajoutés au forfait du Brigadier, payés par le Flemmard, calculés par `price()` et le réglage `COMMISSION` de `packages/shared` (PR #10). Acompte de 50 %, retenue de 20 % et annulation proportionnelle restent des pistes **non arrêtées**.
- Un accord et une candidature principaux servent la démonstration. Le modèle de données n’est pas prêt pour une gestion multi-missions réelle.
- Les textes publics/privés représentent le parcours souhaité : cette page ne vérifie pas les permissions réelles ni les durées de conservation.
- Aucun premium, badge vérifié/privilégié, annuaire, recommandation automatique ou paiement d’engagement Brigadier n’est ajouté.

## Améliorations après revue (PR suivante)

- **Modèle économique aligné** : la candidature, l’accord, la conversation, la recherche et la FAQ affichent « forfait + 10 % de frais Flemme = total payé par le Flemmard », recalculé à la saisie du prix, avec la même fonction que l’app connectée.
- **Règles testables** : budget affiché, contrôle du dépôt, recherche/filtres/tri, calcul du tarif et dictée sont dans `apps/web/src/apercu/logique.ts`, couverts par `apps/web/tests/apercu.test.ts`.
- **Corrections** : modifier une demande puis enregistrer un brouillon et envoyer ne crée plus de doublon ; la demande en attente survit à un rechargement de l’écran de connexion (avant : demande vide enregistrée) ; la demande « correction demandée » disparaît une fois corrigée ; un brouillon de candidature repris n’est plus dupliqué à chaque sauvegarde ; la dictée ajoute le texte à la fin sans saut de ligne parasite ; « Déléguer ma flemme » repart toujours d’un formulaire vide, même par l’historique du navigateur ; l’aide ne propose « Revenir à la conversation » que si une conversation a été ouverte.
- **Lisibilité** : les demandes envoyées affichent leur budget et leur délai.
- **Démo** : bouton « Réinitialiser la démo » dans Mon compte.
- **Accessibilité** : `aria-current` sur l’espace et l’onglet actifs, bascule de rôle déclarée comme groupe.

## Vérification

L’aperçu initial a été vérifié dans Chrome bureau et à 390 × 844 : dépôt avec brouillon et passage par connexion, demande privée en attente, bascule des espaces, filtre Lyon, conversation volontaire, candidature, accord et signatures simulées, assistant puis demande humaine. Pas de débordement horizontal constaté sur formulaire, espace et assistance.

Pour le portage dans ce dépôt, la syntaxe JavaScript, la vérification TypeScript, les tests existants et le build Vite doivent passer. La validation navigateur porte sur `/apercu.html` construit. Les détails effectifs des commandes et leurs résultats sont consignés dans la PR.

## Références

Consultées le 4 novembre 2026 :

- [Site actuel](https://flemme.org/).
- [Accueil de référence sur prod](https://github.com/benchamply-cmyk/flemme.org-web-app/blob/prod/apps/web/index.html), SHA fichier `9c5eb896aef44a17e7f240808981b2f062f0462e`.
- [Styles de référence sur prod](https://github.com/benchamply-cmyk/flemme.org-web-app/blob/prod/apps/web/src/styles.css), SHA fichier `ffe0d3792bee80261f7f47a5b69cb27157f4e64f`.
- [Organisation Git](organisation-git.md) : branche de travail courte depuis preprod, PR vers preprod, fusion par Ben.

Cette PR conserve le logo déjà présent dans `apps/web/public/flemme-logo.png` et n’ajoute aucune migration ou dépendance applicative.

Résultats du portage, 4 novembre 2026 : `node --check`, `git diff --check`, `npm run typecheck`, les **31 tests existants** et `npm run build` réussis. La page construite `/apercu.html` a été ouverte dans Chrome : formulaire → connexion démo obligatoire → envoi privé en attente → liste des demandes. Cette dernière vue a été vérifiée à 390 × 844, avec largeur de document de 390 px. Les tests automatisés existants contrôlent l’application et le code partagé ; ils ne constituent pas des tests de bout en bout de cette nouvelle démo.
