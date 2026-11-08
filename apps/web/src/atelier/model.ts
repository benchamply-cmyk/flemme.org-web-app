// Atelier visuel : plusieurs versions du site (atelier/reference.json) et directions réglables.
// Deux familles de structure HTML : « v05 » (vitrine multipage, PR #38 et #41) et « v63 » (accueil de prod v6.3000).
export type Family='v05'|'v63';
export const families={
 v05:{labels:{hero:'Présentation',steps:'En bref, trois étapes',examples:'Exemples de demandes',trust:'Tu gardes la main',contact:'Écris-nous',footer:'Pied de page'},fixed:['hero','footer']},
 v63:{labels:{hero:'Présentation',examples:'Exemples de demandes',steps:'Comment ça marche',price:'Prix et calculateur',help:'Proposer son aide',limits:'Conditions du service',footer:'Pied de page'},fixed:['examples','footer']},
} as const satisfies Record<Family,{labels:Record<string,string>;fixed:readonly string[]}>;
export type Section=string;
export const sectionKeysOf=(f:Family)=>Object.keys(families[f].labels);
export const sectionLabel=(f:Family,k:string)=>(families[f].labels as Record<string,string>)[k]||k;
export const isFixed=(f:Family,k:string)=>(families[f].fixed as readonly string[]).includes(k);
export type Preset='reference'|'essentiel'|'expressif'|'guide';
export const presetKeys:Preset[]=['reference','essentiel','expressif','guide'];
export type Design={family:Family;preset:Preset;custom:boolean;accent:string;background:string;radius:number;spacing:number;font:'sans'|'serif';menu:'original'|'compact'|'visible';show:Record<string,boolean>;order:string[];texts:Record<string,string>};
export const labels:Record<Preset,string>={reference:'Référence',essentiel:'Essentiel',expressif:'Expressif',guide:'Guidé'};
export function preset(name:Preset,family:Family='v05'):Design{
 const keys=sectionKeysOf(family),v05=family==='v05';
 const base:Design={family,preset:name,custom:false,accent:'#a5ccff',background:v05?'#e6efff':'#e3eeff',radius:v05?14:24,spacing:v05?48:72,font:'sans',menu:'original',show:Object.fromEntries(keys.map(k=>[k,true])),order:[...keys],texts:{}};
 if(name==='essentiel')Object.assign(base,{accent:'#d7e8df',background:'#ffffff',radius:6,spacing:v05?80:90});
 if(name==='expressif')Object.assign(base,{accent:'#d9ccff',background:'#fff3df',radius:v05?28:30,spacing:v05?56:68});
 if(name==='guide')Object.assign(base,{accent:'#bcebd9',background:'#f2f6fb',radius:v05?12:14,spacing:v05?44:60,menu:'visible'});
 return base;
}
const color=(v:unknown,back:string)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:back;
const number=(v:unknown,back:number,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)?Math.min(max,Math.max(min,v)):back;
export function normalize(value:unknown,family?:Family):Design{
 const v=(value&&typeof value==='object'?value:{}) as Partial<Design>;
 const f:Family=family||(v.family==='v63'?'v63':'v05'),keys=sectionKeysOf(f);
 const name=(presetKeys as string[]).includes(v.preset||'')?v.preset!:'reference';const d=preset(name,f);
 return {...d,custom:v.custom===true,accent:color(v.accent,d.accent),background:color(v.background,d.background),radius:number(v.radius,d.radius,0,40),spacing:number(v.spacing,d.spacing,32,120),font:v.font==='serif'?'serif':'sans',menu:['original','compact','visible'].includes(v.menu||'')?v.menu!:d.menu,show:Object.fromEntries(keys.map(k=>[k,typeof v.show?.[k]==='boolean'?v.show[k]:true])),order:[...new Set(Array.isArray(v.order)?v.order.filter(k=>keys.includes(k)):[]),...keys].filter((k,i,a)=>a.indexOf(k)===i),texts:Object.fromEntries(Object.entries(v.texts&&typeof v.texts==='object'?v.texts:{}).filter(([k,t])=>/^[a-z0-9-]{1,40}\.html\|\d{1,3}(\.\d{1,3}){0,24}$/.test(k)&&typeof t==='string').slice(0,80).map(([k,t])=>[k,(t as string).slice(0,500)]))};
}
// Le lien partagé porte la version et son commit : il ne s’ouvre que sur la même référence.
export function encode(design:Design,version:string,commit:string){return JSON.stringify({schema:2,version,reference:commit,design:normalize(design)});}
export function decode(raw:string,versions:readonly {id:string;commit:string;family:Family}[]):{version:string;design:Design}{
 if(raw.length>6000)throw Error('Lien de variante trop long.');const v=JSON.parse(raw);const ver=versions.find(x=>x.id===v.version);
 if(v.schema!==2||!ver||v.reference!==ver.commit)throw Error('Ce lien correspond à une autre référence du site. Utilise son aperçu d’origine.');
 return {version:ver.id,design:normalize(v.design,ver.family)};
}
function cssV05(d:Design){
 const font=d.font==='serif'?'Georgia,serif':"'Space Grotesk','Helvetica Neue',Arial,sans-serif",half=Math.round(d.spacing/2);
 const css=[`:root{--police:${font}!important;--display:${font}!important}`,
  `body{background:${d.background}!important}main{background:${d.background}!important}`,
  `.carte,.exemple-carte,.contact-carte,.exemple,.parcours-duo>div{border-radius:${d.radius}px!important}`,
  `.cta,.bouton,.btn,.choice,.pastille{border-radius:${Math.max(d.radius,4)}px!important}`,
  `.cta.vert,.pastille.deleguer,.bouton{background:${d.accent}!important;color:var(--encre)!important}`,
  `main>.bloc{padding-top:${half}px!important;padding-bottom:${half}px!important}`];
 if(d.menu==='compact')css.push('.entete{padding:6px 10px!important;margin-top:8px!important}.entete .logo img{height:30px!important}.entete .pastille{height:32px!important;font-size:12px!important}');
 if(d.menu==='visible')css.push('.burger summary{display:none!important}.burger-menu{position:static!important;transform:none!important;display:flex!important;flex-direction:row!important;flex-wrap:wrap!important;min-width:0!important;border:0!important;box-shadow:none!important;background:none!important;padding:0!important}.burger-langues{display:none!important}');
 if(d.preset==='essentiel')css.push('.flemme-chrome-home{--flemme-ribbon-opacity:0!important}.carte,.exemple-carte,.contact-carte,.cta,.bouton,.pastille{box-shadow:none!important}.carte,.exemple-carte,.contact-carte{border:1px solid #b4bec6!important;background:#fff!important}.bandeau h1{font-size:clamp(30px,3.6vw,42px)!important;font-weight:600!important}');
 if(d.preset==='expressif')css.push('.flemme-chrome-home{--flemme-ribbon-opacity:.9!important}.bandeau h1{font-size:clamp(40px,6vw,72px)!important}.carte,.exemple-carte,.contact-carte{border:3px solid var(--encre)!important;background:#f0e7ff!important}.cta,.bouton{box-shadow:6px 6px 0 #4b3887!important;border:2px solid var(--encre)!important}');
 if(d.preset==='guide')css.push('.bandeau h1{font-size:clamp(30px,4vw,48px)!important}main>.bloc{max-width:860px!important;margin-left:auto!important;margin-right:auto!important}.carte,.exemple-carte,.contact-carte{box-shadow:none!important;border:1.5px solid #c9d3e0!important}');
 return css.join('');
}
function cssV63(d:Design){
 return `:root{--accent:${d.accent};--bg:${d.background};--surface:#fff;--ink:#191c2f;--muted:#4a5368}body{background:${d.background}!important;color:#191c2f!important;font-family:${d.font==='serif'?'Georgia,serif':'Archivo,Arial,sans-serif'}!important}.site{gap:${d.spacing}px!important}.card,.showcase-card,.etape,.honest{border-radius:${d.radius}px!important}.cta,.btn{border-radius:${Math.max(d.radius,4)}px!important}.cta.green,.cta-arrow,.etape.flemmard .etape-role{background:${d.accent}!important;color:#191c2f!important}.display em::after{background:${d.accent}!important}.top{background:#ffffff!important}${d.menu==='compact'?'.top{padding:8px 20px!important}.top img{height:36px!important}':''}${d.menu==='visible'?'.top{flex-wrap:wrap!important;gap:16px!important}.top nav{display:flex!important;flex-wrap:wrap!important}.top nav .secondary{display:inline-flex!important}':''}${d.preset==='essentiel'?'.showcase-card,.cta,.etape{box-shadow:none!important;transform:none!important}.display{font-size:clamp(38px,5vw,60px)!important;font-weight:700!important}.display em::after,.float-label{display:none!important}.showcase-card{border:1px solid #b4bec6!important}':''}${d.preset==='expressif'?'.hero{padding-top:44px!important}.display{font-size:clamp(44px,6.5vw,80px)!important}.showcase-card{background:#f0e7ff!important;border-width:3px!important}.etape{border-width:3px!important}.cta{box-shadow:7px 7px 0 #4b3887!important}':''}${d.preset==='guide'?'.hero{grid-template-columns:1fr!important;max-width:920px;margin:auto}.showcase{max-width:640px!important}.parcours{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))!important}.etape{box-shadow:none!important}.display{font-size:clamp(38px,5vw,64px)!important}':''}`;
}
export function variantCSS(input:Design){
 const d=normalize(input);if(d.preset==='reference'&&!d.custom)return '';
 return d.family==='v63'?cssV63(d):cssV05(d);
}
