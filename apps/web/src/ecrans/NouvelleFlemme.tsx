import { BUDGET_RANGES, CATEGORIES, DEADLINES, MODES, TASK_FIELDS, commissionNote, notices, price, money, parseMoney, taskInput } from '../../../../packages/shared/src/index.ts';
import { session } from '../session.ts';
import { Action } from '../ui.tsx';
import { Dictee } from './Dictee.tsx';
import type { Ctx } from './contexte.ts';

// Dépôt d’une demande (écran « new », éventuellement repris d’un brouillon) et modification (écran « edit »).
// Les contrôles sont ceux de packages/shared/src/parcours.ts, refaits par le serveur.
export function NouvelleFlemme({ state: { busy }, place, task, draft, field, choice, mutate, validated, keepDraft, fill }: Ctx) {
  const editing = place.screen === 'edit' && !!task;
  const mode = draft.mode || 'distance';
  const fields = () => Object.fromEntries(TASK_FIELDS.filter(k => draft[k]).map(k => [k, draft[k]]));
  const estimate = (() => { try { const n = parseMoney(draft.amount || '', true); return n ? price(n) : null; } catch { return null; } })();
  const send = () => validated(() => {
    const data = taskInput(draft);
    if (editing) void mutate('edit', data, 'detail', t => t.review === 'pending' ? 'Demande modifiée et renvoyée pour validation.' : notices.edited);
    else void mutate('create', { ...data, draftId: place.draftId || null }, 'detail', t => t.review === 'pending' ? notices.sentForReview : notices.published);
  });
  // Titre suggéré à partir du début de la description, modifiable.
  const suggestion = (draft.details || '').trim().split(/[.!?\n]/)[0].replace(/^(j’aimerais|j'aimerais|je voudrais|il faut)\s+/i, '').slice(0, 60).trim();
  const label = (options: readonly { value: string; label: string }[], v?: string) => options.find(o => o.value === v)?.label;
  const lieu = mode === 'distance' ? 'À distance' : [label(MODES, mode), draft.place].filter(Boolean).join(' · ');
  const budget = estimate ? money(estimate.amount) : label(BUDGET_RANGES, draft.budgetRange) || 'Prix à proposer';
  return <>
    <h1 className="heading">{editing ? 'Modifier ma demande' : place.draftId ? 'Reprendre ma demande' : 'Qu’aimerais-tu déléguer ?'}</h1>
    <p className="muted">Pas besoin d’un brief parfait. Commence avec tes mots.</p>
    {field('Décris ce dont tu as besoin', 'details', { multiline: true, hint: 'Exemple : « J’aimerais mettre mon CV à jour avant vendredi. » Le résultat attendu, ce qui te bloque…' })}
    <Dictee disabled={busy} current={draft.details || ''} onText={details => fill({ details })}/>
    {field('Un titre court pour ta demande', 'title', { hint: 'Ex. Mettre mon CV à jour' })}
    {!draft.title && suggestion.length > 3 && <button type="button" className="btn small secondary" disabled={busy} onClick={() => fill({ title: suggestion[0].toUpperCase() + suggestion.slice(1) })}>Utiliser « {suggestion} » comme titre</button>}
    {choice('Catégorie', 'category', CATEGORIES, 'Choisir une catégorie')}
    {choice('Où se déroule la tâche ?', 'mode', MODES)}
    {mode !== 'distance' && <>
      {field('Ville ou secteur · public', 'place', { hint: 'Ex. Lyon · Croix-Rousse' })}
      {field('Adresse précise · privée', 'address', { max: 200, hint: 'Visible seulement par toi, le Brigadier que tu retiens et l’équipe FLEMME. Jamais sur la fiche publique.' })}
    </>}
    {choice('Délai approximatif', 'deadline', DEADLINES, 'À discuter')}
    {draft.deadline === 'autre' && field('Précise le délai', 'deadlineNote', { hint: 'Ex. avant la rentrée' })}
    {field('Budget · facultatif, hors frais', 'amount', { numeric: true })}
    {choice('Ou une fourchette · facultatif', 'budgetRange', BUDGET_RANGES, 'À discuter')}
    {estimate && <p className="note">Si une proposition à ce prix est acceptée, tu paieras {money(estimate.total)} : le forfait de {money(estimate.amount)} et {money(estimate.total - estimate.amount)} de frais FLEMME.</p>}
    <h2 className="section-title">Vérifie ta demande</h2>
    <p className="muted">Voici les informations qui pourront être visibles sur ta fiche.</p>
    <div className="card apercu-demande" aria-label="Aperçu de ta fiche publique"><span className="row"><span className="tag">{label(CATEGORIES, draft.category) || 'Catégorie à choisir'}</span><span className="strong">{budget}</span></span><span className="card-title">{draft.title || 'Titre à compléter'}</span><span className="muted">{[lieu, draft.deadline ? (draft.deadline === 'autre' ? draft.deadlineNote : label(DEADLINES, draft.deadline)) : 'Délai à discuter'].filter(Boolean).join(' · ')}</span>{draft.details && <span>{draft.details}</span>}</div>
    <p className="note">Sans expiration. {commissionNote()} Ta demande reste privée jusqu’à sa relecture par l’équipe FLEMME, qui peut te demander une correction. Cette relecture ne garantit pas le résultat.</p>
    <p className="note">N’ajoute pas d’informations sensibles dans le titre ni la description : tu pourras transmettre les détails utiles en privé.</p>
    <Action disabled={busy} onClick={send}>{editing ? 'Renvoyer ma demande' : 'Envoyer ma demande'}</Action>
    {!editing && <Action secondary disabled={busy} onClick={() => session.saveDraft({ id: place.draftId, kind: 'task', fields: fields() }, d => keepDraft(d.id))}>Enregistrer le brouillon</Action>}
  </>;
}
