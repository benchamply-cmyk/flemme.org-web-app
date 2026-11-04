import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler, { alerte, secretOk } from '../netlify/functions/alerte.mjs';

const body = (kind: string, payload: Record<string, unknown>) => ({ source: 'flemme_v2', id: 1, kind, task_id: '1234abcd-0000-4000-8000-000000000000', payload });

test('signalement : sujet court, texte échappé, lien vers l’admin', () => {
  const m = alerte(body('report', { title: 'Monter <script>', actor: 'Lou', text: 'Pas venu\nDeux fois', owner: 'Ben', brigadier: 'Lou' }), 'https://preprod.example');
  assert.equal(m.subject, 'Signalement : Monter <script>');
  assert.match(m.html, /Monter &lt;script&gt;/); assert.doesNotMatch(m.html, /<script>/);
  assert.match(m.html, /Pas venu<br>Deux fois/); assert.match(m.html, /https:\/\/preprod\.example\/admin/);
  assert.match(m.text, /Flemme : 1234abcd/);
});
test('nouvelle flemme et accord : montants en euros', () => {
  assert.match(alerte(body('task_created', { title: 'CV', place: 'À distance', budget: null, owner: 'Ben' })).text, /Prix à proposer/);
  assert.match(alerte(body('task_created', { title: 'CV', place: 'Aix', budget: 2500, owner: 'Ben' })).text, /25,00/);
  const m = alerte(body('agreement', { title: 'Meuble', owner: 'Ben', brigadier: 'Lou', amount: 4005, commission: 401 }));
  assert.match(m.text, /40,05/); assert.match(m.text, /4,01/);
});
test('ancien format FlemmeV2.0 ou événement inconnu : rien à envoyer', () => {
  assert.equal(alerte({ type: 'INSERT', table: 'demandes', record: {} }), null);
  assert.equal(alerte(body('autre', {})), null);
  assert.equal(alerte(null), null);
});
test('secret comparé en temps constant, refusé si absent', () => {
  assert.equal(secretOk('abc', 'abc'), true);
  assert.equal(secretOk('abd', 'abc'), false);
  assert.equal(secretOk('', 'abc'), false);
  assert.equal(secretOk('abc', ''), false);
});
test('fonction : secret requis, Resend appelé une fois avec le bon destinataire', async () => {
  const env = { ...process.env }, realFetch = globalThis.fetch;
  const calls: { url: string; body: { to: string[]; subject: string } }[] = [];
  Object.assign(process.env, { ALERTE_SECRET: 's3cret', RESEND_API_KEY: 're_test', ALERTE_EMAIL: 'equipe@example.org, ben@example.org' });
  globalThis.fetch = (async (url: string, init: RequestInit) => { calls.push({ url, body: JSON.parse(String(init.body)) }); return new Response('{}', { status: 200 }); }) as typeof fetch;
  try {
    const post = (secret: string, b: unknown) => handler(new Request('https://x/api/alerte', { method: 'POST', headers: { 'x-alerte-secret': secret }, body: JSON.stringify(b) }));
    assert.equal((await post('faux', body('report', { title: 'A' }))).status, 401);
    assert.equal((await post('s3cret', { table: 'messages' })).status, 204);
    assert.equal((await handler(new Request('https://x/api/alerte'))).status, 405);
    assert.equal(calls.length, 0);
    assert.equal((await post('s3cret', body('report', { title: 'A', text: 'B' }))).status, 200);
    assert.equal(calls.length, 1); assert.equal(calls[0].url, 'https://api.resend.com/emails');
    assert.deepEqual(calls[0].body.to, ['equipe@example.org', 'ben@example.org']);
  } finally { globalThis.fetch = realFetch; process.env = env; }
});
