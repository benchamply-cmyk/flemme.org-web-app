import React from 'react';
import { Text } from 'react-native';
import { commissionNote, notices, parseMoney } from '../../../../packages/shared/src/index.ts';
import { Action } from '../ui/composants';
import { styles } from '../ui/styles';
import type { Ctx } from './contexte';

export function NouvelleFlemme({ state: { busy }, draft, field, mutate, validated }: Ctx) {
  return <><Text style={styles.heading}>La flemme de quoi ?</Text><Text style={styles.muted}>Raconte. Un Brigadier prendra le relais.</Text>
    {field('Ce qu’il faut faire', 'title')}{field('Quelques détails', 'details', { multiline: true })}{field('Ville ou « À distance »', 'place')}{field('Budget Brigadier · facultatif, hors frais', 'amount', { numeric: true })}
    <Text style={styles.note}>Sans expiration. {commissionNote()} Les achats à avancer ne sont pas inclus dans ce premier test.</Text>
    <Action disabled={busy} onPress={() => validated(() => { void mutate('create', { title: draft.title, details: draft.details, place: draft.place, budget: parseMoney(draft.amount || '', true) }, 'detail', notices.published); })}>Publier ma flemme</Action></>;
}
