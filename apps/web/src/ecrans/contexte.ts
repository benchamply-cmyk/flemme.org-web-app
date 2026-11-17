import type { ReactNode } from 'react';
import type { Command, Formule, Input, Offer, Option, Screen, SessionState, Tab, Task, rights } from '../../../../packages/shared/src/index.ts';

// depth : nombre d’écrans empilés dans l’app depuis l’arrivée, pour que Retour ne quitte jamais l’app par erreur.
// draftId : brouillon de demande repris dans le formulaire (écran « new »).
// userId : profil public ouvert (écran « profile » ; absent = le sien).
// formule, categorie : formulaire « autre » ou « devis », filtre de la liste des flemmes (lus dans l’adresse).
export type Place = { screen: Screen; tab: Tab; taskId: string; offerId: string; depth: number; draftId?: string; userId?: string; formule?: Formule; categorie?: string };
export type Draft = Record<string, string>;
export type FieldOptions = { multiline?: boolean; numeric?: boolean; secret?: boolean; max?: number; hint?: string };

/** Ce que App.tsx fournit à chaque écran. */
export type Ctx = {
  state: SessionState; place: Place; draft: Draft;
  task?: Task; offer?: Offer; can: ReturnType<typeof rights>;
  field: (label: string, name: string, options?: FieldOptions) => ReactNode;
  /** Liste déroulante ; `empty` ajoute un premier choix vide (« Toutes », « À discuter »…). */
  choice: (label: string, name: string, options: readonly Option[], empty?: string) => ReactNode;
  go: (screen: Screen, change?: Partial<Place>, replace?: boolean) => void;
  mutate: (action: Command | 'create', data: Input, next?: Screen, message?: string | ((t: Task) => string)) => Promise<void>;
  validated: (fn: () => void) => void;
  clearDraft: (names?: string[]) => void;
  /** Remplace des valeurs du formulaire en cours (dictée, reprise…). */
  fill: (values: Draft) => void;
  /** Retient le brouillon enregistré pour cet écran, sans recharger le formulaire. */
  keepDraft: (id: string) => void;
};
