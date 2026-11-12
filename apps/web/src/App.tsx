import { AccountAccess } from './beta/AccountAccess.tsx';
import { formuleDepuisHash } from './formules.ts';
import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { backLabel, contractFields, footer, money, rights, taskFields } from '../../../packages/shared/src/index.ts';
import type { Command, Input, Option, Screen, Task } from '../../../packages/shared/src/index.ts';
import { onlinePayment, session, useSession } from './session.ts';
import { Action } from './ui.tsx';
import pied from './site/pied.html?raw';
import './site/site.css';
import './site/reglages.css';
import './site/reglages-retenus.css';
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

// Lien direct depuis la vitrine : app.html#mine ou app.html#find.
// app.html#deposer ouvre directement le formulaire « Déléguer ma flemme » ;
// app.html#deposer-autre et #deposer-devis l’ouvrent sur la formule « Autres services » ou « Demande de devis » (src/formules.ts).
const formule = formuleDepuisHash(location.hash);
const deposer = location.hash === '#deposer' || !!formule;
const initialTab = location.hash === '#find' ? 'find' : location.hash === '#mine' || deposer || location.hash.startsWith('#paiement') ? 'mine' : null;
const start: Place = { screen: deposer ? 'new' : initialTab ? 'list' : 'home', tab: initialTab || 'mine', taskId: '', offerId: '', depth: 0 };
const startDraft: Draft = formule === 'autre' ? { formule, category: 'autre' } : formule ? { formule } : {};
// Écrans ouverts depuis la fiche d’une flemme : combien de pas pour y revenir.
const aboveDetail: Partial<Record<Screen, number>> = { offer: 1, review: 2, report: 1, edit: 1, contract: 1 };
// Formulaire prérempli à l’ouverture d’un écran : modification d’une demande ou reprise d’un brouillon.
function initialDraft(next: Place): Draft {
  const { tasks, drafts, found, actorId } = session.getState();
  const t = tasks.find(v => v.id === next.taskId) || found?.tasks.find(v => v.id === next.taskId);
  if (next.screen === 'edit') return t ? taskFields(t, money) : {};
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
  const [place, setPlace] = useState<Place>(start), [draft, setDraft] = useState<Draft>(startDraft), [visit, setVisit] = useState(0);
  const main = useRef<HTMLElement>(null), flash = useRef('');
  const { screen, taskId, offerId } = place;
  const task = tasks.find(t => t.id === taskId) || state.found?.tasks.find(t => t.id === taskId), offer = task?.offers.find(o => o.id === offerId);

  useEffect(() => {
    history.replaceState(start, '');
    const onPop = (e: PopStateEvent) => { if (!e.state?.screen) return; show(e.state as Place); session.notify(flash.current); flash.current = ''; };
    addEventListener('popstate', onPop); void session.initialize();
    return () => removeEventListener('popstate', onPop);
  }, []);
  // `visit` remonte l’écran à chaque navigation : son état local (historique déplié…) repart de zéro.
  function show(next: Place) { setPlace(next); setDraft(initialDraft(next)); setVisit(v => v + 1); session.clearMessages(); main.current?.focus(); scrollTo(0, 0); }
  function go(screen: Screen, change: Partial<Place> = {}, replace = false) {
    const next = { ...place, ...change, screen, depth: replace ? place.depth : place.depth + 1 };
    if (replace) history.replaceState(next, ''); else history.pushState(next, '');
    show(next);
  }
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
  function keepDraft(id: string) { const next = { ...place, draftId: id }; history.replaceState(next, ''); setPlace(next); }
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
  // Lien « catégorie » du pied de page : la liste des demandes se filtre sans recharger l’app.
  function onPied(e: MouseEvent<HTMLElement>) {
    const a = (e.target as Element).closest<HTMLAnchorElement>('[data-filtre-categorie]');
    if (!a || !connecte) return;
    e.preventDefault();
    try { sessionStorage.setItem('flemme.filtre', JSON.stringify({ category: a.dataset.filtreCategorie })); } catch { /* stockage bloqué */ }
    go('list', { tab: 'find' });
  }
  // Lien du menu burger : referme le menu puis change d’écran dans l’app.
  const menu = (action: () => void) => (e: MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); (e.currentTarget.closest('details') as HTMLDetailsElement).open = false; action(); };
  const plus = <svg className="ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter"><path d="M12 6v12M6 12h12"/></g></svg>;
  return <>
    <div className="flemme-chrome-home bandeau app-bandeau" data-flemme-page="deleguer">
      <header className="entete">
        {/* En-tête V0.6 : FLEMME. · Home · Déléguer · Menu (Résoudre une flemme dedans) · Connexion · Aide (même ordre que la vitrine, src/site/entete.html). */}
        <div className="entete-gauche">
          <a className="logo" href="./" aria-label="FLEMME · retour à la présentation">FLEMME.</a>
          <a className="pastille entete-home" href="./"><svg className="ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter"><path d="M5 11l7-6 7 6v8H5z"/></g></svg><span>Home</span></a>
          {connecte && <button type="button" className="pastille deleguer" onClick={() => go('new', { tab: 'mine', draftId: undefined })}>{plus}<span>Déléguer</span></button>}
        </div>
        <details className="burger menu-principal">
          <summary aria-label="Menu"><svg className="ico" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" strokeLinejoin="miter"><path d="M6 8h12M6 12h12M6 16h12"/></g></svg></summary>
          <nav className="burger-menu" aria-label="Menu">
            <a href="resoudre.html#devenir-brigadier">Résoudre une flemme · Devenir Brigadier</a>
            {connecte && <a href="#mine" onClick={menu(() => go('list', { tab: 'mine' }))}>Mon espace</a>}
            <a href="comment-ca-marche.html#concept">À propos de Flemme</a><a href="./#services">Nos services</a><a href="comment-ca-marche.html">Comment ça marche</a><a href="faq.html">Questions fréquentes</a><a href="contact.html">Contact</a>
          </nav>
        </details>
        <div className="entete-droite">{connecte
          ? <><AccountAccess gateway={gateway} compact/><button type="button" className="pastille mon-espace" aria-label="Mon espace" onClick={() => go('list', { tab: 'mine' })}><span className="pastille-initiale" aria-hidden="true">{gateway?.actor.name.slice(0, 1).toUpperCase()}</span><span>Mon espace</span></button></>
          : <span className="pastille deleguer" aria-current="page"><svg className="ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 19c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5"/></g></svg><span>Connexion</span></span>}
          <details className="burger menu-aide">
            <summary aria-label="Aide : FAQ et contact"><svg className="ico" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" strokeLinejoin="miter"><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5v.7"/><path d="M12 17.5v.5"/></g></svg></summary>
            <nav className="burger-menu" aria-label="Aide">
              <a href="faq.html">FAQ</a><a href="contact.html">Contact</a>
              {connecte && <a href="#aide" onClick={menu(() => go('help'))}>Aide en ligne</a>}
            </nav>
          </details>
        </div>
      </header>
    </div>
    <main ref={main} tabIndex={-1} className="app" aria-busy={busy}>
      {screen !== 'home' && connecte && <div className="app-nav"><Action secondary onClick={back}>{backLabel(screen)}</Action>{screen !== 'account' && <button type="button" className="btn small secondary" onClick={() => go('account')}>Mon compte</button>}</div>}
      {!!error && <div role="alert" className="alert">{error}</div>}
      {!!notice && <p aria-live="polite" className="notice">{notice}</p>}
      {content}
      {busy && <p className="muted" role="status">En cours…</p>}
    </main>
    <p className="foot">{footer(session.remote, onlinePayment)}</p>
    <div onClick={onPied} dangerouslySetInnerHTML={{ __html: pied }}/>
  </>;
}
