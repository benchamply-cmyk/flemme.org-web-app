import type { ReactNode } from 'react';
import type { Command, Input, Offer, Screen, SessionState, Tab, Task, rights } from '../../../../packages/shared/src/index.ts';

// depth : nombre d’écrans empilés dans l’app depuis l’arrivée, pour que Retour ne quitte jamais l’app par erreur.
export type Place = { screen: Screen; tab: Tab; taskId: string; offerId: string; depth: number };
export type Draft = Record<string, string>;
export type FieldOptions = { multiline?: boolean; numeric?: boolean; secret?: boolean };

/** Ce que App.tsx fournit à chaque écran. */
export type Ctx = {
  state: SessionState; place: Place; draft: Draft;
  task?: Task; offer?: Offer; can: ReturnType<typeof rights>;
  field: (label: string, name: string, options?: FieldOptions) => ReactNode;
  go: (screen: Screen, change?: Partial<Place>, replace?: boolean) => void;
  mutate: (action: Command | 'create', data: Input, next?: Screen, message?: string) => Promise<void>;
  validated: (fn: () => void) => void;
  clearDraft: (names?: string[]) => void;
};
