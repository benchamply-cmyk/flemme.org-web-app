import { useSyncExternalStore } from 'react';
import { FlemmeSession } from '../../../packages/shared/src/index.ts';
import { readDemo, tokens, writeDemo } from './storage';

// Une seule session pour l’app. La logique (verrou, idempotence, erreurs) vient de packages/shared.
export const session = new FlemmeSession({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
  tokens, readDemo, writeDemo,
});
export const useSession = () => useSyncExternalStore(session.subscribe, session.getState);
