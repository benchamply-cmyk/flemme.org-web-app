# Alignement mobile sur preprod — 04/11/2026

## Faits et source

Base exacte : [preprod, ce05a971](https://github.com/benchamply-cmyk/flemme.org-web-app/commit/ce05a971a39381974fbb12b2520072de86359001), consultée le 04/11/2026. L’app native existe dans apps/mobile ; le site utilise apps/web et les deux interfaces consomment packages/shared.

## Décisions mises en œuvre

- Accueil : « Déléguer ma flemme » ouvre directement le dépôt ; « Résoudre une flemme » ouvre les missions ; le suivi « Mes flemmes » reste accessible.
- Dépôt : catégorie (dont Autre), délai avec précision conditionnelle, budget libre ou fourchette, lieu à distance/sur place/les deux, adresse privée. Validation par taskInput, options et frais venant du socle existant.
- Suivi : état de validation privée, motif de correction/refus, catégorie, délai, fourchette et adresse privée réservée aux participants concernés.
- Modification : préremplissage par taskFields, accès selon canEdit, renvoi via la commande edit existante.
- Brouillons : chaque sauvegarde appelle saveDraft sans id et crée une nouvelle version. Reprendre copie les champs ; envoyer ne transmet pas draftId et conserve les versions précédentes. Aucun bouton de suppression. Cette décision diffère du site, qui peut remplacer et supprimer ses brouillons.
- Navigation : retour en haut à chaque changement d’écran ; retour Android conservé.

Ces changements concernent l’interface native. Aucun schéma, donnée distante, service de paiement ou configuration de production n’est modifié.

## Validation effectuée

- Installation reproductible : npm ci --offline --ignore-scripts, à partir du verrou existant.
- TypeScript : npm run typecheck, réussi.
- npm test : 33 tests réussis, dont 4 tests des actions réellement branchées aux écrans mobiles (navigation, envoi validé, conservation des versions et refus d’édition après attribution).
- Export Metro iOS et Android : réussis. Ces bundles ne constituent pas des applications signées.
- Simulateur iOS : indisponible (CoreSimulatorService inaccessible). Aucun test visuel ou geste sur appareil ne peut être déclaré réalisé.

## Limites et suite

Premier lot d’alignement fonctionnel, pas une parité complète. La dictée native, les liens de récupération de compte, le paiement Stripe mobile et les candidatures sauvegardées restent à traiter. Les composants et couleurs natifs existants sont conservés ; aucune nouvelle maquette n’est présentée comme validée visuellement.

Avant un test connecté, vérifier que le serveur configuré inclut la migration parcours déjà présente dans preprod. Aucun déploiement automatique de migration dans ce travail.

Test conseillé sur deux téléphones : déposer une demande, enregistrer/reprendre plusieurs versions, vérifier sa validation avec l’équipe, corriger, proposer puis accepter une offre. Vérifier sur le second compte que l’adresse précise reste invisible avant attribution.

## Lancer

Depuis la racine du dépôt :

    cd apps/mobile
    npm ci
    npm start -- --clear

Sans .env : démo locale et personnages fictifs. Le service connecté utilise uniquement la configuration publique documentée dans apps/mobile/.env.example. Le test d’une vraie modération demande le service connecté ; la démo ne simule pas une équipe de validation.

Suivi : https://benchp.atlassian.net/browse/FLEMME-6
Documentation : https://benchp.atlassian.net/wiki/spaces/DCHPLY/pages/131097
Références uniquement, sans synchronisation continue.
