import { readVariant } from './config.ts';
import { checkInternalTestsAccess, hasInternalTestsAccess } from './access.ts';
import './variants.css';
function apply(){
 const root=document.documentElement;
 if(!hasInternalTestsAccess()){
  delete root.dataset.testsInternesTheme;delete root.dataset.testsInternesNav;root.style.removeProperty('--tests-internes-accent');
  document.querySelectorAll<HTMLElement>('[data-tests-internes-hidden]').forEach(e=>{e.hidden=false;delete e.dataset.testsInternesHidden;});
  document.querySelectorAll('[data-tests-internes-link]').forEach(e=>e.remove());return;
 }
 const v=readVariant();root.dataset.testsInternesTheme=v.theme;root.dataset.testsInternesNav=v.navigation;root.style.setProperty('--tests-internes-accent',v.color);
 document.querySelectorAll<HTMLDetailsElement>('details.burger').forEach(e=>{if(v.navigation==='visible')e.open=true;});
 document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(e=>{const path=new URL(e.href).pathname.replace(/\.html$/,'');if(path==='/premium'){e.hidden=!v.features.premium;e.dataset.testsInternesHidden='true';}});
 document.querySelectorAll<HTMLElement>('a[href="#aide"], [data-tests-internes-feature="aide"]').forEach(e=>{e.hidden=!v.features.aide;e.dataset.testsInternesHidden='true';});
 document.querySelectorAll('.burger-menu').forEach(menu=>{if(!menu.querySelector('[data-tests-internes-link]')){const a=document.createElement('a');a.href='/tests/internes';a.textContent='tests/internes';a.dataset.testsInternesLink='true';menu.append(a);}});
}
addEventListener('flemme-tests-internes-access',apply);addEventListener('storage',apply);
new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});
void checkInternalTestsAccess();setInterval(()=>void checkInternalTestsAccess(),60000);addEventListener('focus',()=>void checkInternalTestsAccess());
