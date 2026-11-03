import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { commission, money } from '../../../../packages/shared/src/index.ts';
import { styles } from './styles';

export function Action({ children, onPress, secondary = false, disabled = false }: { children: React.ReactNode; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, (pressed || disabled) && { opacity: .55 }]}><Text style={[styles.buttonText, secondary && styles.secondaryText]}>{children}</Text></Pressable>;
}
export function Bill({ amount }: { amount: number }) {
  return <View style={styles.card} accessibilityLabel="Récapitulatif du prix"><View style={styles.row}><Text style={styles.body}>Forfait Brigadier</Text><Text style={styles.strong}>{money(amount)}</Text></View><View style={styles.row}><Text style={styles.body}>FLEMME · 10 %</Text><Text style={styles.strong}>{money(commission(amount))}</Text></View><View style={styles.divider}/><View style={styles.row}><Text style={styles.strong}>Total déposant</Text><Text style={styles.price}>{money(amount + commission(amount))}</Text></View></View>;
}
