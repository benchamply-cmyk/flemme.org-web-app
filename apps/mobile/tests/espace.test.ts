import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Task } from '../../../packages/shared/src/index.ts';
import { environnementMobile } from '../src/flagsEnv.ts';
import { fils, memeFiltre, nonLus, nouvellesAlertes } from '../src/espaceRegles.ts';

const moi = { id: 'm', name: 'Maud' }, lou = { id: 'l', name: 'Lou' }, ali = { id: 'a', name: 'Ali' };
const msg = (actor: typeof moi, text: string, at: string) => ({ actor, text, at });
const tache = (p: Partial<Task>): Task => ({ id: 't1', title: 'Monter une étagère', details: 'Une étagère murale', place: 'Lyon', category: 'maison', mode: 'sur_place', status: 'open', owner: moi, offers: [], reports: [], history: [], createdAt: '2026-11-20T10:00:00Z', ...p }) as unknown as Task;
const offre = (id: string, brigadier: typeof moi, status: string, messages: ReturnType<typeof msg>[] = []) => ({ id, brigadier, status, amount: 4000, slot: 'Samedi', scope: 'Pose', messages });

test('mobile : environnement des flags lu au build, prudent par défaut', () => {
  assert.equal(environnementMobile('preprod', true), 'preprod');
  assert.equal(environnementMobile(' PROD ', true), 'prod');
  assert.equal(environnementMobile(undefined, true), 'prod');
  assert.equal(environnementMobile('inconnu', false), 'local');
  assert.equal(environnementMobile('', false), 'local');
});

test('mobile : une discussion par offre active, la plus récente d’abord, avec les non-lus', () => {
  const t1 = tache({ offers: [offre('o1', lou, 'pending', [msg(lou, 'Bonjour', '2026-11-21T09:00:00Z'), msg(moi, 'Oui ?', '2026-11-21T10:00:00Z'), msg(lou, 'Samedi ?', '2026-11-21T11:00:00Z')]), offre('o2', ali, 'declined', [msg(ali, 'Hé', '2026-11-22T09:00:00Z')])] as never });
  const t2 = tache({ id: 't2', owner: lou, offers: [offre('o3', moi, 'pending', [msg(lou, 'Merci', '2026-11-22T12:00:00Z')])] as never });
  const t3 = tache({ id: 't3', owner: lou, offers: [offre('o4', ali, 'pending', [msg(ali, 'Privé', '2026-11-23T12:00:00Z')])] as never });
  const liste = fils([t1, t2, t3], moi.id, { o1: '2026-11-21T10:30:00Z' });
  assert.deepEqual(liste.map(f => f.offerId), ['o3', 'o1'], 'offre déclinée et discussion des autres exclues');
  assert.equal(liste[1].avec, 'Lou');
  assert.equal(liste[0].avec, 'Lou');
  assert.equal(liste[1].nonLus, 1, 'seuls les messages des autres après la lecture');
  assert.equal(nonLus([t1, t2, t3], moi.id, { o1: '2026-11-21T10:30:00Z' }), 2);
});

test('mobile : alertes de demandes, seulement les nouvelles demandes ouvertes des autres', () => {
  const alerte = { id: '1', filtre: { category: 'maison', q: 'étagère' }, libelle: 'maison', vuLe: '2026-11-21T00:00:00Z' };
  const nouvelle = tache({ id: 'n', owner: lou, createdAt: '2026-11-22T00:00:00Z' });
  const ancienne = tache({ id: 'v', owner: lou, createdAt: '2026-11-20T00:00:00Z' });
  const mienne = tache({ id: 'x', createdAt: '2026-11-22T00:00:00Z' });
  const autre = tache({ id: 'y', owner: lou, category: 'numerique', createdAt: '2026-11-22T00:00:00Z' });
  assert.equal(nouvellesAlertes([alerte], [nouvelle, ancienne, mienne, autre], moi.id), 1);
  assert.ok(memeFiltre({ category: 'maison', sort: 'prix' }, { category: 'maison' }));
  assert.ok(!memeFiltre({ category: 'maison' }, { category: 'maison', mode: 'distance' }));
});
