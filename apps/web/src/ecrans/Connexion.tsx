import { session } from '../session.ts';
import { prepareLink } from '../authLinks.ts';
import { Action } from '../ui.tsx';
import type { Ctx } from './contexte.ts';

// Version bêta (27/11/2026, demande de Ben) : arrivée par /bientot/mon-espace (boutons S’inscrire, Créer mon compte,
// Se connecter de /bientot) ou mode pré-bêta allumé. Textes du compte bêta et astérisque sur l’environnement bêta.
export function Connexion({ state: { gateway, busy }, place, draft, field, clearDraft, beta = false }: Ctx & { beta?: boolean }) {
  const email = draft.email || '', password = draft.password || '';
  const forgetPassword = () => clearDraft(['password']);
  // Le motif de connexion suit le bouton choisi sur la vitrine ; après connexion, l’app reprend sur cet écran.
  const motif = place.screen === 'new' ? 'Connectez-vous ou créez votre compte pour envoyer votre demande' : place.tab === 'find' && place.screen === 'list' ? 'Connectez-vous pour voir les demandes et proposer votre aide' : '';
  const login = <Action disabled={busy || !gateway} onClick={() => session.login(email, password, () => clearDraft())}>Me connecter</Action>;
  const signup = <Action secondary={!beta} disabled={busy || !gateway} onClick={() => session.signup(email, password, forgetPassword, { link: () => prepareLink('signup'), notice: 'Vérifiez votre e-mail et ouvrez le lien dans ce navigateur.' })}>{beta ? 'Créer mon compte bêta' : 'Créer un compte'}</Action>;
  const recover = <Action secondary disabled={busy || !gateway} onClick={() => session.recover(email, () => prepareLink('recovery'), forgetPassword)}>Mot de passe oublié ?</Action>;
  const retry = !gateway && <Action secondary onClick={() => session.initialize()}>Réessayer</Action>;

  if (beta) return <div className="connexion-beta">
    <p className="eyebrow">Bêta · janvier 2027</p>
    <h1 className="heading">Votre compte bêta<span className="asterisque" aria-hidden="true">*</span></h1>
    <p className="muted">Créez votre compte pour rejoindre la bêta de Flemme, ou connectez-vous si vous en avez déjà un.</p>
    <p>Un seul compte pour déléguer et pour résoudre. Dès maintenant, préparez vos demandes et choisissez vos recherches : elles restent privées sur votre compte et vous attendent à l’ouverture.</p>
    {field('E-mail', 'email')}{field('Mot de passe', 'password', { secret: true, hint: 'Après la création, un lien de confirmation vous est envoyé par e-mail.' })}
    {signup}
    <Action secondary disabled={busy || !gateway} onClick={() => session.login(email, password, () => clearDraft())}>Me connecter</Action>
    {recover}{retry}
    <p className="note note-beta"><span aria-hidden="true">* </span>Environnement bêta&#8239;: rien n’est publié avant l’ouverture de la bêta en janvier 2027. Vos demandes et vos recherches restent visibles de vous seul, et aucun argent réel ne circule&#8239;: pendant la bêta, les missions se paient en crédits fondateurs, gratuits et jamais convertis en euros.</p>
    <p className="note">Déjà inscrit sur l’ancien site&#8239;? Utilisez la même adresse e-mail. Si vous n’avez pas encore de mot de passe, choisissez «&#8239;Mot de passe oublié&#8239;?&#8239;» pour en créer un.</p>
  </div>;

  // /mon-espace déconnecté : la page « Mon espace » (ancienne espace-connecte.html) s’ouvre sur la connexion.
  return <>{motif ? <h1 className="heading">{motif}</h1> : <><h1 className="heading">Mon espace</h1><p className="muted">Retrouvez vos demandes et vos propositions.</p></>}<p>Un seul compte pour déléguer une tâche et proposer votre aide. Vous revenez ensuite directement là où vous en étiez.</p>
    <p className="note">Déjà inscrit sur l’ancien site ? Utilisez la même adresse e-mail. Si vous n’avez pas encore de mot de passe, choisissez « Mot de passe oublié ? » pour en créer un.</p>
    {field('E-mail', 'email')}{field('Mot de passe', 'password', { secret: true })}
    {login}{signup}{recover}{retry}</>;
}
