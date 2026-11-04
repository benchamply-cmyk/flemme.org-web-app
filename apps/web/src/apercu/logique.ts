// Règles pures de l’aperçu /apercu.html, séparées de l’affichage pour être testées (tests/apercu.test.ts).
// La commission (modèle et taux réglés dans COMMISSION) vient de packages/shared : l’aperçu affiche le même calcul que l’app connectée.
import { money, price, rateLabel } from '../../../../packages/shared/src/domain.ts';

export type Demande = {
  title?: string; description?: string; category?: string; delay?: string; otherDelay?: string;
  budget?: string; range?: string; mode?: string; city?: string; address?: string;
};
export type Flemme = { title: string; description: string; category: string; place: string; delay: string; rank: number; price: number | null };
export type Filtre = { q?: string; category?: string; city?: string; delay?: string; price?: string; sort?: string };

export const FOURCHETTES = ['0 à moins de 10 €', '10 à moins de 50 €', '50 à 200 €', 'Plus de 200 €'];
export const TAILLE_MAX = 10 * 1024 * 1024;

const euros = (n: number) => money(Math.round(n * 100));

/** Budget affiché d’une demande : montant libre, sinon fourchette, sinon « À discuter ». */
export function budgetLabel(d: Demande): string {
  const n = Number(String(d.budget ?? '').replace(',', '.'));
  if (String(d.budget ?? '').trim() && Number.isFinite(n) && n >= 0) return euros(n);
  return d.range || 'À discuter';
}

/** Message d’erreur du formulaire de dépôt, ou chaîne vide si tout est bon. */
export function validateRequest(d: Demande, files: { size: number }[] = []): string {
  if (!d.title?.trim() || !d.description?.trim()) return 'Titre et description sont nécessaires.';
  if (!d.category) return 'Choisis une catégorie.';
  if (d.delay === 'Autre' && !d.otherDelay?.trim()) return 'Précise le délai approximatif.';
  if (d.mode && d.mode !== 'À distance' && !d.city?.trim()) return 'Indique une ville ou un secteur pour une tâche sur place.';
  if (String(d.budget ?? '').trim() && d.range) return 'Choisis un budget libre ou une fourchette, pas les deux.';
  if (files.some(f => f.size > TAILLE_MAX)) return 'Un fichier dépasse 10 Mo. Choisis un fichier plus petit pour cet aperçu.';
  return '';
}

/** Recherche, filtres et tri de la liste « Résoudre une flemme ». Ne modifie pas la liste reçue. */
export function filterTasks<T extends Flemme>(tasks: T[], f: Filtre): T[] {
  const q = f.q?.trim().toLowerCase();
  const city = f.city?.trim().toLowerCase();
  const prix = (t: T) => {
    if (!f.price) return true;
    if (f.price === 'À discuter') return t.price === null;
    if (t.price === null) return false;
    if (f.price === 'Moins de 50 €') return t.price < 50;
    if (f.price === '50 à 200 €') return t.price >= 50 && t.price <= 200;
    return t.price > 200;
  };
  return tasks
    .filter(t =>
      (!q || `${t.title} ${t.description} ${t.category}`.toLowerCase().includes(q)) &&
      (!f.category || t.category === f.category) &&
      (!city || t.place.toLowerCase().includes(city)) &&
      (!f.delay || t.delay.toLowerCase() === f.delay.toLowerCase()) &&
      prix(t))
    .sort((a, b) => f.sort === 'budget' ? (a.price ?? Infinity) - (b.price ?? Infinity) : a.rank - b.rank);
}

/**
 * Modèle retenu le 3 novembre 2026 : 10 % ajoutés au forfait du Brigadier, payés par le Flemmard.
 * Renvoie null si le prix n’est pas un montant positif.
 */
export function tarif(prix: unknown): { forfait: string; frais: string; total: string; recu: string; taux: string } | null {
  const n = Number(String(prix ?? '').replace(',', '.'));
  if (!String(prix ?? '').trim() || !Number.isFinite(n) || n <= 0) return null;
  const p = price(Math.round(n * 100));
  return { forfait: money(p.amount), frais: money(p.commission), total: money(p.total), recu: money(p.payout), taux: rateLabel() };
}

/** Ajoute une transcription à la fin de la description, sans casser le texte déjà saisi. */
export function appendDictation(existing: string, transcript: string): string {
  const base = existing.trimEnd();
  return base ? `${base}\n${transcript}` : transcript;
}
