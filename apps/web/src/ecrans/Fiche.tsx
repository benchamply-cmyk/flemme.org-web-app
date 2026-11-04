import { useState } from 'react';
import { budgetText, canEdit, categoryLabel, date, deadlineLabel, modeLabel, money, notices, offerStatus, parseMoney, paymentNote, paymentStatus, reviewLabel, taskStatus } from '../../../../packages/shared/src/index.ts';
import { onlinePayment, openStripe } from '../session.ts';
import { Action, Bill } from '../ui.tsx';
import type { Ctx } from './contexte.ts';

// Fiche d’une flemme : accord, paiement déclaratif, propositions, signalements et historique.
export function Fiche({ state: { busy, actorId }, task, can, draft, field, go, mutate, validated }: Ctx) {
  const [showHistory, setShowHistory] = useState(false);
  if (!task) return null;
  const { agreement } = task;
  const preview = (() => { try { const n = parseMoney(draft.amount || ''); return n != null ? <Bill amount={n}/> : null; } catch { return null; } })();
  const review = can.isOwner && task.review && task.review !== 'published' ? task.review : null;
  return <><span className="tag">{taskStatus[task.status]}{task.status === 'open' ? ' · sans expiration' : ''}</span><h1 className="heading">{task.title}</h1><p className="muted">{[categoryLabel(task), task.place, modeLabel(task)].filter(Boolean).join(' · ')} · déposée par {task.owner.name}</p>
    {review && <div className={review === 'changes_requested' || review === 'rejected' ? 'alert' : 'notice'} role="status"><span className="strong">{reviewLabel[review]}</span>{task.reviewNote && <><br/>{task.reviewNote}</>}{review === 'pending' && <><br/>Personne d’autre ne la voit pour l’instant.</>}</div>}
    <p>{task.details}</p>
    <p className="strong">Budget indicatif : {budgetText(task, money)}{task.budget != null || task.budgetRange ? ' hors frais' : ''} · Délai : {deadlineLabel(task)}</p>
    {task.address && <p className="note"><span className="strong">Adresse précise (privée) : </span>{task.address}</p>}
    {canEdit(task, actorId) && <Action secondary disabled={busy} onClick={() => go('edit')}>{review === 'changes_requested' ? 'Corriger ma demande' : 'Modifier ma demande'}</Action>}
    {agreement && <><h2 className="section-title">{agreement.brigadier.name} prend le relais</h2><p>{agreement.scope}</p><p className="muted">{agreement.slot}</p><Bill amount={agreement.amount} agreed={agreement}/>
      <p className="note">{paymentNote(agreement, onlinePayment, money)}</p>
      {can.canComplete && <Action disabled={busy} onClick={() => mutate('complete', {})}>Confirmer la tâche terminée</Action>}
      {can.canDeclarePayment && onlinePayment && <Action disabled={busy} onClick={() => openStripe('checkout', task.id)}>Payer en ligne · {money(agreement.total)}</Action>}
      {can.canDeclarePayment && <Action secondary={onlinePayment} disabled={busy} onClick={() => mutate('declare_payment', {})}>J’ai payé le Brigadier{onlinePayment ? ' en direct' : ''}</Action>}
      {can.canConfirmPayment && <Action disabled={busy} onClick={() => mutate('confirm_payment', {})}>Confirmer avoir reçu le paiement</Action>}
      <p className="muted">{task.payment ? paymentStatus(task, money) : <>{paymentStatus(task)}<br/>Commission : à régler · encaissement non connecté</>}</p></>}
    {task.offers.length > 0 && <><h2 className="section-title">{can.isOwner ? 'Les propositions' : 'Mes propositions'}</h2>
      {task.offers.map(o => <button type="button" key={o.id} onClick={() => go('offer', { offerId: o.id })} className="card"><span className="row"><span className="strong">{o.brigadier.name}</span><span className="price">{money(o.amount)}</span></span><span>{o.scope}</span><span className="muted">{offerStatus[o.status]}</span><span className="link">Discussion et récapitulatif →</span></button>)}</>}
    {can.canOffer && <><h2 className="section-title">Proposer mon aide</h2>{field('Mon forfait Brigadier', 'amount', { numeric: true })}{preview}{field('Mes disponibilités', 'slot')}{field('Ce qui est inclus et non inclus', 'scope', { multiline: true })}
      <Action disabled={busy} onClick={() => validated(() => { void mutate('offer', { amount: parseMoney(draft.amount || ''), slot: draft.slot, scope: draft.scope }, 'detail', notices.offerSent); })}>Proposer mon aide</Action></>}
    {can.canReport && <Action secondary disabled={busy} onClick={() => go('report')}>Signaler un désaccord</Action>}
    {task.reports.map((r, i) => <div className="bubble" key={i}><span className="strong">Signalement de {r.actor.name}</span><span>{r.text}</span><span className="note">En attente d’examen manuel · {date(r.at)}</span></div>)}
    <Action secondary onClick={() => setShowHistory(!showHistory)}>{showHistory ? 'Masquer l’historique' : 'Voir l’historique conservé'}</Action>
    {showHistory && task.history.map((h, i) => <div key={i} className="history"><p>{h.text}</p><span className="note">{date(h.at)}</span></div>)}</>;
}
