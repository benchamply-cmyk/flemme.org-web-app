// Feature flags côté navigateur : un seul lecteur pour la vitrine, l'app (Mon espace) et la page /beta.
// 1. Les valeurs par défaut du registre (packages/shared/src/flags.ts) s'appliquent tout de suite : rien n'attend le réseau.
// 2. L'état réglé dans /admin est lu dans Supabase (public.flemme_flags), gardé pour l'onglet, relu au retour sur l'onglet (au plus une fois par minute).
// 3. L'état « testeurs » s'appuie sur l'accès bêta vérifié par le serveur (beta/access.ts).
// Un élément porte data-flag="cle" : il est masqué quand le flag est éteint. data-flag-off="cle" : montré seulement quand il est éteint.
import { CLES, lireLignes, resoudreFlags, type CleFlag, type EtatFlags, type LigneFlag } from '../../../../packages/shared/src/flags.ts';
import { hasBetaAccess } from '../beta/access.ts';
import './flags.css';

import { ENV } from './env.ts';
export { ENV };
const url = import.meta.env.VITE_SUPABASE_URL || '';
const cle = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const CACHE = 'flemme.flags.v1';

// Liens existants rattachés à un flag sans modifier chaque page HTML.
const LIENS: Partial<Record<CleFlag, string>> = {
  'espace.premium': 'a[href*="premium"]',
  'espace.aide': 'a[href="#aide"], [data-beta-feature="aide"]',
  'catalogue.services': 'a[href$="#services"], #services',
  'formulaires.resoudre': 'a[href*="resoudre"], a[href$="#find"]',
};

function lireCache(): LigneFlag[] | null {
  try { const v = JSON.parse(sessionStorage.getItem(CACHE) || 'null'); return Array.isArray(v) ? v : null; } catch { return null; }
}
let lignes: LigneFlag[] | null = lireCache();
let etat: EtatFlags = resoudreFlags(ENV, lignes, hasBetaAccess());
let dernierChargement = 0;

export const flags = () => etat;
export const flagActif = (k: CleFlag) => etat[k].actif;
export const valeurFlag = (k: CleFlag) => etat[k].valeur;

function recalculer() {
  etat = resoudreFlags(ENV, lignes, hasBetaAccess());
  appliquer();
  dispatchEvent(new Event('flemme-flags'));
}

export async function chargerFlags(force = false) {
  if (!force && Date.now() - dernierChargement < 60000) return etat;
  dernierChargement = Date.now();
  const lues = await lireLignes(url, cle, ENV);
  if (lues) { lignes = lues; try { sessionStorage.setItem(CACHE, JSON.stringify(lues)); } catch { /* stockage bloqué : on garde l'état en mémoire */ } }
  recalculer();
  return etat;
}

function marquer(e: Element, masque: boolean) {
  if (masque) e.setAttribute('data-flag-masque', ''); else e.removeAttribute('data-flag-masque');
}

export function appliquer() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const k of CLES) {
    const actif = etat[k].actif;
    root.toggleAttribute('data-flag-off-' + k.replace('.', '-'), !actif);
    document.querySelectorAll(`[data-flag="${k}"]`).forEach(e => marquer(e, !actif));
    document.querySelectorAll(`[data-flag-off="${k}"]`).forEach(e => marquer(e, actif));
    const sel = LIENS[k];
    if (sel) document.querySelectorAll(sel).forEach(e => { if (!e.closest('[data-flag-ignore]')) marquer(e, !actif); });
  }
  // Variantes globales : le configurateur /beta d'un testeur reste prioritaire (beta/runtime.ts).
  root.dataset.flagTheme = etat['design.theme'].actif ? etat['design.theme'].valeur || 'clair' : 'clair';
  root.dataset.flagNav = etat['navigation.style'].actif ? etat['navigation.style'].valeur || 'burger' : 'burger';
}

if (typeof window !== 'undefined') {
  appliquer();
  addEventListener('flemme-beta-access', recalculer);
  addEventListener('focus', () => void chargerFlags());
  if (document.body) new MutationObserver(appliquer).observe(document.body, { childList: true, subtree: true });
  void chargerFlags(true);
}
