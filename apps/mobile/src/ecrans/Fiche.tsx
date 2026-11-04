import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { date, money, notices, offerStatus, parseMoney, paymentNote, paymentStatus, taskStatus } from '../../../../packages/shared/src/index.ts';
import { Action, Bill } from '../ui/composants';
import { styles } from '../ui/styles';
import type { Ctx } from './contexte';

// Fiche d’une flemme : accord, paiement déclaratif, propositions, signalements et historique.
export function Fiche({ state: { busy }, task, can, draft, field, navigate, openOffer, mutate, validated }: Ctx) {
  const [showHistory, setShowHistory] = useState(false);
  if (!task) return null;
  const { agreement } = task;
  const preview = (() => { try { const n = parseMoney(draft.amount || ''); return n != null ? <Bill amount={n}/> : null; } catch { return null; } })();
  return <><Text style={styles.tag}>{taskStatus[task.status]}{task.status === 'open' ? ' · sans expiration' : ''}</Text><Text style={styles.heading}>{task.title}</Text><Text style={styles.muted}>{task.place} · déposée par {task.owner.name}</Text><Text style={styles.body}>{task.details}</Text>
    <Text style={styles.strong}>{task.budget == null ? 'Prix à proposer' : 'Budget indicatif : ' + money(task.budget) + ' hors frais'}</Text>
    {agreement && <><Text style={styles.sectionTitle}>{agreement.brigadier.name} prend le relais</Text><Text style={styles.body}>{agreement.scope}</Text><Text style={styles.muted}>{agreement.slot}</Text><Bill amount={agreement.amount} agreed={agreement}/>
      <Text style={styles.note}>{paymentNote(agreement, false, money)}</Text>
      {can.canComplete && <Action disabled={busy} onPress={() => mutate('complete', {})}>Confirmer la tâche terminée</Action>}
      {can.canDeclarePayment && <Action disabled={busy} onPress={() => mutate('declare_payment', {})}>J’ai payé le Brigadier</Action>}
      {can.canConfirmPayment && <Action disabled={busy} onPress={() => mutate('confirm_payment', {})}>Confirmer avoir reçu le paiement</Action>}
      <Text style={styles.muted}>{task.payment ? paymentStatus(task, money) : <>{paymentStatus(task)}{'\n'}Commission : à régler · encaissement non connecté</>}</Text></>}
    {task.offers.length > 0 && <><Text style={styles.sectionTitle}>{can.isOwner ? 'Les propositions' : 'Mes propositions'}</Text>
      {task.offers.map(o => <Pressable key={o.id} accessibilityRole="button" onPress={() => openOffer(o)} style={styles.card}><View style={styles.row}><Text style={styles.strong}>{o.brigadier.name}</Text><Text style={styles.price}>{money(o.amount)}</Text></View><Text style={styles.body}>{o.scope}</Text><Text style={styles.muted}>{offerStatus[o.status]}</Text><Text style={styles.link}>Discussion et récapitulatif →</Text></Pressable>)}</>}
    {can.canOffer && <><Text style={styles.sectionTitle}>Proposer mon aide</Text>{field('Mon forfait Brigadier', 'amount', { numeric: true })}{preview}{field('Mes disponibilités', 'slot')}{field('Ce qui est inclus et non inclus', 'scope', { multiline: true })}
      <Action disabled={busy} onPress={() => validated(() => { void mutate('offer', { amount: parseMoney(draft.amount || ''), slot: draft.slot, scope: draft.scope }, 'detail', notices.offerSent); })}>Proposer mon aide</Action></>}
    {can.canReport && <Action secondary disabled={busy} onPress={() => navigate('report')}>Signaler un désaccord</Action>}
    {task.reports.map((r, i) => <View style={styles.bubble} key={i}><Text style={styles.strong}>Signalement de {r.actor.name}</Text><Text style={styles.body}>{r.text}</Text><Text style={styles.note}>En attente d’examen manuel · {date(r.at)}</Text></View>)}
    <Action secondary onPress={() => setShowHistory(!showHistory)}>{showHistory ? 'Masquer l’historique' : 'Voir l’historique conservé'}</Action>
    {showHistory && task.history.map((h, i) => <View key={i} style={styles.history}><Text style={styles.body}>{h.text}</Text><Text style={styles.note}>{date(h.at)}</Text></View>)}</>;
}
