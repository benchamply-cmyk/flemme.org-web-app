import type { Task } from './domain.ts';

// Navigation et droits d’affichage communs aux deux interfaces.
// Le site garde l’historique du navigateur, le mobile le bouton Retour Android : seul le parcours est partagé.
export type Screen = 'home' | 'list' | 'new' | 'detail' | 'offer' | 'review' | 'report' | 'account';
export type Tab = 'mine' | 'find';

/** Écran parent, utilisé par le bouton « Retour » du mobile. */
export function parentScreen(screen: Screen): Screen {
  if (screen === 'list' || screen === 'account') return 'home';
  if (screen === 'review') return 'offer';
  if (screen === 'offer' || screen === 'report') return 'detail';
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
  return {
    isOwner, isBrigadier,
    canComplete: isOwner && task?.status === 'assigned',
    canDeclarePayment: isOwner && task?.status === 'completed' && !task.paymentDeclared,
    canConfirmPayment: isBrigadier && !!task?.paymentDeclared && !task.paymentConfirmed,
    canOffer: !isOwner && task?.status === 'open' && !task.offers.some(o => o.brigadier.id === actorId && o.status === 'pending'),
    canReport: isOwner || isBrigadier,
  };
}
