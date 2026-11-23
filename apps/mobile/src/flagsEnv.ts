import { ENVIRONNEMENTS } from '../../../packages/shared/src/flags.ts';
import type { Environnement } from '../../../packages/shared/src/flags.ts';

// Environnement des feature flags de l’app mobile : la colonne lue dans flemme_v2.feature_flags.
// Fixé au build par EXPO_PUBLIC_FLEMME_ENV (profils de eas.json). Sans valeur reconnue :
// démonstration locale = « local » ; mode connecté = « prod », le réglage le plus prudent
// (refonte et confiance éteintes par défaut en prod, voir packages/shared/src/flags.ts).
export function environnementMobile(valeur: string | undefined, connecte: boolean): Environnement {
  const v = (valeur || '').trim().toLowerCase();
  if ((ENVIRONNEMENTS as readonly string[]).includes(v)) return v as Environnement;
  return connecte ? 'prod' : 'local';
}
