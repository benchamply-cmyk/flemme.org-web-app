import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { styles } from '../ui/styles';
import type { Ctx } from './contexte';

export function Accueil({ openList, navigate }: Ctx) {
  return <View style={styles.home}><View style={styles.homeIntro}><Text style={styles.eyebrow}>LE DROIT D’AVOIR LA FLEMME.</Text><Text style={styles.heading}>On fait quoi aujourd’hui ?</Text><Text style={styles.muted}>Déléguer un peu. Aider quelqu’un.</Text></View>
    <View style={styles.homeChoices}>
      <Pressable accessibilityRole="button" accessibilityLabel="Déléguer ma flemme · déposer une demande" onPress={() => navigate('new')} style={({ pressed }) => [styles.homeChoice, pressed && { opacity: .7 }]}><Text style={styles.homeIcon}>☕</Text><Text style={styles.homeChoiceTitle}>Déléguer ma flemme</Text><Text style={styles.homeChoiceHint}>Confier ce qui me prend la tête</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Résoudre une flemme · voir les flemmes à résoudre" onPress={() => openList('find')} style={({ pressed }) => [styles.homeChoice, styles.homeChoiceSecondary, pressed && { opacity: .7 }]}><Text style={styles.homeIcon}>↗</Text><Text style={styles.homeChoiceTitle}>Résoudre une flemme</Text><Text style={styles.homeChoiceHint}>Trouver quelqu’un à aider</Text></Pressable>
    </View><Pressable accessibilityRole="button" onPress={() => openList('mine')} style={styles.secondary}><Text style={[styles.link, { textAlign: 'center', padding: 14 }]}>Mes flemmes · suivre mes demandes →</Text></Pressable></View>;
}
