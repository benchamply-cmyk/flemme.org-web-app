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
const base = { state: { busy: false, actorId: 'a' }, screen: 'new', draft, field: () => null, choice: () => null, validated: fn => fn() };

test('accueil : déléguer ouvre le dépôt, résoudre ouvre les missions et le suivi reste accessible', () => {
  const visits = [];
  const buttons = nodes(Accueil({ navigate: s => visits.push(s), openList: t => visits.push(t) })).filter(n => n.type === 'Pressable');
  for (const b of buttons) b.props.onPress();
  assert.deepEqual(visits, ['new', 'find', 'mine']);
});
test('envoi mobile : validation partagée, adresse distante retirée et brouillon conservé', () => {
  let submitted;
  const tree = NouvelleFlemme({ ...base, mutate: (...args) => { submitted = args; } });
  const send = nodes(tree).find(n => n.type === Action && n.props.children === 'Envoyer pour validation');
  send.props.onPress();
  assert.equal(submitted[0], 'create');
  assert.equal(submitted[1].budget, 4000);
  assert.equal(submitted[1].category, 'numerique');
  assert.equal(submitted[1].address, null);
  assert.equal(Object.hasOwn(submitted[1], 'draftId'), false);
  assert.match(submitted[3]({ review: 'pending' }), /en cours de relecture/);
  assert.throws(() => nodes(NouvelleFlemme({ ...base, draft: { ...draft, category: '' } })).find(n => n.type === Action).props.onPress(), /catégorie/);
});
test('brouillons : deux enregistrements créent deux versions, sans identifiant à écraser', () => {
  saved.length = 0;
  const tree = NouvelleFlemme({ ...base, mutate: () => {} });
  const save = nodes(tree).find(n => n.type === Action && n.props.secondary);
  save.props.onPress(); save.props.onPress();
  assert.equal(saved.length, 2);
  for (const [data] of saved) {
    assert.equal(Object.hasOwn(data, 'id'), false);
    assert.equal(data.fields.title, draft.title);
  }
});
test('modification : une demande attribuée ne présente aucun bouton d’envoi', () => {
  const task = { owner: { id: 'a' }, status: 'assigned', offers: [] };
  const tree = NouvelleFlemme({ ...base, screen: 'edit', task });
  assert.equal(nodes(tree).filter(n => n.type === Action).length, 0);
});
