import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, useWindowDimensions, KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { backLabel, contractFields, footer, money, rights, taskFields } from '../../packages/shared/src/index.ts';
import type { Command, Input, Option, Screen, Task } from '../../packages/shared/src/index.ts';
import { session, useSession } from './src/session';
import { linkReceived } from './src/liens';
import { Action, Carres, Loupe } from './src/ui/composants';
import { styles, v04 } from './src/ui/styles';
import type { Ctx, Draft, FieldOptions, Place } from './src/ecrans/contexte';
import { Accueil } from './src/ecrans/Accueil';
import { Accord } from './src/ecrans/Accord';
import { Aide } from './src/ecrans/Aide';
import { Compte } from './src/ecrans/Compte';
import { Connexion } from './src/ecrans/Connexion';
import { Fiche } from './src/ecrans/Fiche';
import { Listes } from './src/ecrans/Listes';
import { MotDePasse } from './src/ecrans/MotDePasse';
import { NouvelleFlemme } from './src/ecrans/NouvelleFlemme';
import { Offre } from './src/ecrans/Offre';
import { Profil } from './src/ecrans/Profil';
import { Signalement } from './src/ecrans/Signalement';

// Coque mobile : en-tête V0.4, pile de navigation, formulaire en cours et choix de l’écran.
// Règles, état et textes partagés : packages/shared. Écrans : src/ecrans. Pendant web : apps/web/src/App.tsx.
const start: Place = { screen: 'home', tab: 'mine', taskId: '', offerId: '' };

// Formulaire prérempli à l’ouverture d’un écran, comme initialDraft() du site.
function initialDraft(next: Place): Draft {
  const { tasks, drafts, found, actorId } = session.getState();
  const t = tasks.find(v => v.id === next.taskId) || found?.tasks.find(v => v.id === next.taskId);
  if (next.screen === 'edit') return t ? taskFields(t, money) : {};
  if ((next.screen === 'new' || next.screen === 'detail') && next.draftId) return { ...drafts.find(d => d.id === next.draftId)?.fields };
  // Proposition à corriger : le Brigadier repart de la sienne.
  const o = next.screen === 'offer' ? t?.offers.find(v => v.id === next.offerId && v.brigadier.id === actorId) : undefined;
  if (o) return { amount: (o.amount / 100).toFixed(2).replace('.', ','), slot: o.slot, scope: o.scope, result: o.result || '' };
  // Accord écrit : version enregistrée, sinon reprise de la proposition retenue.
  if (next.screen === 'contract' && t) return t.contract ? contractFields(t.contract) : { scope: t.agreement?.scope || '', deadline: t.agreement?.slot || '' };
  return {};
}

function Mobile() {
  const state = useSession();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const { gateway, actorId, busy, ready, error, notice, tasks, recovering } = state;
  const [stack, setStack] = useState<Place[]>([start]), [draft, setDraft] = useState<Draft>({}), [visit, setVisit] = useState(0), [menu, setMenu] = useState(false);
  // Très petits écrans (iPhone SE…) : le bouton Déléguer ne garde que son « + ».
  const etroit = useWindowDimensions().width < 360;
  const place = stack[stack.length - 1], { screen, taskId, offerId } = place;
  const task = tasks.find(t => t.id === taskId) || state.found?.tasks.find(t => t.id === taskId), offer = task?.offers.find(o => o.id === offerId);

  useEffect(() => {
    void session.initialize();
    // Lien e-mail ouvert pendant que l’app tourne : on relance la session pour l’utiliser.
    const s = Linking.addEventListener('url', ({ url }) => { linkReceived(url); void session.initialize(); });
    return () => s.remove();
  }, []);
  // `visit` remonte l’écran à chaque navigation : son état local (historique déplié…) repart de zéro.
  function show(next: Place[]) { setStack(next); setDraft(initialDraft(next[next.length - 1])); setVisit(v => v + 1); setMenu(false); session.clearMessages(); }
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [visit]);
  function go(next: Screen, change: Partial<Place> = {}) {
    const p = { ...place, ...change, screen: next };
    show(next === 'home' ? [start] : [...stack, p]);
  }
  function back() { show(stack.length > 1 ? stack.slice(0, -1) : [start]); }
  useEffect(() => { const s = BackHandler.addEventListener('hardwareBackPress', () => { if (stack.length <= 1) return false; back(); return true; }); return () => s.remove(); }, [stack]);
  async function mutate(action: Command | 'create', data: Input, next: Screen = 'detail', text: string | ((t: Task) => string) = '') {
    await session.mutate(action, taskId, data, t => {
      const message = typeof text === 'function' ? text(t) : text;
      // Retour à la fiche déjà ouverte plutôt qu’une copie empilée ; après création, le formulaire est remplacé.
      const i = next === 'detail' ? stack.findLastIndex(p => p.screen === 'detail' && p.taskId === t.id) : -1;
      const base = i >= 0 ? stack.slice(0, i) : action === 'create' || next === screen ? stack.slice(0, -1) : stack;
      show([...base, { ...place, screen: next, taskId: t.id, draftId: undefined }]); session.notify(message);
    });
  }
  function field(label: string, name: string, { multiline = false, numeric = false, secret = false, hint = '', max, onMint = false }: FieldOptions = {}) {
    return <View style={styles.field} key={name}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={draft[name] || ''} onChangeText={value => setDraft(d => ({ ...d, [name]: value }))} placeholder={hint || (numeric ? 'En €' : '')} placeholderTextColor={v04.texteDoux} multiline={multiline} maxLength={max ?? (multiline ? 1000 : name === 'password' ? 200 : 100)} keyboardType={numeric ? 'decimal-pad' : name === 'email' ? 'email-address' : 'default'} autoCapitalize={secret || name === 'email' ? 'none' : 'sentences'} autoCorrect={!secret && name !== 'email'} secureTextEntry={secret} editable={!busy} style={[styles.input, onMint && styles.inputOnMint, multiline && styles.textarea]}/></View>;
  }
  function choice(label: string, name: string, options: readonly Option[], empty?: string) {
    const value = draft[name] || (name === 'mode' ? 'distance' : '');
    const items = empty ? [{ value: '', label: empty }, ...options] : options;
    return <View style={styles.field} accessibilityLabel={label} key={name}><Text style={styles.label}>{label}</Text><View style={[styles.row, { justifyContent: 'flex-start', gap: 8 }]}>
      {items.map(o => <Pressable key={o.value} accessibilityRole="radio" accessibilityLabel={o.label} accessibilityState={{ checked: value === o.value, disabled: busy }} disabled={busy} onPress={() => setDraft(d => ({ ...d, [name]: o.value, ...(name === 'budgetRange' && o.value ? { amount: '' } : {}) }))} style={[styles.option, value === o.value && styles.optionSelected]}><Text style={styles.strong}>{o.label}</Text></Pressable>)}
    </View></View>;
  }
  const ctx: Ctx = {
    state, place, draft, task, offer, can: rights(task, actorId), field, choice, go, back, mutate,
    fill: values => setDraft(d => ({ ...d, ...values })),
    keepDraft: id => setStack(s => [...s.slice(0, -1), { ...s[s.length - 1], draftId: id }]),
    validated: fn => { try { fn(); } catch (e) { session.fail((e as Error).message); } },
    clearDraft: names => setDraft(d => names ? Object.fromEntries(Object.entries(d).filter(([k]) => !names.includes(k))) : {}),
  };

  let content: React.ReactNode;
  if (!ready) content = <ActivityIndicator accessibilityLabel="Chargement" color={v04.encre}/>;
  else if (session.remote && (!gateway || !actorId)) content = <Connexion {...ctx}/>;
  else if (!gateway) content = <><Text style={styles.heading}>Chargement interrompu</Text><Action onPress={() => session.initialize()}>Réessayer sans effacer mes données</Action></>;
  else if (recovering && session.remote) content = <MotDePasse {...ctx}/>;
  else if (screen === 'account') content = <Compte {...ctx}/>;
  else if (screen === 'profile') content = <Profil key={visit} {...ctx}/>;
  else if (screen === 'help') content = <Aide key={visit} {...ctx}/>;
  else if (screen === 'home') content = <Accueil {...ctx}/>;
  else if (screen === 'new') content = <NouvelleFlemme key={visit} {...ctx}/>;
  else if (screen === 'list') content = <Listes key={visit} {...ctx}/>;
  else if (!task) content = <><Text style={styles.heading}>Demande indisponible</Text><Action secondary onPress={() => go('list')}>Revenir à la liste</Action></>;
  else if (screen === 'report') content = <Signalement {...ctx}/>;
  else if (screen === 'edit') content = <NouvelleFlemme key={visit} {...ctx}/>;
  else if (screen === 'contract') content = <Accord {...ctx}/>;
  else if ((screen === 'offer' || screen === 'review') && offer) content = <Offre {...ctx}/>;
  else content = <Fiche key={visit} {...ctx}/>;

  const connecte = actorId !== '';
  const lien = (label: string, active: boolean, action: () => void) => <Pressable key={label} accessibilityRole="link" onPress={action} style={[styles.menuLien, active && styles.menuLienActif]}><Text style={styles.menuTexte}>{label}</Text></Pressable>;
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}><StatusBar style="dark"/><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.bandeau}>
      <View style={styles.rubanHaut} pointerEvents="none"/><View style={styles.rubanBas} pointerEvents="none"/>
      <View style={styles.entete}>
        <Pressable accessibilityRole="button" accessibilityLabel="FLEMME · accueil" onPress={() => go('home')} style={styles.logo}><Text style={styles.logoTexte}>FLEMME.</Text></Pressable>
        {connecte && <Pressable accessibilityRole="button" accessibilityLabel="Déléguer ma flemme" onPress={() => go('new', { tab: 'mine', draftId: undefined })} style={({ pressed }) => [styles.pastille, pressed && { backgroundColor: v04.glacierClair }]}><Text style={styles.pastilleIcone}>＋</Text>{!etroit && <Text style={styles.pastilleTexte}>Déléguer</Text>}</Pressable>}
        {connecte && <Pressable accessibilityRole="button" accessibilityLabel="Rechercher une demande" onPress={() => go('list', { tab: 'find', recherche: true })} style={[styles.burger, styles.loupe]}><Loupe size={18}/></Pressable>}
        {connecte && <Pressable accessibilityRole="button" accessibilityLabel="Menu" accessibilityState={{ expanded: menu }} onPress={() => setMenu(!menu)} style={[styles.burger, { marginLeft: 0 }]}><Carres ouvert={menu}/></Pressable>}
      </View>
    </View>
    {menu && <View style={styles.menu} accessibilityLabel="Menu">
      {lien('Flemmes à résoudre', screen === 'list' && place.tab === 'find', () => go('list', { tab: 'find', recherche: false }))}
      {lien('Mon espace', screen === 'list' && place.tab === 'mine', () => go('list', { tab: 'mine', recherche: false }))}
      {lien('Mon profil', screen === 'profile' && !place.userId, () => go('profile', { userId: undefined }))}
      {lien('Aide', screen === 'help', () => go('help'))}
      {lien('Mon compte', screen === 'account', () => go('account'))}
    </View>}
    <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={screen === 'list' && connecte ? <RefreshControl refreshing={busy} onRefresh={() => session.refresh()} tintColor={v04.encre}/> : undefined}>
      {screen !== 'home' && connecte && !(recovering && session.remote) && <Action secondary onPress={back}>{stack.length > 2 ? '← Retour' : backLabel(screen)}</Action>}
      {!!error && <View accessibilityRole="alert" style={styles.error}><Text style={styles.body}>{error}</Text></View>}
      {!!notice && <View accessibilityLiveRegion="polite" style={styles.notice}><Text style={styles.body}>{notice}</Text></View>}
      {content}
      {busy && <ActivityIndicator style={{ margin: 16 }} accessibilityLabel="En cours" color={v04.encre}/>}
    </ScrollView>
    <SafeAreaView edges={['bottom']} style={styles.pied}><Text style={styles.piedTexte}>{footer(session.remote)}</Text></SafeAreaView>
  </KeyboardAvoidingView></SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><Mobile/></SafeAreaProvider>; }
