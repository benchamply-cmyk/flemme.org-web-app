import React from 'react';
import { Text } from 'react-native';
import { BUDGET_RANGES, CATEGORIES, DEADLINES, MODES, TASK_FIELDS, commissionNote, notices, taskInput, parseMoney, canEdit } from '../../../../packages/shared/src/index.ts';
import { session } from '../session';
import { Action, Bill } from '../ui/composants';
import { styles } from '../ui/styles';
import type { Ctx } from './contexte';

export function NouvelleFlemme({ state: { busy, actorId }, screen, task, draft, field, choice, mutate, validated }: Ctx) {
  const editing = screen === 'edit';
  const mode = draft.mode || 'distance';
  const estimate = (() => { try { return parseMoney(draft.amount || '', true); } catch { return null; } })();
  if (editing && !canEdit(task, actorId)) return <Text style={styles.body}>Cette demande ne peut plus être modifiée. Reviens à sa fiche pour consulter son état.</Text>;
  const send = () => validated(() => {
    const data = taskInput(draft);
    void mutate(editing ? 'edit' : 'create', data, 'detail', t => t.review === 'pending' ? notices.sentForReview : editing ? notices.edited : notices.published);
  });
  return <><Text style={styles.heading}>{editing ? 'Modifier ma demande' : 'La flemme de quoi ?'}</Text><Text style={styles.muted}>Pas besoin d’un brief parfait. Commence avec tes mots.</Text>
    {field('Un titre pour ta flemme', 'title', { hint: 'Ex. Remettre mon CV au propre' })}
    {field('Raconte ce dont tu as besoin', 'details', { multiline: true, hint: 'La tâche, ce que tu attends, ce qui te bloque…' })}
    {choice('Catégorie', 'category', CATEGORIES, 'Choisir une catégorie')}
    {choice('Délai approximatif', 'deadline', DEADLINES, 'À discuter')}
    {draft.deadline === 'autre' && field('Précise le délai', 'deadlineNote', { hint: 'Ex. avant la rentrée' })}
    {field('Budget libre · facultatif, hors frais', 'amount', { numeric: true })}
    {choice('Ou une fourchette · facultatif', 'budgetRange', BUDGET_RANGES, 'À discuter')}
    {estimate != null && <Bill amount={estimate}/>}
    {choice('Où se déroule la tâche ?', 'mode', MODES)}
    {mode !== 'distance' && <>
      {field('Ville ou secteur · public', 'place', { hint: 'Ex. Lyon · Croix-Rousse' })}
      {field('Adresse précise · privée', 'address', { max: 200, hint: 'Rue, numéro…' })}
      <Text style={styles.note}>L’adresse précise est réservée à toi, au Brigadier retenu et à l’équipe FLEMME. Jamais sur la fiche publique.</Text>
    </>}
    <Text style={styles.note}>Sans expiration. {commissionNote()} Ta demande reste privée jusqu’à sa validation par l’équipe FLEMME. Cette vérification ne garantit pas le résultat.</Text>
    <Text style={styles.note}>N’ajoute pas d’informations sensibles dans le titre ni la description. Transmets les détails utiles en privé.</Text>
    <Action disabled={busy} onPress={send}>{editing ? 'Renvoyer ma demande' : 'Envoyer pour validation'}</Action>
    {!editing && <><Action secondary disabled={busy} onPress={() => session.saveDraft({ kind: 'task', fields: Object.fromEntries(TASK_FIELDS.filter(k => draft[k]).map(k => [k, draft[k]])) }, () => {})}>Enregistrer une version du brouillon</Action><Text style={styles.note}>Chaque enregistrement conserve une nouvelle version. L’envoi garde aussi tes brouillons.</Text></>}
  </>;
}
