import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Compile chaque version de atelier/reference.json en démonstration dans public/atelier-reference/<id>/.
const root=fileURLToPath(new URL('../../../',import.meta.url));
const reference=JSON.parse(readFileSync(join(root,'atelier/reference.json'),'utf8'));
if(!Array.isArray(reference.versions)||!reference.versions.length)throw Error('Aucune version dans atelier/reference.json');
const target=join(root,'apps/web/public/atelier-reference');
rmSync(target,{recursive:true,force:true});mkdirSync(target,{recursive:true});
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>! /^(VITE_|BETA_|TESTS_INTERNES_|SUPABASE|RESEND|STRIPE|OPENAI)/.test(key)));
env.VITE_PAIEMENT_EN_LIGNE='non';
for(const version of reference.versions){
 if(!/^[a-z0-9]{2,12}$/.test(version.id)||!/^[a-f0-9]{40}$/.test(version.commit)||!['v05','v06','p55','v63'].includes(version.family))throw Error('Version invalide : '+JSON.stringify(version));
 try{execFileSync('git',['cat-file','-e',version.commit+'^{commit}'],{cwd:root,stdio:'ignore'});}catch{execFileSync('git',['fetch','--depth=1','origin',version.commit],{cwd:root,stdio:'inherit'});}
 const temp=mkdtempSync(join(tmpdir(),'flemme-reference-'));
 try{
  const paths=['apps/web'];for(const extra of ['packages/shared','apps/mobile/src','beta'])try{execFileSync('git',['cat-file','-e',version.commit+':'+extra],{cwd:root,stdio:'ignore'});paths.push(extra);}catch{}
  const archive=execFileSync('git',['archive',version.commit,...paths],{cwd:root,maxBuffer:30*1024*1024});
  execFileSync('tar',['-x','-C',temp],{input:archive});
  const web=join(temp,'apps/web');
  for(const args of [['ci','--ignore-scripts','--no-audit','--no-fund'],['run','build','--','--base=/atelier-reference/'+version.id+'/']]){
   const run=spawnSync('npm',args,{cwd:web,env,stdio:'inherit'});if(run.status!==0)throw Error('Échec du build de la version '+version.id);
  }
  cpSync(join(web,'dist'),join(target,version.id),{recursive:true});
  console.log(`Version ${version.id} (${version.label}) compilée en démonstration : ${version.commit}`);
 }finally{rmSync(temp,{recursive:true,force:true});}
}
writeFileSync(join(root,'apps/web/public/atelier-build.json'),JSON.stringify({...reference,deployUrl:process.env.DEPLOY_URL||'',buildCommit:process.env.COMMIT_REF||execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()},null,2));
