import { isSecretKey } from '../../../packages/shared/src/gateway.ts';

// Vérifie VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY.
// Utilisé au build (vite.config.ts : le build échoue) et dans l’app (message à l’écran).
// Les deux vides : démo locale. Renvoie le problème en français, ou '' si la configuration est utilisable.
export function supabaseConfigProblem(url = '', key = ''): string {
  url = url.trim(); key = key.trim();
  if (!url && !key) return '';
  if (!url || !key) return 'Configuration Supabase incomplète : renseigne à la fois VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY (ou aucune des deux pour la démo locale).';
  if (!/^https:\/\/[^/\s]+\/?$/.test(url)) return 'VITE_SUPABASE_URL doit être l’adresse HTTPS du projet, par exemple https://xxxx.supabase.co, sans chemin.';
  if (isSecretKey(key)) return 'VITE_SUPABASE_PUBLISHABLE_KEY contient une clé secrète (sb_secret_ ou service_role) : elle serait publiée dans le site. Utilise la clé publique (sb_publishable_ ou anon).';
  return '';
}
