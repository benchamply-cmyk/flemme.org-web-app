import React, { useState } from 'react';
import { Text } from 'react-native';
import { prepareLink } from '../liens';
import { session } from '../session';
import { Action } from '../ui/composants';
import { styles } from '../ui/styles';
import type { Ctx } from './contexte';

// Connexion, création de compte et « Mot de passe oublié ? » (lien e-mail qui rouvre l’app, voir liens.ts).
// `oubli` ouvre directement le second écran (aperçu depuis Mon compte en démonstration).
export function Connexion({ state: { gateway, busy }, place, draft, field, clearDraft, oubli = false }: Ctx & { oubli?: boolean }) {
  const [mode, setMode] = useState<'login' | 'oubli'>(oubli ? 'oubli' : 'login');
  const email = draft.email || '', password = draft.password || '';
  const off = busy || !gateway || !session.remote;
  const forgetPassword = () => clearDraft(['password']);
  if (mode === 'oubli') return <><Text style={styles.heading}>Mot de passe oublié ?</Text>
    <Text style={styles.body}>Indique ton adresse e-mail : tu reçois un lien pour choisir un nouveau mot de passe. Ouvre-le sur ce téléphone, il te ramène dans l’app.</Text>
    <Text style={styles.note}>Tu te connectais par lien e-mail, Google ou Apple sur l’ancien espace FLEMME ? C’est aussi ici que tu crées ton mot de passe.</Text>
    {field('E-mail', 'email')}
    <Action disabled={off} onPress={() => session.recover(email, () => prepareLink('recovery'), () => { forgetPassword(); session.notify('Si un compte existe pour cette adresse, un e-mail vient de partir. Ouvre le lien sur ce téléphone pour choisir ton mot de passe.'); })}>Recevoir le lien</Action>
    {!oubli && <Action secondary disabled={busy} onPress={() => setMode('login')}>Revenir à la connexion</Action>}</>;
  // Le motif suit l’écran demandé ; après connexion, l’app reprend sur cet écran.
  const motif = place.screen === 'new' ? 'Connecte-toi pour décrire ta demande' : place.tab === 'find' && place.screen === 'list' ? 'Connecte-toi pour voir les demandes et proposer ton aide' : 'Connecte-toi pour retrouver ton espace';
  return <><Text style={styles.heading}>{motif}</Text><Text style={styles.body}>Un seul compte pour déléguer une tâche et proposer ton aide.</Text>
    <Text style={styles.note}>Déjà inscrit sur l’ancien espace FLEMME ? Utilise la même adresse e-mail. Si tu te connectais par lien e-mail, Google ou Apple, choisis « Mot de passe oublié ? » pour créer ton mot de passe.</Text>
    {field('E-mail', 'email')}{field('Mot de passe', 'password', { secret: true })}
    <Action disabled={off} onPress={() => session.login(email, password, () => clearDraft())}>Me connecter</Action>
    <Action secondary disabled={off} onPress={() => session.signup(email, password, forgetPassword, { link: () => prepareLink('signup'), notice: 'Vérifie ton e-mail et ouvre le lien sur ce téléphone.' })}>Créer un compte</Action>
    <Action secondary disabled={busy} onPress={() => setMode('oubli')}>Mot de passe oublié ?</Action>
    {!gateway && session.remote && <Action secondary onPress={() => session.initialize()}>Réessayer</Action>}</>;
}
