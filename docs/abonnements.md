# Abonnements (v2.0.0)

Statut : **code prêt, rien d'ouvert.** Demande de Ben (18/11/2026) : implémenter la souscription avec des conditions et des détails encore modifiables, à partir d'un modèle générique.

## Deux verrous

Une formule n'est proposée à un membre que si les **deux** conditions sont remplies :

1. **Le flag `abonnements.souscription` est allumé.** Il se règle dans /admin, onglet Fonctionnalités, sur « Tout le monde » ou « Testeurs ». Il est éteint par défaut partout. En base, l'absence de ligne vaut « éteint ».
2. **La formule est prête dans `flemme_v2.subscription_plans`.** Elle doit être en statut `open` avec au moins un prix Stripe (`price_…`). Elle se règle dans /admin, onglet Abonnements.

## Modèle générique

Chaque formule est décrite par les mêmes champs, dans deux endroits qui partagent le même identifiant :

| Champ | Code (`packages/shared/src/abonnements.ts`, texte de /premium) | Base (`subscription_plans`, fait foi à la souscription) |
|---|---|---|
| Identifiant | `id` | `id` |
| Nom, public | `nom`, `pour` | `name`, `audience` |
| Prix mensuel et annuel (centimes) | `prixMensuel`, `prixAnnuel` | `monthly_amount`, `yearly_amount` + `stripe_price_monthly`, `stripe_price_yearly` |
| Essai gratuit (jours) | `essaiJours` | `trial_days` |
| Avantages, conditions propres | `avantages`, `conditions` | `perks`, `conditions` |
| Statut | `brouillon`, `ouverte`, `fermee` | `draft`, `open`, `closed` |

Les conditions communes à toute formule sont dans `CONDITIONS_COMMUNES` :
- sans engagement, résiliable depuis Mon espace ;
- aucun effet sur les frais de plateforme ;
- paiement par carte avec Stripe.

Elles s'affichent sur /premium et dans Mon espace.

Livré : une formule « Membre Premium » en brouillon, sans prix. La page /premium affiche « Bientôt ».

## Parcours

1. Mon espace liste les formules ouvertes. « S'abonner » ouvre Stripe Checkout en mode abonnement, via la fonction Edge `stripe-subscribe`.
2. Les webhooks Stripe tiennent l'abonnement à jour (`checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`). Ils sont idempotents par `evt_…`, comme les paiements.
3. « Gérer ou résilier mon abonnement » ouvre le portail client Stripe : carte, factures et résiliation à la fin de la période.

Statuts : `incomplete`, `trialing`, `active`, `past_due`, `canceled`, `unpaid`.

## Ouvrir une formule (à faire par Ben, préprod d'abord)

1. Appliquer la migration `20261118130000_flemme_v2_abonnements.sql`, après `20261118120000`.
2. Dans Stripe (mode test) :
   - créer le produit et ses prix récurrents ;
   - activer le portail client (Billing, Customer portal).
3. Déployer la fonction :

        supabase functions deploy stripe-subscribe

4. Ajouter au webhook de la plateforme les événements `customer.subscription.created`, `customer.subscription.updated` et `customer.subscription.deleted`.
5. Dans /admin, onglet Abonnements, renseigner :
   - le prix et le prix Stripe ;
   - les avantages et les conditions ;
   - le statut « Ouverte ».
6. Dans /admin, onglet Fonctionnalités, mettre « Souscription aux abonnements » sur « Testeurs » en préprod.
7. Dans le code, quand les textes sont validés, reporter la formule dans `FORMULES`, avec le statut « ouverte » et le prix. La page /premium affichera alors « S'abonner » quand le flag est allumé.

## À décider

- Prix, périodes, essai, public (membres qui aident, déposants, tous).
- Avantages réellement livrés : alertes prioritaires, mise en avant, badge. Ils ne sont pas encore codés.
- TVA et mentions à ajouter aux CGV (§ Abonnements).
