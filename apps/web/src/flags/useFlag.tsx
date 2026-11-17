// Hook React des feature flags pour l'app (Mon espace) : l'écran se redessine quand un flag change.
import { useSyncExternalStore } from 'react';
import type { CleFlag, ValeurFlag } from '../../../../packages/shared/src/flags.ts';
import { flags } from './runtime.ts';

const abonner = (f: () => void) => { addEventListener('flemme-flags', f); return () => removeEventListener('flemme-flags', f); };

export function useFlag(cle: CleFlag): ValeurFlag {
  return useSyncExternalStore(abonner, () => flags()[cle]);
}

/** Écran affiché à la place d'une fonctionnalité éteinte. */
export function BientotDisponible({ titre }: { titre: string }) {
  return <div className="card" role="status" data-flag-bientot>
    <p className="card-title">{titre}</p>
    <p className="muted">Bientôt disponible. Cette fonctionnalité est en préparation : reviens un peu plus tard, ou écris-nous depuis la page Contact.</p>
    <a className="btn secondary" href="contact.html">Nous contacter</a>
  </div>;
}
