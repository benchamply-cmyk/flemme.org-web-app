import type { Ctx } from './contexte.ts';

export function Accueil({ go }: Ctx) {
  return <div className="home"><div><p className="eyebrow">Le droit d’avoir la flemme.</p><h1 className="heading">On fait quoi aujourd’hui ?</h1><p className="muted">Déléguer un peu. Aider quelqu’un.</p></div>
    <div className="choices">
      <button type="button" className="choice" aria-label="Mes flemmes · déposer et suivre mes demandes" onClick={() => go('list', { tab: 'mine' })}><span className="choice-icon" aria-hidden="true">☕</span><span className="choice-title">Mes flemmes</span><span className="choice-hint">Déposer et suivre mes demandes</span></button>
      <button type="button" className="choice secondary" aria-label="Résoudre une flemme · voir les flemmes à résoudre" onClick={() => go('list', { tab: 'find' })}><span className="choice-icon" aria-hidden="true">↗</span><span className="choice-title">Résoudre une flemme</span><span className="choice-hint">Trouver quelqu’un à aider</span></button>
    </div></div>;
}
