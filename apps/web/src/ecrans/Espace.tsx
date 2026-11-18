import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { SearchFilter, Task } from '../../../../packages/shared/src/index.ts';
import { CATEGORIES, budgetLabel, date, money, partition, price, taskStatus } from '../../../../packages/shared/src/index.ts';
import { ETAPES, avancement, derniereActivite, etapeAtteinte, prochaineAction, remplissageProfil } from '../../../../packages/shared/src/espace.ts';
import { session } from '../session.ts';
import { useFlag } from '../flags/useFlag.tsx';
import type { Ctx, Place } from './contexte.ts';
import './espace.css';

// Refonte de Mon espace (v2.1.0, demande de Ben du 18/11/2026, maquettes « Flemme – Refonte Mon espace »).
// Derrière le flag espace.refonte : éteint, App.tsx garde l’ancien Mon espace.
// Écrans : barre d’onglets, accueil « À faire maintenant », mes demandes, frise, comparaison des offres,
// messagerie, filtres rapides et alertes, profil et réglages.

// ——— Stockage local (navigateur) : discussions lues et alertes. Rien n’est envoyé au serveur. ———
const CLE_LUS = 'flemme.espace.lus.v1', CLE_ALERTES = 'flemme.espace.alertes.v1';
type Alerte = { id: string; filtre: SearchFilter; libelle: string; vuLe: string };
function lire<T>(cle: string, defaut: T): T { try { const v = localStorage.getItem(cle); return v ? JSON.parse(v) as T : defaut; } catch { return defaut; } }
function ecrire(cle: string, v: unknown) { try { localStorage.setItem(cle, JSON.stringify(v)); } catch { /* stockage bloqué : rien de grave */ } dispatchEvent(new Event('flemme-espace')); }
function useStockage<T>(cle: string, defaut: T): T {
  const [v, setV] = useState<T>(() => lire(cle, defaut));
  useEffect(() => { const f = () => setV(lire(cle, defaut)); addEventListener('flemme-espace', f); addEventListener('storage', f); return () => { removeEventListener('flemme-espace', f); removeEventListener('storage', f); }; }, [cle]);
  return v;
}
export function marquerLu(offerId: string) { ecrire(CLE_LUS, { ...lire<Record<string, string>>(CLE_LUS, {}), [offerId]: new Date().toISOString() }); }

// ——— Discussions : une par proposition, côté déposant comme côté membre qui aide. ———
type Fil = { task: Task; offerId: string; avec: string; dernier?: { text: string; at: string; moi: boolean }; nonLus: number; quand: string };
function fils(tasks: Task[], actorId: string, lus: Record<string, string>): Fil[] {
  const out: Fil[] = [];
  for (const t of tasks) for (const o of t.offers) {
    const owner = t.owner.id === actorId, mine = o.brigadier.id === actorId;
    if (!owner && !mine) continue;
    if (o.status === 'declined' || o.status === 'not_selected') continue;
    const m = o.messages.at(-1), vu = lus[o.id] || '';
    const nonLus = o.messages.filter(x => x.actor.id !== actorId && x.at > vu).length;
    out.push({ task: t, offerId: o.id, avec: owner ? o.brigadier.name : t.owner.name, dernier: m && { text: m.text, at: m.at, moi: m.actor.id === actorId }, nonLus, quand: derniereActivite(t, o.id) });
  }
  return out.sort((a, b) => b.quand.localeCompare(a.quand));
}
export function useNonLus(tasks: Task[], actorId: string) {
  const lus = useStockage<Record<string, string>>(CLE_LUS, {});
  return fils(tasks, actorId, lus).reduce((n, f) => n + f.nonLus, 0);
}

// ——— Icônes au trait (aria-hidden) ———
const I = {
  accueil: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>,
  demandes: <path d="M4 6h16M4 12h16M4 18h10"/>,
  trouver: <><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>,
  messages: <path d="M4 4h16v12H8l-4 4z"/>,
  profil: <><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></>,
};
const Ico = ({ d }: { d: ReactNode }) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;

/** Barre d’onglets fixe en bas de l’écran (en haut sur ordinateur). */
export function Onglets({ place, go, nonLus }: { place: Place; go: Ctx['go']; nonLus: number }) {
  const { screen, tab } = place;
  const onglets: { label: string; ico: ReactNode; actif: boolean; aller: () => void; badge?: number }[] = [
    { label: 'Accueil', ico: I.accueil, actif: screen === 'home', aller: () => go('home', { taskId: '', offerId: '' }) },
    { label: 'Demandes', ico: I.demandes, actif: screen === 'list' && tab === 'mine' || ['detail', 'edit', 'contract', 'report', 'review', 'new'].includes(screen), aller: () => go('list', { tab: 'mine' }) },
    { label: 'Trouver', ico: I.trouver, actif: screen === 'list' && tab === 'find', aller: () => go('list', { tab: 'find' }) },
    { label: 'Messages', ico: I.messages, actif: screen === 'offer' || screen === 'list' && tab === 'messages', aller: () => go('list', { tab: 'messages' }), badge: nonLus },
    { label: 'Profil', ico: I.profil, actif: screen === 'account' || screen === 'profile' || screen === 'help', aller: () => go('account') },
  ];
  return <nav className="onglets" aria-label="Mon espace">{onglets.map(o =>
    <button type="button" key={o.label} className="onglet" aria-current={o.actif ? 'page' : undefined} onClick={o.aller}>
      <span className="onglet-ico"><Ico d={o.ico}/>{!!o.badge && <span className="onglet-badge">{o.badge}<span className="sr"> non lu(s)</span></span>}</span>{o.label}</button>)}</nav>;
}

/** Frise d’avancement en 7 étapes, de « Publiée » à « Terminé ». */
export function Frise({ task }: { task: Task }) {
  const i = etapeAtteinte(task);
  if (i < 0) return null;
  const suivante = ETAPES[i + 1];
  return <section className="frise" aria-label="Avancement de la demande">
    <div className="row"><span className="strong">{avancement(task)}</span>{suivante && <span className="note">Prochaine : {suivante.toLowerCase()}</span>}</div>
    <ol className="frise-etapes">{ETAPES.map((e, k) => <li key={e} className={k <= i ? 'fait' : ''} aria-current={k === i ? 'step' : undefined}><span className="frise-trait"/><span className="frise-mot">{e}</span></li>)}</ol>
  </section>;
}

/** Barre de progression compacte (cartes). */
function Progression({ task }: { task: Task }) {
  const i = etapeAtteinte(task);
  return <span className="progression" aria-hidden="true">{ETAPES.map((e, k) => <span key={e} className={k <= i ? 'fait' : ''}/>)}</span>;
}

/** Carte d’une demande avec son avancement. */
function CarteDemande({ task: t, actorId, go }: { task: Task; actorId: string; go: Ctx['go'] }) {
  const action = prochaineAction(t, actorId), mienne = t.owner.id === actorId;
  const offres = t.offers.filter(o => o.status === 'pending').length;
  return <button type="button" className="carte-espace" onClick={() => go('detail', { taskId: t.id })}>
    <span className="row"><span className="carte-titre">{t.title}</span><span className="strong">{t.agreement ? money(t.agreement.amount) : budgetLabel(t, money)}</span></span>
    <span className="note">{mienne ? (t.status === 'open' ? (offres ? `${offres} offre${offres > 1 ? 's' : ''} reçue${offres > 1 ? 's' : ''}` : 'En attente d’offres') : t.agreement ? `Avec ${t.agreement.brigadier.name}` : taskStatus[t.status]) : `Pour ${t.owner.name}`} · {avancement(t)}</span>
    <Progression task={t}/>
    {action && <span className="carte-action">{action} ›</span>}
  </button>;
}

/** Accueil : « À faire maintenant », raccourcis et demandes en cours. */
export function AccueilEspace({ state: { gateway, tasks, actorId, found }, go }: Ctx) {
  const premium = useFlag('espace.premium');
  const { own, helping, available } = partition(tasks, actorId);
  const aFaire = [...own, ...helping].map(t => ({ t, a: prochaineAction(t, actorId) })).filter(x => x.a);
  const enCours = [...own, ...helping].filter(t => t.status !== 'completed' && !aFaire.some(x => x.t.id === t.id));
  const nouvelles = useNouvellesAlertes([...available, ...(found?.tasks || [])], actorId);
  const prenom = (gateway?.actor.name || '').split(' ')[0];
  return <div className="espace-accueil">
    <header className="espace-entete"><div><p className="note">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1 className="espace-titre">Bonjour {prenom}</h1></div></header>
    <section aria-labelledby="a-faire"><h2 className="espace-section" id="a-faire">À faire maintenant{aFaire.length ? ` · ${aFaire.length}` : ''}</h2>
      {aFaire.length ? aFaire.map(({ t, a }) => <button type="button" key={t.id} className="carte-espace a-faire" onClick={() => go('detail', { taskId: t.id })}>
        <span className="carte-action">{a}</span><span className="carte-titre">{t.title}</span><span className="note">{t.owner.id === actorId ? 'Ta demande' : 'Ta mission'} · {avancement(t)}</span></button>)
        : <p className="muted">Rien à faire pour l’instant. Tu seras prévenu ici dès qu’une offre ou un message arrive.</p>}
      {nouvelles > 0 && <button type="button" className="carte-espace alerte" onClick={() => go('list', { tab: 'find' })}><span className="carte-titre">{nouvelles} nouvelle{nouvelles > 1 ? 's' : ''} demande{nouvelles > 1 ? 's' : ''} pour tes alertes</span><span className="carte-action">Voir ›</span></button>}
    </section>
    <section className="tuiles" aria-label="Raccourcis">
      <button type="button" className="tuile fonce" onClick={() => go('new', { tab: 'mine', draftId: undefined })}><span className="tuile-titre">Déléguer</span><span className="note">Publier une demande</span></button>
      <button type="button" className="tuile" onClick={() => go('list', { tab: 'find' })}><span className="tuile-titre">Résoudre</span><span className="note">Trouver une flemme</span></button>
    </section>
    {enCours.length > 0 && <section aria-labelledby="en-cours"><div className="row"><h2 className="espace-section" id="en-cours">En cours</h2><button type="button" className="lien" onClick={() => go('list', { tab: 'mine' })}>Tout voir</button></div>
      {enCours.slice(0, 4).map(t => <CarteDemande key={t.id} task={t} actorId={actorId} go={go}/>)}</section>}
    {premium.actif && <a className="lien-discret" href="premium">Flemme Premium · pour les membres qui aident souvent</a>}
  </div>;
}

/** Mes demandes : « Je délègue » et « J’aide », avec filtres d’état et brouillons. */
export function MesDemandes({ state: { tasks, actorId, busy, drafts, more }, go }: Ctx) {
  const { own, helping } = partition(tasks, actorId);
  const [cote, setCote] = useState<'delegue' | 'aide'>(() => own.length || !helping.length ? 'delegue' : 'aide');
  const [etat, setEtat] = useState<'tous' | 'actives' | 'terminees'>('tous');
  const liste = (cote === 'delegue' ? own : helping).filter(t => etat === 'tous' || (etat === 'terminees') === (t.status === 'completed'));
  const brouillons = drafts.filter(d => d.kind === (cote === 'delegue' ? 'task' : 'offer'));
  return <>
    <div className="row"><h1 className="espace-titre">Mes flemmes</h1><button type="button" className="btn small" onClick={() => go('new', { draftId: undefined })}>＋ Déléguer</button></div>
    <div className="segments" role="tablist" aria-label="Côté">
      <button type="button" role="tab" aria-selected={cote === 'delegue'} onClick={() => setCote('delegue')}>Je délègue · {own.length}</button>
      <button type="button" role="tab" aria-selected={cote === 'aide'} onClick={() => setCote('aide')}>J’aide · {helping.length}</button>
    </div>
    <div className="puces" role="group" aria-label="Filtrer">{([['tous', 'Toutes'], ['actives', 'En cours'], ['terminees', 'Terminées']] as const).map(([v, l]) =>
      <button type="button" key={v} className="puce" aria-pressed={etat === v} onClick={() => setEtat(v)}>{l}</button>)}</div>
    {liste.length ? liste.map(t => <CarteDemande key={t.id} task={t} actorId={actorId} go={go}/>)
      : <p className="muted">{cote === 'delegue' ? 'Aucune demande ici. Qu’aimerais-tu déléguer ?' : 'Aucune mission ici. Trouve une demande dans l’onglet Trouver.'}</p>}
    {brouillons.length > 0 && <><h2 className="espace-section">Brouillons</h2>{brouillons.map(d => <div key={d.id} className="carte-espace brouillon">
      <span className="carte-titre">{d.kind === 'task' ? d.fields.title || 'Brouillon sans titre' : tasks.find(t => t.id === d.taskId)?.title || 'Proposition'}</span>
      <span className="note">Enregistré le {date(d.updatedAt)} · visible de toi seul</span>
      <span className="row"><button type="button" className="btn small" disabled={busy} onClick={() => d.kind === 'task' ? go('new', { draftId: d.id }) : go('detail', { taskId: d.taskId || '', draftId: d.id })}>Reprendre</button><button type="button" className="btn small secondary" disabled={busy} onClick={() => session.deleteDraft(d.id)}>Supprimer</button></span></div>)}</>}
    {more && <button type="button" className="btn secondary" disabled={busy} onClick={() => session.loadMore()}>Voir plus de demandes</button>}
  </>;
}

/** Comparaison des offres côte à côte, avec une seule action principale (fiche, côté déposant). */
export function ComparerOffres({ task, go }: { task: Task; go: Ctx['go'] }) {
  const offres = task.offers.filter(o => o.status === 'pending' && (!o.review || o.review === 'approved'));
  const [tri, setTri] = useState<'prix' | 'recent'>('prix');
  const triees = [...offres].sort((a, b) => tri === 'prix' ? a.amount - b.amount : (b.messages.at(-1)?.at || '').localeCompare(a.messages.at(-1)?.at || ''));
  const [choix, setChoix] = useState(triees[0]?.id || '');
  const retenue = offres.find(o => o.id === choix) || triees[0];
  if (!offres.length) return null;
  return <section aria-labelledby="comparer"><div className="row"><h2 className="espace-section" id="comparer">{offres.length > 1 ? `Comparer les ${offres.length} offres` : 'L’offre reçue'}</h2>
    {offres.length > 1 && <button type="button" className="lien" onClick={() => setTri(tri === 'prix' ? 'recent' : 'prix')}>Trier : {tri === 'prix' ? 'prix' : 'activité'}</button>}</div>
    <div className="offres" role="radiogroup" aria-label="Offres">{triees.map(o => {
      const p = price(o.amount);
      return <div key={o.id} className="offre" role="radio" aria-checked={o.id === retenue?.id} tabIndex={0} onClick={() => setChoix(o.id)} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setChoix(o.id); } }}>
        <span className="offre-qui"><span className="pastille-nom" aria-hidden="true">{o.brigadier.name.slice(0, 1)}</span><span className="strong">{o.brigadier.name}</span></span>
        <span className="offre-prix">{money(o.amount)}</span><span className="note">{money(p.total)} avec les frais</span>
        <span>{o.slot}</span>{o.result && <span className="note">Résultat : {o.result}</span>}
        <button type="button" className="lien" onClick={e => { e.stopPropagation(); go('profile', { userId: o.brigadier.id }); }}>Voir le profil</button>
        <button type="button" className="lien" onClick={e => { e.stopPropagation(); go('offer', { offerId: o.id }); }}>Discuter{o.messages.length ? ` · ${o.messages.length} message${o.messages.length > 1 ? 's' : ''}` : ''}</button>
      </div>;
    })}</div>
    {retenue && <div className="action-collante"><button type="button" className="btn" onClick={() => go('review', { offerId: retenue.id })}>Choisir l’offre de {retenue.brigadier.name}</button></div>}
  </section>;
}

/** Messagerie : une discussion par proposition, la plus récente d’abord, avec les non-lus. */
export function Messages({ state: { tasks, actorId, busy }, go }: Ctx) {
  const lus = useStockage<Record<string, string>>(CLE_LUS, {});
  const liste = fils(tasks, actorId, lus);
  return <>
    <h1 className="espace-titre">Messages</h1>
    {liste.length ? <ul className="fils">{liste.map(f => <li key={f.offerId}><button type="button" className={'fil' + (f.nonLus ? ' non-lu' : '')} onClick={() => go('offer', { taskId: f.task.id, offerId: f.offerId })}>
      <span className="pastille-nom" aria-hidden="true">{f.avec.slice(0, 1)}</span>
      <span className="fil-texte"><span className="row"><span className="strong">{f.avec}</span><span className="note">{f.dernier ? date(f.dernier.at) : ''}</span></span>
        <span className="note">{f.task.title}</span>
        <span className="fil-apercu">{f.dernier ? (f.dernier.moi ? 'Toi : ' : '') + f.dernier.text : 'Pas encore de message. Pose une question avant de vous mettre d’accord.'}</span></span>
      {f.nonLus > 0 && <span className="onglet-badge">{f.nonLus}<span className="sr"> non lu(s)</span></span>}
    </button></li>)}</ul>
      : <p className="muted">Aucune discussion pour l’instant. Une discussion s’ouvre avec chaque proposition d’aide.</p>}
    <button type="button" className="btn secondary" disabled={busy} onClick={() => session.refresh()}>↻ Actualiser</button>
  </>;
}

/** Résumé de l’offre épinglé en haut d’une discussion. */
export function ResumeOffre({ task, offerId }: { task: Task; offerId: string }) {
  const o = task.offers.find(v => v.id === offerId);
  useEffect(() => { if (o) marquerLu(o.id); }, [o?.id, o?.messages.length]);
  if (!o) return null;
  return <div className="resume-offre"><div><span className="strong">{task.title} · {money(o.amount)}</span><span className="note">{o.slot}</span></div><span className="puce statique">Offre</span></div>;
}

// ——— Trouver : filtres rapides et alertes ———
const PUCES: { libelle: string; filtre: SearchFilter }[] = [
  { libelle: 'À distance', filtre: { mode: 'distance' } },
  ...CATEGORIES.filter(c => c.value !== 'autre').map(c => ({ libelle: c.label.split(' ')[0], filtre: { category: c.value } })),
];
const memeFiltre = (a: SearchFilter, b: SearchFilter) => ['q', 'category', 'mode', 'place', 'budget', 'deadline'].every(k => (a[k as keyof SearchFilter] || '') === (b[k as keyof SearchFilter] || ''));
const libelleFiltre = (f: SearchFilter) => [f.q && `« ${f.q} »`, f.category && CATEGORIES.find(c => c.value === f.category)?.label, f.mode === 'distance' ? 'à distance' : f.mode === 'sur_place' ? 'sur place' : '', f.place].filter(Boolean).join(' · ') || 'toutes les demandes';

/** Puces de filtres rapides au-dessus de la recherche. */
export function FiltresRapides({ f, run }: { f: SearchFilter; run: (next: SearchFilter) => void }) {
  return <div className="puces" role="group" aria-label="Filtres rapides">{PUCES.map(p => {
    const [k, v] = Object.entries(p.filtre)[0] as [keyof SearchFilter, string], actif = f[k] === v;
    return <button type="button" key={p.libelle} className="puce" aria-pressed={actif} onClick={() => run({ ...f, [k]: actif ? '' : v })}>{p.libelle}</button>;
  })}</div>;
}

/** Bandeau « Créer l’alerte » pour les filtres en cours, et liste des alertes. */
export function Alertes({ f, run }: { f: SearchFilter; run: (next: SearchFilter) => void }) {
  const alertes = useStockage<Alerte[]>(CLE_ALERTES, []);
  const existe = alertes.some(a => memeFiltre(a.filtre, f)), vide = !Object.entries(f).some(([k, v]) => v && k !== 'sort');
  const creer = () => ecrire(CLE_ALERTES, [...alertes, { id: String(Date.now()), filtre: { ...f, sort: undefined }, libelle: libelleFiltre(f), vuLe: new Date().toISOString() }].slice(-5));
  return <>
    {!vide && !existe && <div className="bandeau-alerte"><span>Être prévenu des nouvelles demandes : {libelleFiltre(f)}</span><button type="button" className="btn small" onClick={creer}>Créer l’alerte</button></div>}
    {alertes.length > 0 && <details className="mes-alertes"><summary>Mes alertes · {alertes.length}</summary><ul>{alertes.map(a => <li key={a.id} className="row">
      <button type="button" className="lien" onClick={() => { ecrire(CLE_ALERTES, alertes.map(x => x.id === a.id ? { ...x, vuLe: new Date().toISOString() } : x)); run({ ...a.filtre, sort: f.sort }); }}>{a.libelle}</button>
      <button type="button" className="lien" onClick={() => ecrire(CLE_ALERTES, alertes.filter(x => x.id !== a.id))}>Supprimer<span className="sr"> l’alerte {a.libelle}</span></button></li>)}</ul>
      <p className="note">Alertes gardées dans ce navigateur : les nouvelles demandes sont signalées sur ton accueil. Pas encore d’e-mail ni de notification.</p></details>}
  </>;
}
const correspond = (t: Task, f: SearchFilter) => (!f.category || t.category === f.category) && (!f.mode || t.mode === f.mode || t.mode === 'les_deux')
  && (!f.q || (t.title + ' ' + t.details).toLowerCase().includes(f.q.toLowerCase())) && (!f.place || t.place.toLowerCase().includes(f.place.toLowerCase()));
function useNouvellesAlertes(tasks: Task[], actorId: string) {
  const alertes = useStockage<Alerte[]>(CLE_ALERTES, []);
  const vues = new Set<string>();
  for (const a of alertes) for (const t of tasks) if (t.owner.id !== actorId && t.status === 'open' && t.createdAt > a.vuLe && correspond(t, a.filtre)) vues.add(t.id);
  return vues.size;
}

// ——— Profil et réglages ———
/** Onglet Profil : en-tête, taux de remplissage, chiffres et réglages ; la suite du compte (paiements, abonnement, démo) dessous. */
export function Reglages({ state: { gateway, actorId, profile, tasks }, go, children }: Ctx & { children: ReactNode }) {
  const premium = useFlag('espace.premium');
  useEffect(() => { if (actorId && profile?.id !== actorId) void session.openProfile(actorId); }, [actorId]);
  if (!gateway) return null;
  const p = profile?.id === actorId ? profile : null, r = p && remplissageProfil(p);
  const { own } = partition(tasks, actorId);
  const ligne = (libelle: string, detail: string, aller: () => void) => <li><button type="button" className="reglage" onClick={aller}><span>{libelle}</span><span className="note">{detail} ›</span></button></li>;
  return <>
    <section className="profil-entete"><span className="pastille-nom grand" aria-hidden="true">{gateway.actor.name.slice(0, 1).toUpperCase()}</span>
      <div><h1 className="espace-titre">{gateway.actor.name}</h1>{p && <span className="note">Membre depuis le {date(p.since).split(' ')[0]}</span>}</div>
      <button type="button" className="lien" onClick={() => go('profile', { userId: undefined })}>Voir</button></section>
    {r && r.faits < r.total && <section className="carte-espace"><div className="row"><span className="strong">Profil complété à {r.pourcent} %</span><span className="note">{r.faits} sur {r.total}</span></div>
      <span className="jauge"><span style={{ width: r.pourcent + '%' }}/></span>
      <span className="note">À ajouter : {r.manquants.join(', ').toLowerCase()}. Les profils complets inspirent plus confiance.</span>
      <button type="button" className="lien" onClick={() => go('profile', { userId: undefined })}>Compléter mon profil ›</button></section>}
    <section className="chiffres" aria-label="Mes chiffres"><div><span className="chiffre">{own.length}</span><span className="note">demande{own.length > 1 ? 's' : ''}</span></div>
      <div><span className="chiffre">{p?.missions ?? 0}</span><span className="note">mission{(p?.missions ?? 0) > 1 ? 's' : ''} faite{(p?.missions ?? 0) > 1 ? 's' : ''}</span></div>
      <div><span className="chiffre">{p?.rating != null ? String(p.rating).replace('.', ',') : '–'}</span><span className="note">note · {p?.reviews.length ?? 0} avis</span></div></section>
    <ul className="reglages">
      {ligne('Mon profil public', 'Nom, présentation, avis', () => go('profile', { userId: undefined }))}
      {ligne('Mes alertes de demandes', String(lire<Alerte[]>(CLE_ALERTES, []).length || 'Aucune'), () => go('list', { tab: 'find' }))}
      {premium.actif && <li><a className="reglage" href="premium"><span>Flemme Premium</span><span className="note">Découvrir ›</span></a></li>}
      {ligne('Aide et contact', '', () => go('help'))}
    </ul>
    <h2 className="espace-section">Compte et paiements</h2>
    {children}
  </>;
}

