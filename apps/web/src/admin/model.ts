import type { Actor, Input, Task } from '../../../../packages/shared/src/domain.ts';
import { applyCommand, text } from '../../../../packages/shared/src/domain.ts';
import { demoActors, seed } from '../../../../packages/shared/src/gateway.ts';

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
export type AlertKind = 'task_created' | 'report' | 'agreement';
export type AlertRow = { id: number; kind: AlertKind; taskId: string; payload: Record<string, unknown>; createdAt: string; dispatchedAt: string | null; error: string | null };
export type AdminAction = 'overview' | 'reports' | 'disputes' | 'users' | 'alerts' | 'alert_retry' | 'dispute_update' | 'user_suspend' | 'user_restore';

export interface AdminSource {
  demo: boolean;
  email: string;
  call(action: AdminAction, data?: Input): Promise<any>;
}

export const disputeLabel: Record<DisputeStatus, string> = { open: 'À traiter', in_review: 'Pris en charge', resolved: 'Clos' };
export const taskLabel: Record<Task['status'], string> = { open: 'Ouverte', assigned: 'Attribuée', completed: 'Terminée' };
export const alertLabel: Record<AlertKind, string> = { task_created: 'Nouvelle flemme', report: 'Signalement', agreement: 'Accord conclu' };
export const logLabel: Record<string, string> = {
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
  private disputes: DisputeRow[];
  private users: UserRow[];
  private log: Overview['log'] = [];
  private alerts: AlertRow[];
  constructor(now = new Date().toISOString()) {
    const [ben, lou, camille] = demoActors;
    const base = seed();
    const assigned = applyCommand(applyCommand(base[0], ben, 'accept', { offerId: 'demo-offer' }, now), ben, 'report', { text: 'Le Brigadier n’est pas passé au créneau prévu et ne répond plus.' }, now);
    this.tasks = [assigned, base[1], base[2]];
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
