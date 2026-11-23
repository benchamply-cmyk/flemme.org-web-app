import { useSyncExternalStore } from 'react';
import { espaceStore } from './storage';

// Mon espace (refonte v2.1.0) côté mobile : discussions lues et alertes de demandes, gardées sur ce téléphone
// (même rôle que le stockage du navigateur dans apps/web/src/ecrans/Espace.tsx). Rien n’est envoyé au serveur.
import type { Alerte } from './espaceRegles';
export * from './espaceRegles';
type Etat = { lus: Record<string, string>; alertes: Alerte[] };

let etat: Etat = { lus: {}, alertes: [] };
const abonnes = new Set<() => void>();
const publier = (next: Etat) => { etat = next; abonnes.forEach(f => f()); void espaceStore.set(JSON.stringify(etat)).catch(() => {}); };

/** Lecture au démarrage. Un fichier illisible est ignoré : ce ne sont que des repères d’affichage. */
export async function chargerEspace() {
  try {
    const v = JSON.parse((await espaceStore.get()) || 'null');
    if (v && typeof v === 'object') etat = { lus: v.lus && typeof v.lus === 'object' ? v.lus : {}, alertes: Array.isArray(v.alertes) ? v.alertes : [] };
  } catch { /* on garde l’état vide */ }
  abonnes.forEach(f => f());
}
const abonner = (f: () => void) => { abonnes.add(f); return () => { abonnes.delete(f); }; };
export const useEspace = () => useSyncExternalStore(abonner, () => etat);

export const marquerLu = (offerId: string) => publier({ ...etat, lus: { ...etat.lus, [offerId]: new Date().toISOString() } });
export const enregistrerAlertes = (alertes: Alerte[]) => publier({ ...etat, alertes: alertes.slice(-5) });

