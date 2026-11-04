import React from 'react';
import { Text } from 'react-native';
import { notices } from '../../../../packages/shared/src/index.ts';
import { session } from '../session';
import { Action } from '../ui/composants';
import { styles } from '../ui/styles';
import type { Ctx } from './contexte';

export function Signalement({ state: { busy }, draft, field, mutate }: Ctx) {
  return <><Text style={styles.heading}>Un problème ?</Text><Text style={styles.body}>Décris les faits. L’accord et les échanges restent conservés. Aucun remboursement n’est déclenché automatiquement.</Text>
    {field('Ce qui s’est passé', 'text', { multiline: true })}
    <Action disabled={busy} onPress={() => mutate('report', { text: draft.text }, 'detail', notices.report(session.remote))}>Enregistrer le signalement</Action></>;
}
