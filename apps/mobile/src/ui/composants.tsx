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
  const row = (label: string, value: number, strong = false) => <View style={styles.row}><Text style={strong ? styles.strong : styles.body}>{label}</Text><Text style={strong ? styles.price : styles.strong}>{money(value)}</Text></View>;
  if (p.model === 'partage') return <View style={styles.card} accessibilityLabel="Récapitulatif du prix">
    {row('Forfait', p.amount)}{row('Frais FLEMME · ' + rateLabel({ rateBps: p.rateBps }), p.total - p.amount)}<View style={styles.divider}/>{row('Total déposant', p.total, true)}
    {row('Reversé au Brigadier (forfait − ' + rateLabel({ rateBps: p.brigadierBps ?? 0 }) + ')', p.payout)}</View>;
  return <View style={styles.card} accessibilityLabel="Récapitulatif du prix">{row(p.model === 'ajout' ? 'Forfait Brigadier' : 'Reversé au Brigadier', p.model === 'ajout' ? p.amount : p.payout)}{row('FLEMME · ' + rateLabel(p), p.commission)}<View style={styles.divider}/>{row('Total déposant', p.total, true)}</View>;
}
/** Case à cocher (acceptation de l’accord). */
export function Check({ checked, onChange, disabled, children }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; children: React.ReactNode }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked, disabled }} disabled={disabled} onPress={() => onChange(!checked)} style={styles.check}>
    <View style={[styles.checkBox, checked && styles.checkBoxOn]}>{checked && <Text style={styles.strong}>✓</Text>}</View><Text style={[styles.strong, { flex: 1 }]}>{children}</Text></Pressable>;
}
/** Loupe dessinée (recherche), à la taille `size`. */
export function Loupe({ size = 18, color = '#16131f' }: { size?: number; color?: string }) {
  const r = size * .62, w = Math.max(2, size / 8);
  return <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no">
    <View style={{ position: 'absolute', left: 0, top: 0, width: r, height: r, borderRadius: r / 2, borderWidth: w, borderColor: color }}/>
    <View style={{ position: 'absolute', left: r * .78, top: r * .98, width: size * .42, height: w, borderRadius: w / 2, backgroundColor: color, transform: [{ rotate: '45deg' }], transformOrigin: 'left center' }}/>
  </View>;
}
/** Silhouette (tête et épaules) : accès à l’espace perso. */
export function Personne({ size = 18, color = '#16131f' }: { size?: number; color?: string }) {
  const w = Math.max(2, size / 8), t = size * .44;
  return <View style={{ width: size, height: size, alignItems: 'center' }} accessibilityElementsHidden importantForAccessibility="no">
    <View style={{ width: t, height: t, borderRadius: t / 2, borderWidth: w, borderColor: color }}/>
    <View style={{ position: 'absolute', bottom: 0, width: size * .86, height: size * .42, borderTopLeftRadius: size * .43, borderTopRightRadius: size * .43, borderWidth: w, borderBottomWidth: 0, borderColor: color }}/>
  </View>;
}
/** Maison (onglet Accueil) : toit en chevron sur un corps carré. */
export function Maison({ size = 20, color = '#d2e4ff' }: { size?: number; color?: string }) {
  const w = Math.max(2, size / 9), toit = size * .62;
  return <View style={{ width: size, height: size, alignItems: 'center' }} accessibilityElementsHidden importantForAccessibility="no">
    <View style={{ position: 'absolute', top: size * .14, width: toit, height: toit, borderLeftWidth: w, borderTopWidth: w, borderColor: color, borderTopLeftRadius: 2, transform: [{ rotate: '45deg' }] }}/>
    <View style={{ position: 'absolute', bottom: 0, width: size * .66, height: size * .52, borderWidth: w, borderTopWidth: 0, borderColor: color, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }}/>
  </View>;
}
/** Bulle de dialogue (onglet Contact). */
export function Bulle({ size = 20, color = '#d2e4ff' }: { size?: number; color?: string }) {
  const w = Math.max(2, size / 9);
  return <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no">
    <View style={{ width: size, height: size * .74, borderRadius: size * .22, borderWidth: w, borderColor: color }}/>
    <View style={{ position: 'absolute', left: size * .2, bottom: size * .06, width: size * .26, height: size * .26, borderRightWidth: w, borderBottomWidth: w, borderColor: color, backgroundColor: 'transparent', transform: [{ rotate: '45deg' }] }}/>
  </View>;
}
