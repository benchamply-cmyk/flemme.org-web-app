import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FAQ, FILE_TYPES, HELP_TOPICS, MAX_FILE_SIZE, assistant, fileInput, fileSize, helpInput } from '../src/aide.ts';
import { FlemmeSession } from '../src/session.ts';

const sql = readFileSync(new URL('../../../supabase/migrations/20261104150000_flemme_v2_fichiers_aide.sql', import.meta.url), 'utf8');

test('aide : mêmes formats, taille et sujets que la migration', () => {
  for (const mime of Object.keys(FILE_TYPES)) assert.ok(sql.includes(`'${mime}'`), mime);
  assert.ok(sql.includes(`between 1 and ${MAX_FILE_SIZE}`));
  const topics = sql.match(/topic in \(([^)]*)\)/)![1].match(/'([^']+)'/g)!.map(s => s.slice(1, -1));
  assert.deepEqual(topics, HELP_TOPICS.map(t => t.value));
});

test('aide : contrôle des fichiers avant envoi', () => {
  assert.deepEqual(fileInput({ name: 'devis.docx', type: '', size: 2000 }), { name: 'devis.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 2000 });
  assert.throws(() => fileInput({ name: 'a.zip', type: 'application/zip', size: 10 }), /PDF, JPEG, PNG ou Word/);
  assert.throws(() => fileInput({ name: 'a.pdf', type: 'application/pdf', size: MAX_FILE_SIZE + 1 }), /10 Mo/);
  assert.throws(() => fileInput({ name: 'cv.pdf', type: 'application/pdf', size: 10 }, true), /JPEG ou PNG/);
  assert.equal(fileInput({ name: 'moi.PNG', type: '', size: 10 }, true).mime, 'image/png');
  assert.equal(fileSize(1536), '2 Ko'); assert.equal(fileSize(3 * 1024 * 1024), '3,0 Mo');
});

test('aide : assistant par mots clés, sans accent ni casse', () => {
  assert.equal(assistant('J’ai OUBLIÉ mon mot de passe')[0].id, 'motdepasse');
  assert.equal(assistant('combien de commission ?')[0].id, 'prix');
  assert.equal(assistant('signer le contrat')[0].id, 'accord');
  assert.deepEqual(assistant('zzz'), []);
  assert.ok(assistant('paiement carte remboursé').length <= 3);
  assert.equal(new Set(FAQ.map(f => f.id)).size, FAQ.length);
  assert.throws(() => helpInput('', 'x'), /sujet/); assert.throws(() => helpInput('compte', ' '), /question/);
  assert.deepEqual(helpInput('compte', ' Bonjour '), { topic: 'compte', text: 'Bonjour', taskId: null });
});

test('aide : messages et fichiers dans la démo', async () => {
  const s = new FlemmeSession({ url: '', key: '', tokens: { get: async () => null, set: async () => {}, clear: async () => {} }, readDemo: async () => null, writeDemo: async () => {} });
  await s.initialize();
  await s.sendHelp(helpInput('compte', 'Question'), () => {});
  await s.loadHelp();
  assert.equal(s.getState().help![0].text, 'Question');
  const task = s.getState().tasks[0];
  await s.upload(task.id, Object.assign(new Blob(['%PDF']), { name: 'facture.pdf' }));
  assert.equal(s.getState().files[task.id][0].name, 'facture.pdf');
  await s.deleteFile(task.id, s.getState().files[task.id][0]);
  assert.deepEqual(s.getState().files[task.id], []);
  await s.upload(task.id, Object.assign(new Blob(['x']), { name: 'virus.exe' }));
  assert.match(s.getState().error, /PDF, JPEG/);
});
