import type { DemoState } from '../../../packages/shared/src/gateway.ts';

// Version navigateur de storage.ts, choisie automatiquement par Metro pour `expo export --platform web`
// (aperçu de l'app dans un navigateur). Même principe : un instantané par mutation, rien n'est effacé.
const prefix = 'flemme-mobile-demo/';
const store = (): Storage | null => { try { return globalThis.localStorage ?? null; } catch { return null; } };
const memory = new Map<string, string>();
const keys = () => { const s = store(); if (!s) return [...memory.keys()]; return Array.from({ length: s.length }, (_, i) => s.key(i) || ''); };
const get = (k: string) => { const s = store(); try { return s ? s.getItem(k) : memory.get(k) ?? null; } catch { return memory.get(k) ?? null; } };
const set = (k: string, v: string) => { const s = store(); try { if (s) { s.setItem(k, v); return; } } catch { /* stockage plein ou bloqué */ } memory.set(k, v); };

export async function readDemo(): Promise<DemoState | null> {
  const names = keys().filter(k => k.startsWith(prefix)).sort().reverse();
  if (!names.length) return null;
  for (const name of names) {
    try { const state = JSON.parse(get(name) || ''); if (state.version === 1 && Array.isArray(state.tasks) && state.requests) return state; } catch { /* instantané précédent */ }
  }
  throw new Error('Les données locales sont illisibles. Elles ont été conservées ; aucune remise à zéro automatique.');
}
export async function writeDemo(state: DemoState) {
  set(prefix + String(Date.now()).padStart(15, '0') + '-' + Math.random().toString(36).slice(2) + '.json', JSON.stringify(state));
}
// Le mode connecté n'est pas activé dans l'aperçu navigateur : jeton gardé en mémoire seulement.
let token: string | null = null;
export const tokens = {
  get: async () => token,
  set: async (value: string) => { token = value; },
  clear: async () => { token = null; },
};
// Secret du lien e-mail en cours (voir liens.ts) : stockage du navigateur, le lien s'ouvre souvent dans un nouvel onglet.
const secretKey = 'flemme-mobile-lien';
export const linkSecret = {
  get: async () => get(secretKey),
  set: async (value: string) => set(secretKey, value),
  clear: async () => { const s = store(); try { s?.removeItem(secretKey); } catch { /* bloqué */ } memory.delete(secretKey); },
};
