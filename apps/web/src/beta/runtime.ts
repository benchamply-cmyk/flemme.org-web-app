import { readVariant } from './config.ts';
import { checkBetaAccess, hasBetaAccess } from './access.ts';
import './variants.css';
function apply(){
 const root=document.documentElement;
 if(!hasBetaAccess()){
  delete root.dataset.betaTheme;delete root.dataset.betaNav;root.style.removeProperty('--beta-accent');
  document.querySelectorAll<HTMLElement>('[data-beta-hidden]').forEach(e=>{e.hidden=false;delete e.dataset.betaHidden;});
  document.querySelectorAll('[data-beta-link]').forEach(e=>e.remove());return;
 }
 const v=readVariant();root.dataset.betaTheme=v.theme;root.dataset.betaNav=v.navigation;root.style.setProperty('--beta-accent',v.color);
 document.querySelectorAll<HTMLDetailsElement>('details.burger').forEach(e=>{if(v.navigation==='visible')e.open=true;});
 document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(e=>{const path=new URL(e.href).pathname.replace(/\.html$/,'');if(path==='/premium'){e.hidden=!v.features.premium;e.dataset.betaHidden='true';}});
 document.querySelectorAll<HTMLElement>('a[href="#aide"], [data-beta-feature="aide"]').forEach(e=>{e.hidden=!v.features.aide;e.dataset.betaHidden='true';});
 // Lien Bêta : premier menu burger (app) ou navigation pastille de la vitrine (menu déroulant et panneau).
 const menus=document.querySelector('.pn')?[...document.querySelectorAll('#pnDeroulant, .pn-panneau')]:[...document.querySelectorAll('.burger-menu')].slice(0,1);
 menus.forEach(menu=>{if(!menu.querySelector('[data-beta-link]')){const a=document.createElement('a');a.href='/beta';a.textContent='Bêta';a.dataset.betaLink='true';menu.append(a);}});
}
addEventListener('flemme-beta-access',apply);addEventListener('storage',apply);
new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});
void checkBetaAccess();setInterval(()=>void checkBetaAccess(),60000);addEventListener('focus',()=>void checkBetaAccess());
