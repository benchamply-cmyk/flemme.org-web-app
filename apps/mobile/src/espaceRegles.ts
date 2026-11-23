import type { SearchFilter, Task } from '../../../packages/shared/src/index.ts';
import { derniereActivite } from '../../../packages/shared/src/espace.ts';

// Règles pures de Mon espace mobile (refonte v2.1.0), mêmes que apps/web/src/ecrans/Espace.tsx. Testées dans tests/espace.test.ts.
export type Alerte = { id: string; filtre: SearchFilter; libelle: string; vuLe: string };

// ——— Discussions : une par proposition, côté déposant comme côté membre qui aide (même règle que le site). ———
export type Fil = { task: Task; offerId: string; avec: string; dernier?: { text: string; at: string; moi: boolean }; nonLus: number; quand: string };
export function fils(tasks: Task[], actorId: string, lus: Record<string, string>): Fil[] {
  const out: Fil[] = [];
  for (const t of tasks) for (const o of t.offers) {
    const owner = t.owner.id === actorId, mine = o.brigadier.id === actorId;
    if (!owner && !mine) continue;
    if (o.status === 'declined' || o.status === 'not_selected') continue;
    const m = o.messages.at(-1), vu = lus[o.id] || '';
    const nonLus = o.messages.filter(x => x.actor.id !== actorId && x.at > vu).length;
    out.push({ task: t, offerId: o.id, avec: owner ? o.brigadier.name : t.owner.name, dernier: m && { text: m.text, at: m.at, moi: m.actor.id === actorId }, nonLus, quand: derniereActivite(t, o.id) });
  }
  return out.sort((a, b) => b.quand.localeCompare(a.quand));
}
export const nonLus = (tasks: Task[], actorId: string, lus: Record<string, string>) => fils(tasks, actorId, lus).reduce((n, f) => n + f.nonLus, 0);

// ——— Alertes de demandes ———
export const memeFiltre = (a: SearchFilter, b: SearchFilter) => (['q', 'category', 'mode', 'place', 'budget', 'deadline'] as const).every(k => (a[k] || '') === (b[k] || ''));
const correspond = (t: Task, f: SearchFilter) => (!f.category || t.category === f.category) && (!f.mode || t.mode === f.mode || t.mode === 'les_deux')
  && (!f.q || (t.title + ' ' + t.details).toLowerCase().includes(f.q.toLowerCase())) && (!f.place || t.place.toLowerCase().includes(f.place.toLowerCase()));
/** Nombre de demandes ouvertes publiées après la dernière consultation d’une alerte et qui lui correspondent. */
export function nouvellesAlertes(alertes: Alerte[], tasks: Task[], actorId: string) {
  const vues = new Set<string>();
  for (const a of alertes) for (const t of tasks) if (t.owner.id !== actorId && t.status === 'open' && t.createdAt > a.vuLe && correspond(t, a.filtre)) vues.add(t.id);
  return vues.size;
}
