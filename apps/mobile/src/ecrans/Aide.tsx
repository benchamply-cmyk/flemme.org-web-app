import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { FAQ, HELP_TOPICS, assistant, date, helpInput, helpStatus } from '../../../../packages/shared/src/index.ts';
import { session } from '../session';
import { Action } from '../ui/composants';
import { styles } from '../ui/styles';
import type { Ctx } from './contexte';

// Écran « help » : assistant à réponses prédéfinies (sans IA), puis message à l’équipe FLEMME, traité dans /admin.
export function Aide({ state: { busy, help, tasks, actorId }, draft, field, choice, validated, clearDraft }: Ctx) {
  const [asked, setAsked] = useState(''), [human, setHuman] = useState(false), [open, setOpen] = useState('');
  useEffect(() => { if (session.remote || help == null) void session.loadHelp(); }, []);
  const answers = asked ? assistant(asked) : FAQ.slice(0, 4);
  const mine = tasks.filter(t => t.owner.id === actorId || t.offers.some(o => o.brigadier.id === actorId)).map(t => ({ value: t.id, label: t.title }));
  return <><Text style={styles.heading}>Besoin d’aide ?</Text><Text style={styles.muted}>Pose ta question : l’assistant propose les réponses de l’équipe. Si ça ne suffit pas, écris-nous.</Text>
    {field('Ta question', 'question', { max: 200 })}
    <Action secondary disabled={busy} onPress={() => setAsked(draft.question || '')}>Chercher une réponse</Action>
    <Text style={styles.sectionTitle}>{asked ? (answers.length ? 'Réponses proposées' : 'Aucune réponse toute prête') : 'Questions fréquentes'}</Text>
    {answers.map(f => <Pressable key={f.id} accessibilityRole="button" accessibilityState={{ expanded: open === f.id }} onPress={() => setOpen(open === f.id ? '' : f.id)} style={styles.card}>
      <View style={styles.row}><Text style={[styles.strong, { flex: 1 }]}>{f.question}</Text><Text style={styles.strong}>{open === f.id ? '−' : '+'}</Text></View>
      {open === f.id && <Text style={styles.body}>{f.answer}</Text>}</Pressable>)}
    {!human ? <Action disabled={busy} onPress={() => setHuman(true)}>Écrire à l’équipe FLEMME</Action>
      : <View style={[styles.card, styles.propose]}><Text style={[styles.sectionTitle, { marginTop: 0 }]}>Écrire à l’équipe FLEMME</Text><Text style={styles.note}>Une personne de l’équipe lit chaque message. Ne partage jamais de mot de passe ni de numéro de carte.</Text>
        {choice('Sujet', 'topic', HELP_TOPICS)}
        {mine.length > 0 && choice('Demande concernée (facultatif)', 'taskId', mine, 'Aucune')}
        {field('Ton message', 'helpText', { multiline: true, max: 2000, onMint: true })}
        <Action disabled={busy} onPress={() => validated(() => { void session.sendHelp(helpInput(draft.topic, draft.helpText, draft.taskId), () => { clearDraft(['topic', 'taskId', 'helpText']); setHuman(false); }); })}>Envoyer mon message</Action></View>}
    {!!help?.length && <><Text style={styles.sectionTitle}>Mes messages</Text>
      {help.map(h => <View style={styles.bubble} key={h.id}><Text style={styles.strong}>{HELP_TOPICS.find(t => t.value === h.topic)?.label} · {helpStatus[h.status]}</Text><Text style={styles.body}>{h.text}</Text><Text style={styles.note}>{date(h.at)}</Text>
        {!!h.answer && <><Text style={styles.strong}>Réponse de l’équipe FLEMME</Text><Text style={styles.body}>{h.answer}</Text>{!!h.answeredAt && <Text style={styles.note}>{date(h.answeredAt)}</Text>}</>}</View>)}</>}</>;
}
