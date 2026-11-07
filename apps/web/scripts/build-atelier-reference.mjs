import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const reference=JSON.parse(readFileSync(join(root,'atelier/reference.json'),'utf8'));
if(!/^[a-f0-9]{40}$/.test(reference.commit))throw Error('Référence de l’atelier invalide');
try{execFileSync('git',['cat-file','-e',reference.commit+'^{commit}'],{cwd:root,stdio:'ignore'});}catch{execFileSync('git',['fetch','--depth=1','origin',reference.commit],{cwd:root,stdio:'inherit'});}
const temp=mkdtempSync(join(tmpdir(),'flemme-reference-'));
const target=join(root,'apps/web/public/atelier-reference');
try{
 const archive=execFileSync('git',['archive',reference.commit,'apps/web','packages/shared'],{cwd:root,maxBuffer:30*1024*1024});
 execFileSync('tar',['-x','-C',temp],{input:archive});
 const web=join(temp,'apps/web');
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>! /^(VITE_|BETA_|TESTS_INTERNES_|SUPABASE|RESEND|STRIPE|OPENAI)/.test(key)));
 env.VITE_PAIEMENT_EN_LIGNE='non';
 for(const args of [['ci','--ignore-scripts','--no-audit','--no-fund'],['run','build','--','--base=/atelier-reference/']]){
  const run=spawnSync('npm',args,{cwd:web,env,stdio:'inherit'});if(run.status!==0)throw Error('Échec du build de la référence de l’atelier');
 }
 rmSync(target,{recursive:true,force:true});mkdirSync(target,{recursive:true});cpSync(join(web,'dist'),target,{recursive:true});
 writeFileSync(join(root,'apps/web/public/atelier-build.json'),JSON.stringify({...reference,deployUrl:process.env.DEPLOY_URL||'',buildCommit:process.env.COMMIT_REF||execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()},null,2));
 console.log('Référence '+(reference.label||reference.branch)+' compilée en mode démonstration : '+reference.commit);
}finally{rmSync(temp,{recursive:true,force:true});}
