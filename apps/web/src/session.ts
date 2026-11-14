import { useSyncExternalStore } from 'react';
import { FlemmeSession, RemoteGateway, lireAdresse, paymentReturn } from '../../../packages/shared/src/index.ts';
import { readDemo, tokens, writeDemo } from './storage.ts';
import { readLinkReturn } from './authLinks.ts';
import { supabaseConfigProblem } from './supabaseConfig.ts';

// Une seule session pour la page app.html. La logique (verrou, idempotence, erreurs) vient de packages/shared.
// Adresse d’arrivée lue avant que l’app ne la remplace par l’adresse de l’écran (src/App.tsx).
const arrivee = { search: location.search, hash: location.hash, paiement: lireAdresse(location.pathname, location.search, location.hash)?.paiement };
const url = import.meta.env.VITE_SUPABASE_URL || '', key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export const session = new FlemmeSession({
  url, key, tokens, readDemo: () => readDemo(), writeDemo: s => writeDemo(s),
  configProblem: supabaseConfigProblem(url, key),
  // Retour d’un lien e-mail (confirmation d’inscription ou mot de passe oublié), propre au navigateur.
  onStart: async g => {
    const link = readLinkReturn(arrivee.search, arrivee.hash);
    // Retour de Stripe Checkout : /paiement/ok, /paiement/annule (anciennement app.html#paiement-ok, #paiement-annule).
    if (!link) return { signedIn: false, notice: (arrivee.paiement && paymentReturn('#paiement-' + arrivee.paiement)) || undefined };
    // Le code ne sert qu’une fois : il ne doit pas rester dans l’adresse (l’app l’a déjà remplacée par celle de l’écran).
    if (/[?&#](code|error)=/.test(location.search + location.hash)) history.replaceState(history.state, '', location.pathname);
    if ('error' in link) return { signedIn: false, error: link.error };
    await g.exchangeCode(link.code, link.verifier);
    return { signedIn: true, recovering: link.purpose === 'recovery', notice: link.purpose === 'signup' ? 'Adresse confirmée. Bienvenue !' : undefined };
  },
});
// Paiement en ligne Stripe Connect : désactivé tant que VITE_PAIEMENT_EN_LIGNE n'est pas « oui »
// (migration de paiement et fonctions Edge déployées, clés de test Stripe en place). Sinon : paiement direct déclaratif.
export const onlinePayment = !!(url || key) && import.meta.env.VITE_PAIEMENT_EN_LIGNE === 'oui';
/** Ouvre la page Stripe (paiement d’une flemme terminée ou activation des paiements du Brigadier). */
export const openStripe = (kind: 'onboarding' | 'checkout', taskId?: string) => session.execute(async () => {
  const g = session.getState().gateway;
  if (!(g instanceof RemoteGateway)) throw new Error('Paiement en ligne indisponible en démonstration.');
  location.assign(await g.paymentLink(kind, taskId));
});
export const useSession = () => useSyncExternalStore(session.subscribe, session.getState);
