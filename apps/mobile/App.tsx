import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Image, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { backLabel, colors, footer, parentScreen, rights } from '../../packages/shared/src/index.ts';
import type { Command, Input, Screen, Tab } from '../../packages/shared/src/index.ts';
import { session, useSession } from './src/session';
import { Action } from './src/ui/composants';
import { styles } from './src/ui/styles';
import type { Ctx, Draft, FieldOptions } from './src/ecrans/contexte';
import { Accueil } from './src/ecrans/Accueil';
import { Compte } from './src/ecrans/Compte';
import { Connexion } from './src/ecrans/Connexion';
import { Fiche } from './src/ecrans/Fiche';
import { Listes } from './src/ecrans/Listes';
import { NouvelleFlemme } from './src/ecrans/NouvelleFlemme';
import { Offre } from './src/ecrans/Offre';
import { Signalement } from './src/ecrans/Signalement';

// Coque mobile : navigation, formulaire en cours et choix de l’écran.
// Règles, état et textes partagés : packages/shared. Écrans : src/ecrans. Pendant web : apps/web/src/App.tsx.
function Mobile() {
  const state = useSession();
  const { gateway, actorId, busy, ready, error, notice, tasks } = state;
  const [tab, setTab] = useState<Tab>('mine'), [screen, setScreen] = useState<Screen>('home');
  const [taskId, setTaskId] = useState(''), [offerId, setOfferId] = useState('');
  const [draft, setDraft] = useState<Draft>({}), [visit, setVisit] = useState(0);
  const task = tasks.find(t => t.id === taskId), offer = task?.offers.find(o => o.id === offerId);

  useEffect(() => { void session.initialize(); }, []);
  // `visit` remonte l’écran à chaque navigation : son état local (historique déplié…) repart de zéro.
  function navigate(next: Screen) { setScreen(next); setDraft({}); setVisit(v => v + 1); session.clearMessages(); }
  function back() { navigate(parentScreen(screen)); }
  useEffect(() => { const s = BackHandler.addEventListener('hardwareBackPress', () => { if (screen === 'home') return false; back(); return true; }); return () => s.remove(); }, [screen]);
  async function mutate(action: Command | 'create', data: Input, next: Screen = 'detail', message = '') {
    await session.mutate(action, taskId, data, t => { setTaskId(t.id); navigate(next); session.notify(message); });
  }
  function field(label: string, name: string, { multiline = false, numeric = false, secret = false }: FieldOptions = {}) {
    return <View style={styles.field} key={name}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={draft[name] || ''} onChangeText={value => setDraft(d => ({ ...d, [name]: value }))} placeholder={numeric ? 'En €' : ''} placeholderTextColor={colors.muted} multiline={multiline} maxLength={multiline ? 1000 : name === 'password' ? 200 : 100} keyboardType={numeric ? 'decimal-pad' : name === 'email' ? 'email-address' : 'default'} autoCapitalize={secret || name === 'email' ? 'none' : 'sentences'} autoCorrect={!secret && name !== 'email'} secureTextEntry={secret} editable={!busy} style={[styles.input, multiline && styles.textarea]}/></View>;
  }
  const ctx: Ctx = {
    state, screen, tab, offerId, draft, task, offer, can: rights(task, actorId), field, navigate, mutate,
    openList: next => { setTab(next); navigate('list'); },
    openTask: t => { setTaskId(t.id); navigate('detail'); },
    openOffer: o => { setOfferId(o.id); navigate('offer'); },
    validated: fn => { try { fn(); } catch (e) { session.fail((e as Error).message); } },
    clearDraft: names => setDraft(d => names ? Object.fromEntries(Object.entries(d).filter(([k]) => !names.includes(k))) : {}),
    resetSelection: () => { setTaskId(''); setOfferId(''); },
  };

  let content: React.ReactNode;
  if (!ready) content = <ActivityIndicator accessibilityLabel="Chargement" color={colors.ink}/>;
  else if (session.remote && (!gateway || !actorId)) content = <Connexion {...ctx}/>;
  else if (!gateway) content = <><Text style={styles.heading}>Chargement interrompu</Text><Action onPress={() => session.initialize()}>Réessayer sans effacer mes données</Action></>;
  else if (screen === 'account') content = <Compte {...ctx}/>;
  else if (screen === 'home') content = <Accueil {...ctx}/>;
  else if (screen === 'new') content = <NouvelleFlemme {...ctx}/>;
  else if (screen === 'list') content = <Listes {...ctx}/>;
  else if (!task) content = <><Text style={styles.heading}>Flemme indisponible</Text><Action secondary onPress={() => navigate('list')}>Revenir à la liste</Action></>;
  else if (screen === 'report') content = <Signalement {...ctx}/>;
  else if ((screen === 'offer' || screen === 'review') && offer) content = <Offre {...ctx}/>;
  else content = <Fiche key={visit} {...ctx}/>;

  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}><StatusBar style="dark"/><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.header}><Image source={require('./assets/flemme-logo.png')} accessibilityLabel="FLEMME" resizeMode="contain" style={styles.brandLogo}/>{actorId !== '' && <Pressable accessibilityRole="button" accessibilityLabel="Mon compte" onPress={() => navigate('account')} style={styles.avatar}><Text style={styles.strong}>{gateway?.actor.name.slice(0, 1).toUpperCase()}</Text></Pressable>}</View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={screen === 'list' && actorId ? <RefreshControl refreshing={busy} onRefresh={() => session.refresh()} tintColor={colors.ink}/> : undefined}>
      {screen !== 'home' && actorId !== '' && <Action secondary onPress={back}>{backLabel(screen)}</Action>}
      {!!error && <View accessibilityRole="alert" style={styles.error}><Text style={styles.body}>{error}</Text></View>}
      {!!notice && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
      {content}
      {busy && <ActivityIndicator style={{ margin: 16 }} accessibilityLabel="En cours" color={colors.ink}/>}
    </ScrollView>
    <Text style={styles.footer}>{footer(session.remote)}</Text>
  </KeyboardAvoidingView></SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><Mobile/></SafeAreaProvider>; }
