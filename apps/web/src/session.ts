import { useSyncExternalStore } from 'react';
import { FlemmeSession } from '../../../packages/shared/src/index.ts';
import { readDemo, tokens, writeDemo } from './storage.ts';
import { readLinkReturn } from './authLinks.ts';
import { supabaseConfigProblem } from './supabaseConfig.ts';

// Une seule session pour la page app.html. La logique (verrou, idempotence, erreurs) vient de packages/shared.
const url = import.meta.env.VITE_SUPABASE_URL || '', key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export const session = new FlemmeSession({
  url, key, tokens, readDemo: () => readDemo(), writeDemo: s => writeDemo(s),
  configProblem: supabaseConfigProblem(url, key),
  // Retour d’un lien e-mail (confirmation d’inscription ou mot de passe oublié), propre au navigateur.
  onStart: async g => {
    const link = readLinkReturn(location.search, location.hash);
    if (!link) return { signedIn: false };
    history.replaceState(history.state, '', location.pathname); // Le code ne sert qu’une fois : on le retire de l’adresse.
    if ('error' in link) return { signedIn: false, error: link.error };
    await g.exchangeCode(link.code, link.verifier);
    return { signedIn: true, recovering: link.purpose === 'recovery', notice: link.purpose === 'signup' ? 'Adresse confirmée. Bienvenue !' : undefined };
  },
});
export const useSession = () => useSyncExternalStore(session.subscribe, session.getState);
