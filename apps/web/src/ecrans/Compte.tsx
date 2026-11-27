import { useState } from 'react';
import { AccountAccess } from '../beta/AccountAccess.tsx';
import { DemoGateway, demoActors } from '../../../../packages/shared/src/index.ts';
import { onlinePayment, openStripe, session } from '../session.ts';
import { Abonnements } from './Abonnements.tsx';
import { Action } from '../ui.tsx';
import type { Ctx } from './contexte.ts';

export function Compte({ state: { gateway, busy, actorId }, go, draft, field, clearDraft }: Ctx) {
  const [suppression, setSuppression] = useState(false);
  if (!gateway) return null;
  const home = () => go('home', { taskId: '', offerId: '' });
  return <><AccountAccess gateway={gateway}/><h1 className="heading">Salut {gateway.actor.name}.</h1>{gateway instanceof DemoGateway
    ? <><p>Démonstration locale. Changez de personnage pour tester les deux côtés d’une mission. Aucun échange entre appareils, aucun paiement réel.</p>
      {demoActors.map(a => <Action secondary key={a.id} disabled={busy} onClick={() => session.switchActor(a, home)}>{a.name}{a.id === actorId ? ' · actif' : ''}</Action>)}
      <Action secondary disabled={busy} onClick={() => go('profile', { userId: undefined })}>Mon profil public</Action></>
    : <><p>Les comptes, annonces et discussions utilisent le service FLEMME configuré.</p>
      {onlinePayment && <><p className="note">Vous êtes Brigadier ? Activez vos paiements en ligne : Stripe vérifie votre identité et votre IBAN, puis verse votre part après chaque mission payée.</p><Action secondary disabled={busy} onClick={() => openStripe('onboarding')}>Recevoir mes paiements avec Stripe</Action></>}
      <Abonnements busy={busy}/>
      <Action secondary disabled={busy} onClick={() => go('profile', { userId: undefined })}>Mon profil public · nom, présentation, avis</Action>
      <Action secondary disabled={busy} onClick={() => session.logout(home)}>Me déconnecter</Action>
      {/* Suppression du compte (27/11/2026, demande de Ben) : migration 20261127140000, confirmation écrite « SUPPRIMER ». */}
      <h2 className="section-title">Supprimer mon compte et mes données</h2>
      {!suppression ? <Action secondary disabled={busy} onClick={() => setSuppression(true)}>Supprimer mon compte</Action>
        : <div className="carte-suppression"><p>La suppression est définitive. Elle efface votre compte, votre profil et sa photo, vos demandes et leurs brouillons, vos recherches enregistrées et vos demandes d’aide. Dans les échanges avec d’autres membres, votre nom est remplacé par «&#8239;Compte supprimé&#8239;». Les paiements déjà faits sont gardés le temps imposé par la loi.</p>
          {field('Écrivez SUPPRIMER pour confirmer', 'deleteConfirm')}
          <Action disabled={busy || (draft.deleteConfirm || '').trim() !== 'SUPPRIMER'} onClick={() => session.deleteAccount((draft.deleteConfirm || '').trim(), () => { clearDraft(); setSuppression(false); home(); })}>Supprimer définitivement</Action>
          <Action secondary disabled={busy} onClick={() => setSuppression(false)}>Annuler</Action></div>}</>}</>;
}
