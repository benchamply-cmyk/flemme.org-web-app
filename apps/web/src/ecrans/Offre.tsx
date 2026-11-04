import { commission, date, money, notices, offerStatus } from '../../../../packages/shared/src/index.ts';
import { Action, Bill } from '../ui.tsx';
import type { Ctx } from './contexte.ts';

// Écrans « offer » (discussion avec un Brigadier) et « review » (récapitulatif avant d’accepter).
export function Offre({ state: { busy }, place: { screen, offerId }, task, offer, can, draft, field, go, mutate }: Ctx) {
  if (!task || !offer) return null;
  const total = money(offer.amount + commission(offer.amount));
  return <><h1 className="heading">{screen === 'review' ? 'On se met d’accord ?' : 'L’offre de ' + offer.brigadier.name}</h1><p className="card-title">{task.title}</p><span className="tag">{offerStatus[offer.status]}</span>
    <h2 className="section-title">Ce qui est convenu</h2><p>{offer.scope}</p><p className="muted">{offer.slot}</p><Bill amount={offer.amount}/>
    {screen === 'review'
      ? <><p className="note">Tu attribues cette flemme à {offer.brigadier.name}. Les autres propositions restent dans l’historique. Forfait et frais sont confirmés ensemble.</p>
        <Action disabled={busy || task.status !== 'open' || offer.status !== 'pending'} onClick={() => mutate('accept', { offerId }, 'detail', notices.accepted)}>Accepter · {total}</Action></>
      : <><h2 className="section-title">Votre discussion</h2>
        {offer.messages.length === 0 && <p className="muted">Un détail à préciser avant de vous mettre d’accord ?</p>}
        {offer.messages.map((m, i) => <div key={i} className="bubble"><span className="strong">{m.actor.name}</span><span>{m.text}</span><span className="note">{date(m.at)}</span></div>)}
        {field('Ton message', 'text', { multiline: true })}
        <Action secondary disabled={busy} onClick={() => mutate('message', { offerId, text: draft.text }, 'offer')}>Envoyer le message</Action>
        {can.isOwner && task.status === 'open' && offer.status === 'pending' && <><Action disabled={busy} onClick={() => go('review')}>Voir l’accord avant d’accepter</Action><Action secondary disabled={busy} onClick={() => mutate('decline', { offerId }, 'detail', notices.declined)}>Décliner cette proposition</Action></>}
        <p className="note">Pour changer le prix : décliner l’offre, puis demander un nouveau forfait au Brigadier. Chaque proposition reste conservée.</p></>}</>;
}
