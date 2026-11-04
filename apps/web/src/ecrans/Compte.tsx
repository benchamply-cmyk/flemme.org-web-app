import { DemoGateway, demoActors } from '../../../../packages/shared/src/index.ts';
import { session } from '../session.ts';
import { Action } from '../ui.tsx';
import type { Ctx } from './contexte.ts';

export function Compte({ state: { gateway, busy, actorId }, draft, field, go, clearDraft }: Ctx) {
  if (!gateway) return null;
  const home = () => go('home', { taskId: '', offerId: '' });
  return <><h1 className="heading">Salut {gateway.actor.name}.</h1>{gateway instanceof DemoGateway
    ? <><p>Démonstration locale. Change de personnage pour tester les deux côtés d’une mission. Aucun échange entre appareils, aucun paiement réel.</p>
      {demoActors.map(a => <Action secondary key={a.id} disabled={busy} onClick={() => session.switchActor(a, home)}>{a.name}{a.id === actorId ? ' · actif' : ''}</Action>)}</>
    : <><p>Les comptes, annonces et discussions utilisent le service FLEMME configuré.</p>
      {field('Mon nom affiché', 'displayName')}
      <Action secondary disabled={busy} onClick={() => session.updateProfile(draft.displayName || '', () => clearDraft())}>Changer mon nom</Action>
      <Action secondary disabled={busy} onClick={() => session.logout(home)}>Me déconnecter</Action></>}</>;
}
