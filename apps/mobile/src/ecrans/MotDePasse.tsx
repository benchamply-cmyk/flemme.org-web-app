import React from 'react';
import { Text } from 'react-native';
import { session } from '../session';
import { Action } from '../ui/composants';
import { styles } from '../ui/styles';
import type { Ctx } from './contexte';

// Arrivée par le lien « Mot de passe oublié » reçu par e-mail (ou compte repris de l’ancien espace sans mot de passe).
export function MotDePasse({ state: { busy }, draft, field, clearDraft }: Ctx) {
  return <><Text style={styles.heading}>Choisis ton mot de passe</Text><Text style={styles.body}>Il te servira à te connecter avec ton adresse e-mail, dans l’app comme sur le site.</Text>
    {field('Nouveau mot de passe', 'password', { secret: true, hint: '12 caractères au moins' })}
    <Action disabled={busy} onPress={() => session.setPassword(draft.password || '', () => clearDraft())}>Enregistrer mon mot de passe</Action>
    <Action secondary disabled={busy} onPress={() => { session.skipRecovery(); clearDraft(); }}>Plus tard</Action></>;
}
