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
  return <>
    <h1 className="heading">{editing ? 'Modifier ma demande' : place.draftId ? 'Reprendre ma flemme' : 'La flemme de quoi ?'}</h1>
    <p className="muted">Pas besoin d’un brief parfait. Commence avec tes mots.</p>
    {field('Un titre pour ta flemme', 'title', { hint: 'Ex. Remettre mon CV au propre' })}
    {field('Raconte ce dont tu as besoin', 'details', { multiline: true, hint: 'La tâche, ce que tu attends, ce qui te bloque…' })}
    <Dictee disabled={busy} current={draft.details || ''} onText={details => fill({ details })}/>
    {choice('Catégorie', 'category', CATEGORIES, 'Choisir une catégorie')}
    {choice('Délai approximatif', 'deadline', DEADLINES, 'À discuter')}
    {draft.deadline === 'autre' && field('Précise le délai', 'deadlineNote', { hint: 'Ex. avant la rentrée' })}
    {field('Budget libre · facultatif, hors frais', 'amount', { numeric: true })}
    {choice('Ou une fourchette · facultatif', 'budgetRange', BUDGET_RANGES, 'À discuter')}
    {estimate && <p className="note">Si un Brigadier accepte ce forfait, tu paieras {money(estimate.total)} : {money(estimate.amount)} pour lui et {money(estimate.commission)} de frais FLEMME.</p>}
    {choice('Où se déroule la tâche ?', 'mode', MODES)}
    {mode !== 'distance' && <>
      {field('Ville ou secteur · public', 'place', { hint: 'Ex. Lyon · Croix-Rousse' })}
      {field('Adresse précise · privée', 'address', { max: 200, hint: 'Visible seulement par toi, le Brigadier que tu retiens et l’équipe FLEMME. Jamais sur la fiche publique.' })}
    </>}
    <p className="note">Sans expiration. {commissionNote()} Ta demande reste privée jusqu’à sa validation par l’équipe FLEMME, qui peut te demander une correction. Cette vérification ne garantit pas le résultat.</p>
    <p className="note">N’ajoute pas d’informations sensibles dans le titre ni la description : tu pourras transmettre les détails utiles en privé.</p>
    <Action disabled={busy} onClick={send}>{editing ? 'Renvoyer ma demande' : 'Envoyer pour validation'}</Action>
    {!editing && <Action secondary disabled={busy} onClick={() => session.saveDraft({ id: place.draftId, kind: 'task', fields: fields() }, d => keepDraft(d.id))}>Enregistrer le brouillon</Action>}
  </>;
}
