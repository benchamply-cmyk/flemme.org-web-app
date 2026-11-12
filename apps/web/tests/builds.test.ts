import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { adresse, buildPR, buildsDepuisPR, FIXES, lireEtat } from '../src/builds.ts';

describe('sélecteur de builds', () => {
  it('preprod déployé par défaut, page d’accueil', () => {
    assert.deepEqual(lireEtat(''), { build: 'preprod', page: 'index.html' });
    assert.equal(adresse(FIXES[0], 'index.html'), 'https://preprod--flemmeorg.netlify.app/index.html');
  });
  it('lit le lien partagé et refuse une page inconnue', () => {
    assert.deepEqual(lireEtat('#build=pr57&page=app.html'), { build: 'pr57', page: 'app.html' });
    assert.equal(lireEtat('#build=pr57&page=../x').page, 'index.html');
  });
  it('aperçu Netlify d’une PR vers beta', () => {
    assert.equal(adresse(buildPR(57), 'atelier-services.html'), 'https://deploy-preview-57--flemmeorg-beta.netlify.app/atelier-services.html');
  });
  it('PR ouvertes d’abord, puis les plus récentes', () => {
    const l = buildsDepuisPR([
      { number: 50, title: 'A', state: 'closed', merged_at: '2026-11-10T05:31:51Z' },
      { number: 63, title: 'B', state: 'open', merged_at: null },
      { number: 57, title: 'C', state: 'closed', merged_at: null },
    ]);
    assert.deepEqual(l.map(b => b.id), ['pr63', 'pr57', 'pr50']);
    assert.equal(l[0].nom, 'PR #63 · B (ouverte)');
    assert.ok(l[1].nom.includes('fermée'));
    assert.ok(l[2].nom.includes('fusionnée le'));
  });
});
