import { normalize, variantCSS, type Design, type Section } from './model.ts';
export function applyPreview(frame:HTMLIFrameElement,design:Design,onPage:(p:string)=>void){
 const doc=frame.contentDocument;if(!doc?.body)return;
 const cfg=normalize(design);
 // Repère une seule fois les blocs de l’accueil dans leur ordre d’origine, avant tout déplacement.
 const main=doc.querySelector('main'),blocs=['steps','examples','trust','contact'] as const;
 if(main&&!main.dataset.atelierTagged){main.dataset.atelierTagged='true';Array.from(main.querySelectorAll<HTMLElement>(':scope > section.bloc')).forEach((node,i)=>{if(blocs[i])node.dataset.atelierSection=blocs[i];});}
 const nodes:Partial<Record<Section,HTMLElement|null>>={hero:doc.querySelector<HTMLElement>('.bandeau.accueil'),footer:doc.querySelector<HTMLElement>('footer.pied')};
 for(const key of blocs)nodes[key]=doc.querySelector<HTMLElement>(`main > [data-atelier-section="${key}"]`);
 Object.entries(nodes).forEach(([k,node])=>{if(node)node.hidden=!cfg.show[k as Section];});
 if(main)for(const key of cfg.order){const node=nodes[key];if(node?.parentElement===main)main.append(node);}
 let style=doc.getElementById('atelier-style');if(!style){style=doc.createElement('style');style.id='atelier-style';doc.head.append(style);}style.textContent=variantCSS(cfg)+'\n[hidden]{display:none!important}';
 if(!doc.documentElement.dataset.atelierBound){
  doc.documentElement.dataset.atelierBound='true';
  doc.addEventListener('click',e=>{const anchor=(e.target as Element).closest<HTMLAnchorElement>('a[href]');if(!anchor)return;const url=new URL(anchor.href,doc.baseURI);if(url.protocol!=='https:'&&url.protocol!=='http:'){e.preventDefault();return;}if(url.origin!==location.origin){e.preventDefault();return;}if(!url.pathname.startsWith('/atelier-reference/')){e.preventDefault();url.pathname='/atelier-reference/'+url.pathname.replace(/^\//,'');frame.src=url.href;}});
  doc.addEventListener('submit',e=>e.preventDefault());
 }
 onPage(doc.location.pathname+doc.location.hash);
}
