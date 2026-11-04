# Encaissement de la commission avec Stripe Connect

Statut : **brouillon, rien n'est branché**. Aucun compte Stripe n'a été créé et aucune clé n'est dans le dépôt. Tant que les étapes ci-dessous ne sont pas faites, le site et l'app gardent le paiement direct déclaratif actuel.

## Ce que fait cette version

1. **La commission est configurable.** Un seul réglage, en deux endroits qui doivent rester identiques (un test le vérifie) :
   - `COMMISSION` dans `packages/shared/src/domain.ts`, pour l'affichage (vitrine, app web, app mobile) ;
   - la table `flemme_v2.settings` (migration `supabase/migrations/20261103140000_flemme_v2_commission_paiement.sql`), qui fait foi au moment de l'accord.

   Deux modèles sont prévus :

   | Modèle | Réglage | Forfait 40 € | Déposant paie | Brigadier reçoit | FLEMME garde |
   |---|---|---|---|---|---|
   | Ajout (actuel) | `ajout`, 1000 | forfait du Brigadier | 44 € | 40 € | 4 € |
   | Prélèvement, « 65 % au Brigadier » | `prelevement`, 3500 | prix de la prestation | 40 € | 26 € | 14 € |

   Chaque flemme enregistre le taux et le modèle appliqués (`commission_bps`, `commission_model`) ; l'API renvoie aussi le total et la part du Brigadier (`payout`). Changer le réglage ne touche pas les accords déjà conclus. Les accords conclus avant la migration sont marqués « 10 % ajoutés ».

   **Décision de Ben (03/11/2026) : on garde 10 % ajoutés au forfait.** C'est le réglage livré.

   Pour changer de taux plus tard, il faut modifier à la fois `COMMISSION` et la ligne de `flemme_v2.settings` (par une nouvelle migration), sinon le test échoue.

2. **Le paiement en ligne passe par Stripe Connect**, en « paiement à destination » :
   - le Brigadier ouvre un compte Stripe Express depuis son compte FLEMME (« Recevoir mes paiements avec Stripe »). Stripe vérifie son identité et son IBAN ;
   - une fois la tâche terminée, le déposant clique « Payer en ligne ». Stripe Checkout encaisse le total, verse la part du Brigadier sur son compte Stripe et garde la commission pour FLEMME (`application_fee_amount`) ;
   - le webhook Stripe marque la flemme comme payée et l'inscrit dans l'historique. Le paiement direct reste possible (« J'ai payé le Brigadier en direct »).

FLEMME ne touche jamais la part du Brigadier : c'est Stripe, établissement de paiement agréé, qui encaisse pour son compte.

## Fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20261103140000_flemme_v2_commission_paiement.sql` | Table `settings`, taux figé sur chaque flemme, comptes Stripe des Brigadiers, sessions de paiement, RPC `flemme_paiement_api` réservée à `service_role` |
| `supabase/functions/` | Fonctions Edge `stripe-onboarding`, `stripe-checkout`, `stripe-webhook` (logique dans `_shared/paiement.ts`) |
| `supabase/tests/paiement.test.mjs` | Tests SQL de la migration (PGlite) : accords existants, réglage, droits, montants, webhook rejoué, doublon |
| `supabase/tests/functions.test.ts` | Tests des fonctions avec un faux Stripe : signature, montants, refus, idempotence |

## Mise en route en préprod (à faire par Ben)

1. Créer un compte Stripe au nom de l'entreprise, activer **Connect** (comptes Express, France), rester en **mode test**.
2. Sur un projet Supabase de test (ou une branche Supabase), appliquer les migrations : `npx supabase db push` (voir `supabase/README.md`). **Pas sur la production sans ton accord.**
3. Déclarer les secrets des fonctions Edge (Supabase, Edge Functions, Secrets) : `STRIPE_SECRET_KEY` (une clé `sk_test_…`), `FLEMME_SITE_URL` (adresse de préprod) et, après l'étape 5, `STRIPE_WEBHOOK_SECRET`. Une clé `sk_live_…` est refusée tant que `FLEMME_PAIEMENT_LIVE` ne vaut pas `oui`.
4. Déployer depuis la racine du dépôt :

        supabase functions deploy stripe-onboarding
        supabase functions deploy stripe-checkout
        supabase functions deploy stripe-webhook --no-verify-jwt

5. Dans Stripe, créer un point de terminaison webhook vers `https://<projet>.supabase.co/functions/v1/stripe-webhook`, avec les événements `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, et un second pour les **comptes connectés** avec `account.updated`. Mettre les deux secrets `whsec_…` dans `STRIPE_WEBHOOK_SECRET`, séparés par une virgule.
6. Sur Netlify (contexte de branche `preprod` uniquement) : `VITE_PAIEMENT_EN_LIGNE=oui`, en plus des clés Supabase publiques.
7. Tester avec les cartes de test Stripe (4242 4242 4242 4242) : un Brigadier active ses paiements, un déposant paie une tâche terminée, la flemme passe à « Payé en ligne ».

## Points à décider avant la production

- **Moment du paiement.** Ici, on paie après la tâche. Payer à l'acceptation et verser au Brigadier à la fin (séquestre) protège mieux le Brigadier, mais demande des virements différés et une politique de remboursement.
- **Remboursements et litiges** : rien d'automatique. Ils se font à la main dans le tableau de bord Stripe. Un double paiement est marqué `doublon` en base pour remboursement.
- **Obligations de plateforme** : CGV et CGU à mettre à jour (rôle de Stripe, commission, remboursements), déclaration DAC7 des revenus des Brigadiers, statut des Brigadiers (particuliers ou auto-entrepreneurs).
- **Frais Stripe** : ils sont prélevés sur le compte FLEMME, donc sur la commission. Sur les petits forfaits, la commission peut ne pas couvrir les frais.
