import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preset,normalize,encode,decode,variantCSS,sectionKeys} from '../src/atelier/model.ts';
test('shared variant preserves settings and reference',()=>{const d=preset('expressif');d.show.price=false;d.order.reverse();assert.deepEqual(decode(encode(d,'abc'),'abc'),d);assert.throws(()=>decode(encode(d,'abc'),'other'));});
test('untrusted settings cannot inject CSS or duplicate sections',()=>{const d=normalize({accent:'red;}body{display:none',radius:999,spacing:-1,order:['hero','hero','unknown']});assert.equal(d.accent,'#a5ccff');assert.equal(d.radius,40);assert.equal(d.spacing,32);assert.deepEqual(d.order,sectionKeys);});
test('reference has no appearance overrides',()=>assert.equal(variantCSS(preset('reference')),''));
