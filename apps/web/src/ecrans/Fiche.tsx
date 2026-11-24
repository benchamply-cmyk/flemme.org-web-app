import { useState } from 'react';
import { AVIS_MASQUAGE, AVIS_QUESTIONS, CONTRACT_FIELDS, DELAI_LIBERATION_JOURS, OFFER_FIELDS, liberationPossibleLe, PAIEMENT_OBLIGATOIRE, RAPPEL_CONTOURNEMENT, etapeArgent, etapeArgentLabel, budgetText, canEdit, categoryLabel, contractStatusLabel, date, deadlineLabel, modeLabel, money, notices, offerInput, offerReviewLabel, offerStatus, parseMoney, paymentNote, paymentStatus, reviewInput, reviewLabel, signatureInput, stars, taskStatus } from '../../../../packages/shared/src/index.ts';
import { onlinePayment, openStripe, payoutStripe, session } from '../session.ts';
import { Action, Bill, Recap } from '../ui.tsx';
import { Pieces } from './Pieces.tsx';
import { useFlag } from '../flags/useFlag.tsx';
import type { Ctx } from './contexte.ts';
import { ComparerOffres, Frise } from './Espace.tsx';

// Fiche d’une flemme : accord, paiement déclaratif, propositions, signalements et historique.
export function Fiche({ state: { busy, actorId, files }, place, task, can, draft, field, go, mutate, validated, keepDraft }: Ctx) {
  const [showHistory, setShowHistory] = useState(false), [accept, setAccept] = useState(false), [rating, setRating] = useState('');
  const refonte = useFlag('espace.refonte').actif;
  // Questions publiques et livraison (flag espace.confiance, migration 20261118140000).
  const confiance = useFlag('espace.confiance').actif;
  if (!task) return null;
  const questions = task.questions || [];
  const { agreement } = task;
  const preview = (() => { try { const n = parseMoney(draft.amount || ''); return n != null ? <Bill amount={n}/> : null; } catch { return null; } })();
  const review = can.isOwner && task.review && task.review !== 'published' ? task.review : null;
  return <><span className="tag">{taskStatus[task.status]}{task.status === 'open' ? ' · sans expiration' : ''}</span><h1 className="heading">{task.title}</h1><p className="muted">{[categoryLabel(task), task.place, modeLabel(task)].filter(Boolean).join(' · ')} · publiée par <button type="button" className="link" onClick={() => go('profile', { userId: task.owner.id })}>{task.owner.name}</button></p>
    {refonte && <Frise task={task}/>}
    {review && <div className={review === 'changes_requested' || review === 'rejected' ? 'alert' : 'notice'} role="status"><span className="strong">{reviewLabel[review]}</span>{task.reviewNote && <><br/>{task.reviewNote}</>}{review === 'pending' && <><br/>Personne d’autre ne la voit pour l’instant.</>}</div>}
    <p>{task.details}</p>
    <p className="strong">Budget indicatif : {budgetText(task, money)}{task.budget != null || task.budgetRange ? ' hors frais' : ''} · Délai : {deadlineLabel(task)}</p>
    {task.address && <p className="note"><span className="strong">Adresse précise (privée) : </span>{task.address}</p>}
    {canEdit(task, actorId) && <Action secondary disabled={busy} onClick={() => go('edit')}>{review === 'changes_requested' ? 'Corriger ma demande' : 'Modifier ma demande'}</Action>}
    {agreement && <><h2 className="section-title">{agreement.brigadier.name} prend le relais</h2><p>{agreement.scope}</p><p className="muted">{agreement.slot}</p><Bill amount={agreement.amount} agreed={agreement}/>
      <p className="note">{paymentNote(agreement, onlinePayment, money, can.viaFlemme, task.paymentMode !== 'stripe')}</p>
      {can.viaFlemme && <p className="muted">{etapeArgentLabel[etapeArgent(task)]}</p>}
      {can.canPay && <><p className="note">{PAIEMENT_OBLIGATOIRE}</p>{task.paymentMode === 'stripe'
        ? <Action disabled={busy} onClick={() => openStripe('checkout', task.id, 'signature')}>Payer par carte via Flemme · {money(agreement.total)}</Action>
        : <Action disabled={busy} onClick={() => mutate('pay', {}, 'detail', notices.paid)}>Payer via Flemme · {money(agreement.total)} (simulation)</Action>}</>}
      {can.canPayout && <Action secondary disabled={busy} onClick={() => payoutStripe(task.id)}>Verser la part du membre · {money(agreement.payout ?? agreement.amount)}</Action>}
      {confiance && task.deliveredAt && task.status === 'assigned' && <p className="note">Mission déclarée livrée le {date(task.deliveredAt)}. {can.isOwner
        ? `Vérifiez le résultat puis confirmez. Sans réponse ni désaccord signalé d’ici le ${date(liberationPossibleLe(task.deliveredAt)).split(' ')[0]}, le membre pourra clôturer et le paiement sera libéré.`
        : `Le déposant confirme, ou vous pourrez clôturer vous-même à partir du ${date(liberationPossibleLe(task.deliveredAt)).split(' ')[0]} si aucun désaccord n’est signalé.`}</p>}
      {confiance && can.canDeliver && <><p className="note">Mission terminée de votre côté ? Déclarez-la livrée : le déposant a {DELAI_LIBERATION_JOURS} jours pour confirmer ou signaler un désaccord.</p>
        <Action disabled={busy} onClick={() => mutate('deliver', {}, 'detail', 'Mission déclarée livrée. Le déposant est invité à confirmer.')}>J’ai terminé la mission</Action></>}
      {confiance && can.canRelease && <Action disabled={busy} onClick={() => mutate('complete', {}, 'detail', 'Mission clôturée : le paiement est libéré.')}>Clôturer la mission et libérer mon paiement</Action>}
      {can.canComplete && <Action disabled={busy} onClick={() => mutate('complete', {})}>{can.viaFlemme ? 'Mission terminée, je libère le paiement' : 'Confirmer la tâche terminée'}</Action>}
      {can.canDeclarePayment && onlinePayment && <Action disabled={busy} onClick={() => openStripe('checkout', task.id)}>Payer en ligne · {money(agreement.total)}</Action>}
      {can.canDeclarePayment && <Action secondary={onlinePayment} disabled={busy} onClick={() => mutate('declare_payment', {})}>J’ai payé le membre{onlinePayment ? ' en direct' : ''}</Action>}
      {can.canConfirmPayment && <Action disabled={busy} onClick={() => mutate('confirm_payment', {})}>Confirmer avoir reçu le paiement</Action>}
      <p className="muted">{task.payment || can.viaFlemme ? paymentStatus(task, money) : <>{paymentStatus(task)}<br/>Commission : à régler · encaissement non connecté</>}</p>
      {(task.contract || can.canContract) && <><h2 className="section-title">Accord écrit</h2>
        {!task.contract ? <p className="muted">Pas encore d’accord écrit. Rédigez-le ensemble : périmètre, résultat attendu, délai, annulation et confidentialité. Une fois commencé, il doit être signé par les deux avant la fin de la tâche.</p>
          : <><span className="tag">{contractStatusLabel[task.contract.status]}{task.contract.version ? ` · version ${task.contract.version}` : ''}</span>
            {task.contract.reviewNote && <div className={task.contract.status === 'changes_requested' ? 'alert' : 'notice'} role="status">{task.contract.reviewNote}</div>}
            {CONTRACT_FIELDS.filter(c => task.contract!.terms[c.name]).map(c => <p key={c.name}><span className="strong">{c.label} : </span>{task.contract!.terms[c.name]}</p>)}
            <p className="note">Déposant : {task.contract.ownerSignedAt ? `signé « ${task.contract.ownerSignature} » le ${date(task.contract.ownerSignedAt)}` : 'pas encore signé'}<br/>
              Membre qui aide : {task.contract.brigadierSignedAt ? `signé « ${task.contract.brigadierSignature} » le ${date(task.contract.brigadierSignedAt)}` : 'pas encore signé'}</p></>}
        {can.canContract && task.contract?.status !== 'signed' && <Action secondary disabled={busy} onClick={() => go('contract')}>{task.contract ? 'Modifier l’accord' : 'Rédiger l’accord'}</Action>}
        {can.canContract && (task.contract?.status === 'draft' || task.contract?.status === 'changes_requested') && <Action disabled={busy} onClick={() => mutate('agreement_submit', {}, 'detail', t => notices.contractSubmitted(t.contract?.status))}>Soumettre l’accord à l’équipe FLEMME</Action>}
        {can.canSign && <><Recap agreed={agreement} cancellation={task.contract?.terms.cancellation}/>
          {can.viaFlemme && <p className="note">En signant, le déposant s’engage à payer ces frais de plateforme et la mission via Flemme. {RAPPEL_CONTOURNEMENT}</p>}
          <p className="note">Signature électronique simple : votre nom et votre acceptation sont enregistrés et horodatés. Ce n’est pas une signature qualifiée.</p>
          {field('Votre nom complet', 'signature', { max: 80 })}
          <label className="check"><input type="checkbox" checked={accept} disabled={busy} onChange={e => setAccept(e.target.checked)}/> J’ai lu l’accord et je l’accepte.</label>
          <Action disabled={busy} onClick={() => validated(() => { void mutate('agreement_sign', signatureInput(draft.signature, accept), 'detail', notices.signed); })}>Signer l’accord</Action></>}
        {can.isOwner && task.status === 'assigned' && task.contract && task.contract.status !== 'signed' && <p className="muted">La fin de la tâche se confirme une fois l’accord signé par les deux.</p>}</>}
      {task.myReview && <p className="note">Votre avis : {stars(task.myReview.rating)}{task.myReview.text ? ' · ' + task.myReview.text : ''}</p>}
      {can.canReview && <><h2 className="section-title">Donner mon avis</h2>
        <div className="field"><label htmlFor="f-rating">Note</label><select id="f-rating" value={rating} disabled={busy} onChange={e => setRating(e.target.value)}><option value="">Choisir</option>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{stars(n)} · {n}/5</option>)}</select></div>
        {field('Commentaire (facultatif)', 'reviewText', { multiline: true, max: 600 })}
        <Action disabled={busy} onClick={() => validated(() => { void mutate('review', reviewInput(rating, draft.reviewText), 'detail', notices.reviewSent); })}>Publier mon avis</Action></>}</>}
    {confiance && (questions.length > 0 || can.canAsk) && <><h2 className="section-title">Questions publiques{questions.length ? ` (${questions.length})` : ''}</h2>
      <p className="note">{AVIS_QUESTIONS}</p>
      {questions.length === 0 && <p className="muted">Pas encore de question. Un détail à préciser avant de proposer ? Demandez-le ici.</p>}
      {questions.map(q => <div className="bubble" key={q.id}><span className="strong">{q.author.name}</span><span>{q.text}</span><span className="note">{date(q.at)}</span>
        {q.answer ? <><span className="strong">Réponse de {task.owner.name}</span><span>{q.answer}</span></>
          : can.isOwner && task.status === 'open' ? <>{field('Votre réponse publique', 'answer-' + q.id, { multiline: true, max: 1000 })}
            <Action secondary disabled={busy} onClick={() => validated(() => { void mutate('answer', { questionId: q.id, text: draft['answer-' + q.id] }, 'detail', 'Réponse publiée.'); })}>Répondre</Action></>
          : <span className="muted">En attente de réponse</span>}</div>)}
      {can.canAsk && <>{field('Votre question', 'question', { multiline: true, max: 600 })}
        <Action secondary disabled={busy} onClick={() => validated(() => { void mutate('ask', { text: draft.question }, 'detail', 'Question publiée.'); })}>Poser ma question</Action></>}</>}
    {refonte && can.isOwner && task.status === 'open' && <ComparerOffres task={task} go={go}/>}
    {task.offers.length > 0 && !(refonte && can.isOwner && task.status === 'open') && <><h2 className="section-title">{can.isOwner ? 'Les propositions' : 'Mes propositions'}</h2>
      {task.offers.map(o => <button type="button" key={o.id} onClick={() => go('offer', { offerId: o.id })} className="card"><span className="row"><span className="strong">{o.brigadier.name}</span><span className="price">{money(o.amount)}</span></span><span>{o.scope}</span>{o.result && <span className="note">Résultat promis : {o.result}</span>}<span className="muted">{offerStatus[o.status]}{o.review && o.review !== 'approved' ? ' · ' + offerReviewLabel[o.review] : ''}</span><span className="link">Discussion et récapitulatif →</span></button>)}</>}
    {can.canOffer && <div className="card propose"><h2 className="section-title" style={{ marginTop: 0 }}>{place.draftId ? 'Reprendre ma proposition' : 'Vous pouvez vous en charger ?'}</h2><p className="muted">Indiquez votre prix et précisez ce que vous proposez.</p>{field('Mon prix', 'amount', { numeric: true })}{preview}{field('Mes disponibilités', 'slot')}{field('Ce qui est inclus et non inclus', 'scope', { multiline: true })}
      {field('Résultat promis (facultatif)', 'result', { multiline: true, hint: 'Ce que la personne aura à la fin. Ex. : étagère fixée et de niveau.' })}
      <p className="note">L’équipe FLEMME relit chaque proposition avant de la transmettre à la personne qui a publié la demande. {AVIS_MASQUAGE}</p>
      <Action disabled={busy} onClick={() => validated(() => { void mutate('apply', { ...offerInput(draft), draftId: place.draftId || null }, 'detail', t => notices.applied(t.offers.find(o => o.brigadier.id === actorId && o.status === 'pending'))); })}>Envoyer ma proposition</Action>
      <Action secondary disabled={busy} onClick={() => session.saveDraft({ id: place.draftId, kind: 'offer', taskId: task.id, fields: Object.fromEntries(OFFER_FIELDS.filter(k => draft[k]).map(k => [k, draft[k]])) }, d => keepDraft(d.id))}>Enregistrer le brouillon</Action></div>}
    {(can.isOwner || can.isBrigadier) && <Pieces task={task} actorId={actorId} files={files[task.id]} busy={busy}/>}
    {can.canReport && <Action secondary disabled={busy} onClick={() => go('report')}>Signaler un désaccord</Action>}
    {task.reports.map((r, i) => <div className="bubble" key={i}><span className="strong">Signalement de {r.actor.name}</span><span>{r.text}</span><span className="note">En attente d’examen manuel · {date(r.at)}</span></div>)}
    <Action secondary onClick={() => setShowHistory(!showHistory)}>{showHistory ? 'Masquer l’historique' : 'Voir l’historique conservé'}</Action>
    {showHistory && task.history.map((h, i) => <div key={i} className="history"><p>{h.text}</p><span className="note">{date(h.at)}</span></div>)}</>;
}
