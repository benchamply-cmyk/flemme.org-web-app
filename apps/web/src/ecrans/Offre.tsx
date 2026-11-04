import { date, price, money, notices, offerInput, offerReviewLabel, offerStatus } from '../../../../packages/shared/src/index.ts';
import { Action, Bill } from '../ui.tsx';
import type { Ctx } from './contexte.ts';

// Écrans « offer » (discussion avec un Brigadier) et « review » (récapitulatif avant d’accepter).
export function Offre({ state: { busy, actorId }, place: { screen, offerId }, task, offer, can, draft, field, go, mutate, validated }: Ctx) {
  if (!task || !offer) return null;
  const total = money(price(offer.amount).total);
  const mine = offer.brigadier.id === actorId, editable = mine && offer.status === 'pending' && task.status === 'open' && offer.review !== 'rejected';
  return <><h1 className="heading">{screen === 'review' ? 'On se met d’accord ?' : 'L’offre de ' + offer.brigadier.name}</h1><p className="card-title">{task.title}</p><span className="tag">{offerStatus[offer.status]}</span>
    <Action secondary onClick={() => go('profile', { userId: offer.brigadier.id })}>Voir le profil de {offer.brigadier.name}</Action>
    {mine && offer.review && offer.review !== 'approved' && <div className={offer.review === 'pending' ? 'notice' : 'alert'} role="status"><span className="strong">{offerReviewLabel[offer.review]}</span>{offer.reviewNote && <><br/>{offer.reviewNote}</>}</div>}
    <h2 className="section-title">Ce qui est convenu</h2><p>{offer.scope}</p>{offer.result && <p><span className="strong">Résultat promis : </span>{offer.result}</p>}<p className="muted">{offer.slot}</p><Bill amount={offer.amount}/>
    {editable && <><h2 className="section-title">{offer.review === 'changes_requested' ? 'Corriger ma candidature' : 'Modifier ma candidature'}</h2>
      {field('Mon forfait Brigadier', 'amount', { numeric: true })}{field('Mes disponibilités', 'slot')}{field('Ce qui est inclus et non inclus', 'scope', { multiline: true })}{field('Résultat promis (facultatif)', 'result', { multiline: true })}
      <Action disabled={busy} onClick={() => validated(() => { void mutate('apply_edit', { offerId, ...offerInput(draft) }, 'offer', t => notices.applied(t.offers.find(o => o.id === offerId))); })}>Renvoyer ma candidature</Action></>}
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
