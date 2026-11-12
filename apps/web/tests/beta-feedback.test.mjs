import test from 'node:test';
import assert from 'node:assert/strict';
import {validFeedback} from '../netlify/functions/beta-feedback.mjs';
const body={id:'2d9a4527-7eca-4a22-b3b9-a5fa4cd8ac15',consent:true,rating:4,comment:'Navigation facile à comprendre',page:'index.html',variant:{theme:'clair',color:'#b8f0de',navigation:'burger',features:{aide:true,premium:false}},invite:'test-only'};
const request=(b=body,origin='https://beta.example.test')=>new Request('https://beta.example.test/.netlify/functions/beta-feedback',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(b)});
test('feedback rejects forged variants, invalid ratings, missing consent and oversized comments',()=>{
 assert.ok(validFeedback(body));
 for(const change of [{rating:0},{rating:6},{rating:1.5},{consent:false},{comment:'court'},{comment:'x'.repeat(3001)},{website:'spam'},{page:'https://evil.test'},{variant:{...body.variant,color:'url(evil)'}},{id:'invalid'}]) assert.ok(!validFeedback({...body,...change}));
});
// Le scénario « code testeur dans le corps de la requête » de l'ancienne bêta a été remplacé (fusion preprod → beta, 12 nov. 2026)
// par l'accès vérifié par session : voir tests/beta-feedback-invite.test.mjs (stockage avant e-mail, origine, état honnête).
