import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteGateway } from '../../../packages/shared/src/gateway.ts';
test('account test access exchanges current bearer only on same-origin function',async()=>{
 const requests:{path:string;init?:RequestInit}[]=[];
 const transport=(async(path:string,init?:RequestInit)=>{
  requests.push({path,init});
  if(path.includes('/token?'))return new Response(JSON.stringify({access_token:'test-access',refresh_token:'test-refresh',expires_in:3600,user:{id:'u'}}));
  if(path.includes('/rpc/'))return new Response(JSON.stringify({profile:{id:'u',name:'Test'}}));
  return new Response(JSON.stringify({allowed:true}));
 }) as typeof fetch;
 const gateway=new RemoteGateway('https://example.supabase.co','test-public',{get:async()=>null,set:async()=>{},clear:async()=>{}},transport);
 await gateway.login('test@example.test','test-password');assert.equal(await gateway.betaAccess(),true);
 const call=requests.at(-1)!;assert.equal(call.path,'/.netlify/functions/beta-auth');assert.equal(call.init?.method,'POST');assert.equal((call.init?.headers as Record<string,string>).Authorization,'Bearer test-access');assert.ok(!call.path.includes('test-access'));
});
