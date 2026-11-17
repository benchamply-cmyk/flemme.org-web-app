// Brouillon de demande commencé sur la vitrine (page Déléguer), sans compte.
// Gardé dans ce navigateur (localStorage : le lien de confirmation d’inscription s’ouvre souvent dans un nouvel onglet),
// puis repris une seule fois par le formulaire de l’app (/deleguer/nouvelle, src/ecrans/NouvelleFlemme.tsx) après connexion.
// Aucun envoi au serveur avant que la personne connectée clique « Envoyer ma demande ».
export const CLE_BROUILLON = 'flemme.brouillon-deleguer';
export const CHAMPS_BROUILLON = ['details', 'category', 'mode', 'place', 'deadline', 'budgetRange', 'formule'] as const;
export type Brouillon = Partial<Record<typeof CHAMPS_BROUILLON[number], string>>;

/** Ne garde que les champs connus, en texte court (la description jusqu’à 1000 caractères, comme le formulaire). */
export function nettoyer(v: unknown): Brouillon {
  if (!v || typeof v !== 'object') return {};
  const o = v as Record<string, unknown>;
  return Object.fromEntries(CHAMPS_BROUILLON.filter(k => typeof o[k] === 'string' && (o[k] as string).trim())
    .map(k => [k, (o[k] as string).trim().slice(0, k === 'details' ? 1000 : 100)]));
}
export function lireBrouillon(store: Pick<Storage, 'getItem'> = localStorage): Brouillon {
  try { return nettoyer(JSON.parse(store.getItem(CLE_BROUILLON) || '{}')); } catch { return {}; }
}
export function ecrireBrouillon(b: Brouillon, store: Pick<Storage, 'setItem' | 'removeItem'> = localStorage) {
  try { const p = nettoyer(b); if (Object.keys(p).length) store.setItem(CLE_BROUILLON, JSON.stringify(p)); else store.removeItem(CLE_BROUILLON); } catch { /* stockage bloqué */ }
}
/** Lit le brouillon et l’efface : il ne sert qu’une fois. */
export function reprendreBrouillon(store: Pick<Storage, 'getItem' | 'removeItem'> = localStorage): Brouillon {
  const b = lireBrouillon(store);
  try { store.removeItem(CLE_BROUILLON); } catch { /* stockage bloqué */ }
  return b;
}
