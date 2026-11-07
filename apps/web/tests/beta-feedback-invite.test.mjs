import test from 'node:test';
import assert from 'node:assert/strict';
import login from '../netlify/functions/beta-auth.mjs';
import feedback from '../netlify/functions/beta-feedback.mjs';
const origin='https://flemme.org';
const form={id:'2d9a4527-7eca-4a22-b3b9-a5fa4cd8ac15',consent:true,rating:4,comment:'La navigation est facile à comprendre.',page:'index.html',variant:{theme:'clair',color:'#b8f0de',navigation:'burger',features:{aide:true,premium:false}}};
const request=(session='',body=form,from=origin)=>new Request(origin+'/.netlify/functions/beta-feedback',{method:'POST',headers:{origin:from,cookie:session,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('anonymous invited visitor saves feedback and notifies Ben without account or Auth call',async()=>{
 const old={...process.env},original=globalThis.fetch;const calls=[];
 try{
  for(const key of Object.keys(process.env))if(key.startsWith('BETA_'))delete process.env[key];
  Object.assign(process.env,{BETA_ENABLED:'oui',BETA_SESSION_SECRET:'test-session-'.repeat(4),BETA_INVITE_TOKEN:'test-invite-'.repeat(4),BETA_INVITE_EXPIRES_AT:'2099-01-01T00:00:00Z',BETA_FEEDBACK_ENABLED:'oui',BETA_SUPABASE_URL:'https://isolated.supabase.co',BETA_SUPABASE_SECRET_KEY:'test-only-secret',BETA_RESEND_API_KEY:'test-only-email',BETA_EMAIL_FROM:'test@example.test'});
  const invited=await login(new Request(origin+'/.netlify/functions/beta-auth',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({invite:process.env.BETA_INVITE_TOKEN})}));
  assert.equal(invited.status,200);const cookie=invited.headers.get('set-cookie').split(';')[0];
  let failEmail=false,failStorage=false;
  globalThis.fetch=async(url,options={})=>{
   calls.push({url,options});
   assert.ok(!url.includes('/auth/'),'anonymous invitation must not require an account');
   if(url.includes('resend.com'))return new Response('{}',{status:failEmail?500:200});
   if(options.method==='POST')return new Response(null,{status:failStorage?500:201});
   if(options.method==='PATCH')return new Response(null,{status:204});
   return new Response(JSON.stringify([{...form,notified_at:null}]));
  };
  assert.equal((await feedback(request())).status,403);assert.equal(calls.length,0);
  assert.equal((await feedback(request(cookie,form,'https://evil.test'))).status,403);assert.equal(calls.length,0);
  assert.equal((await feedback(request(cookie,{...form,rating:0}))).status,400);assert.equal(calls.length,0);
  const result=await feedback(request(cookie));assert.deepEqual(await result.json(),{saved:true,notified:true});
  const sent=calls.find(c=>c.url.includes('resend.com'));assert.ok(sent);const email=JSON.parse(sent.options.body);
  assert.deepEqual(email.to,['ben.champly@gmail.com']);assert.ok(email.text.includes(form.comment));assert.ok(email.text.includes('4/5'));
  assert.ok(calls[0].url.includes('supabase.co/rest/v1/beta_feedback'),'persist before notifying');
  calls.length=0;failEmail=true;assert.deepEqual(await(await feedback(request(cookie))).json(),{saved:true,notified:false});
  calls.length=0;failStorage=true;assert.equal((await feedback(request(cookie))).status,502);assert.ok(!calls.some(c=>c.url.includes('resend.com')));
  process.env.BETA_FEEDBACK_ENABLED='non';assert.equal((await feedback(request(cookie))).status,503);
 }finally{globalThis.fetch=original;for(const key of Object.keys(process.env))if(key.startsWith('BETA_'))delete process.env[key];Object.assign(process.env,old);}
});
