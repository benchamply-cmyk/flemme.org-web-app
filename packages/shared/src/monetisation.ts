// Monétisation de la marketplace ouverte (v2.0.0), d'après les documents de Ben du 17-18/11/2026 :
// « Étude de monétisation et anti-contournement » v0.2 (décisions validées) et « Business plan marketplace ouverte » v0.1.
//
// Décisions VALIDÉES reprises ici :
// - Modèle B : publication, consultation, propositions et discussion gratuites ; contrat standard inclus.
// - Frais de plateforme UNIQUES, payés par le déposant, en POURCENTAGE du prix librement négocié (D2).
// - Le fait générateur des frais est la SIGNATURE de l'accord (D1) : ici, la seconde signature.
// - Paiement de la mission via Flemme OBLIGATOIRE (D6) : la déclaration « j'ai payé en direct » n'est plus le parcours normal.
// NON VALIDÉ, donc réglable et jamais écrit en dur : le taux (flemme_v2.settings.commission_bps, 10 % provisoire
// repris de la décision du 03/11), un minimum ou plafond (aucun), la TVA et les frais du prestataire de paiement (D3).
// Le mode « simulation » rejoue le parcours sans argent réel ; le mode « stripe » encaisse par Stripe Checkout à la signature
// (migration 20261118120000, fonctions Edge stripe-checkout, stripe-payout et stripe-webhook).
import type { Price } from './domain.ts';
import { rateLabel } from './domain.ts';

/** Mode de règlement des missions, réglé côté serveur (flemme_v2.settings.payment_mode) et renvoyé avec chaque flemme. */
export type ModePaiement = 'direct' | 'simulation' | 'stripe';
export const MODES_PAIEMENT: readonly ModePaiement[] = ['direct', 'simulation', 'stripe'];
export const modePaiementLabel: Record<ModePaiement, string> = {
  direct: 'Paiement direct déclaratif (ancien parcours)',
  simulation: 'Paiement via Flemme · simulation, aucun argent réel',
  stripe: 'Paiement via Flemme · carte bancaire avec Stripe, à la signature',
};
/** Un mode inconnu ou absent (flemme créée avant la v2.0.0, serveur pas encore migré) vaut « direct ». */
export const modePaiement = (value: unknown): ModePaiement => value === 'simulation' || value === 'stripe' ? value : 'direct';
/** Vrai quand la mission se paie via Flemme (simulation ou Stripe) : paiement à la signature, déclaration directe fermée. */
export const payeViaFlemme = (t: { paymentMode?: ModePaiement } | undefined) => !!t && modePaiement(t.paymentMode) !== 'direct';

/** États d'un paiement de mission (étude v0.2, § 8). « paid » = encaissement confirmé. */
export type StatutPaiement = 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded' | 'disputed';
export const statutPaiementLabel: Record<StatutPaiement, string> = {
  pending: 'En attente', authorized: 'Autorisé, pas encore encaissé', paid: 'Payé', failed: 'Échec du paiement',
  refunded: 'Remboursé', disputed: 'Contesté',
};

export const FRAIS_LIBELLE = 'Frais de plateforme Flemme';

/** Rappel affiché au dépôt d'une demande : rien n'est payé avant la signature. */
export const fraisDeposant = (p: Pick<Price, 'rateBps'>) =>
  `Publier et recevoir des propositions est gratuit. Si tu signes un accord, des frais de plateforme de ${rateLabel(p)} du prix convenu s’ajoutent, à ta charge.`;
/** Rappel côté intervenant : il touche tout le prix qu'il a négocié. */
export const fraisIntervenant = (p: Pick<Price, 'rateBps'>) =>
  `Proposer est gratuit et ton prix t’est versé en entier : les frais de plateforme (${rateLabel(p)}) sont payés par le déposant.`;
/** Règle commerciale (D6), formulée sans surveillance des messages ni promesse de garantie. */
export const PAIEMENT_OBLIGATOIRE = 'Une mission conclue sur Flemme se paie sur Flemme. C’est ce qui garde l’accord signé, le paiement et l’historique au même endroit si un problème survient.';
/** Sensibilisation au moment de l'engagement (anti-contournement proportionné, étude v0.2 § 9). */
export const RAPPEL_CONTOURNEMENT = 'Payer en dehors de Flemme fait perdre le suivi du paiement et l’appui de l’équipe en cas de désaccord.';

export type LigneRecap = { label: string; value: string; strong?: boolean };
/**
 * Écran unique avant signature (étude v0.2 § 3) : prix de la prestation, pourcentage et montant des frais,
 * total déposant, rémunération de l'intervenant. Une seule ligne de frais, jamais de « frais de contrat » en plus.
 */
export function recapitulatif(p: Price, money: (n: number) => string): LigneRecap[] {
  const ajout = p.model === 'ajout';
  return [
    { label: 'Prix convenu de la prestation', value: money(p.amount) },
    { label: `${FRAIS_LIBELLE} · ${rateLabel(p)}${ajout ? ', payés par le déposant' : ', retenus sur le prix'}`, value: money(p.commission) },
    { label: 'Total payé par le déposant', value: money(p.total), strong: true },
    { label: 'Versé à la personne qui réalise la mission', value: money(p.payout) },
  ];
}

/** Où en est l'argent d'une mission : gratuit → choisi → frais dus (signature) → payé. */
export type EtapeArgent = 'gratuit' | 'choisi' | 'frais_dus' | 'paye';
export function etapeArgent(t: { agreement?: unknown; contract?: { feeDueAt?: string | null; status: string } | null; payment?: { status: string } }): EtapeArgent {
  if (t.payment?.status === 'paid') return 'paye';
  if (t.contract?.status === 'signed' || t.contract?.feeDueAt) return 'frais_dus';
  return t.agreement ? 'choisi' : 'gratuit';
}
export const etapeArgentLabel: Record<EtapeArgent, string> = {
  gratuit: 'Gratuit : rien n’est dû tant qu’aucun accord n’est signé.',
  choisi: 'Proposition choisie : rien n’est dû avant la signature de l’accord par les deux parties.',
  frais_dus: 'Accord signé : les frais de plateforme sont dus et le paiement via Flemme est ouvert.',
  paye: 'Paiement enregistré via Flemme.',
};

/** Prix saisi en centimes → texte éditable en euros (« 12,50 »). */
export const eurosEditables = (cents: number) => (cents / 100).toFixed(2).replace('.', ',').replace(/,00$/, '');
