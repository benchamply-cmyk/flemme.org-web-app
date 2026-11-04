import { session } from '../session.ts';
import { Action } from '../ui.tsx';
import type { Ctx } from './contexte.ts';

// Arrivée par un lien « mot de passe oublié » (ou compte repris de l’ancien espace sans mot de passe).
export function MotDePasse({ state: { busy }, draft, field, clearDraft }: Ctx) {
  return <><h1 className="heading">Choisis ton mot de passe</h1><p>Il te servira à te connecter avec ton adresse e-mail, sur le site comme dans l’app.</p>
    {field('Nouveau mot de passe', 'password', { secret: true })}
    <Action disabled={busy} onClick={() => session.setPassword(draft.password || '', () => clearDraft())}>Enregistrer mon mot de passe</Action>
    <Action secondary disabled={busy} onClick={() => { session.skipRecovery(); clearDraft(); }}>Plus tard</Action></>;
}
