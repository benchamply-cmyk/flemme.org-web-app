# Encaissement de la commission avec Stripe Connect

Statut : **brouillon, rien n'est branché**. Aucun compte Stripe n'a été créé et aucune clé n'est dans le dépôt. Tant que les étapes ci-dessous ne sont pas faites, le site et l'app gardent le paiement direct déclaratif actuel.

## Ce que fait cette version

1. **La commission est configurable.** Un seul réglage, en deux endroits qui doivent rester identiques (un test le vérifie) :
   - `COMMISSION` dans `apps/mobile/src/domain.ts`, pour l'affichage (vitrine, app web, app mobile) ;
   - la table `flemme_mobile_v1.settings` dans `apps/mobile/backend/install.sql`, qui fait foi au moment de l'accord.

   Deux modèles sont prévus :

   | Modèle | Réglage | Forfait 40 € | Déposant paie | Brigadier reçoit | FLEMME garde |
   |---|---|---|---|---|---|
   | Ajout (actuel) | `ajout`, 1000 | forfait du Brigadier | 44 € | 40 € | 4 € |
   | Prélèvement, « 65 % au Brigadier » | `prelevement`, 3500 | prix de la prestation | 40 € | 26 € | 14 € |

   Chaque accord enregistre le taux, le modèle et la part du Brigadier (`payout`). Changer le réglage ne touche pas les accords déjà conclus.

2. **Le paiement en ligne passe par Stripe Connect**, en « paiement à destination » :
   - le Brigadier ouvre un compte Stripe Express depuis son compte FLEMME (« Recevoir mes paiements avec Stripe »). Stripe vérifie son identité et son IBAN ;
   - une fois la tâche terminée, le déposant clique « Payer en ligne ». Stripe Checkout encaisse le total, verse la part du Brigadier sur son compte Stripe et garde la commission pour FLEMME (`application_fee_amount`) ;
   - le webhook Stripe marque la flemme comme payée et l'inscrit dans l'historique. Le paiement direct reste possible (« J'ai payé le Brigadier en direct »).

FLEMME ne touche jamais la part du Brigadier : c'est Stripe, établissement de paiement agréé, qui encaisse pour son compte.

## Fichiers

| Fichier | Rôle |
|---|---|
| `apps/mobile/backend/install.sql` | Table `settings` et calcul serveur de la commission à l'acceptation |
| `apps/mobile/backend/paiement.sql` | Comptes Stripe des Brigadiers, sessions de paiement, RPC `flemme_paiement_api` réservée à `service_role` |
| `apps/mobile/backend/supabase/functions/` | Fonctions Edge `stripe-onboarding`, `stripe-checkout`, `stripe-webhook` (logique dans `_shared/paiement.ts`) |
| `apps/mobile/backend/tests/paiement.test.ts` | Tests des fonctions avec un faux Stripe : signature, montants, refus, idempotence |

## Mise en route en préprod (à faire par Ben)

1. Trancher le modèle économique (voir plus bas) et ajuster `COMMISSION` et la table `settings` si besoin.
2. Créer un compte Stripe au nom de l'entreprise, activer **Connect** (comptes Express, France), rester en **mode test**.
3. Sur un projet Supabase de test, exécuter `install.sql` puis `paiement.sql`.
4. Déclarer les secrets des fonctions Edge (Supabase, Edge Functions, Secrets) : `STRIPE_SECRET_KEY` (une clé `sk_test_…`), `FLEMME_SITE_URL` (adresse de préprod) et, après l'étape 6, `STRIPE_WEBHOOK_SECRET`. Une clé `sk_live_…` est refusée tant que `FLEMME_PAIEMENT_LIVE` ne vaut pas `oui`.
5. Déployer depuis `apps/mobile/backend` :

        supabase functions deploy stripe-onboarding
        supabase functions deploy stripe-checkout
        supabase functions deploy stripe-webhook --no-verify-jwt

6. Dans Stripe, créer un point de terminaison webhook vers `https://<projet>.supabase.co/functions/v1/stripe-webhook`, avec les événements `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, et un second pour les **comptes connectés** avec `account.updated`. Mettre les deux secrets `whsec_…` dans `STRIPE_WEBHOOK_SECRET`, séparés par une virgule.
7. Sur Netlify (contexte de branche `preprod` uniquement) : `VITE_PAIEMENT_EN_LIGNE=oui`, en plus des clés Supabase publiques.
8. Tester avec les cartes de test Stripe (4242 4242 4242 4242) : un Brigadier active ses paiements, un déposant paie une tâche terminée, la flemme passe à « Payé en ligne ».

## Points à décider avant la production

- **Modèle économique.** Le business plan dit que FLEMME vend la prestation, les apps ajoutent 10 % au forfait, les personas Brigade parlent de 65 % reversés. Le code gère « ajout » et « prélèvement » ; si FLEMME vend elle-même la prestation, il faudra plutôt des « charges et virements séparés » (FLEMME vendeur, puis virement au Brigadier), avec TVA et facturation à revoir.
- **Moment du paiement.** Ici, on paie après la tâche. Payer à l'acceptation et verser au Brigadier à la fin (séquestre) protège mieux le Brigadier, mais demande des virements différés et une politique de remboursement.
- **Remboursements et litiges** : rien d'automatique. Ils se font à la main dans le tableau de bord Stripe. Un double paiement est marqué `doublon` en base pour remboursement.
- **Obligations de plateforme** : CGV et CGU à mettre à jour (rôle de Stripe, commission, remboursements), déclaration DAC7 des revenus des Brigadiers, statut des Brigadiers (particuliers ou auto-entrepreneurs).
- **Frais Stripe** : ils sont prélevés sur le compte FLEMME, donc sur la commission. Sur les petits forfaits, la commission peut ne pas couvrir les frais.
