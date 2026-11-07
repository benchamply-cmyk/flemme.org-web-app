import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Action, Loupe } from '../ui/composants';
import { styles } from '../ui/styles';
import type { Ctx } from './contexte';

// Accueil de l’app : les deux portes d’entrée. Textes choisis par Ben (6 novembre 2026, commentaires sur l’aperçu) :
// au-dessus, « Le droit d’avoir la Flemme. Le Pouvoir d’aider. » ; grand titre qui alterne toutes les 2 secondes entre les deux côtés.
const TITRES = ['Une tâche que tu repousses ? Trouve quelqu’un pour t’aider.', 'Sois rémunéré(e) pour te charger de la mission.'] as const;
/** Grand titre qui change toutes les 2 secondes. */
function TitreAlterne() {
  const [titre, setTitre] = useState(0);
  useEffect(() => { const t = setInterval(() => setTitre(i => (i + 1) % TITRES.length), 2000); return () => clearInterval(t); }, []);
  // Le titre le plus long, invisible, fixe la hauteur ; le titre affiché se pose par-dessus : la page ne saute pas.
  return <View accessibilityLabel={TITRES.join(' ')}>
    <Text style={[styles.heading, { opacity: 0 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{TITRES[0]}</Text>
    <Text style={[styles.heading, styles.titreAlterne]}>{TITRES[titre]}</Text>
  </View>;
}
export function Accueil({ go }: Ctx) {
  return <View style={styles.home}><View style={styles.homeIntro}><Text style={styles.eyebrow}>Le droit d’avoir la Flemme.{'\n'}Le Pouvoir d’aider.</Text><TitreAlterne/><Text style={styles.muted}>Publie ce que tu repousses, ou donne un coup de main près de chez toi. Tout le monde y gagne.</Text></View>
    <View style={styles.homeChoices}>
      <Pressable accessibilityRole="button" accessibilityLabel="Déléguer ma flemme · décris ce que tu aimerais confier" onPress={() => go('new', { tab: 'mine', draftId: undefined })} style={({ pressed }) => [styles.homeChoice, pressed && { transform: [{ translateX: 2 }, { translateY: 2 }], boxShadow: '2px 3px 0 #a5ccff' }]}><Text style={styles.homeIcon}>＋</Text><Text style={styles.homeChoiceTitle}>Déléguer ma flemme</Text><Text style={styles.homeChoiceHint}>Décris ce que tu aimerais confier.</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Résoudre une flemme · trouve une demande et propose ton aide" onPress={() => go('list', { tab: 'find', recherche: false })} style={({ pressed }) => [styles.homeChoice, styles.homeChoiceSecondary, pressed && { transform: [{ translateX: 2 }, { translateY: 2 }], boxShadow: '2px 3px 0 #a5ccff' }]}><Loupe size={24}/><Text style={styles.homeChoiceTitle}>Résoudre une flemme</Text><Text style={styles.homeChoiceHint}>Trouve une demande et propose ton aide.</Text></Pressable>
    </View>
    <Action secondary onPress={() => go('list', { tab: 'mine' })}>Mon espace · mes demandes et mes propositions</Action></View>;
}
