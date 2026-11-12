import { normalize, optionsCSS, tweaksAllowed, variantCSS, type Design, type Section } from './model.ts';
import { tweakCSS, tweakFonts } from './tweaks.ts';
// Éditeur de texte : chaque texte modifié est repéré par sa page et son chemin d’éléments depuis <body>, dans l’ordre d’origine de la page.
const pageOf=(doc:Document)=>doc.location.pathname.split('/').pop()||'index.html';
export function pathOf(el:Element,doc:Document){const parts:number[]=[];let n:Element|null=el;while(n&&n!==doc.body){const p:Element|null=n.parentElement;if(!p)break;parts.unshift(Array.prototype.indexOf.call(p.children,n));n=p;}return parts.join('.');}
function byPath(doc:Document,path:string){let n:Element|undefined=doc.body;for(const i of path.split('.').map(Number)){n=n?.children[i];if(!n)return null;}return n||null;}
const editable=(el:Element)=>!el.closest('script,style,svg,select,textarea,input')&&(el.textContent||'').trim().length>0&&Array.from(el.children).every(c=>['B','I','EM','STRONG','SPAN','BR','SMALL','A'].includes(c.tagName)&&c.children.length===0);

// Plan de page : groupes d’éléments que l’on peut masquer ou réordonner (menus, boutons, sections, pied de page).
// Chaque groupe est un conteneur ; ses enfants directs sont repérés une fois, dans l’ordre d’origine (« groupe:index »).
const groupsSite:[string,string,string][]=[
 ['gauche','En-tête · boutons de gauche','.entete-gauche'],
 ['droite','En-tête · boutons de droite','.entete-droite'],
 ['menu','Menu principal (☰)','.menu-principal .burger-menu'],
 ['aide','Menu Aide « ? »','.menu-aide .burger-menu'],
 ['haut','Haut de page','.bandeau .accueil-texte, .bandeau .titre-page'],
 ['boutons','Boutons','.boutons'],
 ['sections','Sections de la page','main'],
 ['pied','Pied de page · colonnes','.pied-colonnes'],
 ['liens','Pied de page · liens','.pied-colonnes > nav'],
];
const groupsV63:[string,string,string][]=[['menu','Menu','.top nav'],['boutons','Boutons','.hero .actions, .hero .cta-row'],['sections','Sections','.site'],['pied','Pied de page','footer']];
export type PlanItem={id:string;label:string;hidden:boolean};
export type PlanGroup={id:string;label:string;items:PlanItem[]};
const clean=(s:string|null|undefined)=>(s||'').replace(/\s+/g,' ').trim();
function labelOf(el:Element){
 const h=el.querySelector('h1,h2,h3,b,strong,summary');
 const t=clean(el.getAttribute('aria-label'))||clean(el.querySelector('summary')?.getAttribute('aria-label'))||clean(h?.textContent)||clean(el.textContent)||('<'+el.tagName.toLowerCase()+'>');
 return t.length>48?t.slice(0,46)+'…':t;
}
function tag(doc:Document,family:Design['family']){
 if(doc.body.dataset.atelierPlan)return;doc.body.dataset.atelierPlan='true';
 for(const [key,,selector] of family==='v63'?groupsV63:groupsSite){
  Array.from(doc.querySelectorAll<HTMLElement>(selector)).slice(0,12).forEach((box,n)=>{
   const g=key+(n||'');box.dataset.atelierGroup=g;
   Array.from(box.children).filter(c=>!['SCRIPT','STYLE','TEMPLATE'].includes(c.tagName)).slice(0,80).forEach((c,i)=>{(c as HTMLElement).dataset.atelierItem=g+':'+i;});
  });
 }
}
// Remet chaque groupe dans l’ordre d’origine (avant d’appliquer les textes, puis l’ordre choisi).
function restore(doc:Document){
 doc.querySelectorAll<HTMLElement>('[data-atelier-group]').forEach(box=>{const kids=Array.from(box.children).filter(c=>(c as HTMLElement).dataset.atelierItem) as HTMLElement[];kids.sort((a,b)=>Number(a.dataset.atelierItem!.split(':')[1])-Number(b.dataset.atelierItem!.split(':')[1])).forEach(k=>box.append(k));});
}
export function readPlan(frame:HTMLIFrameElement,design:Design):PlanGroup[]{
 const doc=frame.contentDocument;if(!doc?.body)return [];
 const groups=design.family==='v63'?groupsV63:groupsSite,plan=design.plan[pageOf(doc)];
 return Array.from(doc.querySelectorAll<HTMLElement>('[data-atelier-group]')).map(box=>{
  const g=box.dataset.atelierGroup!,base=g.replace(/\d+$/,''),def=groups.find(x=>x[0]===base);
  const n=g.slice(base.length),label=(def?.[1]||g)+(base==='liens'?' · '+labelOf(box).slice(0,24):base==='boutons'?' · '+Array.from(box.children).map(labelOf).join(' / ').slice(0,40):n?' '+(Number(n)+1):'');
  const items=Array.from(box.children).filter(c=>(c as HTMLElement).dataset.atelierItem).map(c=>{const id=(c as HTMLElement).dataset.atelierItem!;return {id,label:labelOf(c),hidden:!!plan?.hide.includes(id)};});
  return {id:g,label,items};
 }).filter(g=>g.items.length>1||(g.items.length===1&&g.id.startsWith('sections')));
}
export type EditOptions={edit:boolean;onText:(key:string,text:string)=>void};
export function applyPreview(frame:HTMLIFrameElement,design:Design,onPage:(p:string)=>void,opts?:EditOptions){
 const doc=frame.contentDocument;if(!doc?.body)return;
 const cfg=normalize(design,design.family);const page=pageOf(doc);
 tag(doc,cfg.family);restore(doc);
 // Textes d’abord, dans l’ordre d’origine de la page : les chemins enregistrés restent valables quand on déplace des blocs.
 for(const [key,text] of Object.entries(cfg.texts)){const [pg,path]=key.split('|');if(pg!==page)continue;const el=byPath(doc,path);if(el&&el.textContent!==text&&doc.activeElement!==el)el.textContent=text;}
 const nodes:Partial<Record<Section,HTMLElement|null>>={};let parent:HTMLElement|null=null;
 if(cfg.family!=='v63'){
  // Repère une seule fois les blocs de l’accueil dans leur ordre d’origine, avant tout déplacement.
  const main=doc.querySelector('main'),blocs=cfg.family==='v06'?['steps','examples','trust','contact','final']:cfg.family==='p55'?['services','steps','trust','contact','final']:['steps','examples','trust','contact'];parent=main;
  if(main&&!main.dataset.atelierTagged){main.dataset.atelierTagged='true';Array.from(main.querySelectorAll<HTMLElement>(':scope > section.bloc')).forEach((node,i)=>{if(blocs[i])node.dataset.atelierSection=blocs[i];});}
  nodes.hero=doc.querySelector<HTMLElement>('.bandeau.accueil');nodes.footer=doc.querySelector<HTMLElement>('footer.pied');
  for(const key of blocs)nodes[key]=doc.querySelector<HTMLElement>(`main > [data-atelier-section="${key}"]`);
 }else{
  Object.assign(nodes,{hero:doc.querySelector('.hero'),examples:doc.querySelector('.showcase'),steps:doc.getElementById('comment'),price:doc.querySelector('.split'),help:doc.querySelector('.site > .block:not([id]):not(.split):not(.honest)'),limits:doc.querySelector('.honest'),footer:doc.querySelector('footer')});
  parent=doc.querySelector('.site');
 }
 Object.entries(nodes).forEach(([k,node])=>{if(node)node.hidden=!cfg.show[k];});
 if(parent)for(const key of cfg.order){const node=nodes[key];if(node?.parentElement===parent)parent.append(node);}
 // Plan de la page : ordre puis éléments masqués (un élément masqué ici l’est en plus des blocs de l’accueil).
 const plan=cfg.plan[page];
 doc.querySelectorAll<HTMLElement>('[data-atelier-item]').forEach(el=>{el.classList.toggle('atelier-masque',!!plan?.hide.includes(el.dataset.atelierItem!));});
 if(plan)for(const [g,list] of Object.entries(plan.order)){const box=doc.querySelector<HTMLElement>(`[data-atelier-group="${g}"]`);if(!box)continue;for(const id of list){const el=box.querySelector<HTMLElement>(`:scope > [data-atelier-item="${id}"]`);if(el)box.append(el);}Array.from(box.children).filter(c=>!(c as HTMLElement).dataset.atelierItem).forEach(c=>box.append(c));}
 // Tweaks du canevas : classes t-<réglage>-<option> sur <body>, règles extraites du canevas (tweaks.ts).
 const body=doc.body;Array.from(body.classList).filter(c=>c.startsWith('t-')).forEach(c=>body.classList.remove(c));
 const tw=tweaksAllowed(cfg.family)?cfg.tweaks:{};for(const [k,v] of Object.entries(tw))body.classList.add('t-'+k+'-'+v);
 // « Fond du haut » 1 à 5 : reflets chromés d’une autre page (attribut data-flemme-page des bandeaux).
 const chrome:Record<string,string>={'1':'accueil','3':'deleguer','4':'resoudre','5':'comment'};
 doc.querySelectorAll<HTMLElement>('.flemme-chrome-home').forEach(el=>{if(el.dataset.atelierChrome===undefined)el.dataset.atelierChrome=el.dataset.flemmePage||'';const want=chrome[tw.fond||''];if(want)el.dataset.flemmePage=want;else if(el.dataset.atelierChrome)el.dataset.flemmePage=el.dataset.atelierChrome;else delete el.dataset.flemmePage;});
 const used=Object.keys(tw).length>0;
 let fonts=doc.getElementById('atelier-polices') as HTMLLinkElement|null;
 if(used&&tw.police&&tweakFonts&&!fonts){fonts=doc.createElement('link');fonts.id='atelier-polices';fonts.rel='stylesheet';fonts.href=tweakFonts;doc.head.append(fonts);}
 let style=doc.getElementById('atelier-style');if(!style){style=doc.createElement('style');style.id='atelier-style';doc.head.append(style);}doc.querySelectorAll<HTMLElement>('.titre-alterne').forEach(t=>{if((cfg.family==='v06'||cfg.family==='p55')&&cfg.anim!=='fixe')t.dataset.anim=cfg.anim;});
 style.textContent=variantCSS(cfg)+(used?'\n'+tweakCSS:'')+'\n'+optionsCSS(cfg)+'\n[hidden],.atelier-masque{display:none!important}\nhtml[data-atelier-edit="1"] body *:hover{outline:1px dashed #5b7cfa;outline-offset:2px;cursor:text}\n[contenteditable="plaintext-only"]{outline:2px solid #5b7cfa!important;background:#fffbe6}';
 doc.documentElement.dataset.atelierEdit=opts?.edit?'1':'';
 (frame as HTMLIFrameElement&{atelierEdit?:EditOptions;atelierReapply?:()=>void}).atelierEdit=opts;
 (frame as HTMLIFrameElement&{atelierReapply?:()=>void}).atelierReapply=()=>applyPreview(frame,design,onPage,opts);
 if(!doc.documentElement.dataset.atelierBound){
  doc.documentElement.dataset.atelierBound='true';
  doc.addEventListener('click',e=>{
   const o=(frame as HTMLIFrameElement&{atelierEdit?:EditOptions}).atelierEdit;
   if(o?.edit){let el=e.target as Element|null;while(el&&el!==doc.body&&!editable(el))el=el.parentElement;e.preventDefault();e.stopPropagation();if(!el||el===doc.body)return;const h=el as HTMLElement;if(h.isContentEditable)return;h.contentEditable='plaintext-only';h.focus();
    // Le chemin est calculé dans l’ordre d’origine de la page, puis l’aperçu est réappliqué par l’atelier.
    h.addEventListener('blur',()=>{h.contentEditable='false';restore(doc);o.onText(page+'|'+pathOf(h,doc),(h.textContent||'').slice(0,500));setTimeout(()=>(frame as HTMLIFrameElement&{atelierReapply?:()=>void}).atelierReapply?.(),60);},{once:true});return;}
   const anchor=(e.target as Element).closest<HTMLAnchorElement>('a[href]');if(!anchor)return;const url=new URL(anchor.href,doc.baseURI);if(url.protocol!=='https:'&&url.protocol!=='http:'){e.preventDefault();return;}if(url.origin!==location.origin){e.preventDefault();return;}if(!url.pathname.includes('/atelier-reference/')){e.preventDefault();const root=new URL(frame.src,location.href).pathname.replace(/[^/]*$/,'');url.pathname=root+url.pathname.replace(/^\//,'');frame.src=url.href;}});
  doc.addEventListener('submit',e=>e.preventDefault());
 }
 onPage(doc.location.pathname+doc.location.hash);
}
