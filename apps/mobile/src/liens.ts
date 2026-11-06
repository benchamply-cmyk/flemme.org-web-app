import { Linking, Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { authMessage } from '../../../packages/shared/src/gateway.ts';
import type { AuthLinkOptions, RemoteGateway, StartResult } from '../../../packages/shared/src/index.ts';
import { linkSecret } from './storage';

// Liens envoyés par e-mail (mot de passe oublié, confirmation d’inscription) en flux PKCE, comme apps/web/src/authLinks.ts :
// l’e-mail ne contient qu’un code à usage unique, inutilisable sans le secret gardé sur ce téléphone.
// Le lien rouvre l’app par flemme-mobile://lien (à autoriser dans Supabase : Authentication › URL Configuration › Redirect URLs).
export type LinkPurpose = 'signup' | 'recovery';
export const redirectUrl = () => Platform.OS === 'web' && typeof location !== 'undefined' ? location.origin + location.pathname : 'flemme-mobile://lien';
const b64url = (s: string) => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

export async function prepareLink(purpose: LinkPurpose): Promise<AuthLinkOptions> {
  const verifier = hex(Crypto.getRandomBytes(32));
  await linkSecret.set(JSON.stringify({ verifier, purpose }));
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 });
  return { redirectTo: redirectUrl(), codeChallenge: b64url(digest) };
}

/** Lit l’adresse qui a ouvert l’app (?code=… ou ?error=…, parfois dans #…). Le secret ne sert qu’une fois. */
export async function readLink(url: string | null): Promise<{ code: string; verifier: string; purpose: LinkPurpose } | { error: string } | null> {
  if (!url) return null;
  const [, rest = ''] = url.split('?'); const [query = '', hash = ''] = rest.split('#');
  const q = new URLSearchParams(query), h = new URLSearchParams(hash || (url.split('#')[1] || ''));
  const err = q.get('error') ? q : h.get('error') ? h : null, code = q.get('code');
  if (!code && !err) return null;
  let saved: { verifier?: string; purpose?: string } = {};
  try { saved = JSON.parse((await linkSecret.get()) || '{}'); } catch { /* secret illisible : traité comme absent */ }
  await linkSecret.clear();
  if (err) return { error: authMessage(err.get('error_code') || err.get('error'), err.get('error_description') || 'Ce lien n’a pas pu être utilisé. Demande-en un nouveau.') };
  if (!saved.verifier) return { error: authMessage('flow_state_not_found', '') };
  return { code: code!, verifier: saved.verifier, purpose: saved.purpose === 'recovery' ? 'recovery' : 'signup' };
}

// Lien reçu pendant que l’app tourne déjà (App.tsx écoute Linking puis relance la session).
let received: string | null = null, initialRead = false;
export const linkReceived = (url: string) => { received = url; };
/** Démarrage de la session : retour d’un lien e-mail éventuel (voir FlemmeSession.onStart). */
export async function onStart(g: RemoteGateway): Promise<StartResult> {
  // L’adresse d’ouverture ne se lit qu’une fois : « Réessayer » ne doit pas rejouer un lien déjà utilisé.
  const url = received ?? (initialRead ? null : await Linking.getInitialURL().catch(() => null)); received = null; initialRead = true;
  const link = await readLink(url ?? null);
  if (!link) return { signedIn: false };
  if (Platform.OS === 'web' && typeof history !== 'undefined') history.replaceState(null, '', location.pathname);
  if ('error' in link) return { signedIn: false, error: link.error };
  await g.exchangeCode(link.code, link.verifier);
  return { signedIn: true, recovering: link.purpose === 'recovery', notice: link.purpose === 'signup' ? 'Adresse confirmée. Bienvenue !' : undefined };
}
