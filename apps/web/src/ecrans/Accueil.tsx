import type { Ctx } from './contexte.ts';

export function Accueil({ go }: Ctx) {
  return <div className="home"><div><p className="eyebrow">Le droit d’avoir la flemme,<br/>le pouvoir d’aider.</p><h1 className="heading">Passe le relais. Ou prends-le.</h1><p className="muted">Déléguer des tâches. Se charger de les réaliser. Tout le monde est gagnant.</p></div>
    <div className="choices">
      <button type="button" className="choice" aria-label="Mes flemmes · déposer et suivre mes demandes" onClick={() => go('list', { tab: 'mine' })}><span className="choice-icon" aria-hidden="true">☕</span><span className="choice-title">Mes flemmes</span><span className="choice-hint">Je décris ce que je repousse</span></button>
      <button type="button" className="choice secondary" aria-label="Résoudre une flemme · voir les flemmes à résoudre" onClick={() => go('list', { tab: 'find' })}><span className="choice-icon" aria-hidden="true">↗</span><span className="choice-title">Résoudre une flemme</span><span className="choice-hint">Je propose mon coup de main</span></button>
    </div></div>;
}
