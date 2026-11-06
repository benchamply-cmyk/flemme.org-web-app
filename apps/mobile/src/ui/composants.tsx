import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { money, price, rateLabel } from '../../../../packages/shared/src/index.ts';
import type { Price } from '../../../../packages/shared/src/index.ts';
import { styles } from './styles';

export function Action({ children, onPress, secondary = false, small = false, disabled = false }: { children: React.ReactNode; onPress: () => void; secondary?: boolean; small?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, small && styles.small, (pressed || disabled) && { opacity: .55 }]}><Text style={[styles.buttonText, secondary && styles.secondaryText, small && styles.smallText]}>{children}</Text></Pressable>;
}
// Accord conclu : montants figés par le serveur (agreed) ; sinon calcul avec le réglage courant (COMMISSION).
export function Bill({ amount, agreed }: { amount: number; agreed?: Price }) {
  const p = agreed?.payout != null ? agreed : price(amount);
  return <View style={styles.card} accessibilityLabel="Récapitulatif du prix"><View style={styles.row}><Text style={styles.body}>{p.model === 'ajout' ? 'Forfait Brigadier' : 'Reversé au Brigadier'}</Text><Text style={styles.strong}>{money(p.model === 'ajout' ? p.amount : p.payout)}</Text></View><View style={styles.row}><Text style={styles.body}>FLEMME · {rateLabel(p)}</Text><Text style={styles.strong}>{money(p.commission)}</Text></View><View style={styles.divider}/><View style={styles.row}><Text style={styles.strong}>Total déposant</Text><Text style={styles.price}>{money(p.total)}</Text></View></View>;
}
/** Case à cocher (acceptation de l’accord). */
export function Check({ checked, onChange, disabled, children }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; children: React.ReactNode }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked, disabled }} disabled={disabled} onPress={() => onChange(!checked)} style={styles.check}>
    <View style={[styles.checkBox, checked && styles.checkBoxOn]}>{checked && <Text style={styles.strong}>✓</Text>}</View><Text style={[styles.strong, { flex: 1 }]}>{children}</Text></Pressable>;
}
/** Icône du menu : quatre carrés arrondis (choix de Ben pour le site). */
export function Carres({ ouvert }: { ouvert: boolean }) {
  return <View style={[styles.carres, ouvert && { transform: [{ rotate: '45deg' }] }]}>{[0, 1, 2, 3].map(i => <View key={i} style={styles.carre}/>)}</View>;
}
/** Loupe dessinée (recherche), à la taille `size`. */
export function Loupe({ size = 18, color = '#16131f' }: { size?: number; color?: string }) {
  const r = size * .62, w = Math.max(2, size / 8);
  return <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no">
    <View style={{ position: 'absolute', left: 0, top: 0, width: r, height: r, borderRadius: r / 2, borderWidth: w, borderColor: color }}/>
    <View style={{ position: 'absolute', left: r * .78, top: r * .98, width: size * .42, height: w, borderRadius: w / 2, backgroundColor: color, transform: [{ rotate: '45deg' }], transformOrigin: 'left center' }}/>
  </View>;
}
