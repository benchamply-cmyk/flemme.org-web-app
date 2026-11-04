import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Task } from '../../../../packages/shared/src/index.ts';
import { budgetLabel, cardHint, money, partition, taskStatus } from '../../../../packages/shared/src/index.ts';
import { session } from '../session';
import { Action } from '../ui/composants';
import { styles } from '../ui/styles';
import type { Ctx } from './contexte';

export function TaskCard({ task: t, actorId, onOpen }: { task: Task; actorId: string; onOpen: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={'Voir : ' + t.title} onPress={onOpen} style={styles.card}><View style={styles.row}><Text style={styles.tag}>{taskStatus[t.status]}</Text><Text style={styles.strong}>{budgetLabel(t, money)}</Text></View><Text style={styles.cardTitle}>{t.title}</Text><Text style={styles.muted}>{t.place}</Text><Text style={styles.link}>{cardHint(t, actorId)}</Text></Pressable>;
}
// Actualisation : geste « tirer vers le bas » géré par App.tsx (RefreshControl).
export function Listes({ state: { tasks, actorId, busy, more }, tab, navigate, openTask }: Ctx) {
  const { own, helping, available } = partition(tasks, actorId);
  const moreButton = more ? <Action secondary disabled={busy} onPress={() => session.loadMore()}>Voir plus de flemmes</Action> : null;
  const card = (t: Task) => <TaskCard key={t.id} task={t} actorId={actorId} onOpen={() => openTask(t)}/>;
  if (tab === 'mine') return <><Text style={styles.heading}>Mes flemmes</Text><Text style={styles.muted}>Dépose une demande et retrouve tes flemmes en cours.</Text>
    <Action onPress={() => navigate('new')}>＋ Déposer ma flemme</Action><Text style={styles.sectionTitle}>Mes demandes</Text>
    {own.length ? own.map(card) : <Text style={styles.muted}>Aucune flemme déposée. Par quoi veux-tu commencer ?</Text>}{moreButton}</>;
  return <><Text style={styles.eyebrow}>À TOI DE JOUER, BRIGADIER.</Text><Text style={styles.heading}>Résoudre une flemme</Text><Text style={styles.muted}>Propose ton forfait. Le déposant règle 10 % en plus à FLEMME.</Text>
    {helping.length > 0 && <><Text style={styles.sectionTitle}>Mes propositions et missions</Text>{helping.map(card)}</>}
    <Text style={styles.sectionTitle}>Flemmes disponibles</Text>
    {available.length ? available.map(card) : <Text style={styles.muted}>Aucune nouvelle flemme pour l’instant. Tire la liste vers le bas pour l’actualiser.</Text>}{moreButton}</>;
}
