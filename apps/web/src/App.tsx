import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { backLabel, footer, rights } from '../../../packages/shared/src/index.ts';
import type { Command, Input, Screen } from '../../../packages/shared/src/index.ts';
import { onlinePayment, session, useSession } from './session.ts';
import { Action } from './ui.tsx';
import type { Ctx, Draft, FieldOptions, Place } from './ecrans/contexte.ts';
import { Accueil } from './ecrans/Accueil.tsx';
import { Compte } from './ecrans/Compte.tsx';
import { Connexion } from './ecrans/Connexion.tsx';
import { Fiche } from './ecrans/Fiche.tsx';
import { Listes } from './ecrans/Listes.tsx';
import { MotDePasse } from './ecrans/MotDePasse.tsx';
import { NouvelleFlemme } from './ecrans/NouvelleFlemme.tsx';
import { Offre } from './ecrans/Offre.tsx';
import { Signalement } from './ecrans/Signalement.tsx';

// Coque web de l’app : navigation, formulaire en cours et choix de l’écran.
// Règles, état et textes partagés : packages/shared. Écrans : src/ecrans. Pendant mobile : apps/mobile/App.tsx.
// Différence web : chaque écran est une entrée d’historique, le bouton Retour du navigateur remplace BackHandler.

// Lien direct depuis la vitrine : app.html#mine ou app.html#find.
const initialTab = location.hash === '#find' ? 'find' : location.hash === '#mine' || location.hash.startsWith('#paiement') ? 'mine' : null;
const start: Place = { screen: initialTab ? 'list' : 'home', tab: initialTab || 'mine', taskId: '', offerId: '', depth: 0 };
// Écrans ouverts depuis la fiche d’une flemme : combien de pas pour y revenir.
const aboveDetail: Partial<Record<Screen, number>> = { offer: 1, review: 2, report: 1 };

export default function App() {
  const state = useSession();
  const { gateway, actorId, busy, ready, error, notice, tasks, recovering } = state;
  const [place, setPlace] = useState<Place>(start), [draft, setDraft] = useState<Draft>({}), [visit, setVisit] = useState(0);
  const main = useRef<HTMLElement>(null), flash = useRef('');
  const { screen, taskId, offerId } = place;
  const task = tasks.find(t => t.id === taskId), offer = task?.offers.find(o => o.id === offerId);

  useEffect(() => {
    history.replaceState(start, '');
    const onPop = (e: PopStateEvent) => { if (!e.state?.screen) return; show(e.state as Place); session.notify(flash.current); flash.current = ''; };
    addEventListener('popstate', onPop); void session.initialize();
    return () => removeEventListener('popstate', onPop);
  }, []);
  // `visit` remonte l’écran à chaque navigation : son état local (historique déplié…) repart de zéro.
  function show(next: Place) { setPlace(next); setDraft({}); setVisit(v => v + 1); session.clearMessages(); main.current?.focus(); scrollTo(0, 0); }
  function go(screen: Screen, change: Partial<Place> = {}, replace = false) {
    const next = { ...place, ...change, screen, depth: replace ? place.depth : place.depth + 1 };
    if (replace) history.replaceState(next, ''); else history.pushState(next, '');
    show(next);
  }
  function back() { if (place.depth > 0) history.back(); else go('home', {}, true); }
  async function mutate(action: Command | 'create', data: Input, next: Screen = 'detail', message = '') {
    await session.mutate(action, taskId, data, t => {
      // Après création, l’écran « nouvelle flemme » est remplacé : Retour ramène à la liste, pas au formulaire vide.
      // Accord, refus ou signalement : on revient à la fiche déjà dans l’historique au lieu d’empiler une copie,
      // pour que Retour mène ensuite à la liste, comme sur le mobile.
      const steps = next === 'detail' ? aboveDetail[place.screen] : undefined;
      if (steps && place.depth >= steps) { flash.current = message; history.go(-steps); return; }
      go(next, { taskId: t.id }, action === 'create' || next === place.screen); session.notify(message);
    });
  }
  function field(label: string, name: string, { multiline = false, numeric = false, secret = false }: FieldOptions = {}) {
    const id = 'f-' + name, common = { id, value: draft[name] || '', disabled: busy, onChange: (e: { target: { value: string } }) => setDraft(d => ({ ...d, [name]: e.target.value })) };
    return <div className="field" key={name}><label htmlFor={id}>{label}</label>{multiline ? <textarea {...common} maxLength={1000}/> : <input {...common} type={secret ? 'password' : name === 'email' ? 'email' : 'text'} inputMode={numeric ? 'decimal' : undefined} placeholder={numeric ? 'En €' : ''} maxLength={name === 'password' ? 200 : 100} autoComplete={name === 'email' ? 'email' : secret ? (recovering ? 'new-password' : 'current-password') : 'off'}/>}</div>;
  }
  const ctx: Ctx = {
    state, place, draft, task, offer, can: rights(task, actorId), field, go, mutate,
    validated: fn => { try { fn(); } catch (e) { session.fail((e as Error).message); } },
    clearDraft: names => setDraft(d => names ? Object.fromEntries(Object.entries(d).filter(([k]) => !names.includes(k))) : {}),
  };

  let content: ReactNode;
  if (!ready) content = <p className="muted" role="status">Chargement…</p>;
  else if (session.remote && (!gateway || !actorId)) content = <Connexion {...ctx}/>;
  else if (!gateway) content = <><h1 className="heading">Chargement interrompu</h1><Action onClick={() => session.initialize()}>Réessayer sans effacer mes données</Action></>;
  else if (recovering && session.remote) content = <MotDePasse {...ctx}/>;
  else if (screen === 'account') content = <Compte {...ctx}/>;
  else if (screen === 'home') content = <Accueil {...ctx}/>;
  else if (screen === 'new') content = <NouvelleFlemme {...ctx}/>;
  else if (screen === 'list') content = <Listes {...ctx}/>;
  else if (!task) content = <><h1 className="heading">Flemme indisponible</h1><Action secondary onClick={() => go('list')}>Revenir à la liste</Action></>;
  else if (screen === 'report') content = <Signalement {...ctx}/>;
  else if ((screen === 'offer' || screen === 'review') && offer) content = <Offre {...ctx}/>;
  else content = <Fiche key={visit} {...ctx}/>;

  return <>
    <header className="top"><a href="./" aria-label="FLEMME · retour à la présentation"><img src={import.meta.env.BASE_URL + 'flemme-logo.png'} alt="FLEMME"/></a>{actorId !== '' && <button type="button" className="avatar" aria-label="Mon compte" onClick={() => go('account')}>{gateway?.actor.name.slice(0, 1).toUpperCase()}</button>}</header>
    <main ref={main} tabIndex={-1} className="app" aria-busy={busy}>
      {screen !== 'home' && actorId !== '' && <Action secondary onClick={back}>{backLabel(screen)}</Action>}
      {!!error && <div role="alert" className="alert">{error}</div>}
      {!!notice && <p aria-live="polite" className="notice">{notice}</p>}
      {content}
      {busy && <p className="muted" role="status">En cours…</p>}
    </main>
    <p className="foot">{footer(session.remote, onlinePayment)}</p>
  </>;
}
