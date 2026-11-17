import type { Agreement, Offer, Task } from './domain.ts';
import { COMMISSION, rateLabel } from './domain.ts';
import { fraisDeposant, fraisIntervenant, statutPaiementLabel } from './monetisation.ts';
import { budgetText } from './parcours.ts';

// Libellés et messages affichés à l’identique sur le site et dans l’app mobile.
// Les titres propres à chaque écran restent dans les écrans ; ici, seulement ce qui est calculé ou répété.
export const taskStatus: Record<Task['status'], string> = { open: 'Ouverte', assigned: 'Attribuée', completed: 'Terminée' };
export const offerStatus: Record<Offer['status'], string> = { pending: 'En attente', accepted: 'Acceptée', declined: 'Déclinée', not_selected: 'Demande confiée à un autre membre' };
export const date = (iso: string) => new Date(iso).toLocaleString('fr-FR');

export const notices = {
  published: 'Ta demande est publiée.',
  sentForReview: 'Ta demande a été reçue. Elle est en cours de relecture : tu peux suivre son état dans « Mes demandes ».',
  edited: 'Demande modifiée.',
  draftSaved: 'Brouillon enregistré sur ton compte.',
  draftDeleted: 'Brouillon supprimé.',
  offerSent: 'Proposition envoyée. La demande reste ouverte jusqu’à ce qu’une proposition soit acceptée.',
  applied: (o?: { review?: string }) => o?.review === 'pending'
    ? 'Proposition envoyée. L’équipe FLEMME la relit avant de la transmettre à la personne qui a publié la demande.' : 'Proposition envoyée. La demande reste ouverte jusqu’à ce qu’une proposition soit acceptée.',
  contractSaved: 'Accord enregistré. Relisez-le à deux, puis soumettez-le.',
  contractSubmitted: (status?: string) => status === 'pending' ? 'Accord soumis : l’équipe FLEMME le contrôle avant la signature.' : 'Accord prêt à signer.',
  signed: 'Signature enregistrée et horodatée.',
  reviewSent: 'Merci, ton avis est publié sur le profil de l’autre personne.',
  profileSaved: 'Profil enregistré.',
  fileSent: 'Fichier ajouté. Seuls le déposant et le membre retenu peuvent l’ouvrir.',
  fileDeleted: 'Fichier supprimé.',
  avatarSaved: 'Photo de profil enregistrée.',
  helpSent: 'Message envoyé à l’équipe FLEMME. La réponse s’affichera ici.',
  accepted: 'Proposition choisie. Rédigez maintenant l’accord ensemble : rien n’est dû avant sa signature.',
  paid: 'Paiement enregistré via Flemme (simulation : aucun argent réel). Tu pourras confirmer la fin de la mission une fois réalisée.',
  declined: 'Offre déclinée et conservée. Le membre peut proposer un nouveau forfait.',
  checkEmail: 'Vérifie ton e-mail, puis connecte-toi.',
  recoverSent: 'Si un compte existe pour cette adresse, un e-mail vient de partir. Ouvre le lien dans ce navigateur pour choisir ton mot de passe.',
  passwordSaved: 'Mot de passe enregistré.',
  nameUpdated: 'Nom affiché mis à jour.',
  report: (remote: boolean) => remote ? 'Signalement enregistré pour examen manuel. Aucun remboursement automatique.' : 'Signalement local enregistré. Aucun support réel contacté.',
};
export const footer = (remote: boolean, online = false) => remote ? (online ? 'Paiement en ligne sécurisé par Stripe' : 'Test accompagné · paiements directs') : 'Démo locale · données fictives · aucun paiement';

// Frais de plateforme (v2.0.0, anciennement « commission ») : textes calculés à partir de COMMISSION (domain.ts), jamais « 10 % » en dur.
export const commissionNote = () => COMMISSION.model === 'ajout'
  ? fraisDeposant(COMMISSION) : `FLEMME garde ${rateLabel()} du prix payé.`;
export const brigadierPitch = () => COMMISSION.model === 'ajout'
  ? fraisIntervenant(COMMISSION) : `Propose ton prix. FLEMME garde ${rateLabel()}, le reste est pour toi.`;
/** Note sous l’accord : paiement via Flemme (v2.0.0, simulé), paiement en ligne (Stripe Connect) ou paiement direct déclaratif. */
export function paymentNote(a: Agreement, online: boolean, money: (n: number) => string, viaFlemme = false) {
  if (viaFlemme) return `Paiement via Flemme, obligatoire, une fois l’accord signé par les deux : ${money(a.total)} au total, dont ${money(a.commission)} de frais de plateforme. ${money(a.payout ?? a.amount)} reviennent à ${a.brigadier.name}. Version de test : le paiement est simulé, aucun argent réel ne circule.`;
  return online
    ? `Paiement en ligne une fois la tâche terminée : ${money(a.total)} par carte via Stripe. ${money(a.payout ?? a.amount)} sont versés au membre, ${money(a.commission)} reviennent à FLEMME.`
    : `Paiement direct : ${money(a.amount)} au membre. Commission FLEMME : ${money(a.commission)} à régler séparément, non encaissée dans cette version.`;
}
/** Message au retour de Stripe Checkout (/paiement/ok, /paiement/annule ; anciennement app.html#paiement-ok, #paiement-annule). */
export const paymentReturn = (hash: string) => hash === '#paiement-ok'
  ? 'Paiement accepté par Stripe. Il apparaîtra dans l’historique de la flemme d’ici quelques secondes, actualise si besoin.'
  : hash === '#paiement-annule' ? 'Paiement annulé. Rien n’a été débité.' : '';

/** Ligne d’appel en bas d’une carte de flemme, selon la place de la personne connectée. */
export function cardHint(task: Task, actorId: string) {
  if (task.owner.id === actorId) return String(task.offers.filter(o => o.status === 'pending').length) + ' proposition(s) · suivre →';
  return task.offers.some(o => o.brigadier.id === actorId) ? 'Ma proposition et le suivi →' : 'Voir la demande →';
}
export const budgetLabel = (task: Task, money: (n: number) => string) =>
  task.budget != null ? money(task.budget) : task.budgetRange ? budgetText(task, money) : 'Prix à proposer';

/** État du paiement direct, déclaratif, affiché sous l’accord. */
export function paymentStatus(task: Task, money?: (n: number) => string) {
  if (task.payment && money) return task.payment.method === 'simulation'
    ? `${statutPaiementLabel[task.payment.status]} via Flemme (simulation) · ${money(task.payment.total)}, dont ${money(task.payment.commission)} de frais de plateforme`
    : 'Payé en ligne · ' + money(task.payment.total) + ' encaissés par Stripe, dont ' + money(task.payment.commission) + ' de commission FLEMME';
  if (task.paymentMode === 'simulation') return task.contract?.status === 'signed' ? 'À payer via Flemme' : 'Paiement via Flemme après la signature de l’accord';
  return task.paymentConfirmed ? 'Paiement confirmé par les deux personnes · déclaratif'
    : task.paymentDeclared ? 'Paiement déclaré · confirmation du membre attendue' : 'Paiement non déclaré';
}
