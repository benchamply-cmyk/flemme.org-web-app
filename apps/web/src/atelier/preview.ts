import { normalize, optionsCSS, variantCSS, type Design, type Section } from './model.ts';
// Éditeur de texte : chaque texte modifié est repéré par sa page et son chemin d’éléments depuis <body>.
const pageOf=(doc:Document)=>doc.location.pathname.split('/').pop()||'index.html';
export function pathOf(el:Element,doc:Document){const parts:number[]=[];let n:Element|null=el;while(n&&n!==doc.body){const p:Element|null=n.parentElement;if(!p)break;parts.unshift(Array.prototype.indexOf.call(p.children,n));n=p;}return parts.join('.');}
function byPath(doc:Document,path:string){let n:Element|undefined=doc.body;for(const i of path.split('.').map(Number)){n=n?.children[i];if(!n)return null;}return n||null;}
const editable=(el:Element)=>!el.closest('script,style,svg,select,textarea,input')&&(el.textContent||'').trim().length>0&&Array.from(el.children).every(c=>['B','I','EM','STRONG','SPAN','BR','SMALL','A'].includes(c.tagName)&&c.children.length===0);
export type EditOptions={edit:boolean;onText:(key:string,text:string)=>void};
export function applyPreview(frame:HTMLIFrameElement,design:Design,onPage:(p:string)=>void,opts?:EditOptions){
 const doc=frame.contentDocument;if(!doc?.body)return;
 const cfg=normalize(design,design.family);
 const nodes:Partial<Record<Section,HTMLElement|null>>={};let parent:HTMLElement|null=null;
 if(cfg.family!=='v63'){
  // Repère une seule fois les blocs de l’accueil dans leur ordre d’origine, avant tout déplacement.
  const main=doc.querySelector('main'),blocs=cfg.family==='v06'?['steps','examples','trust','contact','final']:['steps','examples','trust','contact'];parent=main;
  if(main&&!main.dataset.atelierTagged){main.dataset.atelierTagged='true';Array.from(main.querySelectorAll<HTMLElement>(':scope > section.bloc')).forEach((node,i)=>{if(blocs[i])node.dataset.atelierSection=blocs[i];});}
  nodes.hero=doc.querySelector<HTMLElement>('.bandeau.accueil');nodes.footer=doc.querySelector<HTMLElement>('footer.pied');
  for(const key of blocs)nodes[key]=doc.querySelector<HTMLElement>(`main > [data-atelier-section="${key}"]`);
 }else{
  Object.assign(nodes,{hero:doc.querySelector('.hero'),examples:doc.querySelector('.showcase'),steps:doc.getElementById('comment'),price:doc.querySelector('.split'),help:doc.querySelector('.site > .block:not([id]):not(.split):not(.honest)'),limits:doc.querySelector('.honest'),footer:doc.querySelector('footer')});
  parent=doc.querySelector('.site');
 }
 Object.entries(nodes).forEach(([k,node])=>{if(node)node.hidden=!cfg.show[k];});
 if(parent)for(const key of cfg.order){const node=nodes[key];if(node?.parentElement===parent)parent.append(node);}
 let style=doc.getElementById('atelier-style');if(!style){style=doc.createElement('style');style.id='atelier-style';doc.head.append(style);}doc.querySelectorAll<HTMLElement>('.titre-alterne').forEach(t=>{if(cfg.family==='v06'&&cfg.anim!=='fixe')t.dataset.anim=cfg.anim;});
 style.textContent=variantCSS(cfg)+optionsCSS(cfg)+'\n[hidden]{display:none!important}\nhtml[data-atelier-edit="1"] body *:hover{outline:1px dashed #5b7cfa;outline-offset:2px;cursor:text}\n[contenteditable="plaintext-only"]{outline:2px solid #5b7cfa!important;background:#fffbe6}';
 const page=pageOf(doc);
 for(const [key,text] of Object.entries(cfg.texts)){const [pg,path]=key.split('|');if(pg!==page)continue;const el=byPath(doc,path);if(el&&el.textContent!==text&&doc.activeElement!==el)el.textContent=text;}
 doc.documentElement.dataset.atelierEdit=opts?.edit?'1':'';
 (frame as HTMLIFrameElement&{atelierEdit?:EditOptions}).atelierEdit=opts;
 if(!doc.documentElement.dataset.atelierBound){
  doc.documentElement.dataset.atelierBound='true';
  doc.addEventListener('click',e=>{
   const o=(frame as HTMLIFrameElement&{atelierEdit?:EditOptions}).atelierEdit;
   if(o?.edit){let el=e.target as Element|null;while(el&&el!==doc.body&&!editable(el))el=el.parentElement;e.preventDefault();e.stopPropagation();if(!el||el===doc.body)return;const h=el as HTMLElement;if(h.isContentEditable)return;h.contentEditable='plaintext-only';h.focus();
    h.addEventListener('blur',()=>{h.contentEditable='false';o.onText(page+'|'+pathOf(h,doc),(h.textContent||'').slice(0,500));},{once:true});return;}
   const anchor=(e.target as Element).closest<HTMLAnchorElement>('a[href]');if(!anchor)return;const url=new URL(anchor.href,doc.baseURI);if(url.protocol!=='https:'&&url.protocol!=='http:'){e.preventDefault();return;}if(url.origin!==location.origin){e.preventDefault();return;}if(!url.pathname.includes('/atelier-reference/')){e.preventDefault();const root=new URL(frame.src,location.href).pathname.replace(/[^/]*$/,'');url.pathname=root+url.pathname.replace(/^\//,'');frame.src=url.href;}});
  doc.addEventListener('submit',e=>e.preventDefault());
 }
 onPage(doc.location.pathname+doc.location.hash);
}
