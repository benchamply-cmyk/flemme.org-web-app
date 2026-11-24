import { session } from '../session.ts';
import { prepareLink } from '../authLinks.ts';
import { Action } from '../ui.tsx';
import type { Ctx } from './contexte.ts';

export function Connexion({ state: { gateway, busy }, place, draft, field, clearDraft }: Ctx) {
  const email = draft.email || '', password = draft.password || '';
  const forgetPassword = () => clearDraft(['password']);
  // Le motif de connexion suit le bouton choisi sur la vitrine ; après connexion, l’app reprend sur cet écran.
  const motif = place.screen === 'new' ? 'Connectez-vous ou créez votre compte pour envoyer votre demande' : place.tab === 'find' && place.screen === 'list' ? 'Connectez-vous pour voir les demandes et proposer votre aide' : '';
  // /mon-espace déconnecté : la page « Mon espace » (ancienne espace-connecte.html) s’ouvre sur la connexion.
  return <>{motif ? <h1 className="heading">{motif}</h1> : <><h1 className="heading">Mon espace</h1><p className="muted">Retrouvez vos demandes et vos propositions.</p></>}<p>Un seul compte pour déléguer une tâche et proposer votre aide. Vous revenez ensuite directement là où vous en étiez.</p>
    <p className="note">Déjà inscrit sur l’ancien espace FLEMME ? Utilisez la même adresse e-mail. Si vous vous connectiez par lien e-mail, Google ou Apple, choisissez « Mot de passe oublié ? » pour créer votre mot de passe.</p>
    {field('E-mail', 'email')}{field('Mot de passe', 'password', { secret: true })}
    <Action disabled={busy || !gateway} onClick={() => session.login(email, password, () => clearDraft())}>Me connecter</Action>
    <Action secondary disabled={busy || !gateway} onClick={() => session.signup(email, password, forgetPassword, { link: () => prepareLink('signup'), notice: 'Vérifiez votre e-mail et ouvrez le lien dans ce navigateur.' })}>Créer un compte</Action>
    <Action secondary disabled={busy || !gateway} onClick={() => session.recover(email, () => prepareLink('recovery'), forgetPassword)}>Mot de passe oublié ?</Action>
    {!gateway && <Action secondary onClick={() => session.initialize()}>Réessayer</Action>}</>;
}
