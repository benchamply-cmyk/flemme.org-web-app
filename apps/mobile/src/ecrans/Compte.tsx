import React from 'react';
import { Text } from 'react-native';
import { DemoGateway, demoActors } from '../../../../packages/shared/src/index.ts';
import { session } from '../session';
import { Action } from '../ui/composants';
import { styles } from '../ui/styles';
import type { Ctx } from './contexte';

export function Compte({ state: { gateway, busy, actorId }, navigate, resetSelection, clearDraft }: Ctx) {
  if (!gateway) return null;
  return <><Text style={styles.heading}>Salut {gateway.actor.name}.</Text>{gateway instanceof DemoGateway
    ? <><Text style={styles.body}>Démonstration locale. Change de personnage pour tester les deux côtés d’une mission. Aucun échange entre appareils, aucun paiement réel.</Text>
      {demoActors.map(a => <Action secondary key={a.id} disabled={busy} onPress={() => session.switchActor(a, () => { resetSelection(); navigate('home'); })}>{a.name}{a.id === actorId ? ' · actif' : ''}</Action>)}</>
    : <><Text style={styles.body}>Les comptes, annonces et discussions utilisent le service FLEMME configuré.</Text>
      <Action secondary disabled={busy} onPress={() => session.logout(() => { resetSelection(); clearDraft(); navigate('home'); })}>Me déconnecter</Action></>}</>;
}
