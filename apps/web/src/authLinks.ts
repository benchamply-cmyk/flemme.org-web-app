import { authMessage } from '../../../packages/shared/src/gateway.ts';

// Liens envoyés par e-mail (confirmation d’inscription, mot de passe oublié), en flux PKCE :
// le lien ne contient qu’un code à usage unique, inutilisable sans le secret gardé ici.
// Retour sur /app.html, l’adresse autorisée dans Supabase, quel que soit l’écran d’où part la demande.
// localStorage plutôt que sessionStorage : le lien de l’e-mail s’ouvre souvent dans un nouvel onglet.
export type LinkPurpose = 'signup' | 'recovery';
const key = 'flemme-web-pkce';
const b64url = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Prépare un lien : garde le secret et renvoie l’empreinte SHA-256 à transmettre à Supabase.
export async function prepareLink(purpose: LinkPurpose, store: Storage = localStorage) {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  store.setItem(key, JSON.stringify({ verifier, purpose }));
  return { redirectTo: new URL('/app.html', location.href).href, codeChallenge: b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))) };
}

export type LinkReturn = { code: string; verifier: string; purpose: LinkPurpose } | { error: string } | null;
// Lit le retour d’un lien (?code=… ou ?error=…, parfois dans #…). Le secret ne sert qu’une fois.
export function readLinkReturn(search: string, hash: string, store: Storage = localStorage): LinkReturn {
  const q = new URLSearchParams(search), h = new URLSearchParams(hash.replace(/^#/, ''));
  const err = q.get('error') ? q : h.get('error') ? h : null;
  const code = q.get('code');
  if (!code && !err) return null;
  let saved: { verifier?: string; purpose?: string } = {};
  try { saved = JSON.parse(store.getItem(key) || '{}'); } catch { /* secret illisible : traité comme absent */ }
  store.removeItem(key);
  if (err) return { error: authMessage(err.get('error_code') || err.get('error'), err.get('error_description') || 'Ce lien n’a pas pu être utilisé. Demande-en un nouveau.') };
  if (!saved.verifier) return { error: authMessage('flow_state_not_found', '') };
  return { code: code!, verifier: saved.verifier, purpose: saved.purpose === 'recovery' ? 'recovery' : 'signup' };
}
