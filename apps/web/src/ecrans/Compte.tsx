import { AccountAccess } from '../beta/AccountAccess.tsx';
import { DemoGateway, demoActors } from '../../../../packages/shared/src/index.ts';
import { onlinePayment, openStripe, session } from '../session.ts';
import { Action } from '../ui.tsx';
import type { Ctx } from './contexte.ts';

export function Compte({ state: { gateway, busy, actorId }, go }: Ctx) {
  if (!gateway) return null;
  const home = () => go('home', { taskId: '', offerId: '' });
  return <><AccountAccess gateway={gateway}/><h1 className="heading">Salut {gateway.actor.name}.</h1>{gateway instanceof DemoGateway
    ? <><p>Démonstration locale. Change de personnage pour tester les deux côtés d’une mission. Aucun échange entre appareils, aucun paiement réel.</p>
      {demoActors.map(a => <Action secondary key={a.id} disabled={busy} onClick={() => session.switchActor(a, home)}>{a.name}{a.id === actorId ? ' · actif' : ''}</Action>)}
      <Action secondary disabled={busy} onClick={() => go('profile', { userId: undefined })}>Mon profil public</Action></>
    : <><p>Les comptes, annonces et discussions utilisent le service FLEMME configuré.</p>
      {onlinePayment && <><p className="note">Brigadier ? Active tes paiements en ligne : Stripe vérifie ton identité et ton IBAN, puis verse ta part après chaque mission payée.</p><Action secondary disabled={busy} onClick={() => openStripe('onboarding')}>Recevoir mes paiements avec Stripe</Action></>}
      <Action secondary disabled={busy} onClick={() => go('profile', { userId: undefined })}>Mon profil public · nom, présentation, avis</Action>
      <Action secondary disabled={busy} onClick={() => session.logout(home)}>Me déconnecter</Action></>}</>;
}
