// Abonnements (v2.0.0, demande de Ben du 18/11/2026) : le code de souscription est prêt, mais les formules, prix et conditions
// restent modifiables et rien n'est ouvert. Le flag « abonnements.souscription » est éteint partout.
//
// Modèle générique : une formule = un nom, un public, des prix (mensuel et/ou annuel, en centimes), un essai, des avantages,
// des conditions et un statut. Pour ajouter ou changer une formule :
//   1. modifier FORMULES ci-dessous (texte de la page /premium, généré au build) ;
//   2. reporter la même formule dans flemme_v2.subscription_plans (/admin ou SQL), avec l'identifiant de prix Stripe :
//      c'est la base qui fait foi au moment de souscrire (prix, statut, essai).
// Une formule « brouillon » s'affiche « Bientôt » ; seule une formule « ouverte », avec un prix et un prix Stripe en base,
// peut être souscrite, et seulement quand le flag est allumé.

export type PublicFormule = 'membre' | 'deposant' | 'tous';
export type StatutFormule = 'brouillon' | 'ouverte' | 'fermee';
export type FormuleAbonnement = {
  /** Identifiant stable, en minuscules (même valeur que flemme_v2.subscription_plans.id). */
  id: string;
  nom: string;
  accroche: string;
  pour: PublicFormule;
  /** Prix en centimes, TTC. null = pas encore décidé. */
  prixMensuel: number | null;
  prixAnnuel: number | null;
  /** Jours d'essai gratuits (0 = aucun). */
  essaiJours: number;
  avantages: string[];
  conditions: string[];
  statut: StatutFormule;
};

/** Conditions communes à toute formule (reprises dans les CGV, § Abonnements). */
export const CONDITIONS_COMMUNES = [
  'Sans engagement : résiliable à tout moment depuis Mon espace, effet à la fin de la période payée.',
  'Un abonnement ne change ni les frais de plateforme ni le prix d’une mission, et ne garantit aucune mission.',
  'Paiement par carte avec Stripe, renouvelé automatiquement. Prix et conditions affichés avant la souscription.',
] as const;

// Formules : textes provisoires, à valider par Ben avant toute ouverture.
export const FORMULES: FormuleAbonnement[] = [
  { id: 'membre-premium', nom: 'Membre Premium', accroche: 'Pour les membres qui aident souvent.', pour: 'membre',
    prixMensuel: null, prixAnnuel: null, essaiJours: 0, statut: 'brouillon',
    avantages: ['Alertes en priorité sur les nouvelles flemmes', 'Profil mis en avant et badge Premium', 'Suivi des prestations et des revenus dans l’app'],
    conditions: [] },
];

export type StatutAbonnement = 'incomplete' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
export const statutAbonnementLabel: Record<StatutAbonnement, string> = {
  incomplete: 'Paiement en attente', trialing: 'Essai gratuit en cours', active: 'Actif', past_due: 'Paiement en retard',
  canceled: 'Résilié', unpaid: 'Impayé, suspendu',
};
/** Un abonnement donne accès aux avantages dans ces états. */
export const abonnementActif = (s: StatutAbonnement) => s === 'active' || s === 'trialing' || s === 'past_due';

/** Abonnement d'un membre, tel que renvoyé par l'action « subscriptions ». */
export type Abonnement = { planId: string; status: StatutAbonnement; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean };
/** FormuleAbonnement telle que la base la renvoie (seules les formules ouvertes avec un prix Stripe sont listées). */
export type FormuleServeur = { id: string; name: string; monthlyAmount: number | null; yearlyAmount: number | null; trialDays: number;
  perks: string[]; conditions: string[] };

const ID = /^[a-z][a-z0-9-]{1,39}$/;
/** Vérifie une formule du modèle : levée d'une erreur lisible si un champ ne va pas. */
export function verifierFormule(f: FormuleAbonnement): FormuleAbonnement {
  if (!ID.test(f.id)) throw new Error(`Identifiant de formule invalide : ${f.id}`);
  if (!f.nom.trim() || f.nom.length > 60) throw new Error(`Nom de formule invalide : ${f.id}`);
  for (const p of [f.prixMensuel, f.prixAnnuel]) if (p != null && (!Number.isInteger(p) || p <= 0 || p > 100000)) throw new Error(`Prix invalide : ${f.id}`);
  if (!Number.isInteger(f.essaiJours) || f.essaiJours < 0 || f.essaiJours > 90) throw new Error(`Essai invalide : ${f.id}`);
  if (!f.avantages.length || f.avantages.length > 8) throw new Error(`De 1 à 8 avantages : ${f.id}`);
  if (f.conditions.length > 8) throw new Error(`8 conditions au plus : ${f.id}`);
  if (f.statut === 'ouverte' && f.prixMensuel == null && f.prixAnnuel == null) throw new Error(`Une formule ouverte a un prix : ${f.id}`);
  return f;
}

/** Une formule s'affiche comme souscriptible seulement si elle est ouverte, avec un prix. */
export const souscriptible = (f: FormuleAbonnement) => f.statut === 'ouverte' && (f.prixMensuel != null || f.prixAnnuel != null);

const euros = (c: number) => (c / 100).toFixed(2).replace('.', ',').replace(/,00$/, '') + ' €';
/** « 4,90 € / mois », « 49 € / an », les deux, ou « Bientôt » tant que le prix n'est pas décidé. */
export function prixFormule(f: Pick<FormuleAbonnement, 'prixMensuel' | 'prixAnnuel' | 'statut'>): string {
  if (f.statut === 'fermee') return 'Fermée';
  const parts = [f.prixMensuel != null ? euros(f.prixMensuel) + ' / mois' : '', f.prixAnnuel != null ? euros(f.prixAnnuel) + ' / an' : ''].filter(Boolean);
  return f.statut === 'brouillon' || !parts.length ? 'Bientôt' : parts.join(' ou ');
}

/** Ligne d'état d'un abonnement pour Mon espace. */
export function resumeAbonnement(a: Abonnement, nom: string, date: (iso: string) => string): string {
  const fin = a.currentPeriodEnd ? date(a.currentPeriodEnd) : null;
  if (a.status === 'canceled') return `${nom} : résilié.`;
  if (a.cancelAtPeriodEnd && fin) return `${nom} : ${statutAbonnementLabel[a.status].toLowerCase()}, prend fin le ${fin}.`;
  return `${nom} : ${statutAbonnementLabel[a.status].toLowerCase()}${fin ? `, renouvelé le ${fin}` : ''}.`;
}
