import { session } from '../session.ts';
import { prepareLink } from '../authLinks.ts';
import { Action } from '../ui.tsx';
import type { Ctx } from './contexte.ts';

export function Connexion({ state: { gateway, busy }, draft, field, clearDraft }: Ctx) {
  const email = draft.email || '', password = draft.password || '';
  const forgetPassword = () => clearDraft(['password']);
  return <><h1 className="heading">Un peu de flemme ?</h1><p>Connecte-toi pour déposer une tâche ou proposer ton aide.</p>
    <p className="note">Déjà inscrit sur l’ancien espace FLEMME ? Utilise la même adresse e-mail. Si tu te connectais par lien e-mail, Google ou Apple, choisis « Mot de passe oublié ? » pour créer ton mot de passe.</p>
    {field('E-mail', 'email')}{field('Mot de passe', 'password', { secret: true })}
    <Action disabled={busy || !gateway} onClick={() => session.login(email, password, () => clearDraft())}>Me connecter</Action>
    <Action secondary disabled={busy || !gateway} onClick={() => session.signup(email, password, forgetPassword, { link: () => prepareLink('signup'), notice: 'Vérifie ton e-mail et ouvre le lien dans ce navigateur.' })}>Créer un compte</Action>
    <Action secondary disabled={busy || !gateway} onClick={() => session.recover(email, () => prepareLink('recovery'), forgetPassword)}>Mot de passe oublié ?</Action>
    {!gateway && <Action secondary onClick={() => session.initialize()}>Réessayer</Action>}</>;
}
