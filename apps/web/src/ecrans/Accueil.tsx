import { AccountAccess } from '../beta/AccountAccess.tsx';
import type { Ctx } from './contexte.ts';

// Accueil de l’app : les deux portes d’entrée, chacune avec sa destination immédiate.
export function Accueil({ go, state: { gateway } }: Ctx) {
  return <div className="home"><div><p className="eyebrow">Une tâche en moins, un coup de main en plus.</p><h1 className="heading">Que veux-tu faire&#8239;?</h1><p className="muted">Avec un seul compte, tu peux déléguer une tâche et proposer ton aide.</p></div>
    <div className="choices">
      <button type="button" className="choice" onClick={() => go('new', { tab: 'mine', draftId: undefined })}><span className="choice-icon" aria-hidden="true"><svg className="ico" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" strokeLinejoin="miter"><path d="M12 6v12M6 12h12"/></g></svg></span><span className="choice-title">Déléguer ma flemme</span><span className="choice-hint">Décris ce que tu aimerais confier.</span></button>
      <a className="choice secondary" href="resoudre"><span className="choice-icon" aria-hidden="true"><svg className="ico" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><g fill="currentColor"><circle cx="16.5" cy="10.5" r="1.6"/><circle cx="14.7" cy="14.7" r="1.6"/><circle cx="10.5" cy="16.5" r="1.6"/><circle cx="6.3" cy="14.7" r="1.6"/><circle cx="4.5" cy="10.5" r="1.6"/><circle cx="6.3" cy="6.3" r="1.6"/><circle cx="10.5" cy="4.5" r="1.6"/><circle cx="14.7" cy="6.3" r="1.6"/><circle cx="19" cy="19" r="2.2"/></g></svg></span><span className="choice-title">Résoudre une flemme</span><span className="choice-hint">Trouve une demande et propose ton aide.</span></a>
    </div>
    <button type="button" className="btn secondary" onClick={() => go('list', { tab: 'mine' })}>Mon espace · mes demandes et mes propositions</button>
    {/* Brigadier Premium : seul lien depuis l’espace, repris de l’ancienne page espace-connecte.html. */}
    <a className="btn secondary" href="premium">Brigadier Premium · pour celles et ceux qui aident souvent</a>
    <AccountAccess gateway={gateway} visibleEntry/></div>;
}
