import type { SearchFilter } from '../../../../packages/shared/src/index.ts';

// La recherche se fait dans l’app (catalogue, /flemmes) : la vitrine lui passe les mots et filtres choisis.
// Lu une seule fois par l’écran Résoudre (src/ecrans/Listes.tsx).
export const CLE_FILTRE = 'flemme.filtre';
export function ouvrirCatalogue(filtre: SearchFilter) {
  const propre = Object.fromEntries(Object.entries(filtre).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, (v as string).trim().slice(0, 100)]));
  try { if (Object.keys(propre).length) sessionStorage.setItem(CLE_FILTRE, JSON.stringify(propre)); else sessionStorage.removeItem(CLE_FILTRE); } catch { /* stockage bloqué : le catalogue s’ouvre sans filtre */ }
  location.href = '/flemmes';
}
