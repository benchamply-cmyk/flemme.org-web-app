import type { Task } from '../../../../packages/shared/src/index.ts';
import { brigadierPitch, budgetLabel, cardHint, categoryLabel, date, deadlineLabel, money, partition, reviewLabel, taskStatus } from '../../../../packages/shared/src/index.ts';
import { session } from '../session.ts';
import { Action } from '../ui.tsx';
import type { Ctx } from './contexte.ts';

export function TaskCard({ task: t, actorId, onOpen }: { task: Task; actorId: string; onOpen: () => void }) {
  const pending = t.owner.id === actorId && t.review && t.review !== 'published';
  const meta = [categoryLabel(t), t.place, t.deadline ? deadlineLabel(t) : ''].filter(Boolean).join(' · ');
  return <button type="button" onClick={onOpen} className="card"><span className="row"><span className={'tag' + (pending ? ' warn' : '')}>{pending ? reviewLabel[t.review!] : taskStatus[t.status]}</span><span className="strong">{budgetLabel(t, money)}</span></span><span className="card-title">{t.title}</span><span className="muted">{meta}</span><span className="link">{cardHint(t, actorId)}</span></button>;
}
export function Listes(ctx: Ctx) {
  const { state: { tasks, actorId, busy, more, drafts }, place, go } = ctx;
  const { own, helping, available } = partition(tasks, actorId);
  const card = (t: Task) => <TaskCard key={t.id} task={t} actorId={actorId} onOpen={() => go('detail', { taskId: t.id })}/>;
  const reload = <>{more && <Action secondary disabled={busy} onClick={() => session.loadMore()}>Voir plus de flemmes</Action>}<Action secondary disabled={busy} onClick={() => session.refresh()}>↻ Actualiser</Action></>;
  const taskDrafts = drafts.filter(d => d.kind === 'task');
  if (place.tab === 'mine') return <><h1 className="heading">Mes flemmes</h1><p className="muted">Dépose une demande et retrouve tes flemmes en cours.</p>
    <Action onClick={() => go('new', { draftId: undefined })}>＋ Déléguer ma flemme</Action>
    {taskDrafts.length > 0 && <><h2 className="section-title">Mes brouillons</h2>
      {taskDrafts.map(d => <div className="card" key={d.id}><span className="card-title">{d.fields.title || 'Brouillon sans titre'}</span><span className="note">Enregistré le {date(d.updatedAt)} · visible de toi seul</span>
        <span className="row"><button type="button" className="btn small" disabled={busy} onClick={() => go('new', { draftId: d.id })}>Reprendre</button><button type="button" className="btn small secondary" disabled={busy} onClick={() => session.deleteDraft(d.id)}>Supprimer</button></span></div>)}</>}
    <h2 className="section-title">Mes demandes</h2>
    {own.length ? own.map(card) : <p className="muted">Aucune flemme déposée. Par quoi veux-tu commencer ?</p>}{reload}</>;
  return <><p className="eyebrow">À toi de jouer, Brigadier.</p><h1 className="heading">Résoudre une flemme</h1><p className="muted">{brigadierPitch()}</p>
    {helping.length > 0 && <><h2 className="section-title">Mes propositions et missions</h2>{helping.map(card)}</>}
    <h2 className="section-title">Flemmes disponibles</h2>
    {available.length ? available.map(card) : <p className="muted">Aucune nouvelle flemme pour l’instant. Actualise la liste un peu plus tard.</p>}{reload}</>;
}
