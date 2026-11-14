import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { adresse, backLabel, contractFields, footer, lireAdresse, money, rights, taskFields } from '../../../packages/shared/src/index.ts';
import type { Adresse, Command, Input, Option, Screen, Task } from '../../../packages/shared/src/index.ts';
import { onlinePayment, session, useSession } from './session.ts';
import { Action } from './ui.tsx';
import pied from './site/pied.html?raw';
import './site/site.css';
import './site/reglages.css';
import './site/reglages-retenus.css';
import './site/reglages-pr55.css';
import type { Ctx, Draft, FieldOptions, Place } from './ecrans/contexte.ts';
import { Accueil } from './ecrans/Accueil.tsx';
import { Accord } from './ecrans/Accord.tsx';
import { Aide } from './ecrans/Aide.tsx';
import { Compte } from './ecrans/Compte.tsx';
import { Connexion } from './ecrans/Connexion.tsx';
import { Fiche } from './ecrans/Fiche.tsx';
import { Listes } from './ecrans/Listes.tsx';
import { MotDePasse } from './ecrans/MotDePasse.tsx';
import { NouvelleFlemme } from './ecrans/NouvelleFlemme.tsx';
import { Offre } from './ecrans/Offre.tsx';
import { Profil } from './ecrans/Profil.tsx';
import { Signalement } from './ecrans/Signalement.tsx';

// Coque web de l’app : navigation, formulaire en cours et choix de l’écran.
// Règles, état et textes partagés : packages/shared. Écrans : src/ecrans. Pendant mobile : apps/mobile/App.tsx.
// Différence web : chaque écran est une entrée d’historique, le bouton Retour du navigateur remplace BackHandler.

// Une adresse par écran, la même que dans l’app mobile : /mon-espace, /mes-demandes, /flemmes, /deleguer/nouvelle,
// /flemme/123… (table dans packages/shared/src/adresses.ts, servie par netlify.toml). Les anciennes adresses
// app.html#mine, #find, #deleguer(-autre, -devis), #deposer… et #paiement-ok sont lues puis remplacées par la nouvelle.
const arrivee = lireAdresse(location.pathname, location.search, location.hash) ?? { screen: 'home' as const };
const start: Place = placeDe(arrivee, { screen: 'home', tab: 'mine', taskId: '', offerId: '', depth: 0 });
retenirCategorie(arrivee.categorie);
/** Écran désigné par une adresse, à partir de l’écran courant. */
function placeDe(a: Adresse, from: Place): Place {
  return { ...from, screen: a.screen, tab: a.tab || from.tab, taskId: a.taskId || '', offerId: a.offerId || '', userId: a.userId, formule: a.formule, categorie: a.categorie, draftId: undefined };
}
// Filtre « catégorie » transmis à la liste des flemmes, comme depuis la vitrine (src/site/filtre.ts).
function retenirCategorie(category: string | undefined) {
  if (category) try { sessionStorage.setItem('flemme.filtre', JSON.stringify({ category })); } catch { /* stockage bloqué */ }
}
const adresseDe = (p: Place) => adresse(p);
// Écrans ouverts depuis la fiche d’une flemme : combien de pas pour y revenir.
const aboveDetail: Partial<Record<Screen, number>> = { offer: 1, review: 2, report: 1, edit: 1, contract: 1 };
// Formulaire prérempli à l’ouverture d’un écran : modification d’une demande ou reprise d’un brouillon.
function initialDraft(next: Place): Draft {
  const { tasks, drafts, found, actorId } = session.getState();
  const t = tasks.find(v => v.id === next.taskId) || found?.tasks.find(v => v.id === next.taskId);
  if (next.screen === 'edit') return t ? taskFields(t, money) : {};
  // /deleguer/nouvelle?formule=autre|devis : formulaire ouvert sur la formule « Autres services » ou « Demande de devis ».
  if (next.screen === 'new' && !next.draftId && next.formule) return next.formule === 'autre' ? { formule: next.formule, category: 'autre' } : { formule: next.formule };
  if ((next.screen === 'new' || next.screen === 'detail') && next.draftId) return { ...drafts.find(d => d.id === next.draftId)?.fields };
  // Candidature à corriger : le Brigadier repart de sa proposition.
  const o = next.screen === 'offer' ? t?.offers.find(v => v.id === next.offerId && v.brigadier.id === actorId) : undefined;
  if (o) return { amount: (o.amount / 100).toFixed(2).replace('.', ','), slot: o.slot, scope: o.scope, result: o.result || '' };
  // Accord écrit : version enregistrée, sinon reprise de la candidature retenue.
  if (next.screen === 'contract' && t) return t.contract ? contractFields(t.contract) : { scope: t.agreement?.scope || '', deadline: t.agreement?.slot || '' };
  return {};
}

export default function App() {
  const state = useSession();
  const { gateway, actorId, busy, ready, error, notice, tasks, recovering } = state;
  const [place, setPlace] = useState<Place>(start), [draft, setDraft] = useState<Draft>(() => initialDraft(start)), [visit, setVisit] = useState(0);
  const main = useRef<HTMLElement>(null), flash = useRef(''), suivre = useRef<(a: Adresse) => void>(() => {});
  const { screen, taskId, offerId } = place;
  const task = tasks.find(t => t.id === taskId) || state.found?.tasks.find(t => t.id === taskId), offer = task?.offers.find(o => o.id === offerId);

  useEffect(() => {
    history.replaceState(start, '', adresseDe(start));
    const onPop = (e: PopStateEvent) => {
      const next = e.state?.screen ? e.state as Place : placeDe(lireAdresse(location.pathname, location.search, location.hash) ?? { screen: 'home' }, { ...start, depth: 0 });
      if (!e.state?.screen) history.replaceState(next, '', adresseDe(next));
      show(next); session.notify(flash.current); flash.current = '';
    };
    // Liens vers une adresse de l’espace (barre de navigation, pied de page, écrans) : l’écran change sans recharger l’app.
    const onClick = (e: globalThis.MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.<HTMLAnchorElement>('a[href]');
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href);
      const cible = url.origin === location.origin && url.pathname !== '/app.html' ? lireAdresse(url.pathname, url.search, url.hash) : null;
      if (!cible) return;
      e.preventDefault(); suivre.current(cible);
    };
    addEventListener('popstate', onPop); document.addEventListener('click', onClick); void session.initialize();
    return () => { removeEventListener('popstate', onPop); document.removeEventListener('click', onClick); };
  }, []);
  // `visit` remonte l’écran à chaque navigation : son état local (historique déplié…) repart de zéro.
  function show(next: Place) { setPlace(next); setDraft(initialDraft(next)); setVisit(v => v + 1); session.clearMessages(); main.current?.focus(); scrollTo(0, 0); }
  function go(screen: Screen, change: Partial<Place> = {}, replace = false) {
    const next: Place = { ...place, formule: undefined, categorie: undefined, ...change, screen, depth: replace ? place.depth : place.depth + 1 };
    if (replace) history.replaceState(next, '', adresseDe(next)); else history.pushState(next, '', adresseDe(next));
    show(next);
  }
  suivre.current = a => { retenirCategorie(a.categorie); const { screen: _s, depth: _d, ...change } = placeDe(a, place); go(a.screen, change); };
  function back() { if (place.depth > 0) history.back(); else go('home', {}, true); }
  async function mutate(action: Command | 'create', data: Input, next: Screen = 'detail', text: string | ((t: Task) => string) = '') {
    await session.mutate(action, taskId, data, t => {
      const message = typeof text === 'function' ? text(t) : text;
      // Après création, l’écran « nouvelle flemme » est remplacé : Retour ramène à la liste, pas au formulaire vide.
      // Accord, refus ou signalement : on revient à la fiche déjà dans l’historique au lieu d’empiler une copie,
      // pour que Retour mène ensuite à la liste, comme sur le mobile.
      const steps = next === 'detail' ? aboveDetail[place.screen] : undefined;
      if (steps && place.depth >= steps) { flash.current = message; history.go(-steps); return; }
      go(next, { taskId: t.id }, action === 'create' || next === place.screen); session.notify(message);
    });
  }
  function field(label: string, name: string, { multiline = false, numeric = false, secret = false, max, hint }: FieldOptions = {}) {
    const id = 'f-' + name, common = { id, value: draft[name] || '', disabled: busy, 'aria-describedby': hint ? id + '-aide' : undefined, onChange: (e: { target: { value: string } }) => setDraft(d => ({ ...d, [name]: e.target.value })) };
    return <div className="field" key={name}><label htmlFor={id}>{label}</label>{multiline ? <textarea {...common} maxLength={max || 1000}/> : <input {...common} type={secret ? 'password' : name === 'email' ? 'email' : 'text'} inputMode={numeric ? 'decimal' : undefined} placeholder={numeric ? 'En €' : ''} maxLength={max || (name === 'password' ? 200 : 100)} autoComplete={name === 'email' ? 'email' : secret ? (recovering ? 'new-password' : 'current-password') : 'off'}/>}{hint && <small id={id + '-aide'} className="note">{hint}</small>}</div>;
  }
  function choice(label: string, name: string, options: readonly Option[], empty?: string) {
    const id = 'f-' + name;
    return <div className="field" key={name}><label htmlFor={id}>{label}</label><select id={id} value={draft[name] || ''} disabled={busy} onChange={e => setDraft(d => ({ ...d, [name]: e.target.value }))}>{empty != null && <option value="">{empty}</option>}{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>;
  }
  function keepDraft(id: string) { const next = { ...place, draftId: id }; history.replaceState(next, '', adresseDe(next)); setPlace(next); }
  const ctx: Ctx = {
    state, place, draft, task, offer, can: rights(task, actorId), field, choice, go, mutate, keepDraft,
    fill: values => setDraft(d => ({ ...d, ...values })),
    validated: fn => { try { fn(); } catch (e) { session.fail((e as Error).message); } },
    clearDraft: names => setDraft(d => names ? Object.fromEntries(Object.entries(d).filter(([k]) => !names.includes(k))) : {}),
  };

  let content: ReactNode;
  if (!ready) content = <p className="muted" role="status">Chargement…</p>;
  else if (session.remote && (!gateway || !actorId)) content = <Connexion {...ctx}/>;
  else if (!gateway) content = <><h1 className="heading">Chargement interrompu</h1><Action onClick={() => session.initialize()}>Réessayer sans effacer mes données</Action></>;
  else if (recovering && session.remote) content = <MotDePasse {...ctx}/>;
  else if (screen === 'account') content = <Compte {...ctx}/>;
  else if (screen === 'profile') content = <Profil key={visit} {...ctx}/>;
  else if (screen === 'help') content = <Aide key={visit} {...ctx}/>;
  else if (screen === 'home') content = <Accueil {...ctx}/>;
  else if (screen === 'new') content = <NouvelleFlemme key={visit} {...ctx}/>;
  else if (screen === 'list') content = <Listes key={visit} {...ctx}/>;
  else if (!task) content = <><h1 className="heading">Demande indisponible</h1><Action secondary onClick={() => go('list')}>Revenir à la liste</Action></>;
  else if (screen === 'report') content = <Signalement {...ctx}/>;
  else if (screen === 'edit') content = <NouvelleFlemme key={visit} {...ctx}/>;
  else if (screen === 'contract') content = <Accord {...ctx}/>;
  else if ((screen === 'offer' || screen === 'review') && offer) content = <Offre {...ctx}/>;
  else content = <Fiche key={visit} {...ctx}/>;

  const connecte = actorId !== '';
  // Barre de navigation commune au site (src/site/entete.html, insérée dans app.html) : « Connexion » devient « Mon espace ».
  useEffect(() => {
    document.querySelectorAll<HTMLAnchorElement>('.pn a[href="mon-espace"]').forEach(a => { a.textContent = connecte ? 'Mon espace' : 'Connexion'; });
  }, [connecte]);
  return <>
    <main ref={main} tabIndex={-1} className={'app ecran-' + screen} aria-busy={busy}>
      {connecte && <div className="app-nav">{screen !== 'home' && <Action secondary onClick={back}>{backLabel(screen)}</Action>}{screen !== 'account' && <button type="button" className="btn small secondary" onClick={() => go('account')}>Mon compte</button>}{screen !== 'help' && <button type="button" className="btn small secondary" data-beta-feature="aide" onClick={() => go('help')}>Aide en ligne</button>}</div>}
      {!!error && <div role="alert" className="alert">{error}</div>}
      {!!notice && <p aria-live="polite" className="notice">{notice}</p>}
      {content}
      {busy && <p className="muted" role="status">En cours…</p>}
    </main>
    <p className="foot">{footer(session.remote, onlinePayment)}</p>
    <div dangerouslySetInnerHTML={{ __html: pied }}/>
  </>;
}
