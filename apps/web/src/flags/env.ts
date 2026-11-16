// Environnement des feature flags, fixé au build par vite.config.ts (__FLEMME_ENV__) : la colonne lue dans flemme_v2.feature_flags.
import type { Environnement } from '../../../../packages/shared/src/flags.ts';
declare const __FLEMME_ENV__: Environnement;
export const ENV: Environnement = typeof __FLEMME_ENV__ === 'string' ? __FLEMME_ENV__ : 'local';
