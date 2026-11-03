export type Actor = { id: string; name: string };
export type Offer = {
  id: string; brigadier: Actor; amount: number; slot: string; scope: string;
  status: 'pending' | 'accepted' | 'declined' | 'not_selected';
  messages: { actor: Actor; text: string; at: string }[];
};
export type Task = {
  id: string; owner: Actor; title: string; details: string; place: string;
  budget: number | null; status: 'open' | 'assigned' | 'completed';
  createdAt: string; offers: Offer[]; acceptedOfferId?: string;
  agreement?: Agreement;
  history: { text: string; at: string }[];
  reports: { actor: Actor; text: string; at: string }[];
  paymentDeclared?: boolean; paymentConfirmed?: boolean;
  // Rempli uniquement par le serveur (webhook Stripe) quand le paiement en ligne est activé.
  payment?: { method: 'stripe'; status: 'paid'; total: number; commission: number; payout: number; at: string };
};
// amount : forfait proposé par le Brigadier. commission : part FLEMME. total : payé par le déposant.
// payout : reversé au Brigadier. rateBps et model : règle appliquée, figée au moment de l'accord.
export type Agreement = Price & { slot: string; scope: string; brigadier: Actor };
export type Command = 'offer' | 'message' | 'accept' | 'decline' | 'complete' | 'declare_payment' | 'confirm_payment' | 'report';
export type Input = Record<string, unknown>;
/*
 * Commission FLEMME, configurable. Le modèle économique n'est pas encore tranché (roadmap V2) :
 * - 'ajout' : la commission s'ajoute au forfait du Brigadier (modèle actuel, 10 %).
 *   Le déposant paie forfait + commission, le Brigadier reçoit tout son forfait.
 * - 'prelevement' : la commission est prise sur le prix payé par le déposant.
 *   Exemple « 65 % reversés au Brigadier » : { model: 'prelevement', rateBps: 3500 }.
 * rateBps est en points de base (1000 = 10 %). Le serveur garde sa propre copie de ce réglage
 * (table flemme_mobile_v1.settings) ; un test vérifie que les deux restent identiques.
 */
export type CommissionModel = 'ajout' | 'prelevement';
export type CommissionConfig = { model: CommissionModel; rateBps: number };
export const COMMISSION: CommissionConfig = { model: 'ajout', rateBps: 1000 };
export type Price = { amount: number; commission: number; total: number; payout: number; rateBps: number; model: CommissionModel };
export function price(amount: number, config: CommissionConfig = COMMISSION): Price {
  if (!Number.isSafeInteger(config.rateBps) || config.rateBps < 0 || config.rateBps > 10000) throw new Error('Taux de commission invalide.');
  const fee = Math.round(amount * config.rateBps / 10000); // centimes entiers, arrondi au centime le plus proche
  return config.model === 'ajout'
    ? { amount, commission: fee, total: amount + fee, payout: amount, rateBps: config.rateBps, model: config.model }
    : { amount, commission: fee, total: amount, payout: amount - fee, rateBps: config.rateBps, model: config.model };
}
export const commission = (amount: number, config: CommissionConfig = COMMISSION) => price(amount, config).commission;
export const rateLabel = (config: Pick<CommissionConfig, 'rateBps'> = COMMISSION) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(config.rateBps / 100) + ' %';
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
function amount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 1000000) throw new Error('Montant invalide.');
  return value;
}
export function createTask(id: string, actor: Actor, data: Input, at: string): Task {
  return { id, owner: actor, title: text(data.title, 100), details: text(data.details), place: text(data.place, 100),
    budget: data.budget == null ? null : amount(data.budget), status: 'open', createdAt: at,
    offers: [], reports: [], history: [{ text: 'Flemme publiée · sans expiration', at }] };
}
export function applyCommand(task: Task, actor: Actor, command: Command, data: Input, at: string, config: CommissionConfig = COMMISSION): Task {
  const t: Task = JSON.parse(JSON.stringify(task));
  const owner = actor.id === t.owner.id;
  const chosen = t.offers.find(o => o.id === t.acceptedOfferId);
  const offer = t.offers.find(o => o.id === data.offerId);
  const event = (value: string) => t.history.push({ text: value, at });
  if (command === 'offer') {
    if (owner || t.status !== 'open') throw new Error('Cette flemme ne peut pas recevoir cette proposition.');
    if (t.offers.some(o => o.brigadier.id === actor.id && o.status === 'pending')) throw new Error('Tu as déjà une proposition en attente.');
    t.offers.push({ id: text(data.id, 100), brigadier: actor, amount: amount(data.amount), slot: text(data.slot, 100), scope: text(data.scope), status: 'pending', messages: [] });
    event('Proposition reçue');
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
  if (task.owner.id === actor.id) return task;
  if (task.status !== 'open' && !task.offers.some(o => o.brigadier.id === actor.id)) throw new Error('Flemme inaccessible.');
  const participant = task.agreement?.brigadier.id === actor.id;
  return { ...task, offers: task.offers.filter(o => o.brigadier.id === actor.id),
    agreement: participant ? task.agreement : undefined,
    reports: task.reports.filter(r => participant || r.actor.id === actor.id) };
}
