import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preset,normalize,encode,decode,variantCSS,sectionKeysOf} from '../src/atelier/model.ts';
const versions=[{id:'v05',commit:'a'.repeat(40),family:'v05' as const},{id:'v63',commit:'b'.repeat(40),family:'v63' as const}];
test('shared variant preserves version, settings and reference',()=>{const d=preset('expressif');d.show.trust=false;d.order.reverse();assert.deepEqual(decode(encode(d,'v05','a'.repeat(40)),versions),{version:'v05',design:normalize(d)});assert.throws(()=>decode(encode(d,'v05','c'.repeat(40)),versions));assert.throws(()=>decode(encode(d,'zz','a'.repeat(40)),versions));});
test('untrusted settings cannot inject CSS or duplicate sections',()=>{const d=normalize({accent:'red;}body{display:none',radius:999,spacing:-1,order:['hero','hero','unknown']});assert.equal(d.accent,'#a5ccff');assert.equal(d.radius,40);assert.equal(d.spacing,32);assert.deepEqual(d.order,sectionKeysOf('v05'));});
test('reference has no appearance overrides in both families',()=>{assert.equal(variantCSS(preset('reference')),'');assert.equal(variantCSS(preset('reference','v63')),'');});
test('sections follow the family of the version',()=>{assert.ok('price' in preset('reference','v63').show);assert.ok(!('price' in normalize({order:['price']},'v05').show));});
test('variant CSS targets each family selectors',()=>{assert.match(variantCSS({...preset('essentiel'),menu:'compact'}),/main>\.bloc\{padding-top:40px/);assert.match(variantCSS(preset('essentiel','v63')),/\.site\{gap:90px/);});
