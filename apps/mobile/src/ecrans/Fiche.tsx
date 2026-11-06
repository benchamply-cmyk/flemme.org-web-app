import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CONTRACT_FIELDS, OFFER_FIELDS, budgetText, canEdit, categoryLabel, contractStatusLabel, date, deadlineLabel, modeLabel, money, notices, offerInput, offerReviewLabel, offerStatus, parseMoney, paymentNote, paymentStatus, reviewInput, reviewLabel, signatureInput, stars, taskStatus } from '../../../../packages/shared/src/index.ts';
import { session } from '../session';
import { Action, Bill, Check } from '../ui/composants';
import { styles } from '../ui/styles';
import { Pieces } from './Pieces';
import type { Ctx } from './contexte';

// Fiche d’une demande : accord, accord écrit et signature, avis, paiement déclaratif, propositions,
// pièces jointes, signalements et historique. Même contenu que apps/web/src/ecrans/Fiche.tsx (sans Stripe).
export function Fiche({ state: { busy, actorId, files }, place, task, can, draft, field, go, mutate, validated, keepDraft }: Ctx) {
  const [showHistory, setShowHistory] = useState(false), [accept, setAccept] = useState(false), [rating, setRating] = useState(0);
  if (!task) return null;
  const { agreement, contract } = task;
  const preview = (() => { try { const n = parseMoney(draft.amount || ''); return n != null ? <Bill amount={n}/> : null; } catch { return null; } })();
  const review = can.isOwner && task.review && task.review !== 'published' ? task.review : null;
  // « Délai à discuter » se lit seul ; sinon « Délai : 3 jours ».
  const delai = task.deadline ? 'Délai : ' + deadlineLabel(task) : deadlineLabel(task);
  return <><Text style={styles.tag}>{taskStatus[task.status]}{task.status === 'open' ? ' · sans expiration' : ''}</Text><Text style={styles.heading}>{task.title}</Text>
    <Text style={styles.muted}>{[categoryLabel(task), task.place, modeLabel(task)].filter(Boolean).join(' · ')} · publiée par <Text style={styles.inlineLink} onPress={() => go('profile', { userId: task.owner.id })}>{task.owner.name}</Text></Text>
    {review && <View accessibilityRole="alert" style={review === 'changes_requested' || review === 'rejected' ? styles.error : styles.notice}><Text style={styles.strong}>{reviewLabel[review]}</Text>{!!task.reviewNote && <Text style={styles.body}>{task.reviewNote}</Text>}{review === 'pending' && <Text style={styles.note}>Personne d’autre ne la voit pour l’instant.</Text>}</View>}
    <Text style={styles.body}>{task.details}</Text>
    <Text style={styles.strong}>Budget indicatif : {budgetText(task, money)}{task.budget != null || task.budgetRange ? ' hors frais' : ''} · {delai}</Text>
    {!!task.address && <Text style={styles.note}><Text style={styles.strong}>Adresse précise (privée) : </Text>{task.address}</Text>}
    {canEdit(task, actorId) && <Action secondary disabled={busy} onPress={() => go('edit')}>{review === 'changes_requested' ? 'Corriger ma demande' : 'Modifier ma demande'}</Action>}
    {agreement && <><Text style={styles.sectionTitle}>{agreement.brigadier.name} prend le relais</Text><Text style={styles.body}>{agreement.scope}</Text><Text style={styles.muted}>{agreement.slot}</Text><Bill amount={agreement.amount} agreed={agreement}/>
      <Text style={styles.note}>{paymentNote(agreement, false, money)}</Text>
      {can.canComplete && <Action disabled={busy} onPress={() => mutate('complete', {})}>Confirmer la tâche terminée</Action>}
      {can.canDeclarePayment && <Action disabled={busy} onPress={() => mutate('declare_payment', {})}>J’ai payé le Brigadier</Action>}
      {can.canConfirmPayment && <Action disabled={busy} onPress={() => mutate('confirm_payment', {})}>Confirmer avoir reçu le paiement</Action>}
      <Text style={styles.muted}>{task.payment ? paymentStatus(task, money) : `${paymentStatus(task)}\nCommission : à régler · encaissement non connecté`}</Text>
      {(contract || can.canContract) && <><Text style={styles.sectionTitle}>Accord écrit</Text>
        {!contract ? <Text style={styles.muted}>Pas encore d’accord écrit. Rédigez-le ensemble : périmètre, résultat attendu, délai, annulation et confidentialité. Une fois commencé, il doit être signé par les deux avant la fin de la tâche.</Text>
          : <View style={styles.card}><Text style={styles.tag}>{contractStatusLabel[contract.status]}</Text>
            {!!contract.reviewNote && <View accessibilityRole="alert" style={contract.status === 'changes_requested' ? styles.error : styles.notice}><Text style={styles.body}>{contract.reviewNote}</Text></View>}
            {CONTRACT_FIELDS.map(c => <Text key={c.name} style={styles.body}><Text style={styles.strong}>{c.label} : </Text>{contract.terms[c.name]}</Text>)}
            <Text style={styles.note}>Déposant : {contract.ownerSignedAt ? `signé « ${contract.ownerSignature} » le ${date(contract.ownerSignedAt)}` : 'pas encore signé'}{'\n'}Brigadier : {contract.brigadierSignedAt ? `signé « ${contract.brigadierSignature} » le ${date(contract.brigadierSignedAt)}` : 'pas encore signé'}</Text></View>}
        {can.canContract && contract?.status !== 'signed' && <Action secondary disabled={busy} onPress={() => go('contract')}>{contract ? 'Modifier l’accord' : 'Rédiger l’accord'}</Action>}
        {can.canContract && (contract?.status === 'draft' || contract?.status === 'changes_requested') && <Action disabled={busy} onPress={() => mutate('agreement_submit', {}, 'detail', t => notices.contractSubmitted(t.contract?.status))}>Soumettre l’accord à l’équipe FLEMME</Action>}
        {can.canSign && <View style={[styles.card, styles.propose]}><Text style={[styles.sectionTitle, { marginTop: 0 }]}>Signer l’accord</Text><Text style={styles.note}>Signature électronique simple : ton nom et ton acceptation sont enregistrés et horodatés. Ce n’est pas une signature qualifiée.</Text>
          {field('Ton nom complet', 'signature', { max: 80, onMint: true })}
          <Check checked={accept} disabled={busy} onChange={setAccept}>J’ai lu l’accord et je l’accepte.</Check>
          <Action disabled={busy} onPress={() => validated(() => { void mutate('agreement_sign', signatureInput(draft.signature, accept), 'detail', notices.signed); })}>Signer l’accord</Action></View>}
        {can.isOwner && task.status === 'assigned' && contract && contract.status !== 'signed' && <Text style={styles.muted}>La fin de la tâche se confirme une fois l’accord signé par les deux.</Text>}</>}
      {task.myReview && <Text style={styles.note}>Ton avis : {stars(task.myReview.rating)}{task.myReview.text ? ' · ' + task.myReview.text : ''}</Text>}
      {can.canReview && <View style={[styles.card, styles.propose]}><Text style={[styles.sectionTitle, { marginTop: 0 }]}>Donner mon avis</Text>
        <Text style={styles.muted}>Ton avis apparaît sur le profil de {can.isOwner ? agreement.brigadier.name : task.owner.name}.</Text>
        <View style={styles.field} accessibilityLabel="Note"><Text style={styles.label}>Note</Text><View style={[styles.row, { justifyContent: 'flex-start', gap: 6 }]}>
          {[1, 2, 3, 4, 5].map(n => <Pressable key={n} accessibilityRole="radio" accessibilityLabel={n + ' sur 5'} accessibilityState={{ checked: rating === n }} disabled={busy} onPress={() => setRating(n)} style={[styles.option, { minWidth: 48, alignItems: 'center' }, rating >= n && styles.optionSelected]}><Text style={[styles.strong, { fontSize: 20 }]}>{rating >= n ? '★' : '☆'}</Text></Pressable>)}
        </View>{rating > 0 && <Text style={styles.note}>{rating}/5</Text>}</View>
        {field('Commentaire (facultatif)', 'reviewText', { multiline: true, max: 600, onMint: true })}
        <Action disabled={busy} onPress={() => validated(() => { void mutate('review', reviewInput(rating ? String(rating) : '', draft.reviewText), 'detail', notices.reviewSent); })}>Publier mon avis</Action></View>}</>}
    {task.offers.length > 0 && <><Text style={styles.sectionTitle}>{can.isOwner ? 'Les propositions' : 'Mes propositions'}</Text>
      {task.offers.map(o => <Pressable key={o.id} accessibilityRole="button" onPress={() => go('offer', { offerId: o.id })} style={styles.card}><View style={styles.row}><Text style={styles.strong}>{o.brigadier.name}</Text><Text style={styles.price}>{money(o.amount)}</Text></View><Text style={styles.body}>{o.scope}</Text>{!!o.result && <Text style={styles.note}>Résultat promis : {o.result}</Text>}<Text style={styles.muted}>{offerStatus[o.status]}{o.review && o.review !== 'approved' ? ' · ' + offerReviewLabel[o.review] : ''}</Text><Text style={styles.link}>Discussion et récapitulatif →</Text></Pressable>)}</>}
    {can.canOffer && <View style={[styles.card, styles.propose]}><Text style={[styles.sectionTitle, { marginTop: 0 }]}>{place.draftId ? 'Reprendre ma proposition' : 'Tu peux t’en charger ?'}</Text><Text style={styles.muted}>Indique ton prix et précise ce que tu proposes.</Text>
      {field('Mon forfait Brigadier', 'amount', { numeric: true, onMint: true })}{preview}{field('Mes disponibilités', 'slot', { onMint: true })}{field('Ce qui est inclus et non inclus', 'scope', { multiline: true, onMint: true })}
      {field('Résultat promis (facultatif)', 'result', { multiline: true, onMint: true, hint: 'Ce que la personne aura à la fin. Ex. : étagère fixée et de niveau.' })}
      <Text style={styles.note}>L’équipe FLEMME relit chaque proposition avant de la transmettre à la personne qui a publié la demande.</Text>
      <Action disabled={busy} onPress={() => validated(() => { void mutate('apply', { ...offerInput(draft), draftId: place.draftId || null }, 'detail', t => notices.applied(t.offers.find(o => o.brigadier.id === actorId && o.status === 'pending'))); })}>Envoyer ma proposition</Action>
      <Action secondary disabled={busy} onPress={() => session.saveDraft({ id: place.draftId, kind: 'offer', taskId: task.id, fields: Object.fromEntries(OFFER_FIELDS.filter(k => draft[k]).map(k => [k, draft[k]])) }, d => keepDraft(d.id))}>Enregistrer le brouillon</Action></View>}
    {(can.isOwner || can.isBrigadier) && <Pieces task={task} actorId={actorId} files={files[task.id]} busy={busy}/>}
    {can.canReport && <Action secondary disabled={busy} onPress={() => go('report')}>Signaler un désaccord</Action>}
    {task.reports.map((r, i) => <View style={styles.bubble} key={i}><Text style={styles.strong}>Signalement de {r.actor.name}</Text><Text style={styles.body}>{r.text}</Text><Text style={styles.note}>En attente d’examen manuel · {date(r.at)}</Text></View>)}
    <Action secondary onPress={() => setShowHistory(!showHistory)}>{showHistory ? 'Masquer l’historique' : 'Voir l’historique conservé'}</Action>
    {showHistory && task.history.map((h, i) => <View key={i} style={styles.history}><Text style={styles.body}>{h.text}</Text><Text style={styles.note}>{date(h.at)}</Text></View>)}</>;
}
