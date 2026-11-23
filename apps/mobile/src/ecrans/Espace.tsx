import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { SearchFilter, Task } from '../../../../packages/shared/src/index.ts';
import { CATEGORIES, budgetLabel, date, money, partition, price, taskStatus } from '../../../../packages/shared/src/index.ts';
import { ETAPES, avancement, etapeAtteinte, prochaineAction, remplissageProfil } from '../../../../packages/shared/src/espace.ts';
import { enregistrerAlertes, fils, marquerLu, memeFiltre, nouvellesAlertes, useEspace } from '../espace';
import { useFlag } from '../flags';
import { session } from '../session';
import { Action } from '../ui/composants';
import { styles } from '../ui/styles';
import type { Ctx } from './contexte';

// Refonte de Mon espace sur mobile (v2.1.0, demande de Ben du 18/11/2026, maquettes « Flemme – Refonte Mon espace »),
// pendant de apps/web/src/ecrans/Espace.tsx. Derrière le flag espace.refonte : éteint, App.tsx garde l’ancien Mon espace.

const Pastille = ({ nom }: { nom: string }) => <View style={styles.pastille} accessibilityElementsHidden importantForAccessibility="no"><Text style={styles.pastilleTexte}>{nom.slice(0, 1).toUpperCase()}</Text></View>;
export const Badge = ({ n }: { n: number }) => n > 0 ? <View style={styles.badge} accessibilityLabel={n + ' non lu(s)'}><Text style={styles.badgeTexte}>{n}</Text></View> : null;

/** Frise d’avancement en 7 étapes, de « Publiée » à « Terminé ». */
export function Frise({ task }: { task: Task }) {
  const i = etapeAtteinte(task);
  if (i < 0) return null;
  const suivante = ETAPES[i + 1];
  return <View style={styles.frise} accessibilityLabel={'Avancement : ' + avancement(task)}>
    <View style={styles.row}><Text style={styles.strong}>{avancement(task)}</Text>{!!suivante && <Text style={styles.note}>Prochaine : {suivante.toLowerCase()}</Text>}</View>
    <View style={styles.friseEtapes}>{ETAPES.map((e, k) => <View key={e} style={styles.friseEtape}>
      <View style={[styles.friseTrait, k <= i && styles.friseTraitFait]}/><Text style={[styles.friseMot, k === i && styles.friseMotActuel]}>{e}</Text></View>)}</View>
  </View>;
}

function Progression({ task }: { task: Task }) {
  const i = etapeAtteinte(task);
  return <View style={styles.progression} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{ETAPES.map((e, k) => <View key={e} style={[styles.progressionPas, k <= i && styles.friseTraitFait]}/>)}</View>;
}

/** Carte d’une demande avec son avancement et la prochaine action attendue. */
function CarteDemande({ task: t, actorId, go }: { task: Task; actorId: string; go: Ctx['go'] }) {
  const confiance = useFlag('espace.confiance').actif;
  const action = prochaineAction(t, actorId, { confiance }), mienne = t.owner.id === actorId;
  const offres = t.offers.filter(o => o.status === 'pending').length;
  const etat = mienne ? (t.status === 'open' ? (offres ? `${offres} offre${offres > 1 ? 's' : ''} reçue${offres > 1 ? 's' : ''}` : 'En attente d’offres') : t.agreement ? `Avec ${t.agreement.brigadier.name}` : taskStatus[t.status]) : `Pour ${t.owner.name}`;
  return <Pressable accessibilityRole="button" accessibilityLabel={'Voir : ' + t.title} onPress={() => go('detail', { taskId: t.id, draftId: undefined })} style={styles.card}>
    <View style={styles.row}><Text style={[styles.cardTitle, { flex: 1 }]}>{t.title}</Text><Text style={styles.strong}>{t.agreement ? money(t.agreement.amount) : budgetLabel(t, money)}</Text></View>
    <Text style={styles.note}>{etat} · {avancement(t)}</Text>
    <Progression task={t}/>
    {!!action && <Text style={styles.carteAction}>{action} ›</Text>}
  </Pressable>;
}

/** Accueil : « À faire maintenant », raccourcis et demandes en cours. */
export function AccueilEspace({ state: { gateway, tasks, actorId, found }, go }: Ctx) {
  const confiance = useFlag('espace.confiance').actif;
  const { alertes } = useEspace();
  const { own, helping, available } = partition(tasks, actorId);
  const aFaire = [...own, ...helping].map(t => ({ t, a: prochaineAction(t, actorId, { confiance }) })).filter(x => x.a);
  const enCours = [...own, ...helping].filter(t => t.status !== 'completed' && !aFaire.some(x => x.t.id === t.id));
  const nouvelles = nouvellesAlertes(alertes, [...available, ...(found?.tasks || [])], actorId);
  const prenom = (gateway?.actor.name || '').split(' ')[0];
  return <>
    <Text style={styles.note}>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
    <Text style={styles.heading}>Bonjour {prenom}</Text>
    <Text style={styles.sectionTitle}>À faire maintenant{aFaire.length ? ` · ${aFaire.length}` : ''}</Text>
    {aFaire.length ? aFaire.map(({ t, a }) => <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={a + ' : ' + t.title} onPress={() => go('detail', { taskId: t.id, draftId: undefined })} style={[styles.card, styles.aFaire]}>
      <Text style={styles.carteAction}>{a}</Text><Text style={styles.cardTitle}>{t.title}</Text><Text style={styles.note}>{t.owner.id === actorId ? 'Ta demande' : 'Ta mission'} · {avancement(t)}</Text></Pressable>)
      : <Text style={styles.muted}>Rien à faire pour l’instant. Tu le verras ici dès qu’une offre ou un message arrive.</Text>}
    {nouvelles > 0 && <Pressable accessibilityRole="button" onPress={() => go('list', { tab: 'find', recherche: false })} style={[styles.card, styles.aFaire]}>
      <Text style={styles.cardTitle}>{nouvelles} nouvelle{nouvelles > 1 ? 's' : ''} demande{nouvelles > 1 ? 's' : ''} pour tes alertes</Text><Text style={styles.carteAction}>Voir ›</Text></Pressable>}
    <View style={styles.tuiles}>
      <Pressable accessibilityRole="button" accessibilityLabel="Déléguer · publier une demande" onPress={() => go('new', { tab: 'mine', draftId: undefined })} style={[styles.tuile, styles.tuileFoncee]}><Text style={styles.tuileTitre}>Déléguer</Text><Text style={styles.note}>Publier une demande</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Résoudre · trouver une flemme" onPress={() => go('list', { tab: 'find', recherche: false })} style={styles.tuile}><Text style={styles.tuileTitre}>Résoudre</Text><Text style={styles.note}>Trouver une flemme</Text></Pressable>
    </View>
    {enCours.length > 0 && <><View style={styles.row}><Text style={styles.sectionTitle}>En cours</Text><Text style={[styles.link, { marginTop: 18 }]} accessibilityRole="button" onPress={() => go('list', { tab: 'mine' })}>Tout voir</Text></View>
      {enCours.slice(0, 4).map(t => <CarteDemande key={t.id} task={t} actorId={actorId} go={go}/>)}</>}
  </>;
}

/** Mes flemmes : « Je délègue » et « J’aide », filtres d’état et brouillons. */
export function MesDemandes({ state: { tasks, actorId, busy, drafts, more }, go }: Ctx) {
  const { own, helping } = partition(tasks, actorId);
  const [cote, setCote] = useState<'delegue' | 'aide'>(() => own.length || !helping.length ? 'delegue' : 'aide');
  const [etat, setEtat] = useState<'tous' | 'actives' | 'terminees'>('tous');
  const liste = (cote === 'delegue' ? own : helping).filter(t => etat === 'tous' || (etat === 'terminees') === (t.status === 'completed'));
  const brouillons = drafts.filter(d => d.kind === (cote === 'delegue' ? 'task' : 'offer'));
  const segment = (v: typeof cote, label: string) => <Pressable key={v} accessibilityRole="tab" accessibilityState={{ selected: cote === v }} onPress={() => setCote(v)} style={[styles.segment, cote === v && styles.segmentActif]}><Text style={styles.strong}>{label}</Text></Pressable>;
  return <>
    <View style={styles.row}><Text style={styles.heading}>Mes flemmes</Text><Action small onPress={() => go('new', { draftId: undefined })}>＋ Déléguer</Action></View>
    <View style={styles.segments} accessibilityRole="tablist">{segment('delegue', `Je délègue · ${own.length}`)}{segment('aide', `J’aide · ${helping.length}`)}</View>
    <View style={styles.puces} accessibilityLabel="Filtrer">{([['tous', 'Toutes'], ['actives', 'En cours'], ['terminees', 'Terminées']] as const).map(([v, l]) =>
      <Pressable key={v} accessibilityRole="button" accessibilityState={{ selected: etat === v }} onPress={() => setEtat(v)} style={[styles.puce, etat === v && styles.puceActive]}><Text style={styles.strong}>{l}</Text></Pressable>)}</View>
    {liste.length ? liste.map(t => <CarteDemande key={t.id} task={t} actorId={actorId} go={go}/>)
      : <Text style={styles.muted}>{cote === 'delegue' ? 'Aucune demande ici. Qu’aimerais-tu déléguer ?' : 'Aucune mission ici. Trouve une demande dans l’onglet Trouver.'}</Text>}
    {brouillons.length > 0 && <><Text style={styles.sectionTitle}>Brouillons</Text>{brouillons.map(d => <View key={d.id} style={styles.card}>
      <Text style={styles.cardTitle}>{d.kind === 'task' ? d.fields.title || 'Brouillon sans titre' : tasks.find(t => t.id === d.taskId)?.title || 'Proposition'}</Text>
      <Text style={styles.note}>Enregistré le {date(d.updatedAt)} · visible de toi seul</Text>
      <View style={styles.row}><Action small disabled={busy} onPress={() => d.kind === 'task' ? go('new', { draftId: d.id }) : go('detail', { taskId: d.taskId || '', draftId: d.id })}>Reprendre</Action><Action small secondary disabled={busy} onPress={() => session.deleteDraft(d.id)}>Supprimer</Action></View></View>)}</>}
    {more && <Action secondary disabled={busy} onPress={() => session.loadMore()}>Voir plus de demandes</Action>}
  </>;
}

/** Comparaison des offres reçues, avec une seule action principale (fiche, côté déposant). */
export function ComparerOffres({ task, go }: { task: Task; go: Ctx['go'] }) {
  const offres = task.offers.filter(o => o.status === 'pending' && (!o.review || o.review === 'approved'));
  const [tri, setTri] = useState<'prix' | 'recent'>('prix');
  const triees = [...offres].sort((a, b) => tri === 'prix' ? a.amount - b.amount : (b.messages.at(-1)?.at || '').localeCompare(a.messages.at(-1)?.at || ''));
  const [choix, setChoix] = useState(triees[0]?.id || '');
  const retenue = offres.find(o => o.id === choix) || triees[0];
  if (!offres.length) return null;
  return <>
    <View style={styles.row}><Text style={styles.sectionTitle}>{offres.length > 1 ? `Comparer les ${offres.length} offres` : 'L’offre reçue'}</Text>
      {offres.length > 1 && <Text style={[styles.link, { marginTop: 18 }]} accessibilityRole="button" onPress={() => setTri(tri === 'prix' ? 'recent' : 'prix')}>Trier : {tri === 'prix' ? 'prix' : 'activité'}</Text>}</View>
    <View accessibilityRole="radiogroup" style={{ gap: 12 }}>{triees.map(o => {
      const p = price(o.amount), actif = o.id === retenue?.id;
      return <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ checked: actif }} accessibilityLabel={`${o.brigadier.name}, ${money(o.amount)}`} onPress={() => setChoix(o.id)} style={[styles.card, actif && styles.offreChoisie]}>
        <View style={styles.row}><View style={[styles.row, { flex: 1, justifyContent: 'flex-start' }]}><Pastille nom={o.brigadier.name}/><Text style={styles.strong}>{o.brigadier.name}</Text></View><Text style={styles.price}>{money(o.amount)}</Text></View>
        <Text style={styles.note}>{money(p.total)} avec les frais · {o.slot}</Text>
        {!!o.result && <Text style={styles.note}>Résultat : {o.result}</Text>}
        <View style={styles.row}><Action small secondary onPress={() => go('profile', { userId: o.brigadier.id })}>Voir le profil</Action>
          <Action small secondary onPress={() => go('offer', { offerId: o.id })}>{'Discuter' + (o.messages.length ? ` · ${o.messages.length}` : '')}</Action></View>
      </Pressable>;
    })}</View>
    {retenue && <Action onPress={() => go('review', { offerId: retenue.id })}>Choisir l’offre de {retenue.brigadier.name}</Action>}
  </>;
}

/** Messagerie : une discussion par proposition, la plus récente d’abord, avec les non-lus. */
export function Messages({ state: { tasks, actorId, busy }, go }: Ctx) {
  const { lus } = useEspace();
  const liste = fils(tasks, actorId, lus);
  return <>
    <Text style={styles.heading}>Messages</Text>
    {liste.length ? <View>{liste.map(f => <Pressable key={f.offerId} accessibilityRole="button" accessibilityLabel={`Discussion avec ${f.avec} sur ${f.task.title}` + (f.nonLus ? `, ${f.nonLus} non lu(s)` : '')} onPress={() => go('offer', { taskId: f.task.id, offerId: f.offerId })} style={styles.fil}>
      <Pastille nom={f.avec}/>
      <View style={{ flex: 1, gap: 2 }}><View style={styles.row}><Text style={styles.strong}>{f.avec}</Text><Text style={styles.note}>{f.dernier ? date(f.dernier.at) : ''}</Text></View>
        <Text style={styles.note}>{f.task.title}</Text>
        <Text style={[styles.body, f.nonLus > 0 && { fontWeight: '700' }]} numberOfLines={2}>{f.dernier ? (f.dernier.moi ? 'Toi : ' : '') + f.dernier.text : 'Pas encore de message. Pose une question avant de vous mettre d’accord.'}</Text></View>
      <Badge n={f.nonLus}/>
    </Pressable>)}</View>
      : <Text style={styles.muted}>Aucune discussion pour l’instant. Une discussion s’ouvre avec chaque proposition d’aide.</Text>}
    <Action secondary disabled={busy} onPress={() => session.refresh()}>↻ Actualiser</Action>
  </>;
}

/** Résumé de l’offre en haut d’une discussion ; ouvrir la discussion la marque comme lue. */
export function ResumeOffre({ task, offerId }: { task: Task; offerId: string }) {
  const o = task.offers.find(v => v.id === offerId);
  useEffect(() => { if (o) marquerLu(o.id); }, [o?.id, o?.messages.length]);
  if (!o) return null;
  return <View style={[styles.card, styles.aFaire, styles.row]}><View style={{ flex: 1 }}><Text style={styles.strong}>{task.title} · {money(o.amount)}</Text><Text style={styles.note}>{o.slot}</Text></View><Text style={styles.tag}>Offre</Text></View>;
}

// ——— Trouver : filtres rapides et alertes ———
const PUCES: { libelle: string; filtre: SearchFilter }[] = [
  { libelle: 'À distance', filtre: { mode: 'distance' } },
  ...CATEGORIES.filter(c => c.value !== 'autre').map(c => ({ libelle: c.label.split(' ')[0], filtre: { category: c.value } })),
];
const libelleFiltre = (f: SearchFilter) => [f.q && `« ${f.q} »`, f.category && CATEGORIES.find(c => c.value === f.category)?.label, f.mode === 'distance' ? 'à distance' : f.mode === 'sur_place' ? 'sur place' : '', f.place].filter(Boolean).join(' · ') || 'toutes les demandes';

export function FiltresRapides({ f, run }: { f: SearchFilter; run: (next: SearchFilter) => void }) {
  return <View style={styles.puces} accessibilityLabel="Filtres rapides">{PUCES.map(p => {
    const [k, v] = Object.entries(p.filtre)[0] as [keyof SearchFilter, string], actif = f[k] === v;
    return <Pressable key={p.libelle} accessibilityRole="button" accessibilityState={{ selected: actif }} onPress={() => run({ ...f, [k]: actif ? '' : v })} style={[styles.puce, actif && styles.puceActive]}><Text style={styles.strong}>{p.libelle}</Text></Pressable>;
  })}</View>;
}

export function Alertes({ f, run }: { f: SearchFilter; run: (next: SearchFilter) => void }) {
  const { alertes } = useEspace(), [ouvert, setOuvert] = useState(false);
  const existe = alertes.some(a => memeFiltre(a.filtre, f)), vide = !Object.entries(f).some(([k, v]) => v && k !== 'sort');
  const creer = () => enregistrerAlertes([...alertes, { id: String(Date.now()), filtre: { ...f, sort: undefined }, libelle: libelleFiltre(f), vuLe: new Date().toISOString() }]);
  return <>
    {!vide && !existe && <View style={[styles.card, styles.aFaire]}><Text style={styles.body}>Être prévenu des nouvelles demandes : {libelleFiltre(f)}</Text><Action small onPress={creer}>Créer l’alerte</Action></View>}
    {alertes.length > 0 && <><Action small secondary onPress={() => setOuvert(!ouvert)}>{`Mes alertes · ${alertes.length} ${ouvert ? '▴' : '▾'}`}</Action>
      {ouvert && <View style={styles.card}>{alertes.map(a => <View key={a.id} style={styles.row}>
        <Text style={[styles.link, { flex: 1 }]} accessibilityRole="button" onPress={() => { enregistrerAlertes(alertes.map(x => x.id === a.id ? { ...x, vuLe: new Date().toISOString() } : x)); run({ ...a.filtre, sort: f.sort }); }}>{a.libelle}</Text>
        <Text style={styles.link} accessibilityRole="button" accessibilityLabel={'Supprimer l’alerte ' + a.libelle} onPress={() => enregistrerAlertes(alertes.filter(x => x.id !== a.id))}>Supprimer</Text></View>)}
        <Text style={styles.note}>Alertes gardées sur ce téléphone : les nouvelles demandes sont signalées sur ton accueil. Pas encore de notification.</Text></View>}</>}
  </>;
}

// ——— Profil et réglages ———
/** Onglet Profil : en-tête, taux de remplissage, chiffres et réglages ; le compte (démo, déconnexion) dessous. */
export function Reglages({ state: { gateway, actorId, profile, tasks }, go, children }: Ctx & { children: React.ReactNode }) {
  const { alertes } = useEspace(), aide = useFlag('espace.aide').actif;
  useEffect(() => { if (actorId && profile?.id !== actorId) void session.openProfile(actorId); }, [actorId]);
  if (!gateway) return null;
  const p = profile?.id === actorId ? profile : null, r = p && remplissageProfil(p);
  const { own } = partition(tasks, actorId);
  const ligne = (libelle: string, detail: string, aller: () => void) => <Pressable key={libelle} accessibilityRole="button" onPress={aller} style={styles.reglage}><Text style={styles.body}>{libelle}</Text><Text style={styles.note}>{detail} ›</Text></Pressable>;
  return <>
    <View style={styles.profileHead}><Pastille nom={gateway.actor.name}/><View style={{ flex: 1 }}><Text style={styles.heading}>{gateway.actor.name}</Text>{p && <Text style={styles.note}>Membre depuis le {date(p.since).split(' ')[0]}</Text>}</View></View>
    {r && r.faits < r.total && <Pressable accessibilityRole="button" onPress={() => go('profile', { userId: undefined })} style={styles.card}>
      <View style={styles.row}><Text style={styles.strong}>Profil complété à {r.pourcent} %</Text><Text style={styles.note}>{r.faits} sur {r.total}</Text></View>
      <View style={styles.jauge}><View style={[styles.jaugeRemplie, { width: `${r.pourcent}%` }]}/></View>
      <Text style={styles.note}>À ajouter : {r.manquants.join(', ').toLowerCase()}. Les profils complets inspirent plus confiance.</Text>
      <Text style={styles.carteAction}>Compléter mon profil ›</Text></Pressable>}
    <View style={styles.chiffres} accessibilityLabel="Mes chiffres">
      <View style={styles.chiffre}><Text style={styles.chiffreValeur}>{own.length}</Text><Text style={styles.note}>demande{own.length > 1 ? 's' : ''}</Text></View>
      <View style={styles.chiffre}><Text style={styles.chiffreValeur}>{p?.missions ?? 0}</Text><Text style={styles.note}>mission{(p?.missions ?? 0) > 1 ? 's' : ''} faite{(p?.missions ?? 0) > 1 ? 's' : ''}</Text></View>
      <View style={styles.chiffre}><Text style={styles.chiffreValeur}>{p?.rating != null ? String(p.rating).replace('.', ',') : '–'}</Text><Text style={styles.note}>note · {p?.reviews.length ?? 0} avis</Text></View>
    </View>
    <View>
      {ligne('Mon profil public', 'Nom, présentation, avis', () => go('profile', { userId: undefined }))}
      {ligne('Mes alertes de demandes', String(alertes.length || 'Aucune'), () => go('list', { tab: 'find', recherche: false }))}
      {aide && ligne('Aide et contact', '', () => go('help'))}
    </View>
    <Text style={styles.sectionTitle}>Compte</Text>
    {children}
  </>;
}
