export const sectionLabels={hero:'Présentation',examples:'Exemples de demandes',steps:'Comment ça marche',price:'Prix et calculateur',help:'Proposer son aide',limits:'Conditions du service',footer:'Pied de page'} as const;
export type Section=keyof typeof sectionLabels;
export const sectionKeys=Object.keys(sectionLabels) as Section[];
export type Preset='reference'|'essentiel'|'expressif'|'guide';
export type Design={preset:Preset;custom:boolean;accent:string;background:string;radius:number;spacing:number;font:'sans'|'serif';menu:'original'|'compact'|'visible';show:Record<Section,boolean>;order:Section[]};
export const labels:Record<Preset,string>={reference:'Référence PROD',essentiel:'Essentiel',expressif:'Expressif',guide:'Guidé'};
export function preset(name:Preset):Design{
 const base:Design={preset:name,custom:false,accent:'#a5ccff',background:'#e3eeff',radius:24,spacing:72,font:'sans',menu:'original',show:Object.fromEntries(sectionKeys.map(k=>[k,true])) as Record<Section,boolean>,order:[...sectionKeys]};
 if(name==='essentiel')Object.assign(base,{accent:'#d7e8df',background:'#ffffff',radius:6,spacing:90});
 if(name==='expressif')Object.assign(base,{accent:'#d9ccff',background:'#fff3df',radius:30,spacing:68});
 if(name==='guide')Object.assign(base,{accent:'#bcebd9',background:'#f2f6fb',radius:14,spacing:60,menu:'visible'});
 return base;
}
const color=(v:unknown,back:string)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:back;
const number=(v:unknown,back:number,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)?Math.min(max,Math.max(min,v)):back;
export function normalize(value:unknown):Design{
 const v=(value&&typeof value==='object'?value:{}) as Partial<Design>;
 const name=(['reference','essentiel','expressif','guide'] as string[]).includes(v.preset||'')?v.preset!:'reference';const d=preset(name);
 return {...d,custom:v.custom===true,accent:color(v.accent,d.accent),background:color(v.background,d.background),radius:number(v.radius,d.radius,0,40),spacing:number(v.spacing,d.spacing,32,120),font:v.font==='serif'?'serif':'sans',menu:['original','compact','visible'].includes(v.menu||'')?v.menu!:d.menu,show:Object.fromEntries(sectionKeys.map(k=>[k,typeof v.show?.[k]==='boolean'?v.show[k]:true])) as Design['show'],order:[...new Set(Array.isArray(v.order)?v.order.filter(k=>sectionKeys.includes(k)):[]),...sectionKeys].filter((k,i,a)=>a.indexOf(k)===i)};
}
export function encode(design:Design,reference:string){return JSON.stringify({schema:1,reference,design:normalize(design)});}
export function decode(raw:string,reference:string):Design{
 if(raw.length>6000)throw Error('Lien de variante trop long.');const v=JSON.parse(raw);if(v.schema!==1||v.reference!==reference)throw Error('Ce lien correspond à une autre référence du site. Utilise son aperçu d’origine.');return normalize(v.design);
}
export function variantCSS(input:Design){
 const d=normalize(input);if(d.preset==='reference'&&!d.custom)return '';
 return `:root{--accent:${d.accent};--bg:${d.background};--surface:#fff;--ink:#191c2f;--muted:#4a5368}body{background:${d.background}!important;color:#191c2f!important;font-family:${d.font==='serif'?'Georgia,serif':'Archivo,Arial,sans-serif'}!important}.site{gap:${d.spacing}px!important}.card,.showcase-card,.etape,.honest{border-radius:${d.radius}px!important}.cta,.btn{border-radius:${Math.max(d.radius,4)}px!important}.cta.green,.cta-arrow,.etape.flemmard .etape-role{background:${d.accent}!important;color:#191c2f!important}.display em::after{background:${d.accent}!important}.top{background:#ffffff!important}${d.menu==='compact'?'.top{padding:8px 20px!important}.top img{height:36px!important}':''}${d.menu==='visible'?'.top{flex-wrap:wrap!important;gap:16px!important}.top nav{display:flex!important;flex-wrap:wrap!important}.top nav .secondary{display:inline-flex!important}':''}${d.preset==='essentiel'?'.showcase-card,.cta,.etape{box-shadow:none!important;transform:none!important}.display{font-size:clamp(38px,5vw,60px)!important;font-weight:700!important}.display em::after,.float-label{display:none!important}.showcase-card{border:1px solid #b4bec6!important}':''}${d.preset==='expressif'?'.hero{padding-top:44px!important}.display{font-size:clamp(44px,6.5vw,80px)!important}.showcase-card{background:#f0e7ff!important;border-width:3px!important}.etape{border-width:3px!important}.cta{box-shadow:7px 7px 0 #4b3887!important}':''}${d.preset==='guide'?'.hero{grid-template-columns:1fr!important;max-width:920px;margin:auto}.showcase{max-width:640px!important}.parcours{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))!important}.etape{box-shadow:none!important}.display{font-size:clamp(38px,5vw,64px)!important}':''}`;
}
