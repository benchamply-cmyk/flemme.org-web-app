import type { Task } from './domain.ts';
import { rights } from './ecrans.ts';

// Refonte de Mon espace (v2.1.0, demande de Ben du 18/11/2026, maquettes « Flemme – Refonte Mon espace ») :
// frise d’avancement d’une demande, prochaine action attendue et taux de remplissage du profil.
// Logique pure, partagée par le site et, plus tard, par l’app mobile.

/** Les 7 étapes de la frise, de la publication à la fin de la mission. */
export const ETAPES = ['Publiée', 'Offres', 'Contrat', 'Signé', 'Payé', 'Livré', 'Terminé'] as const;
export type Etape = typeof ETAPES[number];

/**
 * Étape atteinte par une demande (0 à 6), lue dans l’état réel de la flemme.
 * -1 : pas encore publiée (en attente de validation ou à corriger).
 * « Livré » = mission déclarée livrée par le membre (deliveredAt, v2.1.0) ou tâche confirmée terminée ;
 * « Terminé » = tâche terminée et avis donné par la personne connectée.
 */
export function etapeAtteinte(t: Task): number {
  if (t.review && t.review !== 'published') return -1;
  if (t.status === 'completed') return t.myReview ? 6 : 5;
  if (t.deliveredAt) return 5;
  const paye = t.payment?.status === 'paid' || t.paymentConfirmed;
  if (paye) return 4;
  if (t.contract?.status === 'signed') return 3;
  if (t.agreement) return 2;
  if (t.offers.some(o => o.status === 'pending')) return 1;
  return 0;
}

/** Libellé court de l’avancement : « Étape 2 sur 7 · Offres ». */
export function avancement(t: Task): string {
  const i = etapeAtteinte(t);
  return i < 0 ? 'En attente de publication' : `Étape ${i + 1} sur ${ETAPES.length} · ${ETAPES[i]}`;
}

/** Prochaine action attendue de la personne connectée sur une demande, ou '' si c’est à l’autre d’agir. */
/** `confiance` : flag espace.confiance allumé (livraison et libération du paiement, v2.1.0). */
export function prochaineAction(t: Task, actorId: string, { confiance = false }: { confiance?: boolean } = {}): string {
  const can = rights(t, actorId);
  if (can.isOwner && t.review === 'changes_requested') return 'Corriger ta demande';
  if (can.isOwner && t.status === 'open' && t.offers.some(o => o.status === 'pending')) return 'Comparer les offres reçues';
  if (can.canSign) return 'Relire et signer le contrat';
  if (can.canContract && !t.contract) return 'Préparer le contrat';
  if (can.canContract && (t.contract?.status === 'draft' || t.contract?.status === 'changes_requested')) return 'Relire le contrat';
  if (can.canPay) return 'Payer via Flemme';
  if (can.canDeclarePayment) return 'Régler et déclarer le paiement';
  if (can.canConfirmPayment) return 'Confirmer le paiement reçu';
  if (confiance && can.canDeliver) return 'Déclarer la mission livrée';
  if (confiance && can.canRelease) return 'Clôturer et libérer le paiement';
  if (can.canComplete) return 'Confirmer la tâche terminée';
  if (can.canReview) return 'Donner ton avis';
  return '';
}

/** Dernière activité d’une discussion (message le plus récent), pour trier la messagerie. */
export function derniereActivite(t: Task, offerId: string): string {
  const o = t.offers.find(v => v.id === offerId);
  return o?.messages.at(-1)?.at || t.createdAt;
}

/** Profil public : éléments remplis sur 5 (photo, nom, présentation, compétences, expérience). */
export function remplissageProfil(p: { avatar?: string | null; name?: string; bio?: string | null; skills?: string[]; experience?: string | null }) {
  const items = [
    { label: 'Photo', ok: !!p.avatar },
    { label: 'Nom affiché', ok: !!p.name?.trim() },
    { label: 'Présentation', ok: !!p.bio?.trim() },
    { label: 'Compétences', ok: (p.skills?.length || 0) > 0 },
    { label: 'Expérience', ok: !!p.experience?.trim() },
  ];
  const faits = items.filter(i => i.ok).length;
  return { faits, total: items.length, pourcent: Math.round(faits / items.length * 100), manquants: items.filter(i => !i.ok).map(i => i.label) };
}
