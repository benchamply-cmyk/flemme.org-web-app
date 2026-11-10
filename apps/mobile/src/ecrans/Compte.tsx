import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { DemoGateway, demoActors } from '../../../../packages/shared/src/index.ts';
import { session } from '../session';
import { Action } from '../ui/composants';
import { styles } from '../ui/styles';
import { Connexion } from './Connexion';
import type { Ctx } from './contexte';

export function Compte(ctx: Ctx) {
  const { state: { gateway, busy, actorId }, go } = ctx;
  const [apercu, setApercu] = useState<'' | 'login' | 'oubli'>('');
  if (!gateway) return null;
  const home = () => go('home', { taskId: '', offerId: '' });
  return <><Text style={styles.heading}>Salut {gateway.actor.name}.</Text>{gateway instanceof DemoGateway
    ? <><Text style={styles.body}>Démonstration locale. Change de personnage pour tester les deux côtés d’une mission. Aucun échange entre appareils, aucun paiement réel.</Text>
      {demoActors.map(a => <Action secondary key={a.id} disabled={busy} onPress={() => session.switchActor(a, home)}>{a.name}{a.id === actorId ? ' · actif' : ''}</Action>)}
      <Action secondary disabled={busy} onPress={() => go('profile', { userId: undefined })}>Mon profil public · présentation, avis</Action>
      <Action secondary disabled={busy} onPress={() => go('help')}>Aide · écrire à l’équipe FLEMME</Action>
      <Text style={styles.sectionTitle}>Écrans du mode connecté</Text>
      <Text style={styles.note}>Aperçu seulement : en démonstration, ces boutons ne contactent aucun serveur.</Text>
      <View style={styles.row}><Action small secondary onPress={() => setApercu(apercu === 'login' ? '' : 'login')}>Connexion</Action><Action small secondary onPress={() => setApercu(apercu === 'oubli' ? '' : 'oubli')}>Mot de passe oublié</Action></View>
      {!!apercu && <View style={[styles.card, { gap: 10 }]}><Connexion key={apercu} {...ctx} oubli={apercu === 'oubli'}/></View>}</>
    : <><Text style={styles.body}>Les comptes, demandes et discussions utilisent le service FLEMME configuré.</Text>
      <Action secondary disabled={busy} onPress={() => go('profile', { userId: undefined })}>Mon profil public · nom, présentation, avis</Action>
      <Action secondary disabled={busy} onPress={() => go('help')}>Aide · écrire à l’équipe FLEMME</Action>
      <Action secondary disabled={busy} onPress={() => session.logout(home)}>Me déconnecter</Action></>}</>;
}
