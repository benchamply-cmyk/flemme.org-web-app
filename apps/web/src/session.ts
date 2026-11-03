import { useSyncExternalStore } from 'react';
import { FlemmeSession } from '../../../packages/shared/src/index.ts';
import { readDemo, tokens, writeDemo } from './storage.ts';

// Une seule session pour la page app.html. La logique (verrou, idempotence, erreurs) vient de packages/shared.
export const session = new FlemmeSession({
  url: import.meta.env.VITE_SUPABASE_URL || '',
  key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
  tokens, readDemo: () => readDemo(), writeDemo: s => writeDemo(s),
});
export const useSession = () => useSyncExternalStore(session.subscribe, session.getState);
