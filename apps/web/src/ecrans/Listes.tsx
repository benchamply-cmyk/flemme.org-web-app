import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Option, SearchFilter, Task } from '../../../../packages/shared/src/index.ts';
import { BUDGET_FILTERS, CATEGORIES, DEADLINES, MODES, SORTS, brigadierPitch, budgetLabel, cardHint, categoryLabel, date, deadlineLabel, money, partition, reviewLabel, taskStatus } from '../../../../packages/shared/src/index.ts';
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
  const offerDrafts = drafts.filter(d => d.kind === 'offer');
  return <><p className="eyebrow">À toi de jouer, Brigadier.</p><h1 className="heading">Résoudre une flemme</h1><p className="muted">{brigadierPitch()}</p>
    {offerDrafts.length > 0 && <><h2 className="section-title">Mes candidatures en brouillon</h2>
      {offerDrafts.map(d => <div className="card" key={d.id}><span className="card-title">{tasks.find(t => t.id === d.taskId)?.title || 'Candidature'}</span><span className="note">Enregistrée le {date(d.updatedAt)} · visible de toi seul</span>
        <span className="row"><button type="button" className="btn small" disabled={busy} onClick={() => go('detail', { taskId: d.taskId || '', draftId: d.id })}>Reprendre</button><button type="button" className="btn small secondary" disabled={busy} onClick={() => session.deleteDraft(d.id)}>Supprimer</button></span></div>)}</>}
    {helping.length > 0 && <><h2 className="section-title">Mes propositions et missions</h2>{helping.map(card)}</>}
    <h2 className="section-title">Flemmes disponibles</h2>
    <Recherche {...ctx} card={card} fallback={available} skip={helping}/></>;
}

// Recherche et filtres choisis sur la vitrine (page Résoudre, catégories de l’accueil et du pied de page), lus une seule fois.
// Ancienne clé « flemme.recherche » (mots seuls) encore acceptée.
const FILTRE_KEYS: (keyof SearchFilter)[] = ['q', 'category', 'mode', 'place', 'budget', 'deadline'];
function pendingFilter(): SearchFilter {
  try {
    const raw = sessionStorage.getItem('flemme.filtre'), old = sessionStorage.getItem('flemme.recherche') || '';
    sessionStorage.removeItem('flemme.filtre'); sessionStorage.removeItem('flemme.recherche');
    const data = raw ? JSON.parse(raw) as Record<string, unknown> : { q: old };
    return Object.fromEntries(FILTRE_KEYS.filter(k => typeof data[k] === 'string' && (data[k] as string).trim()).map(k => [k, (data[k] as string).trim().slice(0, 100)]));
  } catch { return {}; }
}

// Recherche, filtres et tri : faits par le serveur (flemme_v2.search_tasks), pagination comprise.
function Recherche({ state: { busy, found, filter }, card, fallback, skip }: Ctx & { card: (t: Task) => ReactNode; fallback: Task[]; skip: Task[] }) {
  const [f, setF] = useState<SearchFilter>(filter), [open, setOpen] = useState(false);
  useEffect(() => {
    const pending = pendingFilter();
    if (Object.keys(pending).length) { run({ sort: filter.sort, ...pending }); if (FILTRE_KEYS.some(k => k !== 'q' && pending[k])) setOpen(true); } else if (!found) void session.search(filter);
  }, []);
  const set = (k: keyof SearchFilter) => (e: { target: { value: string } }) => setF(v => ({ ...v, [k]: e.target.value }));
  const run = (next: SearchFilter) => { setF(next); void session.search(next); };
  const select = (label: string, k: keyof SearchFilter, options: readonly Option[], empty: string) =>
    <div className="field"><label htmlFor={'s-' + k}>{label}</label><select id={'s-' + k} value={f[k] || ''} disabled={busy} onChange={e => run({ ...f, [k]: e.target.value })}>{empty && <option value="">{empty}</option>}{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>;
  const active = Object.entries(f).filter(([k, v]) => v && k !== 'sort').length;
  // Les flemmes où j’ai déjà proposé mon aide sont au-dessus, dans « Mes propositions et missions ».
  const list = found ? found.tasks.filter(t => !skip.some(v => v.id === t.id)) : fallback;
  return <>
    <form role="search" className="searchbar" onSubmit={e => { e.preventDefault(); run(f); }}>
      <div className="field"><label htmlFor="s-q">Rechercher une flemme</label><input id="s-q" type="search" value={f.q || ''} onChange={set('q')} placeholder="Un mot, une compétence, une envie…" maxLength={100}/></div>
      <div className="row"><button type="submit" className="btn small" disabled={busy}>Rechercher</button><button type="button" className="btn small secondary" aria-expanded={open} aria-controls="filtres" onClick={() => setOpen(!open)}>☷ Filtres{active ? ' (' + active + ')' : ''}</button></div>
    </form>
    {open && <div id="filtres" className="card">
      {select('Catégorie', 'category', CATEGORIES, 'Toutes')}
      {select('Où', 'mode', MODES, 'Partout')}
      <div className="field"><label htmlFor="s-place">Ville ou secteur</label><input id="s-place" value={f.place || ''} onChange={set('place')} onBlur={() => run(f)} maxLength={100}/></div>
      {select('Budget indicatif', 'budget', BUDGET_FILTERS, 'Tous')}
      {select('Délai', 'deadline', DEADLINES, 'Tous')}
      <button type="button" className="btn small secondary" disabled={busy} onClick={() => run({ sort: f.sort })}>Réinitialiser les filtres</button>
    </div>}
    {select('Trier par', 'sort', SORTS, '')}
    {found && <p className="note" aria-live="polite">{found.total === 0 ? 'Aucune flemme ne correspond.' : found.total + ' flemme(s) trouvée(s)'}</p>}
    {list.length ? list.map(card) : !found && <p className="muted">Aucune nouvelle flemme pour l’instant. Actualise la liste un peu plus tard.</p>}
    {found?.total === 0 && active > 0 && <button type="button" className="btn secondary" disabled={busy} onClick={() => run({ sort: f.sort })}>Effacer la recherche et les filtres</button>}
    {found?.nextCursor && <button type="button" className="btn secondary" disabled={busy} onClick={() => session.search(filter, true)}>Voir plus de flemmes</button>}
    <button type="button" className="btn secondary" disabled={busy} onClick={() => session.search(filter)}>↻ Actualiser</button>
    <p className="note">Seules les demandes validées par l’équipe apparaissent ici. Prix indicatifs hors frais FLEMME. Ouvrir une fiche ne crée aucune conversation : c’est toi qui proposes ton aide.</p>
  </>;
}
