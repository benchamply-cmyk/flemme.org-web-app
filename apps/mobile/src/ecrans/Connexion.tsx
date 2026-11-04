import React from 'react';
import { Text } from 'react-native';
import { session } from '../session';
import { Action } from '../ui/composants';
import { styles } from '../ui/styles';
import type { Ctx } from './contexte';

export function Connexion({ state: { gateway, busy }, draft, field, clearDraft }: Ctx) {
  return <><Text style={styles.heading}>Un peu de flemme ?</Text><Text style={styles.body}>Connecte-toi pour déposer une tâche ou proposer ton aide.</Text>
    {field('E-mail', 'email')}{field('Mot de passe', 'password', { secret: true })}
    <Action disabled={busy || !gateway} onPress={() => session.login(draft.email || '', draft.password || '', () => clearDraft())}>Me connecter</Action>
    <Action secondary disabled={busy || !gateway} onPress={() => session.signup(draft.email || '', draft.password || '', () => clearDraft(['password']))}>Créer un compte</Action>
    {!gateway && <Action secondary onPress={() => session.initialize()}>Réessayer</Action>}</>;
}
