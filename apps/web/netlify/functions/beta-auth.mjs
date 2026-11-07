import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
const cookieName='flemme_beta';
const env=key=>globalThis.Netlify?.env.get(key) ?? process.env[key];
const equal=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length && timingSafeEqual(x,y);};
const hash=value=>createHash('sha256').update(value).digest('hex');
export const reply=(status,data,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
function settings(){return {enabled:env('BETA_ENABLED')==='oui',secret:env('BETA_SESSION_SECRET'),invite:env('BETA_INVITE_TOKEN')||'',expiry:Date.parse(env('BETA_INVITE_EXPIRES_AT')||''),url:env('VITE_SUPABASE_URL'),key:env('VITE_SUPABASE_PUBLISHABLE_KEY'),emails:(env('BETA_ADMIN_EMAILS')||'ben.champly@gmail.com').split(',').map(x=>x.trim().toLowerCase())};}
function encode(payload,c){const data=Buffer.from(JSON.stringify({...payload,exp:Date.now()+3600000})).toString('base64url');return data+'.'+createHmac('sha256',c.secret).update(data).digest('base64url');}
function decode(value,c){try{const [data,sig]=value.split('.');if(!equal(sig,createHmac('sha256',c.secret).update(data).digest('base64url')))return null;const p=JSON.parse(Buffer.from(data,'base64url'));return p.exp>Date.now()?p:null;}catch{return null;}}
function cookie(value){return `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${value?3600:0}`;}
async function user(token,c){if(!c.url||!c.key||!/^https:\/\//.test(c.url))return null;const res=await fetch(c.url.replace(/\/$/,'')+'/auth/v1/user',{headers:{apikey:c.key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(8000)});if(!res.ok)return null;const u=await res.json();return u.id && u.email_confirmed_at && c.emails.includes((u.email||'').toLowerCase())?u:null;}
export async function authorize(req){
 const c=settings();if(!c.enabled||!c.secret||c.secret.length<32)return false;
 const value=req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 const p=value?decode(value,c):null;if(!p)return false;
 if(p.kind==='invite')return c.invite.length>=32 && c.expiry>Date.now() && equal(p.fingerprint,hash(c.invite));
 if(p.kind==='account')return !!await user(p.token,c);
 return false;
}
export default async function handler(req){
 const c=settings();if(!c.enabled||!c.secret||c.secret.length<32)return reply(503,{allowed:false});
 try {
  if(req.method==='GET'){const allowed=await authorize(req);return reply(allowed?200:403,{allowed});}
  if(req.headers.get('origin')!==new URL(req.url).origin)return reply(403,{allowed:false});
  if(req.method==='DELETE')return reply(200,{allowed:false},{'Set-Cookie':cookie('')});
  if(req.method!=='POST')return reply(405,{allowed:false});
  const raw=await req.text();if(raw.length>5000)return reply(413,{allowed:false});
  let b;try{b=JSON.parse(raw);}catch{return reply(400,{allowed:false});}
  let payload;
  if(typeof b?.invite==='string'){
   if(c.invite.length<32||!(c.expiry>Date.now())||!equal(b.invite,c.invite))return reply(403,{allowed:false});
   payload={kind:'invite',fingerprint:hash(c.invite)};
  }else{
   if(!c.url||!c.key||!/^https:\/\//.test(c.url)||typeof b?.email!=='string'||typeof b?.password!=='string'||!c.emails.includes(b.email.trim().toLowerCase()))return reply(403,{allowed:false});
   const res=await fetch(c.url.replace(/\/$/,'')+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:c.key,'Content-Type':'application/json'},body:JSON.stringify({email:b.email.trim(),password:b.password}),signal:AbortSignal.timeout(8000)});
   if(!res.ok)return reply(403,{allowed:false});const result=await res.json();if(!result.access_token||!await user(result.access_token,c))return reply(403,{allowed:false});
   payload={kind:'account',token:result.access_token};
  }
  return reply(200,{allowed:true},{'Set-Cookie':cookie(encode(payload,c))});
 }catch{return reply(503,{allowed:false});}
}
export const config={rateLimit:{action:'rate_limit',windowLimit:10,windowSize:60,aggregateBy:['ip','domain']}};
