import type { Ctx } from './contexte.ts';

// Accueil de l’app : les deux portes d’entrée, chacune avec sa destination immédiate.
export function Accueil({ go }: Ctx) {
  return <div className="home"><div><p className="eyebrow">Une tâche en moins, un coup de main en plus.</p><h1 className="heading">Que voulez-vous faire&#8239;?</h1><p className="muted">Avec un seul compte, vous pouvez déléguer une tâche et proposer votre aide.</p></div>
    <div className="choices">
      <button type="button" className="choice" onClick={() => go('new', { tab: 'mine', draftId: undefined })}><span className="choice-icon" aria-hidden="true"><svg className="ico" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" strokeLinejoin="miter"><path d="M12 6v12M6 12h12"/></g></svg></span><span className="choice-title">Déléguer ma flemme</span><span className="choice-hint">Décrivez ce que vous aimeriez confier.</span></button>
      <a className="choice secondary" href="flemmes"><span className="choice-icon" aria-hidden="true"><svg className="ico" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><g fill="currentColor"><circle cx="16.5" cy="10.5" r="1.6"/><circle cx="14.7" cy="14.7" r="1.6"/><circle cx="10.5" cy="16.5" r="1.6"/><circle cx="6.3" cy="14.7" r="1.6"/><circle cx="4.5" cy="10.5" r="1.6"/><circle cx="6.3" cy="6.3" r="1.6"/><circle cx="10.5" cy="4.5" r="1.6"/><circle cx="14.7" cy="6.3" r="1.6"/><circle cx="19" cy="19" r="2.2"/></g></svg></span><span className="choice-title">Résoudre une flemme</span><span className="choice-hint">Trouvez une demande et proposez votre aide.</span></a>
    </div>
    <div className="home-liens">
    <button type="button" className="btn secondary" onClick={() => go('list', { tab: 'mine' })}>Mon espace · mes demandes et mes propositions</button>
    {/* Brigadier Premium : seul lien depuis l’espace, repris de l’ancienne page espace-connecte.html. */}
    <a className="btn secondary" href="premium">Flemme Premium · pour les membres qui aident souvent</a>
    </div>
    {/* v2.1.0 (Ben, 18/11/2026) : bloc « Version test » retiré de l’accueil ; les testeurs gardent la pastille « Test » de l’en-tête. */}
    </div>;
}
