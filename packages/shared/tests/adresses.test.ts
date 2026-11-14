import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PREFIXES_APP, adresse, estAdresseApp, lireAdresse } from '../src/adresses.ts';
import type { Adresse } from '../src/adresses.ts';

// Table adresse ↔ écran, commune au site et à l’app mobile (plan d’adresses du 14/11/2026).
const TABLE: [string, Adresse][] = [
  ['/mon-espace', { screen: 'home' }],
  ['/mes-demandes', { screen: 'list', tab: 'mine' }],
  ['/flemmes', { screen: 'list', tab: 'find', categorie: undefined }],
  ['/flemmes?categorie=administratif', { screen: 'list', tab: 'find', categorie: 'administratif' }],
  ['/deleguer/nouvelle', { screen: 'new', tab: 'mine', formule: undefined }],
  ['/deleguer/nouvelle?formule=autre', { screen: 'new', tab: 'mine', formule: 'autre' }],
  ['/deleguer/nouvelle?formule=devis', { screen: 'new', tab: 'mine', formule: 'devis' }],
  ['/flemme/t1', { screen: 'detail', taskId: 't1' }],
  ['/flemme/t1/modifier', { screen: 'edit', taskId: 't1' }],
  ['/flemme/t1/accord', { screen: 'contract', taskId: 't1' }],
  ['/flemme/t1/signaler', { screen: 'report', taskId: 't1' }],
  ['/flemme/t1/proposition/o2', { screen: 'offer', taskId: 't1', offerId: 'o2' }],
  ['/flemme/t1/proposition/o2/accepter', { screen: 'review', taskId: 't1', offerId: 'o2' }],
  ['/compte', { screen: 'account' }],
  ['/profil', { screen: 'profile' }],
  ['/profil/u3', { screen: 'profile', userId: 'u3' }],
  ['/aide', { screen: 'help' }],
];

test('adresses : chaque écran a une adresse, lue et écrite à l’identique', () => {
  for (const [url, a] of TABLE) {
    const [chemin, requete = ''] = url.split('?');
    assert.deepEqual(lireAdresse(chemin, requete), a, url);
    assert.equal(adresse(a), url, url);
  }
});

test('adresses : variantes acceptées', () => {
  assert.deepEqual(lireAdresse('/mes-demandes/'), { screen: 'list', tab: 'mine' });
  assert.deepEqual(lireAdresse('/connexion'), { screen: 'home' });
  assert.deepEqual(lireAdresse('/connexion/mot-de-passe'), { screen: 'home' });
  assert.deepEqual(lireAdresse('/flemme/t1/proposer'), { screen: 'detail', taskId: 't1' });
  assert.deepEqual(lireAdresse('/paiement/ok'), { screen: 'list', tab: 'mine', paiement: 'ok' });
  assert.deepEqual(lireAdresse('/paiement/annule'), { screen: 'list', tab: 'mine', paiement: 'annule' });
  // Valeurs inconnues ignorées plutôt que transmises.
  assert.equal(lireAdresse('/deleguer/nouvelle', 'formule=autrechose')?.formule, undefined);
  assert.equal(lireAdresse('/flemmes', 'categorie=<script>')?.categorie, undefined);
});

test('adresses : anciennes adresses app.html#… converties', () => {
  assert.deepEqual(lireAdresse('/app.html'), { screen: 'home' });
  assert.equal(adresse(lireAdresse('/app.html', '', '#mine')!), '/mes-demandes');
  assert.equal(adresse(lireAdresse('/app.html', '', '#find')!), '/flemmes');
  for (const h of ['#deleguer', '#deposer']) assert.equal(adresse(lireAdresse('/app.html', '', h)!), '/deleguer/nouvelle');
  for (const h of ['#deleguer-autre', '#deposer-autre']) assert.equal(adresse(lireAdresse('/app.html', '', h)!), '/deleguer/nouvelle?formule=autre');
  for (const h of ['#deleguer-devis', '#deposer-devis']) assert.equal(adresse(lireAdresse('/app.html', '', h)!), '/deleguer/nouvelle?formule=devis');
  assert.equal(lireAdresse('/app.html', '', '#paiement-ok')?.paiement, 'ok');
  assert.equal(lireAdresse('/app.html', '', '#paiement-annule')?.paiement, 'annule');
  assert.equal(adresse(lireAdresse('/app.html', '', '#compte')!), '/compte');
});

test('adresses : les pages de la vitrine ne sont pas prises par l’app', () => {
  for (const p of ['/', '/index.html', '/resoudre.html', '/deleguer', '/deleguer-une-flemme.html', '/flemme', '/flemme/t1/inconnu', '/espace-connecte.html', '/beta', '/admin'])
    assert.equal(estAdresseApp(p), false, p);
  assert.equal(estAdresseApp('/app.html'), true);
});

test('adresses : Netlify sert app.html pour chaque adresse de l’espace', () => {
  const toml = readFileSync(new URL('../../../netlify.toml', import.meta.url), 'utf8');
  const regles = [...toml.matchAll(/\[\[redirects\]\]\s*from = "([^"]+)"\s*to = "([^"]+)"\s*status = (\d+)/g)].map(m => ({ from: m[1], to: m[2], status: m[3] }));
  for (const p of PREFIXES_APP) {
    const r = regles.find(x => x.from === p || x.from === p + '/*');
    assert.ok(r, 'règle manquante pour ' + p);
    assert.equal(r.to, '/app.html', p); assert.equal(r.status, '200', p);
  }
  // Une adresse générée doit toujours tomber sous une règle.
  for (const [url] of TABLE) assert.ok(PREFIXES_APP.some(p => url === p || url.startsWith(p + '/') || url.startsWith(p + '?')), url);
});
