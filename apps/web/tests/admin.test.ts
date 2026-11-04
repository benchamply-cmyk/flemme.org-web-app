import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DemoAdmin, filterDisputes, filterUsers } from '../src/admin/model.ts';

test('démo admin : un litige ouvert issu d’un signalement, comptes de l’ancien espace inclus', async () => {
  const a = new DemoAdmin('2026-11-03T10:00:00.000Z');
  const o = await a.call('overview');
  assert.deepEqual(o.disputes, { open: 1, in_review: 0, resolved: 0 });
  assert.equal((await a.call('reports')).reports.length, 1);
  assert.ok((await a.call('users')).users.some((u: { email: string }) => u.email.startsWith('ancien-espace')));
});
test('démo admin : clôture d’un litige avec décision obligatoire, ajoutée à l’historique et au journal', async () => {
  const a = new DemoAdmin(), [d] = (await a.call('disputes')).disputes;
  await assert.rejects(a.call('dispute_update', { taskId: d.taskId, status: 'resolved', note: ' ' }), /Complète ce champ/);
  await assert.rejects(a.call('dispute_update', { taskId: d.taskId, status: 'supprimé' }), /invalide/);
  await a.call('dispute_update', { taskId: d.taskId, status: 'in_review' });
  await a.call('dispute_update', { taskId: d.taskId, status: 'resolved', note: 'Remboursement du déplacement convenu' });
  const [after] = (await a.call('disputes')).disputes;
  assert.equal(after.status, 'resolved'); assert.match(after.task.history.at(-1).text, /Litige clos par l'équipe FLEMME : Remboursement/);
  assert.deepEqual((await a.call('overview')).log.map((l: { action: string }) => l.action), ['dispute_resolved', 'dispute_in_review']);
});
test('démo admin : suspension avec motif, jamais d’un admin, puis rétablissement', async () => {
  const a = new DemoAdmin(), users = (await a.call('users')).users;
  const admin = users.find((u: { admin: boolean }) => u.admin), member = users.find((u: { admin: boolean }) => !u.admin);
  await assert.rejects(a.call('user_suspend', { userId: admin.id, reason: 'Test' }), /administrateur/);
  await assert.rejects(a.call('user_suspend', { userId: member.id, reason: '' }), /Complète ce champ/);
  await a.call('user_suspend', { userId: member.id, reason: 'Annonces frauduleuses' });
  assert.equal((await a.call('overview')).suspended, 1);
  await a.call('user_restore', { userId: member.id });
  await assert.rejects(a.call('user_restore', { userId: member.id }), /pas suspendu/);
});
test('filtres : recherche d’e-mail insensible à la casse, comptes suspendus, litiges à traiter', async () => {
  const a = new DemoAdmin(), users = (await a.call('users')).users;
  assert.equal(filterUsers(users, 'LOU@', false).length, 1);
  assert.equal(filterUsers(users, '', true).length, 0);
  const rows = (await a.call('disputes')).disputes;
  assert.equal(filterDisputes(rows, 'todo').length, 1); assert.equal(filterDisputes(rows, 'resolved').length, 0);
});
