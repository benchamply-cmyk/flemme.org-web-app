import { useEffect, useRef, useState } from 'react';
import './nav-bientot.css';

// Menu de la page /bientot repris dans Mon espace en version bêta (demande de Ben du 27/11/2026) :
// mêmes bulles (logo « À bientôt… », Démo, Patienter, Questions, bouton vert), même menu à quatre carrés sur mobile.
// Copie du rendu de apps/web/public/bientot (vc.css, réglages « bulles » figés de la v2.2.0-rc.1), classes préfixées nb-.
// Les liens vers /bientot rechargent la page statique ; /bientot/mon-espace reste dans l’app.
export function NavBientot({ connecte }: { connecte: boolean }) {
  const [ouvert, setOuvert] = useState(false), liste = useRef<HTMLDivElement>(null), bouton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => { if (!liste.current?.contains(e.target as Node) && !bouton.current?.contains(e.target as Node)) setOuvert(false); };
    const touche = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOuvert(false); bouton.current?.focus(); } };
    document.addEventListener('click', clic); document.addEventListener('keydown', touche);
    return () => { document.removeEventListener('click', clic); document.removeEventListener('keydown', touche); };
  }, [ouvert]);
  const cta = connecte ? 'Mon espace' : 'S’inscrire';
  return <nav className="nb-nav" aria-label="Navigation">
    <span className="nb-logo-bloc"><a className="nb-logo" href="/bientot/" aria-label="FLEMME, page d’attente de la bêta">FLEMME.</a><span className="nb-badge"><i/>À bientôt…</span></span>
    <a className="nb-bulle nb-large" href="/bientot/#essai">Démo</a>
    <a className="nb-bulle nb-large" href="/bientot/je-patiente.html">Patienter</a>
    <a className="nb-bulle nb-large" href="/bientot/#faq">Questions</a>
    <a className="nb-cta nb-large" href="/bientot/mon-espace" aria-current="page">{cta}</a>
    <button ref={bouton} type="button" className="nb-menu-btn" aria-expanded={ouvert} aria-controls="nbMenu" aria-label="Menu" onClick={() => setOuvert(!ouvert)}><span className="nb-carres" aria-hidden="true"><i/><i/><i/><i/></span></button>
    <div ref={liste} className="nb-menu-liste" id="nbMenu" hidden={!ouvert} onClick={e => { if ((e.target as Element).closest('a')) setOuvert(false); }}>
      <a href="/bientot/#essai">Démo</a><a href="/bientot/je-patiente.html">Patienter</a><a href="/bientot/#faq">Questions</a><a className="nb-menu-cta" href="/bientot/mon-espace">{cta}</a>
    </div>
  </nav>;
}
