import type { Task } from '../../../../packages/shared/src/index.ts';
import { budgetLabel, cardHint, money, partition, taskStatus } from '../../../../packages/shared/src/index.ts';
import { session } from '../session.ts';
import { Action } from '../ui.tsx';
import type { Ctx } from './contexte.ts';

export function TaskCard({ task: t, actorId, onOpen }: { task: Task; actorId: string; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="card"><span className="row"><span className="tag">{taskStatus[t.status]}</span><span className="strong">{budgetLabel(t, money)}</span></span><span className="card-title">{t.title}</span><span className="muted">{t.place}</span><span className="link">{cardHint(t, actorId)}</span></button>;
}
export function Listes({ state: { tasks, actorId, busy }, place, go }: Ctx) {
  const { own, helping, available } = partition(tasks, actorId);
  const card = (t: Task) => <TaskCard key={t.id} task={t} actorId={actorId} onOpen={() => go('detail', { taskId: t.id })}/>;
  const reload = <Action secondary disabled={busy} onClick={() => session.refresh()}>↻ Actualiser</Action>;
  if (place.tab === 'mine') return <><h1 className="heading">Mes flemmes</h1><p className="muted">Dépose une demande et retrouve tes flemmes en cours.</p>
    <Action onClick={() => go('new')}>＋ Déposer ma flemme</Action><h2 className="section-title">Mes demandes</h2>
    {own.length ? own.map(card) : <p className="muted">Aucune flemme déposée. Par quoi veux-tu commencer ?</p>}{reload}</>;
  return <><p className="eyebrow">À toi de jouer, Brigadier.</p><h1 className="heading">Résoudre une flemme</h1><p className="muted">Propose ton forfait. Le déposant règle 10 % en plus à FLEMME.</p>
    {helping.length > 0 && <><h2 className="section-title">Mes propositions et missions</h2>{helping.map(card)}</>}
    <h2 className="section-title">Flemmes disponibles</h2>
    {available.length ? available.map(card) : <p className="muted">Aucune nouvelle flemme pour l’instant. Actualise la liste un peu plus tard.</p>}{reload}</>;
}
