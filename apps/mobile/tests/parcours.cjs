const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

// Vérification des actions réellement câblées aux écrans, sans simulateur natif.
const saved = [];
const load = Module._load;
Module._load = function (name, parent, main) {
  if (name === 'react-native') return { Text: 'Text', View: 'View', Pressable: 'Pressable' };
  if (name === '../session') return { session: { saveDraft: (...args) => saved.push(args) } };
  if (name === '../ui/styles' || name === './styles') return { styles: {} };
  return load.call(this, name, parent, main);
};
require.extensions['.tsx'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, file);
const { NouvelleFlemme } = require('../src/ecrans/NouvelleFlemme.tsx');
const { Accueil } = require('../src/ecrans/Accueil.tsx');
const { Action } = require('../src/ui/composants.tsx');
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const draft = { title: 'Remettre mon CV au propre', details: 'Une page claire', category: 'numerique', mode: 'distance', amount: '40', place: 'Ancien lieu', address: 'Ancienne adresse' };
const base = { state: { busy: false, actorId: 'a' }, place: { screen: 'new', tab: 'mine', taskId: '', offerId: '' }, draft, field: () => null, choice: () => null, validated: fn => fn(), keepDraft: () => {}, fill: () => {} };

test('accueil : déléguer ouvre le dépôt, résoudre ouvre les demandes et Mon espace reste accessible', () => {
  const visits = [];
  const buttons = nodes(Accueil({ go: (s, c) => visits.push(s + ':' + (c?.tab || '')) })).filter(n => n.type === 'Pressable' || n.type === Action);
  for (const b of buttons) b.props.onPress();
  assert.deepEqual(visits, ['new:mine', 'list:find', 'list:mine']);
});
test('envoi mobile : validation partagée, adresse distante retirée, brouillon repris transmis', () => {
  let submitted;
  const tree = NouvelleFlemme({ ...base, mutate: (...args) => { submitted = args; } });
  const send = nodes(tree).find(n => n.type === Action && n.props.children === 'Envoyer ma demande');
  send.props.onPress();
  assert.equal(submitted[0], 'create');
  assert.equal(submitted[1].budget, 4000);
  assert.equal(submitted[1].category, 'numerique');
  assert.equal(submitted[1].address, null);
  assert.equal(submitted[1].draftId, null);
  assert.match(submitted[3]({ review: 'pending' }), /en cours de relecture/);
  assert.throws(() => nodes(NouvelleFlemme({ ...base, draft: { ...draft, category: '' } })).find(n => n.type === Action).props.onPress(), /catégorie/);
});
test('brouillons : le premier enregistrement crée le brouillon, la reprise le met à jour', () => {
  saved.length = 0;
  const kept = [];
  const first = nodes(NouvelleFlemme({ ...base, mutate: () => {}, keepDraft: id => kept.push(id) })).find(n => n.type === Action && n.props.children === 'Enregistrer le brouillon');
  first.props.onPress();
  assert.equal(saved[0][0].id, undefined);
  assert.equal(saved[0][0].fields.title, draft.title);
  saved[0][1]({ id: 'b1' });
  assert.deepEqual(kept, ['b1']);
  const again = nodes(NouvelleFlemme({ ...base, place: { ...base.place, draftId: 'b1' }, mutate: () => {} })).find(n => n.type === Action && n.props.children === 'Enregistrer le brouillon');
  again.props.onPress();
  assert.equal(saved[1][0].id, 'b1');
});
test('modification : une demande attribuée ne présente aucun bouton d’envoi', () => {
  const task = { owner: { id: 'a' }, status: 'assigned', offers: [] };
  const tree = NouvelleFlemme({ ...base, place: { ...base.place, screen: 'edit' }, task });
  assert.equal(nodes(tree).filter(n => n.type === Action).length, 0);
});
