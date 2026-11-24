import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAREME_FRAIS, FAMILLES_EN_AVANT, fraisBareme, lignesBareme, tauxEffectifBps } from '../src/bareme.ts';

test('barème : montants de l’analyse v0.2 (§2.3), en centimes', () => {
  const attendus: [number, number][] = [
    [1000, 200], [1500, 225], [2000, 300], [3000, 450], [5000, 650], [6000, 750],
    [10000, 1150], [15000, 1550], [30000, 2750], [50000, 3950], [100000, 6950],
  ];
  for (const [prix, frais] of attendus) assert.equal(fraisBareme(prix), frais, `${prix} centimes`);
});

test('barème : minimum de 2 €, gratuit à 0 €, entrées invalides refusées', () => {
  assert.equal(fraisBareme(0), 0);
  assert.equal(fraisBareme(1), BAREME_FRAIS.minimum);
  assert.equal(fraisBareme(1333), 200);
  for (const bad of [-1, 12.5, Number.NaN]) assert.throws(() => fraisBareme(bad));
});

test('barème : jamais d’effet de seuil (les frais ne baissent pas quand le prix monte)', () => {
  let avant = 0;
  for (let prix = 0; prix <= 120000; prix += 50) {
    const f = fraisBareme(prix);
    assert.ok(f >= avant, `${prix} centimes`);
    avant = f;
  }
});

test('barème : taux effectif et lignes lisibles', () => {
  assert.equal(tauxEffectifBps(5000), 1300);
  assert.equal(tauxEffectifBps(0), 0);
  const lignes = lignesBareme();
  assert.equal(lignes.length, BAREME_FRAIS.tranches.length + 1);
  assert.match(lignes[0].tranche, /30/); assert.equal(lignes[0].taux, '15 %');
  assert.match(lignes.at(-1)!.taux, /2/);
  assert.equal(FAMILLES_EN_AVANT.length, 6);
});
