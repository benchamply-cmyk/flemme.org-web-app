import type React from 'react';
import type { Command, Input, Offer, Screen, SessionState, Tab, Task, rights } from '../../../../packages/shared/src/index.ts';

export type Draft = Record<string, string>;
export type FieldOptions = { multiline?: boolean; numeric?: boolean; secret?: boolean };

/** Ce que App.tsx fournit à chaque écran. Même contrat que apps/web/src/ecrans/contexte.ts, sans historique navigateur. */
export type Ctx = {
  state: SessionState; screen: Screen; tab: Tab; offerId: string; draft: Draft;
  task?: Task; offer?: Offer; can: ReturnType<typeof rights>;
  field: (label: string, name: string, options?: FieldOptions) => React.ReactNode;
  navigate: (next: Screen) => void;
  openList: (tab: Tab) => void; openTask: (task: Task) => void; openOffer: (offer: Offer) => void;
  mutate: (action: Command | 'create', data: Input, next?: Screen, message?: string) => Promise<void>;
  validated: (fn: () => void) => void;
  clearDraft: (names?: string[]) => void;
  resetSelection: () => void;
};
