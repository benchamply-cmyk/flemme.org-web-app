import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { Option, SearchFilter, Task } from '../../../../packages/shared/src/index.ts';
import { BUDGET_FILTERS, CATEGORIES, DEADLINES, MODES, SORTS, brigadierPitch, budgetLabel, cardHint, categoryLabel, date, deadlineLabel, money, partition, reviewLabel, rights, taskStatus } from '../../../../packages/shared/src/index.ts';
import { session } from '../session';
import { Action, Loupe } from '../ui/composants';
import { styles, v04 } from '../ui/styles';
import type { Ctx } from './contexte';

export function TaskCard({ task: t, actorId, onOpen }: { task: Task; actorId: string; onOpen: () => void }) {
  const pending = t.owner.id === actorId && t.review && t.review !== 'published';
  return <Pressable accessibilityRole="button" accessibilityLabel={'Voir : ' + t.title} onPress={onOpen} style={({ pressed }) => [styles.card, pressed && { boxShadow: '5px 6px 0 #a5ccff' }]}><View style={styles.row}><Text style={[styles.tag, pending && styles.tagWarn]}>{pending ? reviewLabel[t.review!] : taskStatus[t.status]}</Text><Text style={styles.strong}>{budgetLabel(t, money)}</Text></View><Text style={styles.cardTitle}>{t.title}</Text><Text style={styles.muted}>{[categoryLabel(t), t.place, t.deadline ? deadlineLabel(t) : ''].filter(Boolean).join(' · ')}</Text><Text style={styles.link}>{cardHint(t, actorId)}</Text></Pressable>;
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
export function Listes(ctx: Ctx) {
  const { state: { tasks, actorId, busy, more, drafts }, place, go } = ctx;
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
    <Recherche ctx={ctx} card={card} fallback={available} skip={helping}/></>;
}

// Recherche par mots clés, filtres et tri : faits par le serveur (flemme_v2.search_tasks) ou la démo (searchTasks),
// comme la page « Flemmes à résoudre » du site. La loupe de l’en-tête ouvre cet écran barre active et filtres dépliés.
function Recherche({ ctx: { state: { busy, found, filter }, place }, card, fallback, skip }: { ctx: Ctx; card: (t: Task) => React.ReactNode; fallback: Task[]; skip: Task[] }) {
  const [f, setF] = useState<SearchFilter>(filter), [open, setOpen] = useState(!!place.recherche);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  useEffect(() => { if (!found || place.recherche) void session.search(filter); if (place.recherche) setTimeout(() => input.current?.focus(), 50); }, []);
  const run = (next: SearchFilter) => { setF(next); void session.search(next); };
  const pills = (label: string, k: keyof SearchFilter, options: readonly Option[], empty: string) => <View style={styles.field} accessibilityLabel={label}><Text style={styles.label}>{label}</Text><View style={[styles.row, { justifyContent: 'flex-start', gap: 8 }]}>
    {[...(empty ? [{ value: '', label: empty }] : []), ...options].map(o => <Pressable key={o.value} accessibilityRole="radio" accessibilityLabel={o.label} accessibilityState={{ checked: (f[k] || '') === o.value, disabled: busy }} disabled={busy} onPress={() => run({ ...f, [k]: o.value })} style={[styles.option, (f[k] || '') === o.value && styles.optionSelected]}><Text style={styles.strong}>{o.label}</Text></Pressable>)}
  </View></View>;
  const active = Object.entries(f).filter(([k, v]) => v && k !== 'sort' && k !== 'q').length;
  const list = found ? found.tasks.filter(t => !skip.some(v => v.id === t.id)) : fallback;
  return <>
    <View style={[styles.card, styles.recherche]} accessibilityRole="search">
      <View style={styles.rechercheBarre}><Loupe size={20}/><TextInput ref={input} accessibilityLabel="Rechercher une demande" value={f.q || ''} onChangeText={q => setF(v => ({ ...v, q }))} onSubmitEditing={() => run(f)} returnKeyType="search" placeholder="Une tâche, une compétence… Ex. CV, étagère" placeholderTextColor={v04.texteDoux} maxLength={100} editable={!busy} style={styles.rechercheChamp}/></View>
      <View style={styles.row}><Action small disabled={busy} onPress={() => run(f)}>Rechercher</Action><Action small secondary onPress={() => setOpen(!open)}>{'☷ Filtres' + (active ? ' (' + active + ')' : '')}</Action></View>
      {open && <>
        {pills('Catégorie', 'category', CATEGORIES, 'Toutes')}
        {pills('Où', 'mode', MODES, 'Partout')}
        <View style={styles.field}><Text style={styles.label}>Ville ou secteur</Text><TextInput accessibilityLabel="Ville ou secteur" value={f.place || ''} onChangeText={place => setF(v => ({ ...v, place }))} onBlur={() => run(f)} onSubmitEditing={() => run(f)} maxLength={100} editable={!busy} style={[styles.input, styles.inputOnMint]}/></View>
        {pills('Budget indicatif', 'budget', BUDGET_FILTERS, 'Tous')}
        {pills('Délai', 'deadline', DEADLINES, 'Tous')}
        {pills('Trier par', 'sort', SORTS, '')}
        <Action small secondary disabled={busy} onPress={() => run({ sort: f.sort })}>Réinitialiser les filtres</Action>
      </>}
    </View>
    {found && <Text accessibilityLiveRegion="polite" style={styles.note}>{found.total === 0 ? 'Aucune demande ne correspond.' : found.total + ' demande(s) trouvée(s)' + (f.q ? ' pour « ' + f.q + ' »' : '')}</Text>}
    {list.length ? list.map(card) : !found && <Text style={styles.muted}>Aucune nouvelle demande pour l’instant. Tire la liste vers le bas pour l’actualiser.</Text>}
    {found?.total === 0 && (active > 0 || !!f.q) && <><Text style={styles.muted}>Essaie d’autres mots, d’élargir la zone ou d’afficher les tâches à distance.</Text><Action secondary disabled={busy} onPress={() => run({ sort: f.sort })}>Effacer la recherche et les filtres</Action></>}
    {found?.nextCursor && <Action secondary disabled={busy} onPress={() => session.search(filter, true)}>Voir plus de demandes</Action>}
    <Text style={styles.note}>Seules les demandes validées par l’équipe apparaissent ici. Prix indicatifs hors frais FLEMME. Ouvrir une demande ne crée aucune conversation : c’est toi qui proposes ton aide.</Text>
  </>;
}
