import { session } from '../session.ts';
import { Action } from '../ui.tsx';
import type { Ctx } from './contexte.ts';

export function Connexion({ state: { gateway, busy }, draft, field, clearDraft }: Ctx) {
  return <><h1 className="heading">Un peu de flemme ?</h1><p>Connecte-toi pour déposer une tâche ou proposer ton aide.</p>
    {field('E-mail', 'email')}{field('Mot de passe', 'password', { secret: true })}
    <Action disabled={busy || !gateway} onClick={() => session.login(draft.email || '', draft.password || '', () => clearDraft())}>Me connecter</Action>
    <Action secondary disabled={busy || !gateway} onClick={() => session.signup(draft.email || '', draft.password || '', () => clearDraft(['password']))}>Créer un compte</Action>
    {!gateway && <Action secondary onClick={() => session.initialize()}>Réessayer</Action>}</>;
}
