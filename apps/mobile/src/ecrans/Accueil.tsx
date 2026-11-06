import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Action, Loupe } from '../ui/composants';
import { styles } from '../ui/styles';
import type { Ctx } from './contexte';

// Accueil de l’app : les deux portes d’entrée, mêmes textes que l’accueil de app.html.
export function Accueil({ go }: Ctx) {
  return <View style={styles.home}><View style={styles.homeIntro}><Text style={styles.eyebrow}>Une tâche en moins, un coup de main en plus.</Text><Text style={styles.heading}>Que veux-tu faire ?</Text><Text style={styles.muted}>Avec un seul compte, tu peux déléguer une tâche et proposer ton aide.</Text></View>
    <View style={styles.homeChoices}>
      <Pressable accessibilityRole="button" accessibilityLabel="Déléguer ma flemme · décris ce que tu aimerais confier" onPress={() => go('new', { tab: 'mine', draftId: undefined })} style={({ pressed }) => [styles.homeChoice, pressed && { transform: [{ translateX: 2 }, { translateY: 2 }], boxShadow: '2px 3px 0 #3a2fa0' }]}><Text style={styles.homeIcon}>＋</Text><Text style={styles.homeChoiceTitle}>Déléguer ma flemme</Text><Text style={styles.homeChoiceHint}>Décris ce que tu aimerais confier.</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Résoudre une flemme · trouve une demande et propose ton aide" onPress={() => go('list', { tab: 'find', recherche: false })} style={({ pressed }) => [styles.homeChoice, styles.homeChoiceSecondary, pressed && { transform: [{ translateX: 2 }, { translateY: 2 }], boxShadow: '2px 3px 0 #3a2fa0' }]}><Loupe size={24}/><Text style={styles.homeChoiceTitle}>Résoudre une flemme</Text><Text style={styles.homeChoiceHint}>Trouve une demande et propose ton aide.</Text></Pressable>
    </View>
    <Action secondary onPress={() => go('list', { tab: 'mine' })}>Mon espace · mes demandes et mes propositions</Action></View>;
}
