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

## v2.0.0 : paiement à la signature (migration 20261118120000)

Décision de Ben (18/11/2026) : la mission se paie **en entier via Flemme, à la signature de l'accord**. Les frais de plateforme (10 % pendant la bêta) sont dus à la seconde signature, à la charge du déposant.

**Rien ne change tant que `flemme_v2.settings.payment_mode` vaut `direct`** (valeur livrée). Le mode est figé sur chaque flemme à sa création.

| Mode | Effet |
|---|---|
| `direct` | Ancien parcours : paiement direct déclaratif, ou Stripe après la tâche si `VITE_PAIEMENT_EN_LIGNE=oui`. |
| `simulation` | Parcours v2 complet sans argent réel : bouton « Payer via Flemme (simulation) » après la double signature. |
| `stripe` | Parcours v2 avec Stripe Checkout à la signature. |

Pour essayer en préprod, après avoir appliqué la migration :

    update flemme_v2.settings set payment_mode = 'simulation';

### Ce que fait la migration

- **Prix dans l'accord.** Le déposant ou le membre choisi peut modifier le prix convenu dans l'accord. Il est recalculé avec le taux figé au choix de la proposition.
- **Accord versionné.** Chaque enregistrement crée une version, gardée dans `flemme_v2.agreement_versions`, et efface les signatures. `fee_due_at` est daté à la seconde signature.
- **Contrat v0.2.**
  - Rubriques obligatoires : livrable, réception et validation.
  - Rubriques facultatives : accès et informations fournis, responsabilités et assurance.
  - Les clauses communes s'affichent avant la signature.
  - Les accords v0.1 déjà enregistrés restent valables.
- **Statuts de paiement** : `pending`, `authorized` (paiement différé lancé), `paid`, `failed`, `refunded`, `disputed`. S'y ajoutent `expired` et `doublon` de l'ancien parcours.
- **Garde-fous en base** (trigger `payment_mode_guard`) :
  - pas de fin de mission sans accord signé et paiement `paid` ;
  - pas de déclaration de paiement direct ;
  - mode de paiement figé une fois la proposition choisie.
- **Webhooks idempotents.**
  - Chaque événement Stripe est enregistré par son identifiant `evt_…` dans `flemme_v2.stripe_events`, dans la même transaction que son traitement.
  - Un événement rejoué ne fait rien deux fois.
  - Si le traitement échoue, rien n'est enregistré et Stripe renvoie l'événement.

### Argent : charges séparées

1. À la signature, le déposant paie le total par Stripe Checkout (`stripe-checkout` avec `stage: 'signature'`). Flemme encaisse, sans compte connecté ni `application_fee`.
2. À la fin de la mission, le déposant ou le membre clique « Verser la part du membre ». La fonction `stripe-payout` crée un virement Stripe (`transfers`) vers le compte Express du membre, une seule fois (clé d'idempotence par flemme).
3. Le membre doit avoir activé ses paiements (« Recevoir mes paiements avec Stripe ») ; sinon le versement attend.

### Mise en route du mode `stripe` (à faire par Ben)

1. Appliquer la migration en préprod (SQL collé dans l'éditeur, comme d'habitude).
2. Déployer la nouvelle fonction en plus des trois existantes :

        supabase functions deploy stripe-payout

3. Ajouter ces événements au point de terminaison webhook de la plateforme :
   - `charge.refunded`
   - `charge.dispute.created`
   - `charge.dispute.closed`
4. Passer `payment_mode` à `stripe` et `VITE_PAIEMENT_EN_LIGNE=oui` (contexte preprod).

### Limites connues

- Le virement au membre n'utilise pas `source_transaction` : le solde Stripe de Flemme doit être disponible au moment du versement. Sinon Stripe refuse, et il suffit de réessayer plus tard.
- Les remboursements se déclenchent dans le tableau de bord Stripe. Le webhook met ensuite le statut à jour.
- L'app mobile renvoie vers flemme.org pour le paiement par carte.

## Points à décider avant la production

- **Moment du paiement.** Ici, on paie après la tâche. Payer à l'acceptation et verser au Brigadier à la fin (séquestre) protège mieux le Brigadier, mais demande des virements différés et une politique de remboursement.
- **Remboursements et litiges** : rien d'automatique. Ils se font à la main dans le tableau de bord Stripe. Un double paiement est marqué `doublon` en base pour remboursement.
- **Obligations de plateforme** : CGV et CGU à mettre à jour (rôle de Stripe, commission, remboursements), déclaration DAC7 des revenus des Brigadiers, statut des Brigadiers (particuliers ou auto-entrepreneurs).
- **Frais Stripe** : ils sont prélevés sur le compte FLEMME, donc sur la commission. Sur les petits forfaits, la commission peut ne pas couvrir les frais.
