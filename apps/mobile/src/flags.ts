import { useSyncExternalStore } from 'react';
import { lireLignes, resoudreFlags } from '../../../packages/shared/src/flags.ts';
import type { CleFlag, EtatFlags, LigneFlag, ValeurFlag } from '../../../packages/shared/src/flags.ts';
import { environnementMobile } from './flagsEnv';

// Feature flags dans l’app mobile, comme apps/web/src/flags/runtime.ts :
// 1. le registre (packages/shared/src/flags.ts) s’applique tout de suite, rien n’attend le réseau ;
// 2. l’état réglé dans /admin › Fonctionnalités est lu dans Supabase (public.flemme_flags), au démarrage
//    et à chaque actualisation (au plus une fois par minute) ;
// 3. pas d’accès bêta vérifié sur mobile pour l’instant : un flag réglé sur « testeurs » reste éteint ici.
// Un flag masque de l’interface, il ne donne aucun droit : le serveur revérifie chaque action.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const cle = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
export const ENV = environnementMobile(process.env.EXPO_PUBLIC_FLEMME_ENV, !!(url && cle));

let lignes: LigneFlag[] | null = null;
let etat: EtatFlags = resoudreFlags(ENV, null, false);
let dernier = 0;
const abonnes = new Set<() => void>();

export async function chargerFlags(force = false) {
  if (!force && Date.now() - dernier < 60_000) return etat;
  dernier = Date.now();
  const lues = await lireLignes(url, cle, ENV);
  if (lues) lignes = lues;
  etat = resoudreFlags(ENV, lignes, false);
  abonnes.forEach(f => f());
  return etat;
}
const abonner = (f: () => void) => { abonnes.add(f); return () => { abonnes.delete(f); }; };
export const flagActif = (k: CleFlag) => etat[k].actif;
export function useFlag(k: CleFlag): ValeurFlag {
  return useSyncExternalStore(abonner, () => etat[k]);
}
