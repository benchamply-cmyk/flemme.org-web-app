import { session } from '../session.ts';
import { prepareLink } from '../authLinks.ts';
import { Action } from '../ui.tsx';
import type { Ctx } from './contexte.ts';

export function Connexion({ state: { gateway, busy }, place, draft, field, clearDraft }: Ctx) {
  const email = draft.email || '', password = draft.password || '';
  const forgetPassword = () => clearDraft(['password']);
  // Le motif de connexion suit le bouton choisi sur la vitrine ; après connexion, l’app reprend sur cet écran.
  const motif = place.screen === 'new' ? 'Connecte-toi ou crée ton compte pour envoyer ta demande' : place.tab === 'find' && place.screen === 'list' ? 'Connecte-toi pour voir les demandes et proposer ton aide' : '';
  // /mon-espace déconnecté : la page « Mon espace » (ancienne espace-connecte.html) s’ouvre sur la connexion.
  return <>{motif ? <h1 className="heading">{motif}</h1> : <><h1 className="heading">Mon espace</h1><p className="muted">Retrouve tes demandes et tes propositions.</p></>}<p>Un seul compte pour déléguer une tâche et proposer ton aide. Tu reviens ensuite directement là où tu en étais.</p>
    <p className="note">Déjà inscrit sur l’ancien espace FLEMME ? Utilise la même adresse e-mail. Si tu te connectais par lien e-mail, Google ou Apple, choisis « Mot de passe oublié ? » pour créer ton mot de passe.</p>
    {field('E-mail', 'email')}{field('Mot de passe', 'password', { secret: true })}
    <Action disabled={busy || !gateway} onClick={() => session.login(email, password, () => clearDraft())}>Me connecter</Action>
    <Action secondary disabled={busy || !gateway} onClick={() => session.signup(email, password, forgetPassword, { link: () => prepareLink('signup'), notice: 'Vérifie ton e-mail et ouvre le lien dans ce navigateur.' })}>Créer un compte</Action>
    <Action secondary disabled={busy || !gateway} onClick={() => session.recover(email, () => prepareLink('recovery'), forgetPassword)}>Mot de passe oublié ?</Action>
    {!gateway && <Action secondary onClick={() => session.initialize()}>Réessayer</Action>}</>;
}
