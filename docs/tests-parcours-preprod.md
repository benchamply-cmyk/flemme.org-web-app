# Tests de bout en bout du parcours marketplace

Deux niveaux, du plus rapide au plus réel. Chantier D « Finaliser les parcours et la confiance », Jira FLM-15, FLM-17, FLM-19 et FLM-21.

## 1. Démo locale, automatique

`apps/web/tests/e2e/parcours-demo.cjs` (lancé par `npm run e2e` dans `apps/web`) rejoue tout le parcours dans la démo locale, sans base ni paiement, avec deux personnages : Benjamin (déposant) et Lou (membre qui aide).

Il vérifie :

1. le dépôt d'une demande sur place avec budget (aperçu « tu paieras 44,00 € » pour 40 €) ;
2. la question publique et la proposition du membre, téléphone et e-mail masqués ;
3. l'absence de proposition possible pour le déposant sur sa propre demande ;
4. la réponse publique, la comparaison des offres (45 € + 4,50 € = 49,50 €) et le choix, sans frais dus à ce stade ;
5. l'accord écrit (7 rubriques obligatoires), sa soumission, puis la double signature ;
6. l'impossibilité de déclarer la livraison avant le paiement ;
7. le paiement via Flemme simulé, la livraison déclarée (clôture automatique annoncée à 7 jours), la fin confirmée par le déposant ;
8. l'avis, et la frise qui passe de l'étape 1 à l'étape 7 ;
9. aucune erreur JavaScript pendant le parcours.

Il demande Playwright et Chromium sur le poste (`npm i -D playwright && npx playwright install chromium`). Il ne touche ni preprod ni prod. Il ne couvre pas la relecture par l'équipe : en démo, demandes, propositions et accords sont validés d'office.

## 2. Preprod, à la main, avec les comptes de test

À faire sur https://preprod--flemmeorg.netlify.app avec `test.flemmard@example.com` (déposant) et `test.brigadier@example.com` (membre), dans deux navigateurs (ou une fenêtre privée), plus un compte admin pour /admin.

État de `flemme-preprod` relevé le 23/11/2026 : `payment_mode = simulation`, frais de 10 % (`commission_bps = 1000`, modèle `ajout`), relecture par l'équipe activée pour les demandes, propositions et accords, environnement des flags `preprod`. Flags réglés en base : `espace.confiance` = tous, `espace.aide` = tous. Sans ligne en base, donc valeur du registre : `espace.refonte` = tous, `abonnements.souscription` = éteint, `modele.version` = ouvert. Migrations jusqu'à `20261118140000` appliquées.

| # | Qui | Action | Résultat attendu |
|---|-----|--------|------------------|
| 1 | flemmard | /deleguer/nouvelle : demande sur place, ville, budget 40 € | « Envoyer » accepté ; demande privée « en relecture » |
| 2 | admin | /admin › À valider : publier la demande | La demande apparaît dans /flemmes pour brigadier |
| 3 | brigadier | Ouvrir la demande, poser une question contenant un numéro | Question publiée, numéro remplacé par « [coordonnées masquées] » |
| 4 | brigadier | Proposer 45 € avec un e-mail dans « Ce qui est inclus » | Proposition « en relecture », e-mail masqué |
| 5 | admin | /admin › Candidatures et accords : valider la proposition | flemmard voit l'offre |
| 6 | flemmard | Répondre à la question, comparer, choisir l'offre | Récapitulatif 45 € + 4,50 € = 49,50 € ; « rien n'est dû avant la signature » |
| 7 | flemmard | Rédiger l'accord (7 rubriques), l'enregistrer, le soumettre | Statut « à contrôler » |
| 8 | admin | Valider l'accord | Statut « prêt à signer » chez les deux |
| 9 | flemmard puis brigadier | Signer | « Signé par les deux parties » ; frais de plateforme dus |
| 10 | flemmard | Payer via Flemme (simulation) | Étape 5 sur 7 · Payé ; aucun argent réel |
| 11 | brigadier | « J'ai terminé la mission » | Étape 6 sur 7 · Livré ; clôture possible à J+7 |
| 12 | flemmard | « Mission terminée, je libère le paiement », puis avis | Terminée ; étape 7 sur 7 après l'avis |
| 13 | brigadier | Signaler un désaccord sur une autre mission livrée | Signalement visible dans /admin › Signalements ; plus de clôture automatique |

Noter pour chaque ligne : OK, ou l'écart avec une capture. Les données créées restent dans `flemme-preprod` (base de test).
