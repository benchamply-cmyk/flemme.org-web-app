import type { BudgetRange, Category, Deadline, Review, WorkMode } from './parcours.ts';
import { BUDGET_RANGES, CATEGORIES, DEADLINES, MODES } from './parcours.ts';
import type { Contract, MyReview, OfferReview } from './accord.ts';

export type Actor = { id: string; name: string };
export type Offer = {
  id: string; brigadier: Actor; amount: number; slot: string; scope: string;
  status: 'pending' | 'accepted' | 'declined' | 'not_selected';
  messages: { actor: Actor; text: string; at: string }[];
  // Lot 3 (migration 20261104140000_flemme_v2_accord) : résultat promis et validation par l’équipe. Absent = validée.
  result?: string | null; review?: OfferReview; reviewNote?: string | null;
};
export type Task = {
  id: string; owner: Actor; title: string; details: string; place: string;
  budget: number | null; status: 'open' | 'assigned' | 'completed';
  createdAt: string; offers: Offer[]; acceptedOfferId?: string;
  agreement?: Agreement;
  history: { text: string; at: string }[];
  reports: { actor: Actor; text: string; at: string }[];
  paymentDeclared?: boolean; paymentConfirmed?: boolean;
  // Parcours complet (migration 20261104120000_flemme_v2_parcours) : absents des flemmes créées avant.
  category?: Category | null; deadline?: Deadline | null; deadlineNote?: string | null;
  budgetRange?: BudgetRange | null; mode?: WorkMode | null;
  /** Adresse précise : seulement pour le déposant et le Brigadier retenu. */
  address?: string | null;
  /** Validation par l’équipe : seulement pour le déposant. Absent = publiée. */
  review?: Review; reviewNote?: string | null;
  // Rempli uniquement par le serveur (webhook Stripe) quand le paiement en ligne est activé.
  payment?: { method: 'stripe'; status: 'paid'; total: number; commission: number; payout: number; at: string };
  /** Accord écrit (lot 3) : seulement pour le déposant et le Brigadier retenu ; null tant qu’il n’est pas commencé. */
  contract?: Contract | null;
  /** Avis que la personne connectée a laissé sur cette mission. */
  myReview?: MyReview | null;
  /** Démo locale uniquement : avis donnés sur la mission (le serveur les garde dans flemme_v2.reviews). */
  ratings?: { authorId: string; targetId: string; rating: number; text: string | null; at: string }[];
};
// amount : forfait proposé par le Brigadier. commission : part FLEMME. total : payé par le déposant.
// payout : reversé au Brigadier. rateBps et model : règle appliquée, figée au moment de l'accord.
export type Agreement = Price & { slot: string; scope: string; brigadier: Actor };
export type Command = 'edit' | 'offer' | 'message' | 'accept' | 'decline' | 'complete' | 'declare_payment' | 'confirm_payment' | 'report'
  | 'apply' | 'apply_edit' | 'agreement_save' | 'agreement_submit' | 'agreement_sign' | 'review';
export type Input = Record<string, unknown>;
/*
 * Commission FLEMME, configurable. Trois modèles :
 * - 'ajout' : la commission s'ajoute au forfait du Brigadier (décision du 03/11/2026, 10 %).
 *   Le déposant paie forfait + commission, le Brigadier reçoit tout son forfait.
 * - 'prelevement' : la commission est prise sur le prix payé par le déposant.
 *   Exemple « 65 % reversés au Brigadier » : { model: 'prelevement', rateBps: 3500 }.
 * - 'partage' (option B, PR brouillon) : rateBps est ajouté au prix du déposant et brigadierBps est retenu
 *   sur le forfait du Brigadier. Exemple 12 % + 13 % : sur 40 €, le déposant paie 44,80 €, le Brigadier reçoit 34,80 €.
 * Les taux sont en points de base (1000 = 10 %). Le serveur garde sa propre copie de ce réglage
 * (table flemme_v2.settings) ; un test vérifie que les deux restent identiques.
 */
export type CommissionModel = 'ajout' | 'prelevement' | 'partage';
export type CommissionConfig = { model: CommissionModel; rateBps: number; brigadierBps?: number };
export const COMMISSION: CommissionConfig = { model: 'partage', rateBps: 1200, brigadierBps: 1300 };
export type Price = { amount: number; commission: number; total: number; payout: number; rateBps: number; brigadierBps?: number; model: CommissionModel };
const validBps = (bps: number) => Number.isSafeInteger(bps) && bps >= 0 && bps <= 10000;
export function price(amount: number, config: CommissionConfig = COMMISSION): Price {
  const brigadierBps = config.brigadierBps ?? 0;
  if (!validBps(config.rateBps) || !validBps(brigadierBps)) throw new Error('Taux de commission invalide.');
  if (config.model !== 'partage' && brigadierBps) throw new Error('La part Brigadier ne vaut que pour le modèle partagé.');
  const fee = Math.round(amount * config.rateBps / 10000); // centimes entiers, arrondi au centime le plus proche
  if (config.model === 'partage') {
    const kept = Math.round(amount * brigadierBps / 10000);
    return { amount, commission: fee + kept, total: amount + fee, payout: amount - kept, rateBps: config.rateBps, brigadierBps, model: config.model };
  }
  return config.model === 'ajout'
    ? { amount, commission: fee, total: amount + fee, payout: amount, rateBps: config.rateBps, model: config.model }
    : { amount, commission: fee, total: amount, payout: amount - fee, rateBps: config.rateBps, model: config.model };
}
export const commission = (amount: number, config: CommissionConfig = COMMISSION) => price(amount, config).commission;
const percent = (bps: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(bps / 100) + ' %';
/** « 10 % », ou « 12 % + 13 % » pour le modèle partagé (part déposant + part Brigadier). */
export const rateLabel = (config: Pick<CommissionConfig, 'rateBps' | 'brigadierBps'> = COMMISSION) =>
  config.brigadierBps ? percent(config.rateBps) + ' + ' + percent(config.brigadierBps) : percent(config.rateBps);
export function money(amount: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount / 100);
}
export function parseMoney(value: string, optional = false): number | null {
  const clean = value.trim().replace(',', '.');
  if (!clean && optional) return null;
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(clean)) throw new Error('Indique un montant en euros avec au plus deux décimales.');
  const [euros, cents = ''] = clean.split('.');
  const n = Number(euros) * 100 + Number(cents.padEnd(2, '0'));
  if (n < 1 || n > 1000000) throw new Error('Le montant doit être compris entre 0,01 € et 10 000 €.');
  return n;
}
export function text(value: unknown, max = 1000) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(`Complète ce champ (1 à ${max} caractères).`);
  return value.trim();
}
function optionalText(value: unknown, max = 1000) {
  return typeof value === 'string' && value.trim() ? text(value, max) : null;
}
function amount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 1000000) throw new Error('Montant invalide.');
  return value;
}
function code<T extends string>(list: readonly { value: T }[], value: unknown, what: string): T | null {
  if (value == null || value === '') return null;
  const found = list.find(o => o.value === value);
  if (!found) throw new Error(what + ' invalide.');
  return found.value;
}
// Mêmes règles que flemme_v2.task_input (serveur). Les anciennes versions n’envoient que title, details, place, budget.
function taskData(data: Input) {
  const mode = code(MODES, data.mode, 'Lieu'), deadline = code(DEADLINES, data.deadline, 'Délai');
  const budget = data.budget == null ? null : amount(data.budget), budgetRange = code(BUDGET_RANGES, data.budgetRange, 'Fourchette');
  if (budget != null && budgetRange) throw new Error('Choisis un budget libre ou une fourchette, pas les deux.');
  const note = typeof data.deadlineNote === 'string' && data.deadlineNote.trim() ? text(data.deadlineNote, 100) : null;
  if (deadline === 'autre' && !note) throw new Error('Précise le délai approximatif.');
  const given = typeof data.place === 'string' && data.place.trim() ? text(data.place, 100) : null;
  if (mode !== 'distance' && !given) throw new Error('Indique une ville ou un secteur pour une tâche sur place.');
  const address = mode === 'sur_place' || mode === 'les_deux' ? (typeof data.address === 'string' && data.address.trim() ? text(data.address, 200) : null) : null;
  return { title: text(data.title, 100), details: text(data.details), place: given || 'À distance', budget, budgetRange,
    category: code(CATEGORIES, data.category, 'Catégorie'), deadline, deadlineNote: deadline === 'autre' ? note : null, mode, address };
}
export function createTask(id: string, actor: Actor, data: Input, at: string): Task {
  return { id, owner: actor, ...taskData(data), status: 'open', createdAt: at,
    offers: [], reports: [], history: [{ text: 'Flemme publiée · sans expiration', at }] };
}
export function applyCommand(task: Task, actor: Actor, command: Command, data: Input, at: string, config: CommissionConfig = COMMISSION): Task {
  const t: Task = JSON.parse(JSON.stringify(task));
  const owner = actor.id === t.owner.id;
  const chosen = t.offers.find(o => o.id === t.acceptedOfferId);
  const offer = t.offers.find(o => o.id === data.offerId);
  const event = (value: string) => t.history.push({ text: value, at });
  if (command === 'edit') {
    if (!owner || t.status !== 'open' || t.review === 'rejected' || t.offers.some(o => o.status === 'pending')) throw new Error('Cette demande ne peut plus être modifiée.');
    Object.assign(t, taskData(data), { reviewNote: null }); event('Demande modifiée');
  } else if (command === 'offer' || command === 'apply') {
    // Démo locale : pas d’équipe FLEMME, la candidature est validée d’office (comme moderation_offers = false).
    if (t.review && t.review !== 'published' && !owner) throw new Error('Flemme introuvable.');
    if (owner || t.status !== 'open') throw new Error('Cette flemme ne peut pas recevoir cette proposition.');
    if (t.offers.some(o => o.brigadier.id === actor.id && o.status === 'pending')) throw new Error('Tu as déjà une proposition en attente.');
    t.offers.push({ id: text(data.id, 100), brigadier: actor, amount: amount(data.amount), slot: text(data.slot, 100), scope: text(data.scope), status: 'pending', messages: [],
      ...(command === 'apply' ? { result: optionalText(data.result), review: 'approved' as const, reviewNote: null } : {}) });
    event('Proposition reçue');
  } else if (command === 'apply_edit') {
    if (!offer || offer.brigadier.id !== actor.id) throw new Error('Proposition introuvable.');
    if (offer.status !== 'pending' || t.status !== 'open' || offer.review === 'rejected') throw new Error('Cette candidature ne peut plus être modifiée.');
    Object.assign(offer, { amount: amount(data.amount), slot: text(data.slot, 100), scope: text(data.scope), result: optionalText(data.result), review: 'approved', reviewNote: null });
    event('Candidature modifiée');
  } else if (command === 'agreement_save' || command === 'agreement_submit' || command === 'agreement_sign') {
    if (!owner && chosen?.brigadier.id !== actor.id) throw new Error('Accord inaccessible.');
    if (t.status !== 'assigned') throw new Error('L’accord se prépare une fois le Brigadier choisi, avant la fin de la tâche.');
    const c = t.contract;
    if (command === 'agreement_save') {
      if (c?.status === 'signed') throw new Error('Accord déjà signé par les deux parties.');
      const terms = { scope: text(data.scope), quality: text(data.quality), deadline: text(data.deadline, 200), cancellation: text(data.cancellation), confidentiality: text(data.confidentiality) };
      t.contract = { terms, status: 'draft', reviewNote: null, ownerSignedAt: null, ownerSignature: null, brigadierSignedAt: null, brigadierSignature: null, updatedAt: at, updatedBy: actor };
      event('Accord écrit modifié par ' + actor.name);
    } else if (command === 'agreement_submit') {
      if (!c || (c.status !== 'draft' && c.status !== 'changes_requested')) throw new Error('Aucun brouillon d’accord à soumettre.');
      c.status = 'approved'; c.updatedAt = at; c.updatedBy = actor; event('Accord prêt à signer');
    } else {
      if (!c || c.status !== 'approved') throw new Error('L’accord doit être validé avant d’être signé.');
      if (data.accept !== true) throw new Error('Coche la case pour accepter l’accord.');
      const name = text(data.signature, 80);
      if (owner) { if (c.ownerSignedAt) throw new Error('Tu as déjà signé.'); c.ownerSignedAt = at; c.ownerSignature = name; }
      else { if (c.brigadierSignedAt) throw new Error('Tu as déjà signé.'); c.brigadierSignedAt = at; c.brigadierSignature = name; }
      if (c.ownerSignedAt && c.brigadierSignedAt) c.status = 'signed';
      event(`Accord signé par ${actor.name} (« ${name} »)`);
    }
  } else if (command === 'review') {
    if (t.status !== 'completed' || !chosen || (!owner && chosen.brigadier.id !== actor.id)) throw new Error('Avis possible seulement après une mission terminée.');
    const rating = data.rating;
    if (typeof rating !== 'number' || ![1, 2, 3, 4, 5].includes(rating)) throw new Error('Note invalide (1 à 5).');
    t.ratings ||= [];
    if (t.ratings.some(r => r.authorId === actor.id)) throw new Error('Tu as déjà donné ton avis sur cette mission.');
    const review = { rating, text: optionalText(data.text, 600) };
    t.ratings.push({ authorId: actor.id, targetId: owner ? chosen.brigadier.id : t.owner.id, ...review, at });
    event('Avis publié par ' + actor.name);
  } else if (command === 'message') {
    if (!offer || (!owner && offer.brigadier.id !== actor.id)) throw new Error('Discussion inaccessible.');
    offer.messages.push({ actor, text: text(data.text), at }); event('Message ajouté à une discussion');
  } else if (command === 'accept') {
    if (!owner || t.status !== 'open' || !offer || offer.status !== 'pending') throw new Error('Cette offre ne peut plus être acceptée.');
    t.status = 'assigned'; t.acceptedOfferId = offer.id;
    t.agreement = { ...price(offer.amount, config), slot: offer.slot, scope: offer.scope, brigadier: offer.brigadier };
    for (const o of t.offers) if (o.status === 'pending') o.status = o.id === offer.id ? 'accepted' : 'not_selected';
    event(`Accord accepté · forfait et commission de ${rateLabel(config)} confirmés`);
  } else if (command === 'decline') {
    if (!owner || t.status !== 'open' || !offer || offer.status !== 'pending') throw new Error('Proposition indisponible.');
    offer.status = 'declined'; event('Proposition déclinée · conservée dans l’historique');
  } else if (command === 'complete') {
    if (!owner || t.status !== 'assigned') throw new Error('Seul le déposant peut confirmer la fin.');
    if (t.contract && t.contract.status !== 'signed') throw new Error('L’accord doit être signé par les deux parties avant la fin de la tâche.');
    t.status = 'completed'; event('Tâche déclarée terminée par le déposant');
  } else if (command === 'declare_payment') {
    if (!owner || t.status !== 'completed' || t.paymentDeclared) throw new Error('Déclaration impossible.');
    t.paymentDeclared = true; event('Paiement direct déclaré par le déposant · non vérifié');
  } else if (command === 'confirm_payment') {
    if (chosen?.brigadier.id !== actor.id || !t.paymentDeclared || t.paymentConfirmed) throw new Error('Confirmation impossible.');
    t.paymentConfirmed = true; event('Réception du paiement confirmée par le Brigadier · non vérifiée par une banque');
  } else if (command === 'report') {
    if (!owner && chosen?.brigadier.id !== actor.id) throw new Error('Signalement inaccessible.');
    t.reports.push({ actor, text: text(data.text), at }); event('Désaccord signalé · examen humain demandé');
  } else throw new Error('Action inconnue.');
  return t;
}
export function visibleTask(task: Task, actor: Actor): Task {
  const mine = task.ratings?.find(r => r.authorId === actor.id);
  const myReview = mine ? { rating: mine.rating, text: mine.text } : null;
  if (task.owner.id === actor.id) return { ...task, ratings: undefined, myReview };
  if (task.status !== 'open' && !task.offers.some(o => o.brigadier.id === actor.id)) throw new Error('Flemme inaccessible.');
  if (task.review && task.review !== 'published') throw new Error('Flemme inaccessible.');
  const participant = task.agreement?.brigadier.id === actor.id;
  return { ...task, offers: task.offers.filter(o => o.brigadier.id === actor.id),
    agreement: participant ? task.agreement : undefined, address: participant ? task.address : undefined,
    contract: participant ? task.contract : undefined, ratings: undefined, myReview: participant ? myReview : undefined,
    review: undefined, reviewNote: undefined,
    reports: task.reports.filter(r => participant || r.actor.id === actor.id) };
}
