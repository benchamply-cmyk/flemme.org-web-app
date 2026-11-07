import { timingSafeEqual } from 'node:crypto';
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type':'application/json','Cache-Control':'no-store' } });
export function validFeedback(b) {
 return b && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.id || '') && b.consent === true && !b.website && Number.isInteger(b.rating) && b.rating >= 1 && b.rating <= 5 && typeof b.comment === 'string' && b.comment.trim().length >= 10 && b.comment.length <= 3000 && ['index.html','comment-ca-marche.html','resoudre.html','faq.html','premium.html','contact.html','app.html'].includes(b.page) && ['clair','nuit','papier'].includes(b.variant?.theme) && /^#[0-9a-f]{6}$/i.test(b.variant?.color || '') && ['burger','visible','compacte'].includes(b.variant?.navigation) && typeof b.variant?.features?.aide === 'boolean' && typeof b.variant?.features?.premium === 'boolean';
}
export default async function handler(req) {
 const e=process.env; let db;
 try { db=new URL(e.BETA_SUPABASE_URL); } catch { return json(503,{error:'not_configured'}); }
 if(e.BETA_FEEDBACK_ENABLED!=='oui' || !e.BETA_ALLOWED_ORIGIN || !e.BETA_INVITE_CODE || !e.BETA_SUPABASE_SECRET_KEY || db.protocol!=='https:' || !db.hostname.endsWith('.supabase.co') || db.hostname==='yktpabnqkhwcshvjuncs.supabase.co') return json(503,{error:'not_configured'});
 if(req.headers.get('origin')!==e.BETA_ALLOWED_ORIGIN || ['flemme.org','www.flemme.org'].includes(new URL(req.url).hostname)) return json(403,{error:'forbidden'});
 if(req.method!=='POST') return json(405,{error:'method'});
 if(!req.headers.get('content-type')?.startsWith('application/json')) return json(415,{error:'content_type'});
 const raw=await req.text(); if(raw.length>12000) return json(413,{error:'too_large'});
 let b; try { b=JSON.parse(raw); } catch { return json(400,{error:'invalid'}); }
 const supplied=Buffer.from(typeof b?.invite==='string'?b.invite:''), expected=Buffer.from(e.BETA_INVITE_CODE);
 if(supplied.length!==expected.length || !timingSafeEqual(supplied,expected)) return json(403,{error:'invite'});
 if(!validFeedback(b)) return json(400,{error:'invalid'});
 const row={id:b.id,variant:{theme:b.variant.theme,color:b.variant.color,navigation:b.variant.navigation,features:{aide:b.variant.features.aide,premium:b.variant.features.premium}},page:b.page,rating:b.rating,comment:b.comment.trim(),consent:true};
 const headers={apikey:e.BETA_SUPABASE_SECRET_KEY,Authorization:`Bearer ${e.BETA_SUPABASE_SECRET_KEY}`,'Content-Type':'application/json'};
 let saved=false;
 try {
  const written=await fetch(`${db.origin}/rest/v1/beta_feedback?on_conflict=id`,{method:'POST',headers:{...headers,Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(row),signal:AbortSignal.timeout(8000)});
  if(!written.ok) return json(502,{error:'storage_failed'}); saved=true;
  const found=await fetch(`${db.origin}/rest/v1/beta_feedback?id=eq.${b.id}&select=id,variant,page,rating,comment,notified_at`,{headers,signal:AbortSignal.timeout(8000)});
  if(!found.ok) return json(200,{saved:true,notified:false});
  const [stored]=await found.json(); if(!stored) return json(200,{saved:true,notified:false});
  if(stored.notified_at) return json(200,{saved:true,notified:true});
  if(!e.BETA_RESEND_API_KEY || !e.BETA_EMAIL_TO || !e.BETA_EMAIL_FROM) return json(200,{saved:true,notified:false});
  const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${e.BETA_RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`beta-feedback-${b.id}`},body:JSON.stringify({from:e.BETA_EMAIL_FROM,to:[e.BETA_EMAIL_TO],subject:'FLEMME — retour bêta',text:JSON.stringify(stored,null,2)}),signal:AbortSignal.timeout(8000)});
  if(!sent.ok) return json(200,{saved:true,notified:false});
  await fetch(`${db.origin}/rest/v1/beta_feedback?id=eq.${b.id}`,{method:'PATCH',headers,body:JSON.stringify({notified_at:new Date().toISOString()}),signal:AbortSignal.timeout(8000)});
  return json(200,{saved:true,notified:true});
 } catch { return saved ? json(200,{saved:true,notified:false}) : json(502,{error:'temporarily_unavailable'}); }
}
export const config={rateLimit:{windowLimit:10,windowSize:60,aggregateBy:['ip','domain']}};
