// Parcours complet (ex-aperçu /apercu.html) : codes et libellés des demandes, contrôles avant envoi.
// Les codes sont les mêmes que les contraintes de supabase/migrations/20261104120000_flemme_v2_parcours.sql ;
// le serveur refait chaque contrôle (packages/shared/tests/parcours.test.ts vérifie que les listes concordent).
import type { Input, Task } from './domain.ts';
import { parseMoney } from './domain.ts';

export type Option<K extends string = string> = { value: K; label: string };
export const CATEGORIES = [
  { value: 'administratif', label: 'Administratif' }, { value: 'maison', label: 'Maison & quotidien' },
  { value: 'numerique', label: 'Numérique' }, { value: 'organisation', label: 'Organisation' }, { value: 'autre', label: 'Autre' },
] as const satisfies readonly Option[];
export const DEADLINES = [
  { value: 'urgent', label: 'Urgent' }, { value: 'aujourdhui', label: 'Aujourd’hui' }, { value: 'demain', label: 'Demain' },
  { value: '3_jours', label: '3 jours' }, { value: '1_semaine', label: '1 semaine' }, { value: '1_mois', label: '1 mois' },
  { value: '1_an', label: '1 an' }, { value: 'autre', label: 'Autre' },
] as const satisfies readonly Option[];
// Fourchettes sans chevauchement : [0,10[, [10,50[, [50,200], plus de 200 €.
export const BUDGET_RANGES = [
  { value: 'moins_10', label: 'Moins de 10 €' }, { value: '10_50', label: '10 à moins de 50 €' },
  { value: '50_200', label: '50 à 200 €' }, { value: 'plus_200', label: 'Plus de 200 €' },
] as const satisfies readonly Option[];
export const MODES = [
  { value: 'distance', label: 'À distance' }, { value: 'sur_place', label: 'Sur place' }, { value: 'les_deux', label: 'Les deux' },
] as const satisfies readonly Option[];
export type Category = typeof CATEGORIES[number]['value'];
export type Deadline = typeof DEADLINES[number]['value'];
export type BudgetRange = typeof BUDGET_RANGES[number]['value'];
export type WorkMode = typeof MODES[number]['value'];
export type Review = 'pending' | 'changes_requested' | 'published' | 'rejected';

const label = (list: readonly Option[], value: string | null | undefined) => list.find(o => o.value === value)?.label;
export const categoryLabel = (t: Pick<Task, 'category'>) => label(CATEGORIES, t.category) || '';
export const modeLabel = (t: Pick<Task, 'mode'>) => label(MODES, t.mode) || '';
export const deadlineLabel = (t: Pick<Task, 'deadline' | 'deadlineNote'>) =>
  t.deadline === 'autre' ? t.deadlineNote || 'Autre' : label(DEADLINES, t.deadline) || 'Délai à discuter';
/** Budget affiché : montant libre, sinon fourchette, sinon « À discuter ». */
export const budgetText = (t: Pick<Task, 'budget' | 'budgetRange'>, money: (n: number) => string) =>
  t.budget != null ? money(t.budget) : label(BUDGET_RANGES, t.budgetRange) || 'À discuter';
export const reviewLabel: Record<Review, string> = {
  pending: 'En attente de validation · privée', changes_requested: 'Correction demandée par l’équipe FLEMME',
  published: 'Publiée', rejected: 'Refusée par l’équipe FLEMME',
};

/** Brouillon enregistré sur le compte : une demande (kind « task ») ou une candidature (kind « offer »). */
export type SavedDraft = { id: string; kind: 'task' | 'offer'; taskId: string | null; fields: Record<string, string>; updatedAt: string };
export const TASK_FIELDS = ['title', 'details', 'category', 'deadline', 'deadlineNote', 'amount', 'budgetRange', 'mode', 'place', 'address'] as const;

const pick = <K extends string>(list: readonly Option<K>[], value: string | undefined, what: string): K | null => {
  if (!value) return null;
  const found = list.find(o => o.value === value);
  if (!found) throw new Error(what + ' invalide.');
  return found.value;
};
/**
 * Formulaire de dépôt → données envoyées au serveur. Lève une erreur lisible au premier problème.
 * `amount` est saisi en euros ; `budget` part en centimes.
 */
export function taskInput(f: Record<string, string | undefined>): Input {
  const title = (f.title || '').trim(), details = (f.details || '').trim();
  if (!title || !details) throw new Error('Un titre et une description sont nécessaires.');
  if (title.length > 100) throw new Error('Titre trop long (100 caractères au plus).');
  if (details.length > 1000) throw new Error('Description trop longue (1000 caractères au plus).');
  const category = pick(CATEGORIES, f.category, 'Catégorie');
  if (!category) throw new Error('Choisis une catégorie.');
  const deadline = pick(DEADLINES, f.deadline, 'Délai');
  const deadlineNote = deadline === 'autre' ? (f.deadlineNote || '').trim() : '';
  if (deadline === 'autre' && !deadlineNote) throw new Error('Précise le délai approximatif.');
  const budget = parseMoney(f.amount || '', true), budgetRange = pick(BUDGET_RANGES, f.budgetRange, 'Fourchette');
  if (budget != null && budgetRange) throw new Error('Choisis un budget libre ou une fourchette, pas les deux.');
  const mode = pick(MODES, f.mode || 'distance', 'Lieu') as WorkMode;
  const place = (f.place || '').trim();
  if (mode !== 'distance' && !place) throw new Error('Indique une ville ou un secteur pour une tâche sur place.');
  return {
    title, details, category, deadline, deadlineNote: deadlineNote || null, budget, budgetRange, mode,
    place: place || (mode === 'distance' ? 'À distance' : ''), address: mode === 'distance' ? null : (f.address || '').trim() || null,
  };
}
/** Demande existante → champs du formulaire (pour la modifier). */
export function taskFields(t: Task, money: (n: number) => string): Record<string, string> {
  const euros = t.budget == null ? '' : money(t.budget).replace(/[^\d,]/g, '');
  return {
    title: t.title, details: t.details, category: t.category || '', deadline: t.deadline || '', deadlineNote: t.deadlineNote || '',
    amount: euros, budgetRange: t.budgetRange || '', mode: t.mode || (t.place === 'À distance' ? 'distance' : 'sur_place'),
    place: t.place === 'À distance' ? '' : t.place, address: t.address || '',
  };
}
/** Ce que le déposant peut faire de sa demande tant qu’elle n’est pas attribuée. */
export const canEdit = (t: Task | undefined, actorId: string) =>
  !!t && t.owner.id === actorId && t.status === 'open' && t.review !== 'rejected' && !t.offers.some(o => o.status === 'pending');
/** Ajoute une transcription à la fin de la description, sans casser le texte déjà saisi. */
export function appendDictation(existing: string, transcript: string): string {
  const base = existing.trimEnd();
  return base ? `${base}\n${transcript}` : transcript;
}

/** Filtres de « Résoudre une flemme ». Mêmes règles que flemme_v2.search_tasks (serveur). */
export type SearchFilter = { q?: string; category?: string; mode?: string; place?: string; budget?: string; deadline?: string; sort?: string };
export type SearchPage = { tasks: Task[]; total: number; nextCursor: string | null };
export const BUDGET_FILTERS = [
  { value: 'moins_50', label: 'Moins de 50 €' }, { value: '50_200', label: '50 à 200 €' },
  { value: 'plus_200', label: 'Plus de 200 €' }, { value: 'a_discuter', label: 'À discuter' },
] as const satisfies readonly Option[];
export const SORTS = [
  { value: 'recent', label: 'Les plus récentes' }, { value: 'deadline', label: 'Délai le plus proche' }, { value: 'budget', label: 'Budget croissant' },
] as const satisfies readonly Option[];
export const SEARCH_FIELDS = ['q', 'category', 'mode', 'place', 'budget', 'deadline', 'sort'] as const;
const rank = (t: Task) => { const i = DEADLINES.findIndex(d => d.value === t.deadline); return i < 0 ? 9 : i + 1; };
const value = (t: Task) => t.budget ?? ({ moins_10: 500, '10_50': 3000, '50_200': 12500, plus_200: 20001 } as Record<string, number>)[t.budgetRange || ''] ?? Infinity;
/** Recherche locale (démo) : ne modifie pas la liste reçue. */
export function searchTasks(tasks: Task[], actorId: string, f: SearchFilter): Task[] {
  const q = f.q?.trim().toLowerCase(), place = f.place?.trim().toLowerCase();
  const budget = (t: Task) => {
    const v = value(t);
    if (f.budget === 'a_discuter') return t.budget == null && !t.budgetRange;
    if (f.budget === 'moins_50') return v < 5000;
    if (f.budget === '50_200') return v >= 5000 && v <= 20000;
    if (f.budget === 'plus_200') return v > 20000 && v !== Infinity;
    return true;
  };
  return tasks.filter(t => t.status === 'open' && (!t.review || t.review === 'published') && t.owner.id !== actorId
      && (!q || `${t.title} ${t.details} ${t.place} ${t.category || ''}`.toLowerCase().includes(q))
      && (!f.category || t.category === f.category)
      && (!f.mode || t.mode === f.mode || t.mode === 'les_deux' || (f.mode === 'distance' && !t.mode && t.place === 'À distance'))
      && (!place || t.place.toLowerCase().includes(place))
      && (!f.deadline || t.deadline === f.deadline) && budget(t))
    .sort((a, b) => (f.sort === 'deadline' ? rank(a) - rank(b) : 0) || (f.sort === 'budget' ? value(a) - value(b) : 0)
      || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}
