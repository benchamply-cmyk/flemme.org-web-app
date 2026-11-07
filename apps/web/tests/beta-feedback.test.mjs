import test from 'node:test';
import assert from 'node:assert/strict';
import handler, {validFeedback} from '../netlify/functions/beta-feedback.mjs';
const body={id:'2d9a4527-7eca-4a22-b3b9-a5fa4cd8ac15',consent:true,rating:4,comment:'Navigation facile à comprendre',page:'index.html',variant:{theme:'clair',color:'#b8f0de',navigation:'burger',features:{aide:true,premium:false}},invite:'test-only'};
const request=(b=body,origin='https://beta.example.test')=>new Request('https://beta.example.test/.netlify/functions/beta-feedback',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(b)});
test('feedback rejects forged variants, invalid ratings, missing consent and oversized comments',()=>{
 assert.ok(validFeedback(body));
 for(const change of [{rating:0},{rating:6},{rating:1.5},{consent:false},{comment:'court'},{comment:'x'.repeat(3001)},{website:'spam'},{page:'https://evil.test'},{variant:{...body.variant,color:'url(evil)'}},{id:'invalid'}]) assert.ok(!validFeedback({...body,...change}));
});
test('feedback isolation, durable write before email and honest delivery state',async()=>{
 const previous={...process.env},originalFetch=globalThis.fetch;
 try {
  for(const key of Object.keys(process.env)) if(key.startsWith('BETA_')) delete process.env[key];
  assert.equal((await handler(request())).status,503);
  Object.assign(process.env,{BETA_FEEDBACK_ENABLED:'oui',BETA_ALLOWED_ORIGIN:'https://beta.example.test',BETA_INVITE_CODE:'test-only',BETA_SUPABASE_SECRET_KEY:'test-secret',BETA_SUPABASE_URL:'https://yktpabnqkhwcshvjuncs.supabase.co'});
  assert.equal((await handler(request())).status,503);
  process.env.BETA_SUPABASE_URL='https://isolated.supabase.co';
  assert.equal((await handler(request(body,'https://evil.test'))).status,403);
  assert.equal((await handler(request({...body,invite:'wrong'}))).status,403);
  const calls=[];globalThis.fetch=async(url,options)=>{calls.push([url,options]);return new Response('',{status:500});};
  assert.equal((await handler(request())).status,502);assert.equal(calls.length,1);
  globalThis.fetch=async(url,options)=>{calls.push([url,options]);return new Response('',{status:201});};
  assert.deepEqual(await (await handler(request())).json(),{saved:true,notified:false});
  Object.assign(process.env,{BETA_RESEND_API_KEY:'test',BETA_EMAIL_TO:'test@example.test',BETA_EMAIL_FROM:'test@example.test'});
  calls.length=0;
  globalThis.fetch=async(url,options)=>{calls.push([url,options]);return new Response(options.method==='POST' && url.includes('supabase')?'':url.includes('select=')?JSON.stringify([{...body,notified_at:null}]):'{}',{status:200});};
  assert.deepEqual(await (await handler(request())).json(),{saved:true,notified:true});
  assert.equal(calls.length,4);assert.ok(calls[0][0].includes('beta_feedback'));assert.equal(calls[2][0],'https://api.resend.com/emails');assert.equal(calls[2][1].headers['Idempotency-Key'],`beta-feedback-${body.id}`);
 } finally {globalThis.fetch=originalFetch;for(const key of Object.keys(process.env)) if(key.startsWith('BETA_')) delete process.env[key];Object.assign(process.env,previous);}
});
