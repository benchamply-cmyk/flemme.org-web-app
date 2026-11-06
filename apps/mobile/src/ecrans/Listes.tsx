import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Task } from '../../../../packages/shared/src/index.ts';
import { brigadierPitch, budgetLabel, cardHint, categoryLabel, date, deadlineLabel, money, partition, reviewLabel, rights, taskStatus } from '../../../../packages/shared/src/index.ts';
import { session } from '../session';
import { Action } from '../ui/composants';
import { styles } from '../ui/styles';
import type { Ctx } from './contexte';

export function TaskCard({ task: t, actorId, onOpen }: { task: Task; actorId: string; onOpen: () => void }) {
  const pending = t.owner.id === actorId && t.review && t.review !== 'published';
  return <Pressable accessibilityRole="button" accessibilityLabel={'Voir : ' + t.title} onPress={onOpen} style={({ pressed }) => [styles.card, pressed && { boxShadow: '5px 6px 0 #3a2fa0' }]}><View style={styles.row}><Text style={[styles.tag, pending && styles.tagWarn]}>{pending ? reviewLabel[t.review!] : taskStatus[t.status]}</Text><Text style={styles.strong}>{budgetLabel(t, money)}</Text></View><Text style={styles.cardTitle}>{t.title}</Text><Text style={styles.muted}>{[categoryLabel(t), t.place, t.deadline ? deadlineLabel(t) : ''].filter(Boolean).join(' · ')}</Text><Text style={styles.link}>{cardHint(t, actorId)}</Text></Pressable>;
}

/** Prochaine étape attendue de la personne connectée sur une demande, ou '' si c’est à l’autre d’agir (comme le site). */
function nextStep(t: Task, actorId: string) {
  const can = rights(t, actorId);
  if (can.isOwner && t.review === 'changes_requested') return 'Corriger ta demande';
  if (can.isOwner && t.status === 'open' && t.offers.some(o => o.status === 'pending')) return 'Voir les propositions reçues';
  if (can.canSign) return 'Relire et signer l’accord';
  if (can.canContract && !t.contract) return 'Rédiger l’accord';
  if (can.canContract && (t.contract?.status === 'draft' || t.contract?.status === 'changes_requested')) return 'Relire l’accord';
  if (can.canDeclarePayment) return 'Régler et déclarer le paiement';
  if (can.canConfirmPayment) return 'Confirmer le paiement reçu';
  if (can.canReview) return 'Donner ton avis';
  return '';
}

// Mon espace (tab « mine ») et Flemmes à résoudre (tab « find »). Actualisation : tirer vers le bas (App.tsx).
export function Listes({ state: { tasks, actorId, busy, more, drafts }, place, go }: Ctx) {
  const { own, helping, available } = partition(tasks, actorId);
  const moreButton = more ? <Action secondary disabled={busy} onPress={() => session.loadMore()}>Voir plus de demandes</Action> : null;
  const card = (t: Task) => <TaskCard key={t.id} task={t} actorId={actorId} onOpen={() => go('detail', { taskId: t.id, draftId: undefined })}/>;
  const taskDrafts = drafts.filter(d => d.kind === 'task'), offerDrafts = drafts.filter(d => d.kind === 'offer');
  const draftCard = (id: string, title: string, at: string, open: () => void) => <View key={id} style={styles.card}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.note}>Enregistré le {date(at)} · visible de toi seul</Text>
    <View style={styles.row}><Action small disabled={busy} onPress={open}>Reprendre</Action><Action small secondary disabled={busy} onPress={() => session.deleteDraft(id)}>Supprimer</Action></View></View>;
  if (place.tab === 'mine') {
    const todo = [...own, ...helping].map(t => ({ t, next: nextStep(t, actorId) })).filter(x => x.next);
    return <><Text style={styles.heading}>Tes demandes et tes propositions</Text><Text style={styles.muted}>Retrouve ce que tu as délégué et l’aide que tu as proposée.</Text>
      <Action onPress={() => go('new', { draftId: undefined })}>＋ Déléguer ma flemme</Action>
      {todo.length > 0 && <><Text style={styles.sectionTitle}>À faire</Text>
        {todo.map(({ t, next }) => <Pressable key={t.id} accessibilityRole="button" onPress={() => go('detail', { taskId: t.id, draftId: undefined })} style={[styles.card, { backgroundColor: '#e6efff' }]}><Text style={styles.cardTitle}>{t.title}</Text><Text style={styles.strong}>{next}</Text><Text style={styles.note}>{t.owner.id === actorId ? 'Ta demande' : 'Ta proposition'} · {taskStatus[t.status]}</Text></Pressable>)}</>}
      {taskDrafts.length > 0 && <><Text style={styles.sectionTitle}>Mes brouillons</Text>{taskDrafts.map(d => draftCard(d.id, d.fields.title || 'Brouillon sans titre', d.updatedAt, () => go('new', { draftId: d.id })))}</>}
      <Text style={styles.sectionTitle}>Mes demandes</Text>
      {own.length ? own.map(card) : <Text style={styles.muted}>Aucune demande pour l’instant. Qu’aimerais-tu déléguer ?</Text>}
      <Text style={styles.sectionTitle}>Mes propositions</Text>
      {offerDrafts.map(d => draftCard(d.id, tasks.find(t => t.id === d.taskId)?.title || 'Proposition', d.updatedAt, () => go('detail', { taskId: d.taskId || '', draftId: d.id })))}
      {helping.length ? helping.map(card) : !offerDrafts.length && <Text style={styles.muted}>Aucune proposition envoyée. Trouve une demande dans « Flemmes à résoudre ».</Text>}
      <Action secondary onPress={() => go('list', { tab: 'find' })}>Voir les demandes à résoudre</Action>{moreButton}</>;
  }
  return <><Text style={styles.eyebrow}>À toi de jouer, Brigadier.</Text><Text style={styles.heading}>Flemmes à résoudre</Text><Text style={styles.muted}>Trouve une tâche près de chez toi ou à distance. {brigadierPitch()}</Text>
    {(helping.length > 0 || offerDrafts.length > 0) && <Text style={styles.note}>Tes propositions et tes brouillons sont dans <Text style={styles.inlineLink} onPress={() => go('list', { tab: 'mine' })}>Mon espace</Text>.</Text>}
    <Text style={styles.sectionTitle}>Demandes disponibles</Text>
    {available.length ? available.map(card) : <Text style={styles.muted}>Aucune nouvelle demande pour l’instant. Tire la liste vers le bas pour l’actualiser.</Text>}{moreButton}</>;
}
