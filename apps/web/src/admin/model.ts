import type { Actor, Input, Task } from '../../../../packages/shared/src/domain.ts';
import { applyCommand, createTask, text } from '../../../../packages/shared/src/domain.ts';
import { demoActors, seed } from '../../../../packages/shared/src/gateway.ts';
import type { Contract } from '../../../../packages/shared/src/accord.ts';
import type { HelpRequest } from '../../../../packages/shared/src/aide.ts';

// Types renvoyés par public.flemme_admin_api (supabase/migrations/20261103130000_flemme_v2_admin.sql).
export type DisputeStatus = 'open' | 'in_review' | 'resolved';
export type Overview = {
  tasks: { open: number; assigned: number; completed: number };
  disputes: Record<DisputeStatus, number>;
  users: number; suspended: number; alertErrors: number;
  log: { id: number; action: string; target: string; details: Record<string, unknown>; at: string; admin: string | null }[];
};
export type ReportRow = { taskId: string; title: string; taskStatus: Task['status']; actor: Actor; text: string; at: string; disputeStatus: DisputeStatus };
export type DisputeRow = { taskId: string; status: DisputeStatus; resolution: string | null; openedAt: string; updatedAt: string; updatedBy: string | null; task: Task };
export type UserRow = {
  id: string; email: string; displayName: string | null; createdAt: string; lastSignInAt: string | null; confirmed: boolean; admin: boolean;
  tasks: number; offers: number; missions: number; reports: number; suspendedReason: string | null; suspendedAt: string | null;
};
export type AlertKind = 'task_created' | 'task_edited' | 'report' | 'agreement' | 'offer_review' | 'agreement_review' | 'help';
// Lot 4 (20261104150000_flemme_v2_fichiers_aide.sql) : demandes d’aide humaine.
export type HelpRow = HelpRequest & { user: Actor; email: string | null; title: string | null };
// Lot 3 (supabase/migrations/20261104140000_flemme_v2_accord.sql) : candidatures et accords écrits à contrôler.
export type QueueOffer = { id: string; task: { id: string; title: string; owner: Actor }; brigadier: Actor; amount: number; slot: string; scope: string; result: string | null; createdAt: string };
export type QueueAgreement = Contract & { taskId: string; title: string; owner: Actor; brigadier: Actor; amount: number };
export type ReviewQueue = { offers: QueueOffer[]; agreements: QueueAgreement[] };
// Validation des demandes (supabase/migrations/20261104120000_flemme_v2_parcours.sql).
export type ModerationTask = Task & { ownerEmail: string | null; updatedAt: string };
export type Moderation = { tasks: ModerationTask[]; waiting: number };
export type ReviewDecision = 'publish' | 'changes' | 'reject';
export type AlertRow = { id: number; kind: AlertKind; taskId: string; payload: Record<string, unknown>; createdAt: string; dispatchedAt: string | null; error: string | null };
export type AdminAction = 'overview' | 'reports' | 'disputes' | 'users' | 'alerts' | 'alert_retry' | 'dispute_update' | 'user_suspend' | 'user_restore'
  | 'moderation' | 'task_review' | 'review_queue' | 'offer_review' | 'agreement_review' | 'help_queue' | 'help_answer';

export interface AdminSource {
  demo: boolean;
  email: string;
  call(action: AdminAction, data?: Input): Promise<any>;
}

export const disputeLabel: Record<DisputeStatus, string> = { open: 'À traiter', in_review: 'Pris en charge', resolved: 'Clos' };
export const taskLabel: Record<Task['status'], string> = { open: 'Ouverte', assigned: 'Attribuée', completed: 'Terminée' };
export const alertLabel: Record<AlertKind, string> = { task_created: 'Nouvelle flemme', task_edited: 'Demande modifiée', report: 'Signalement', agreement: 'Accord conclu', offer_review: 'Candidature à valider', agreement_review: 'Accord écrit à contrôler', help: 'Demande d’aide' };
export const logLabel: Record<string, string> = {
  task_publish: 'Demande publiée', task_changes: 'Correction demandée', task_reject: 'Demande refusée',
  offer_approve: 'Candidature validée', offer_changes: 'Correction de candidature demandée', offer_reject: 'Candidature refusée',
  agreement_approve: 'Accord contrôlé', agreement_changes: 'Correction d’accord demandée',
  help_answered: 'Demande d’aide répondue', help_closed: 'Demande d’aide close',
  dispute_in_review: 'Litige pris en charge', dispute_resolved: 'Litige clos', user_suspend: 'Compte suspendu', user_restore: 'Compte rétabli',
};
export const when = (s: string | null) => s ? new Date(s).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'jamais';

export function filterUsers(users: UserRow[], query: string, onlySuspended: boolean) {
  const q = query.trim().toLowerCase();
  return users.filter(u => (!onlySuspended || u.suspendedReason) && (!q || u.email.toLowerCase().includes(q) || (u.displayName || '').toLowerCase().includes(q) || u.id.startsWith(q)));
}
export function filterDisputes(rows: DisputeRow[], view: 'todo' | 'resolved' | 'all') {
  return rows.filter(d => view === 'all' || (view === 'resolved' ? d.status === 'resolved' : d.status !== 'resolved'));
}

// Démonstration de la page admin, sans Supabase : données fictives, mêmes règles que la migration admin.
export class DemoAdmin implements AdminSource {
  demo = true;
  email = 'equipe@flemme.example';
  private tasks: Task[];
  private queue: ModerationTask[];
  private disputes: DisputeRow[];
  private users: UserRow[];
  private log: Overview['log'] = [];
  private alerts: AlertRow[];
  private help: HelpRow[] = [{ id: 'demo-aide', topic: 'compte', text: 'Je ne reçois pas l’e-mail de confirmation.', status: 'open', answer: null, taskId: null,
    at: '2026-11-03T09:00:00.000Z', answeredAt: null, user: demoActors[1], email: 'lou@flemme.example', title: null }];
  constructor(now = new Date().toISOString()) {
    const [ben, lou, camille] = demoActors;
    const base = seed();
    const assigned = applyCommand(applyCommand(base[0], ben, 'accept', { offerId: 'demo-offer' }, now), ben, 'report', { text: 'Le Brigadier n’est pas passé au créneau prévu et ne répond plus.' }, now);
    this.tasks = [assigned, base[1], base[2]];
    const waiting = createTask('demo-attente', camille, { title: 'Trier mes papiers administratifs', details: 'Deux boîtes de courriers à classer, avec mon employeur Dupont SA en copie de certains.', category: 'administratif', deadline: '1_mois', mode: 'sur_place', place: 'Aix-en-Provence', address: '12 rue de la Paix', budgetRange: '50_200' }, now);
    this.queue = [{ ...waiting, review: 'pending', ownerEmail: 'camille@exemple.fr', updatedAt: now, history: [{ text: 'Demande envoyée · privée jusqu’à sa validation par l’équipe FLEMME', at: now }] }];
    this.disputes = [{ taskId: assigned.id, status: 'open', resolution: null, openedAt: now, updatedAt: now, updatedBy: null, task: assigned }];
    const user = (a: Actor, email: string, extra: Partial<UserRow> = {}): UserRow => ({ id: a.id, email, displayName: a.name || null, createdAt: now, lastSignInAt: now, confirmed: true, admin: false, tasks: 0, offers: 0, missions: 0, reports: 0, suspendedReason: null, suspendedAt: null, ...extra });
    this.users = [
      user(ben, 'benjamin@exemple.fr', { tasks: 1, reports: 1 }), user(lou, 'lou@exemple.fr', { tasks: 1, offers: 1, missions: 1 }),
      user(camille, 'camille@exemple.fr', { tasks: 1 }), user({ id: 'demo-ancien', name: '' }, 'ancien-espace@exemple.fr', { lastSignInAt: null }),
      user({ id: 'demo-equipe', name: 'Équipe FLEMME' }, this.email, { admin: true }),
    ];
    this.alerts = [
      { id: 2, kind: 'report', taskId: assigned.id, payload: { title: assigned.title }, createdAt: now, dispatchedAt: null, error: 'Démonstration : aucun e-mail envoyé' },
      { id: 1, kind: 'agreement', taskId: assigned.id, payload: { title: assigned.title }, createdAt: now, dispatchedAt: now, error: null },
    ];
  }
  private journal(action: string, target: string, details: Record<string, unknown>) {
    this.log.unshift({ id: this.log.length + 1, action, target, details, at: new Date().toISOString(), admin: this.email });
  }
  async call(action: AdminAction, data: Input = {}) {
    const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
    const count = <T>(list: T[], f: (v: T) => boolean) => list.filter(f).length;
    if (action === 'overview') return clone({
      tasks: { open: count(this.tasks, t => t.status === 'open'), assigned: count(this.tasks, t => t.status === 'assigned'), completed: count(this.tasks, t => t.status === 'completed') },
      disputes: { open: count(this.disputes, d => d.status === 'open'), in_review: count(this.disputes, d => d.status === 'in_review'), resolved: count(this.disputes, d => d.status === 'resolved') },
      users: this.users.length, suspended: count(this.users, u => !!u.suspendedReason), alertErrors: count(this.alerts, a => !!a.error), log: this.log,
    });
    if (action === 'reports') return clone({ reports: this.tasks.flatMap(t => t.reports.map(r => ({ taskId: t.id, title: t.title, taskStatus: t.status, actor: r.actor, text: r.text, at: r.at, disputeStatus: this.disputes.find(d => d.taskId === t.id)?.status || 'open' }))) });
    if (action === 'disputes') return clone({ disputes: this.disputes });
    if (action === 'moderation') return clone({ tasks: this.queue.filter(t => t.review === 'pending'), waiting: count(this.queue, t => t.review === 'changes_requested') });
    if (action === 'task_review') {
      const t = this.queue.find(x => x.id === data.taskId); if (!t) throw new Error('Demande introuvable');
      if (t.review !== 'pending') throw new Error('Cette demande n\'attend plus de validation');
      const decision = data.decision as ReviewDecision;
      if (!['publish', 'changes', 'reject'].includes(decision)) throw new Error('Décision invalide');
      const note = decision === 'publish' ? null : text(data.note, 900);
      t.review = decision === 'publish' ? 'published' : decision === 'changes' ? 'changes_requested' : 'rejected'; t.reviewNote = note;
      if (decision === 'publish') this.tasks.push(t);
      this.journal('task_' + decision, t.id, { note, title: t.title });
      return clone({ task: t });
    }
    // Démo : pas de candidature ni d’accord en attente (l’app de démo les valide d’office).
    if (action === 'review_queue') return clone({ offers: [], agreements: [] });
    if (action === 'offer_review') throw new Error('Candidature introuvable');
    if (action === 'agreement_review') throw new Error('Accord introuvable');
    if (action === 'help_queue') return clone({ requests: this.help });
    if (action === 'help_answer') {
      const h = this.help.find(x => x.id === data.id); if (!h) throw new Error('Demande introuvable');
      if (data.status === 'closed') { h.status = 'closed'; this.journal('help_closed', h.id, {}); }
      else { h.answer = text(data.answer, 2000); h.status = 'answered'; h.answeredAt = new Date().toISOString(); this.journal('help_answered', h.id, { note: h.answer }); }
      return clone({ ok: true });
    }
    if (action === 'users') return clone({ users: this.users });
    if (action === 'alerts') return clone({ alerts: this.alerts });
    if (action === 'alert_retry') {
      const a = this.alerts.find(x => x.id === data.id); if (!a) throw new Error('Alerte introuvable');
      return clone({ alert: a });
    }
    if (action === 'dispute_update') {
      const d = this.disputes.find(x => x.taskId === data.taskId); if (!d) throw new Error('Litige introuvable');
      let event: string, note: string | null = null;
      if (data.status === 'in_review') event = 'Litige pris en charge par l\'équipe FLEMME';
      else if (data.status === 'resolved') { note = text(data.note); event = 'Litige clos par l\'équipe FLEMME : ' + note; }
      else throw new Error('Statut de litige invalide');
      const at = new Date().toISOString();
      d.task.history.push({ text: event, at }); d.status = data.status; d.resolution = note ?? d.resolution; d.updatedAt = at; d.updatedBy = this.email;
      this.journal('dispute_' + data.status, d.taskId, { note });
      return { ok: true };
    }
    if (action === 'user_suspend' || action === 'user_restore') {
      const u = this.users.find(x => x.id === data.userId); if (!u) throw new Error('Compte introuvable');
      if (action === 'user_suspend') {
        if (u.admin) throw new Error('Un administrateur ne peut pas être suspendu');
        u.suspendedReason = text(data.reason, 500); u.suspendedAt = new Date().toISOString();
        this.journal(action, u.id, { reason: u.suspendedReason });
      } else {
        if (!u.suspendedReason) throw new Error('Ce compte n\'est pas suspendu');
        u.suspendedReason = null; u.suspendedAt = null; this.journal(action, u.id, {});
      }
      return { ok: true };
    }
    throw new Error('Action inconnue');
  }
}
