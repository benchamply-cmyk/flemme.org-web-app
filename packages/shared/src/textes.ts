import type { Offer, Task } from './domain.ts';

// Libellés et messages affichés à l’identique sur le site et dans l’app mobile.
// Les titres propres à chaque écran restent dans les écrans ; ici, seulement ce qui est calculé ou répété.
export const taskStatus: Record<Task['status'], string> = { open: 'Ouverte', assigned: 'Attribuée', completed: 'Terminée' };
export const offerStatus: Record<Offer['status'], string> = { pending: 'En attente', accepted: 'Acceptée', declined: 'Déclinée', not_selected: 'Flemme attribuée à un autre Brigadier' };
export const date = (iso: string) => new Date(iso).toLocaleString('fr-FR');

export const notices = {
  published: 'Ta flemme est publiée.',
  offerSent: 'Proposition envoyée. La flemme reste ouverte jusqu’à acceptation.',
  accepted: 'Accord confirmé. Le Brigadier prend le relais.',
  declined: 'Offre déclinée et conservée. Le Brigadier peut proposer un nouveau forfait.',
  checkEmail: 'Vérifie ton e-mail, puis connecte-toi.',
  recoverSent: 'Si un compte existe pour cette adresse, un e-mail vient de partir. Ouvre le lien dans ce navigateur pour choisir ton mot de passe.',
  passwordSaved: 'Mot de passe enregistré.',
  nameUpdated: 'Nom affiché mis à jour.',
  report: (remote: boolean) => remote ? 'Signalement enregistré pour examen manuel. Aucun remboursement automatique.' : 'Signalement local enregistré. Aucun support réel contacté.',
};
export const footer = (remote: boolean) => remote ? 'Test accompagné · paiements directs' : 'Démo locale · données fictives · aucun paiement';

/** Ligne d’appel en bas d’une carte de flemme, selon la place de la personne connectée. */
export function cardHint(task: Task, actorId: string) {
  if (task.owner.id === actorId) return String(task.offers.filter(o => o.status === 'pending').length) + ' proposition(s) · suivre →';
  return task.offers.some(o => o.brigadier.id === actorId) ? 'Ma proposition et le suivi →' : 'Je peux aider →';
}
export const budgetLabel = (task: Task, money: (n: number) => string) => task.budget == null ? 'Prix à proposer' : money(task.budget);

/** État du paiement direct, déclaratif, affiché sous l’accord. */
export function paymentStatus(task: Task) {
  return task.paymentConfirmed ? 'Paiement confirmé par les deux personnes · déclaratif'
    : task.paymentDeclared ? 'Paiement déclaré · confirmation Brigadier attendue' : 'Paiement non déclaré';
}
