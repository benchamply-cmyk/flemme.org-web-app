import type React from 'react';
import type { Command, Input, Offer, Option, Screen, SessionState, Tab, Task, rights } from '../../../../packages/shared/src/index.ts';

// Où l’on se trouve dans l’app. Même forme que apps/web/src/ecrans/contexte.ts (Place), sans historique navigateur :
// App.tsx garde une pile de Place, le bouton Retour (et Retour Android) dépile.
// draftId : brouillon repris (demande ou proposition). userId : profil public ouvert (absent = le sien).
// recherche : ouvre « Flemmes à résoudre » avec la barre de recherche active et les filtres dépliés (loupe de l’en-tête).
// categorie : filtre de « Flemmes à résoudre » reçu par un lien (flemme-mobile://flemmes?categorie=maison).
export type Place = { screen: Screen; tab: Tab; taskId: string; offerId: string; draftId?: string; userId?: string; recherche?: boolean; categorie?: string };
export type Draft = Record<string, string>;
export type FieldOptions = { multiline?: boolean; numeric?: boolean; secret?: boolean; hint?: string; max?: number; onMint?: boolean };

/** Ce que App.tsx fournit à chaque écran. */
export type Ctx = {
  state: SessionState; place: Place; draft: Draft;
  task?: Task; offer?: Offer; can: ReturnType<typeof rights>;
  field: (label: string, name: string, options?: FieldOptions) => React.ReactNode;
  /** Choix parmi des pastilles ; `empty` ajoute un premier choix vide (« À discuter »…). */
  choice: (label: string, name: string, options: readonly Option[], empty?: string) => React.ReactNode;
  go: (screen: Screen, change?: Partial<Place>) => void;
  back: () => void;
  mutate: (action: Command | 'create', data: Input, next?: Screen, message?: string | ((task: Task) => string)) => Promise<void>;
  validated: (fn: () => void) => void;
  clearDraft: (names?: string[]) => void;
  /** Remplace des valeurs du formulaire en cours. */
  fill: (values: Draft) => void;
  /** Retient le brouillon enregistré pour cet écran, sans recharger le formulaire. */
  keepDraft: (id: string) => void;
};
