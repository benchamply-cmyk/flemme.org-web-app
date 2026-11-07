// Blocs de l’accueil V0.5 (#41) : la présentation et le pied de page sont hors de <main> et ne se déplacent pas.
export const sectionLabels={hero:'Présentation',steps:'En bref, trois étapes',examples:'Exemples de demandes',trust:'Tu gardes la main',contact:'Écris-nous',footer:'Pied de page'} as const;
export const fixedSections:readonly Section[]=['hero','footer'];
export type Section=keyof typeof sectionLabels;
export const sectionKeys=Object.keys(sectionLabels) as Section[];
export type Preset='reference'|'essentiel'|'expressif'|'guide';
export type Design={preset:Preset;custom:boolean;accent:string;background:string;radius:number;spacing:number;font:'sans'|'serif';menu:'original'|'compact'|'visible';show:Record<Section,boolean>;order:Section[]};
export const labels:Record<Preset,string>={reference:'Référence V0.5',essentiel:'Essentiel',expressif:'Expressif',guide:'Guidé'};
export function preset(name:Preset):Design{
 const base:Design={preset:name,custom:false,accent:'#a5ccff',background:'#e6efff',radius:14,spacing:48,font:'sans',menu:'original',show:Object.fromEntries(sectionKeys.map(k=>[k,true])) as Record<Section,boolean>,order:[...sectionKeys]};
 if(name==='essentiel')Object.assign(base,{accent:'#d7e8df',background:'#ffffff',radius:6,spacing:80});
 if(name==='expressif')Object.assign(base,{accent:'#d9ccff',background:'#fff3df',radius:28,spacing:56});
 if(name==='guide')Object.assign(base,{accent:'#bcebd9',background:'#f2f6fb',radius:12,spacing:44,menu:'visible'});
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
 // Sélecteurs du site V0.5 (apps/web/src/site/*.css au commit de référence).
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
