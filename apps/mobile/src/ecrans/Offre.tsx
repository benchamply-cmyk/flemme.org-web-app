import React from 'react';
import { Text, View } from 'react-native';
import { date, money, notices, offerInput, offerReviewLabel, offerStatus, price } from '../../../../packages/shared/src/index.ts';
import { Action, Bill } from '../ui/composants';
import { styles } from '../ui/styles';
import type { Ctx } from './contexte';

// Écrans « offer » (discussion autour d’une proposition) et « review » (récapitulatif avant d’accepter).
export function Offre({ state: { busy, actorId }, place: { screen, offerId }, task, offer, can, draft, field, go, mutate, validated }: Ctx) {
  if (!task || !offer) return null;
  const total = money(price(offer.amount).total);
  const mine = offer.brigadier.id === actorId, editable = mine && offer.status === 'pending' && task.status === 'open' && offer.review !== 'rejected';
  return <><Text style={styles.heading}>{screen === 'review' ? 'On se met d’accord ?' : 'La proposition de ' + offer.brigadier.name}</Text><Text style={styles.cardTitle}>{task.title}</Text><Text style={styles.tag}>{offerStatus[offer.status]}</Text>
    <Action secondary onPress={() => go('profile', { userId: offer.brigadier.id })}>Voir le profil de {offer.brigadier.name}</Action>
    {mine && offer.review && offer.review !== 'approved' && <View accessibilityRole="alert" style={offer.review === 'pending' ? styles.notice : styles.error}><Text style={styles.strong}>{offerReviewLabel[offer.review]}</Text>{!!offer.reviewNote && <Text style={styles.body}>{offer.reviewNote}</Text>}</View>}
    <Text style={styles.sectionTitle}>Ce qui est convenu</Text><Text style={styles.body}>{offer.scope}</Text>{!!offer.result && <Text style={styles.body}><Text style={styles.strong}>Résultat promis : </Text>{offer.result}</Text>}<Text style={styles.muted}>{offer.slot}</Text><Bill amount={offer.amount}/>
    {editable && <><Text style={styles.sectionTitle}>{offer.review === 'changes_requested' ? 'Corriger ma proposition' : 'Modifier ma proposition'}</Text>
      {field('Mon forfait Brigadier', 'amount', { numeric: true })}{field('Mes disponibilités', 'slot')}{field('Ce qui est inclus et non inclus', 'scope', { multiline: true })}{field('Résultat promis (facultatif)', 'result', { multiline: true })}
      <Action disabled={busy} onPress={() => validated(() => { void mutate('apply_edit', { offerId, ...offerInput(draft) }, 'offer', t => notices.applied(t.offers.find(o => o.id === offerId))); })}>Renvoyer ma proposition</Action></>}
    {screen === 'review'
      ? <><Text style={styles.note}>Tu confies cette demande à {offer.brigadier.name}. Les autres propositions restent dans l’historique. Forfait et frais sont confirmés ensemble.</Text>
        <Action disabled={busy || task.status !== 'open' || offer.status !== 'pending'} onPress={() => mutate('accept', { offerId }, 'detail', notices.accepted)}>Accepter · {total}</Action></>
      : <><Text style={styles.sectionTitle}>Votre discussion</Text>
        {offer.messages.length === 0 && <Text style={styles.muted}>Un détail à préciser avant de vous mettre d’accord ?</Text>}
        {offer.messages.map((m, i) => <View key={i} style={styles.bubble}><Text style={styles.strong}>{m.actor.name}</Text><Text style={styles.body}>{m.text}</Text><Text style={styles.note}>{date(m.at)}</Text></View>)}
        {field('Ton message', 'text', { multiline: true })}
        <Action secondary disabled={busy} onPress={() => mutate('message', { offerId, text: draft.text }, 'offer')}>Envoyer le message</Action>
        {can.isOwner && task.status === 'open' && offer.status === 'pending' && <><Action disabled={busy} onPress={() => go('review')}>Voir l’accord avant d’accepter</Action><Action secondary disabled={busy} onPress={() => mutate('decline', { offerId }, 'detail', notices.declined)}>Décliner cette proposition</Action></>}
        <Text style={styles.note}>Pour changer le prix : décliner la proposition, puis demander un nouveau forfait au Brigadier. Chaque proposition reste conservée.</Text></>}</>;
}
