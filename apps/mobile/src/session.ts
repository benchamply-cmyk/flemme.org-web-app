import { useSyncExternalStore } from 'react';
import { FlemmeSession } from '../../../packages/shared/src/index.ts';
import { readDemo, tokens, writeDemo } from './storage';
import { onStart } from './liens';

// Une seule session pour l’app. La logique (verrou, idempotence, erreurs) vient de packages/shared.
// onStart : retour d’un lien e-mail (mot de passe oublié, confirmation), voir liens.ts.
export const session = new FlemmeSession({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
  tokens, readDemo, writeDemo, onStart,
});
export const useSession = () => useSyncExternalStore(session.subscribe, session.getState);
