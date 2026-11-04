import React from 'react';
import { Text, View } from 'react-native';
import { commission, date, money, notices, offerStatus } from '../../../../packages/shared/src/index.ts';
import { Action, Bill } from '../ui/composants';
import { styles } from '../ui/styles';
import type { Ctx } from './contexte';

// Écrans « offer » (discussion avec un Brigadier) et « review » (récapitulatif avant d’accepter).
export function Offre({ state: { busy }, screen, offerId, task, offer, can, draft, field, navigate, mutate }: Ctx) {
  if (!task || !offer) return null;
  const total = money(offer.amount + commission(offer.amount));
  return <><Text style={styles.heading}>{screen === 'review' ? 'On se met d’accord ?' : 'L’offre de ' + offer.brigadier.name}</Text><Text style={styles.cardTitle}>{task.title}</Text><Text style={styles.tag}>{offerStatus[offer.status]}</Text>
    <Text style={styles.sectionTitle}>Ce qui est convenu</Text><Text style={styles.body}>{offer.scope}</Text><Text style={styles.muted}>{offer.slot}</Text><Bill amount={offer.amount}/>
    {screen === 'review'
      ? <><Text style={styles.note}>Tu attribues cette flemme à {offer.brigadier.name}. Les autres propositions restent dans l’historique. Forfait et frais sont confirmés ensemble.</Text>
        <Action disabled={busy || task.status !== 'open' || offer.status !== 'pending'} onPress={() => mutate('accept', { offerId }, 'detail', notices.accepted)}>Accepter · {total}</Action></>
      : <><Text style={styles.sectionTitle}>Votre discussion</Text>
        {offer.messages.length === 0 && <Text style={styles.muted}>Un détail à préciser avant de vous mettre d’accord ?</Text>}
        {offer.messages.map((m, i) => <View key={i} style={styles.bubble}><Text style={styles.strong}>{m.actor.name}</Text><Text style={styles.body}>{m.text}</Text><Text style={styles.note}>{date(m.at)}</Text></View>)}
        {field('Ton message', 'text', { multiline: true })}
        <Action secondary disabled={busy} onPress={() => mutate('message', { offerId, text: draft.text }, 'offer')}>Envoyer le message</Action>
        {can.isOwner && task.status === 'open' && offer.status === 'pending' && <><Action disabled={busy} onPress={() => navigate('review')}>Voir l’accord avant d’accepter</Action><Action secondary disabled={busy} onPress={() => mutate('decline', { offerId }, 'detail', notices.declined)}>Décliner cette proposition</Action></>}
        <Text style={styles.note}>Pour changer le prix : décliner l’offre, puis demander un nouveau forfait au Brigadier. Chaque proposition reste conservée.</Text></>}</>;
}
