import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preset,normalize,encode,decode,variantCSS,sectionKeys} from '../src/atelier/model.ts';
test('shared variant preserves settings and reference',()=>{const d=preset('expressif');d.show.trust=false;d.order.reverse();assert.deepEqual(decode(encode(d,'abc'),'abc'),d);assert.throws(()=>decode(encode(d,'abc'),'other'));});
test('untrusted settings cannot inject CSS or duplicate sections',()=>{const d=normalize({accent:'red;}body{display:none',radius:999,spacing:-1,order:['hero','hero','unknown']});assert.equal(d.accent,'#a5ccff');assert.equal(d.radius,40);assert.equal(d.spacing,32);assert.deepEqual(d.order,sectionKeys);});
test('reference has no appearance overrides',()=>assert.equal(variantCSS(preset('reference')),''));
test('V0.5 sections: hero and footer stay fixed, old keys are dropped',()=>{const d=normalize({order:['price','contact','hero']});assert.deepEqual(d.order.slice(0,2),['contact','hero']);assert.ok(!('price' in d.show));});
test('variant CSS targets the V0.5 site selectors',()=>{const css=variantCSS({...preset('essentiel'),menu:'compact'});assert.match(css,/main>\.bloc\{padding-top:40px/);assert.match(css,/\.entete\{padding/);assert.match(css,/--police:/);});
