import { test } from 'node:test';
import assert from 'node:assert/strict';
import { supabaseConfigProblem } from '../src/supabaseConfig.ts';
import { readLinkReturn } from '../src/authLinks.ts';

const jwt = (role: string) => 'eyJhbGciOiJIUzI1NiJ9.' + btoa(JSON.stringify({ role })).replace(/=+$/, '') + '.signature';
function memory(): Storage {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, key: i => [...m.keys()][i] ?? null, getItem: k => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: k => { m.delete(k); }, clear: () => m.clear() };
}

test('configuration : vide = démo, complète = mode connecté, le reste est refusé', () => {
  assert.equal(supabaseConfigProblem('', ''), '');
  assert.equal(supabaseConfigProblem('https://yktpabnqkhwcshvjuncs.supabase.co', 'sb_publishable_abc'), '');
  assert.equal(supabaseConfigProblem('https://x.supabase.co/', jwt('anon')), '');
  assert.match(supabaseConfigProblem('https://x.supabase.co', ''), /incomplète/);
  assert.match(supabaseConfigProblem('', 'sb_publishable_abc'), /incomplète/);
  assert.match(supabaseConfigProblem('http://x.supabase.co', 'sb_publishable_abc'), /HTTPS/);
  assert.match(supabaseConfigProblem('https://x.supabase.co/rest/v1', 'sb_publishable_abc'), /sans chemin/);
  assert.match(supabaseConfigProblem('https://x.supabase.co', 'sb_secret_abc'), /clé secrète/);
  assert.match(supabaseConfigProblem('https://x.supabase.co', jwt('service_role')), /clé secrète/);
});

test('retour de lien : code échangé une seule fois, avec le secret gardé et son motif', () => {
  const store = memory();
  store.setItem('flemme-web-pkce', JSON.stringify({ verifier: 'v', purpose: 'recovery' }));
  assert.deepEqual(readLinkReturn('?code=abc', '', store), { code: 'abc', verifier: 'v', purpose: 'recovery' });
  assert.equal(store.getItem('flemme-web-pkce'), null);
  assert.match((readLinkReturn('?code=abc', '', store) as { error: string }).error, /autre navigateur/);
});

test('retour de lien : erreurs traduites, adresse sans lien ignorée', () => {
  const store = memory();
  assert.equal(readLinkReturn('', '#mine', store), null);
  assert.match((readLinkReturn('', '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid', store) as { error: string }).error, /expiré/);
  assert.equal((readLinkReturn('?error=server_error&error_description=Oups', '', store) as { error: string }).error, 'Oups');
});
