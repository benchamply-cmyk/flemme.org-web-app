import type { Task } from './domain.ts';
import { payeViaFlemme } from './monetisation.ts';
import { liberationAutomatique } from './confiance.ts';

// Navigation et droits d’affichage communs aux deux interfaces.
// Le site garde l’historique du navigateur, le mobile le bouton Retour Android : seul le parcours est partagé.
export type Screen = 'home' | 'list' | 'new' | 'edit' | 'detail' | 'offer' | 'review' | 'report' | 'account' | 'contract' | 'profile' | 'help';
export type Tab = 'mine' | 'find' | 'messages';

/** Écran parent, utilisé par le bouton « Retour » du mobile. */
export function parentScreen(screen: Screen): Screen {
  if (screen === 'list' || screen === 'account' || screen === 'help') return 'home';
  if (screen === 'review') return 'offer';
  if (screen === 'offer' || screen === 'report' || screen === 'edit' || screen === 'contract') return 'detail';
  if (screen === 'profile') return 'account';
  return 'list';
}
export const backLabel = (screen: Screen) => screen === 'list' || screen === 'account' ? '← Accueil' : '← Retour';

/** Les trois listes : mes demandes, mes propositions, les flemmes que je peux résoudre. */
export function partition(tasks: Task[], actorId: string) {
  const mine = (t: Task) => t.offers.some(o => o.brigadier.id === actorId);
  return {
    own: tasks.filter(t => t.owner.id === actorId),
    helping: tasks.filter(t => t.owner.id !== actorId && mine(t)),
    available: tasks.filter(t => t.owner.id !== actorId && t.status === 'open' && !mine(t)),
  };
}

/** Ce que la personne connectée peut faire sur une flemme. Les mêmes règles sont revérifiées par domain.ts et le serveur. */
export function rights(task: Task | undefined, actorId: string) {
  const isOwner = task?.owner.id === actorId;
  const isBrigadier = task?.agreement?.brigadier.id === actorId;
  // v2.0.0 : paiement via Flemme obligatoire quand le serveur l’active ; sinon ancien parcours déclaratif.
  const viaFlemme = payeViaFlemme(task), paid = task?.payment?.status === 'paid';
  const signed = task?.contract?.status === 'signed';
  return {
    isOwner, isBrigadier, viaFlemme,
    canComplete: isOwner && task?.status === 'assigned' && (viaFlemme ? signed && paid : !task.contract || signed),
    /** Livraison déclarée par le membre retenu (puis confirmation du déposant ou libération automatique). */
    canDeliver: isBrigadier && task?.status === 'assigned' && !task.deliveredAt && ((viaFlemme || task.contract) ? signed : true) && (!viaFlemme || paid),
    /** Libération automatique : délai passé sans désaccord signalé depuis la livraison. */
    canRelease: isBrigadier && task?.status === 'assigned' && !!task && liberationAutomatique(task, new Date().toISOString()),
    /** Question publique : membres qui voient la demande ouverte, sauf le déposant. */
    canAsk: !!task && !isOwner && task.status === 'open',
    // « authorized » : paiement différé déjà lancé, on attend l’encaissement.
    canPay: isOwner && viaFlemme && task?.status === 'assigned' && signed && !paid && task.payment?.status !== 'authorized' && task.payment?.status !== 'disputed',
    /** Stripe : versement de la part du membre une fois la mission terminée (une seule fois). */
    canPayout: (isOwner || isBrigadier) && task?.paymentMode === 'stripe' && task.status === 'completed' && paid && task.payment?.method === 'stripe' && !task.payment.transferredAt,
    // Accord écrit (lot 3) : préparé par l’une ou l’autre partie entre le choix du Brigadier et la fin.
    canContract: (isOwner || isBrigadier) && task?.status === 'assigned',
    canSign: (isOwner || isBrigadier) && task?.contract?.status === 'approved' && !(isOwner ? task.contract.ownerSignedAt : task.contract.brigadierSignedAt),
    canReview: (isOwner || isBrigadier) && task?.status === 'completed' && !task.myReview,
    canDeclarePayment: isOwner && !viaFlemme && task?.status === 'completed' && !task.paymentDeclared,
    canConfirmPayment: isBrigadier && !viaFlemme && !!task?.paymentDeclared && !task.paymentConfirmed,
    canOffer: !isOwner && task?.status === 'open' && !task.offers.some(o => o.brigadier.id === actorId && o.status === 'pending'),
    canReport: isOwner || isBrigadier,
  };
}
