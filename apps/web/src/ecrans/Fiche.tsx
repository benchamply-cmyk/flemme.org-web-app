import { useState } from 'react';
import { CONTRACT_FIELDS, OFFER_FIELDS, budgetText, canEdit, categoryLabel, contractStatusLabel, date, deadlineLabel, modeLabel, money, notices, offerInput, offerReviewLabel, offerStatus, parseMoney, paymentNote, paymentStatus, reviewInput, reviewLabel, signatureInput, stars, taskStatus } from '../../../../packages/shared/src/index.ts';
import { onlinePayment, openStripe, session } from '../session.ts';
import { Action, Bill } from '../ui.tsx';
import { Pieces } from './Pieces.tsx';
import type { Ctx } from './contexte.ts';

// Fiche d’une flemme : accord, paiement déclaratif, propositions, signalements et historique.
export function Fiche({ state: { busy, actorId, files }, place, task, can, draft, field, go, mutate, validated, keepDraft }: Ctx) {
  const [showHistory, setShowHistory] = useState(false), [accept, setAccept] = useState(false), [rating, setRating] = useState('');
  if (!task) return null;
  const { agreement } = task;
  const preview = (() => { try { const n = parseMoney(draft.amount || ''); return n != null ? <Bill amount={n}/> : null; } catch { return null; } })();
  const review = can.isOwner && task.review && task.review !== 'published' ? task.review : null;
  return <><span className="tag">{taskStatus[task.status]}{task.status === 'open' ? ' · sans expiration' : ''}</span><h1 className="heading">{task.title}</h1><p className="muted">{[categoryLabel(task), task.place, modeLabel(task)].filter(Boolean).join(' · ')} · déposée par <button type="button" className="link" onClick={() => go('profile', { userId: task.owner.id })}>{task.owner.name}</button></p>
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
      <p className="muted">{task.payment ? paymentStatus(task, money) : <>{paymentStatus(task)}<br/>Commission : à régler · encaissement non connecté</>}</p>
      {(task.contract || can.canContract) && <><h2 className="section-title">Accord écrit</h2>
        {!task.contract ? <p className="muted">Pas encore d’accord écrit. Rédigez-le ensemble : périmètre, résultat attendu, délai, annulation et confidentialité. Une fois commencé, il doit être signé par les deux avant la fin de la tâche.</p>
          : <><span className="tag">{contractStatusLabel[task.contract.status]}</span>
            {task.contract.reviewNote && <div className={task.contract.status === 'changes_requested' ? 'alert' : 'notice'} role="status">{task.contract.reviewNote}</div>}
            {CONTRACT_FIELDS.map(c => <p key={c.name}><span className="strong">{c.label} : </span>{task.contract!.terms[c.name]}</p>)}
            <p className="note">Déposant : {task.contract.ownerSignedAt ? `signé « ${task.contract.ownerSignature} » le ${date(task.contract.ownerSignedAt)}` : 'pas encore signé'}<br/>
              Brigadier : {task.contract.brigadierSignedAt ? `signé « ${task.contract.brigadierSignature} » le ${date(task.contract.brigadierSignedAt)}` : 'pas encore signé'}</p></>}
        {can.canContract && task.contract?.status !== 'signed' && <Action secondary disabled={busy} onClick={() => go('contract')}>{task.contract ? 'Modifier l’accord' : 'Rédiger l’accord'}</Action>}
        {can.canContract && (task.contract?.status === 'draft' || task.contract?.status === 'changes_requested') && <Action disabled={busy} onClick={() => mutate('agreement_submit', {}, 'detail', t => notices.contractSubmitted(t.contract?.status))}>Soumettre l’accord à l’équipe FLEMME</Action>}
        {can.canSign && <><p className="note">Signature électronique simple : ton nom et ton acceptation sont enregistrés et horodatés. Ce n’est pas une signature qualifiée.</p>
          {field('Ton nom complet', 'signature', { max: 80 })}
          <label className="check"><input type="checkbox" checked={accept} disabled={busy} onChange={e => setAccept(e.target.checked)}/> J’ai lu l’accord et je l’accepte.</label>
          <Action disabled={busy} onClick={() => validated(() => { void mutate('agreement_sign', signatureInput(draft.signature, accept), 'detail', notices.signed); })}>Signer l’accord</Action></>}
        {can.isOwner && task.status === 'assigned' && task.contract && task.contract.status !== 'signed' && <p className="muted">La fin de la tâche se confirme une fois l’accord signé par les deux.</p>}</>}
      {task.myReview && <p className="note">Ton avis : {stars(task.myReview.rating)}{task.myReview.text ? ' · ' + task.myReview.text : ''}</p>}
      {can.canReview && <><h2 className="section-title">Donner mon avis</h2>
        <div className="field"><label htmlFor="f-rating">Note</label><select id="f-rating" value={rating} disabled={busy} onChange={e => setRating(e.target.value)}><option value="">Choisir</option>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{stars(n)} · {n}/5</option>)}</select></div>
        {field('Commentaire (facultatif)', 'reviewText', { multiline: true, max: 600 })}
        <Action disabled={busy} onClick={() => validated(() => { void mutate('review', reviewInput(rating, draft.reviewText), 'detail', notices.reviewSent); })}>Publier mon avis</Action></>}</>}
    {task.offers.length > 0 && <><h2 className="section-title">{can.isOwner ? 'Les propositions' : 'Mes propositions'}</h2>
      {task.offers.map(o => <button type="button" key={o.id} onClick={() => go('offer', { offerId: o.id })} className="card"><span className="row"><span className="strong">{o.brigadier.name}</span><span className="price">{money(o.amount)}</span></span><span>{o.scope}</span>{o.result && <span className="note">Résultat promis : {o.result}</span>}<span className="muted">{offerStatus[o.status]}{o.review && o.review !== 'approved' ? ' · ' + offerReviewLabel[o.review] : ''}</span><span className="link">Discussion et récapitulatif →</span></button>)}</>}
    {can.canOffer && <div className="card propose"><h2 className="section-title" style={{ marginTop: 0 }}>{place.draftId ? 'Reprendre ma candidature' : 'Proposer mon aide'}</h2>{field('Mon forfait Brigadier', 'amount', { numeric: true })}{preview}{field('Mes disponibilités', 'slot')}{field('Ce qui est inclus et non inclus', 'scope', { multiline: true })}
      {field('Résultat promis (facultatif)', 'result', { multiline: true, hint: 'Ce que le déposant aura à la fin. Ex. : étagère fixée et de niveau.' })}
      <p className="note">L’équipe FLEMME relit chaque candidature avant de la transmettre au déposant.</p>
      <Action disabled={busy} onClick={() => validated(() => { void mutate('apply', { ...offerInput(draft), draftId: place.draftId || null }, 'detail', t => notices.applied(t.offers.find(o => o.brigadier.id === actorId && o.status === 'pending'))); })}>Envoyer ma candidature</Action>
      <Action secondary disabled={busy} onClick={() => session.saveDraft({ id: place.draftId, kind: 'offer', taskId: task.id, fields: Object.fromEntries(OFFER_FIELDS.filter(k => draft[k]).map(k => [k, draft[k]])) }, d => keepDraft(d.id))}>Enregistrer le brouillon</Action></div>}
    {(can.isOwner || can.isBrigadier) && <Pieces task={task} actorId={actorId} files={files[task.id]} busy={busy}/>}
    {can.canReport && <Action secondary disabled={busy} onClick={() => go('report')}>Signaler un désaccord</Action>}
    {task.reports.map((r, i) => <div className="bubble" key={i}><span className="strong">Signalement de {r.actor.name}</span><span>{r.text}</span><span className="note">En attente d’examen manuel · {date(r.at)}</span></div>)}
    <Action secondary onClick={() => setShowHistory(!showHistory)}>{showHistory ? 'Masquer l’historique' : 'Voir l’historique conservé'}</Action>
    {showHistory && task.history.map((h, i) => <div key={i} className="history"><p>{h.text}</p><span className="note">{date(h.at)}</span></div>)}</>;
}
