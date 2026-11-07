import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{authorize} from '../netlify/functions/beta-auth.mjs';
const base='https://flemme.test/.netlify/functions/beta-auth';
const make=(method='GET',body,session='',origin='https://flemme.test')=>new Request(base,{method,headers:{origin,'Content-Type':'application/json',...(session?{cookie:session}:{})},...(body?{body:JSON.stringify(body)}:{})});
test('server gate: fails closed, validates invite, rejects tampering, expiry and revoked links',async()=>{
 const old={...process.env};try{
  process.env.BETA_ENABLED='non';assert.equal((await handler(make())).status,503);
  Object.assign(process.env,{BETA_ENABLED:'oui',BETA_SESSION_SECRET:'test-only-secret-'.repeat(4),BETA_INVITE_TOKEN:'test-only-invite-'.repeat(4),BETA_INVITE_EXPIRES_AT:'2099-01-01T00:00:00Z'});
  assert.equal(await authorize(make()),false);
  assert.equal((await handler(make('POST',{invite:process.env.BETA_INVITE_TOKEN},'','https://evil.test'))).status,403);
  assert.equal((await handler(make('POST',{invite:'wrong'}))).status,403);
  const res=await handler(make('POST',{invite:process.env.BETA_INVITE_TOKEN}));assert.equal(res.status,200);
  const cookie=res.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);
  const session=cookie.split(';')[0];assert.equal(await authorize(make('GET',null,session)),true);
  assert.equal(await authorize(make('GET',null,session+'x')),false);
  process.env.BETA_INVITE_TOKEN='rotated-token-'.repeat(4);assert.equal(await authorize(make('GET',null,session)),false);
  process.env.BETA_INVITE_EXPIRES_AT='2000-01-01T00:00:00Z';assert.equal((await handler(make('POST',{invite:process.env.BETA_INVITE_TOKEN}))).status,403);
  const logout=await handler(make('DELETE'));assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
 }finally{for(const k of Object.keys(process.env))if(k.startsWith('BETA_'))delete process.env[k];Object.assign(process.env,old);}
});
test('account access requires validated Supabase identity and confirmed reference email',async()=>{
 const old={...process.env},original=globalThis.fetch;try{
  Object.assign(process.env,{BETA_ENABLED:'oui',BETA_SESSION_SECRET:'test-secret-'.repeat(4),VITE_SUPABASE_URL:'https://test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'test-public',BETA_ADMIN_EMAILS:'ben.champly@gmail.com'});
  const calls=[];let email='someone@example.test';
  globalThis.fetch=async(url)=>{calls.push(url);return new Response(JSON.stringify(url.includes('/token?')?{access_token:'test-access'}:{id:'test-user',email,email_confirmed_at:'2026-01-01'}),{status:200});};
  assert.equal((await handler(make('POST',{email:'someone@example.test',password:'test-only'}))).status,403);assert.equal(calls.length,0);
  assert.equal((await handler(make('POST',{email:'ben.champly@gmail.com',password:'test-only'}))).status,403);
  email='ben.champly@gmail.com';const res=await handler(make('POST',{email,password:'test-only'}));assert.equal(res.status,200);
  const session=res.headers.get('set-cookie').split(';')[0];assert.equal(await authorize(make('GET',null,session)),true);
  email='removed@example.test';assert.equal(await authorize(make('GET',null,session)),false);
 }finally{globalThis.fetch=original;for(const k of Object.keys(process.env))if(k.startsWith('BETA_'))delete process.env[k];Object.assign(process.env,old);}
});
test('current-account bearer supports added testers without trusting browser email or role',async()=>{
 const old={...process.env},original=globalThis.fetch;
 try{
  Object.assign(process.env,{BETA_ENABLED:'oui',BETA_SESSION_SECRET:'test-secret-'.repeat(4),BETA_TESTER_EMAILS:'tester@example.test',VITE_SUPABASE_URL:'https://test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'test-public'});
  let identity='outsider@example.test';
  globalThis.fetch=async()=>new Response(JSON.stringify({id:'u',email:identity,email_confirmed_at:'2026-01-01'}));
  const request=()=>new Request(base,{method:'POST',headers:{origin:'https://flemme.test',Authorization:'Bearer test-only-token','Content-Type':'application/json'},body:JSON.stringify({email:'ben.champly@gmail.com',role:'admin'})});
  assert.equal((await handler(request())).status,403);
  identity='tester@example.test';const res=await handler(request());assert.equal(res.status,200);
  const session=res.headers.get('set-cookie').split(';')[0];assert.equal(await authorize(make('GET',null,session)),true);
  process.env.BETA_TESTER_EMAILS='';assert.equal(await authorize(make('GET',null,session)),false);
 }finally{globalThis.fetch=original;for(const k of Object.keys(process.env))if(k.startsWith('BETA_'))delete process.env[k];Object.assign(process.env,old);}
});
