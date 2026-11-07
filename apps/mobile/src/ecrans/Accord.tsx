import React from 'react';
import { Text, View } from 'react-native';
import { CONTRACT_FIELDS, contractInput, money, notices } from '../../../../packages/shared/src/index.ts';
import { Action } from '../ui/composants';
import { styles } from '../ui/styles';
import type { Ctx } from './contexte';

// Écran « contract » : rédaction de l’accord écrit par le déposant ou le Brigadier retenu.
// Toute modification remet l’accord en brouillon et efface les signatures : chacun relit la nouvelle version.
// La signature se fait ensuite sur la fiche de la demande, une fois l’accord relu par l’équipe FLEMME.
export function Accord({ state: { busy }, task, can, draft, field, mutate, validated }: Ctx) {
  if (!task) return null;
  if (!can.canContract) return <><Text style={styles.heading}>Accord écrit</Text><Text style={styles.muted}>L’accord se prépare une fois le Brigadier choisi, avant la fin de la tâche.</Text></>;
  const signed = task.contract?.ownerSignedAt || task.contract?.brigadierSignedAt;
  return <><Text style={styles.heading}>{task.contract ? 'Modifier l’accord écrit' : 'Rédiger l’accord écrit'}</Text><Text style={styles.cardTitle}>{task.title}</Text>
    {task.agreement && <Text style={styles.muted}>Prix convenu : {money(task.agreement.amount)} pour le Brigadier, {money(task.agreement.total)} au total. Il ne change pas ici : c’est celui de la proposition acceptée.</Text>}
    <Text style={styles.note}>Écrivez ensemble ce que chacun attend. L’équipe FLEMME relit l’accord avant la signature.</Text>
    {CONTRACT_FIELDS.map(c => field(c.label, c.name, { multiline: c.max > 200, max: c.max, hint: c.hint }))}
    {!!signed && <View accessibilityRole="alert" style={styles.error}><Text style={styles.body}>Une signature a déjà été donnée : enregistrer une modification l’annule, et les deux parties devront signer la nouvelle version.</Text></View>}
    <Action disabled={busy} onPress={() => validated(() => { const data = contractInput(draft); void mutate('agreement_save', data, 'detail', notices.contractSaved); })}>Enregistrer l’accord</Action></>;
}
