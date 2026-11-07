import React from 'react';
import { Text, View } from 'react-native';
import { BUDGET_RANGES, CATEGORIES, DEADLINES, MODES, TASK_FIELDS, canEdit, commissionNote, money, notices, parseMoney, price, taskInput } from '../../../../packages/shared/src/index.ts';
import { session } from '../session';
import { Action } from '../ui/composants';
import { styles } from '../ui/styles';
import type { Ctx } from './contexte';

// Dépôt d’une demande (écran « new », éventuellement repris d’un brouillon) et modification (écran « edit »).
// Mêmes textes et même ordre que le site ; les contrôles sont ceux de packages/shared/src/parcours.ts, refaits par le serveur.
export function NouvelleFlemme({ state: { busy, actorId }, place, task, draft, field, choice, mutate, validated, keepDraft, fill }: Ctx) {
  const editing = place.screen === 'edit';
  if (editing && !canEdit(task, actorId)) return <Text style={styles.body}>Cette demande ne peut plus être modifiée. Reviens à sa fiche pour consulter son état.</Text>;
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
    <Text style={styles.heading}>{editing ? 'Modifier ma demande' : place.draftId ? 'Reprendre ma demande' : 'Qu’aimerais-tu déléguer ?'}</Text>
    <Text style={styles.muted}>Pas besoin d’un brief parfait. Commence avec tes mots.</Text>
    {field('Décris ce dont tu as besoin', 'details', { multiline: true, hint: 'Ex. « J’aimerais mettre mon CV à jour avant vendredi. »' })}
    {field('Un titre court pour ta demande', 'title', { hint: 'Ex. Mettre mon CV à jour' })}
    {!draft.title && suggestion.length > 3 && <Action small secondary disabled={busy} onPress={() => fill({ title: suggestion[0].toUpperCase() + suggestion.slice(1) })}>Utiliser « {suggestion} » comme titre</Action>}
    {choice('Catégorie', 'category', CATEGORIES)}
    {choice('Où se déroule la tâche ?', 'mode', MODES)}
    {mode !== 'distance' && <>
      {field('Ville ou secteur · public', 'place', { hint: 'Ex. Lyon · Croix-Rousse' })}
      {field('Adresse précise · privée', 'address', { max: 200, hint: 'Rue, numéro…' })}
      <Text style={styles.note}>Visible seulement par toi, le Brigadier que tu retiens et l’équipe FLEMME. Jamais sur la fiche publique.</Text>
    </>}
    {choice('Délai approximatif', 'deadline', DEADLINES, 'À discuter')}
    {draft.deadline === 'autre' && field('Précise le délai', 'deadlineNote', { hint: 'Ex. avant la rentrée' })}
    {field('Budget · facultatif, hors frais', 'amount', { numeric: true })}
    {choice('Ou une fourchette · facultatif', 'budgetRange', BUDGET_RANGES, 'À discuter')}
    {estimate && <Text style={styles.note}>Si une proposition à ce prix est acceptée, tu paieras {money(estimate.total)} : {money(estimate.amount)} pour la personne qui t’aide et {money(estimate.commission)} de frais FLEMME.</Text>}
    <Text style={styles.sectionTitle}>Vérifie ta demande</Text>
    <Text style={styles.muted}>Voici les informations qui pourront être visibles sur ta fiche.</Text>
    <View style={styles.card} accessibilityLabel="Aperçu de ta fiche publique"><View style={styles.row}><Text style={styles.tag}>{label(CATEGORIES, draft.category) || 'Catégorie à choisir'}</Text><Text style={styles.strong}>{budget}</Text></View><Text style={styles.cardTitle}>{draft.title || 'Titre à compléter'}</Text><Text style={styles.muted}>{[lieu, draft.deadline ? (draft.deadline === 'autre' ? draft.deadlineNote : label(DEADLINES, draft.deadline)) : 'Délai à discuter'].filter(Boolean).join(' · ')}</Text>{!!draft.details && <Text style={styles.body}>{draft.details}</Text>}</View>
    <Text style={styles.note}>Sans expiration. {commissionNote()} Ta demande reste privée jusqu’à sa relecture par l’équipe FLEMME, qui peut te demander une correction. Cette relecture ne garantit pas le résultat.</Text>
    <Text style={styles.note}>N’ajoute pas d’informations sensibles dans le titre ni la description : tu pourras transmettre les détails utiles en privé.</Text>
    <Action disabled={busy} onPress={send}>{editing ? 'Renvoyer ma demande' : 'Envoyer ma demande'}</Action>
    {!editing && <Action secondary disabled={busy} onPress={() => session.saveDraft({ id: place.draftId, kind: 'task', fields: fields() }, d => keepDraft(d.id))}>Enregistrer le brouillon</Action>}
  </>;
}
