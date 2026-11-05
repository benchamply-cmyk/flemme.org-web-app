import './fonds.css';
import './essais.css';
import { CATEGORIES } from '../../../packages/shared/src/parcours.ts';

// Essais de la vitrine (demandes de Ben du 5 novembre 2026) : fond, organisation du menu, boutons d’accueil, sections.
// Le panneau « Essais » n’apparaît pas sur flemme.org, où la page reste telle quelle.
// Une fois les choix faits : garder les options retenues dans index.html / landing.css et supprimer ce fichier.

const root = document.documentElement;
const enLigne = /(^|\.)flemme\.org$/.test(location.hostname);
const lire = (k: string) => { try { return localStorage.getItem('flemme.essai.' + k); } catch { return null; } };
const garder = (k: string, v: string) => { try { localStorage.setItem('flemme.essai.' + k, v); } catch { /* choix valable pour cette visite */ } };
const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/* ---------- Fond ---------- */
const FONDS = [
  { id: 'glacier', nom: 'Glacier', swatch: 'radial-gradient(circle at 35% 30%, #fff, #bcd5ff)' },
  { id: 'glacier-clair', nom: 'Glacier clair', swatch: 'radial-gradient(circle at 35% 30%, #fff 20%, #d3e3ff)' },
  { id: 'glacier-profond', nom: 'Glacier profond', swatch: 'radial-gradient(circle at 35% 30%, #eaf2ff, #9cc0ff)' },
  { id: 'glacier-aurore', nom: 'Glacier aurore', swatch: 'linear-gradient(135deg, #c1d3ff, #dad4ff 50%, #c5efe6)' },
  { id: 'glacier-relief', nom: 'Glacier relief', swatch: 'radial-gradient(circle at 30% 28%, #fff 30%, #cfe0ff)' },
  { id: 'glacier-nacre', nom: 'Glacier nacré', swatch: 'linear-gradient(135deg, #d3e1fb, #ece4f6 50%, #d6edf6)' },
  { id: '', nom: 'Actuel (en ligne)', swatch: 'linear-gradient(135deg, #cbbcff, #e3eeff 50%, #bfeef0)' },
];
const fond = document.createElement('div');
fond.className = 'fond'; fond.setAttribute('aria-hidden', 'true');
fond.innerHTML = '<i class="b1"></i><i class="b2"></i><i class="b3"></i>';
document.body.prepend(fond);
// --p : 0 en haut de page, 1 en bas. Les formes et les couleurs glissent avec le défilement.
let attente = 0;
const suivre = () => { attente = 0; const max = root.scrollHeight - innerHeight; root.style.setProperty('--p', (max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0).toFixed(3)); };
addEventListener('scroll', () => { if (!attente) attente = requestAnimationFrame(suivre); }, { passive: true });
addEventListener('resize', suivre); suivre();
const appliquerFond = (id: string) => { if (id) root.dataset.fond = id; else delete root.dataset.fond; };

/* ---------- Menu ---------- */
type Lien = { label: string; href: string };
type Entree =
  | { type: 'lien'; label: string; href: string }
  | { type: 'sous'; label: string; items: Lien[] }
  | { type: 'mega'; label: string; colonnes: { titre: string; items: Lien[] }[] }
  | { type: 'bouton'; label: string; href: string; style?: 'secondary' | 'green' | '' }
  | { type: 'espace' } | { type: 'langues' };
const links = document.querySelector<HTMLUListElement>('.nav-links')!;
const menuActuel = links.innerHTML;
const languesHtml = links.querySelector('.nav-lang')!.outerHTML;
const espaceHtml = links.querySelector('.nav-espace')!.outerHTML;
let n = 0;
const sousMenu = (label: string, contenu: string, mega = false) => {
  const id = 'sub' + ++n;
  return `<li class="nav-sub${mega ? ' nav-sub-mega' : ''}"><button type="button" class="nav-link" aria-expanded="false" aria-controls="${id}">${esc(label)}<span class="caret" aria-hidden="true"></span></button><ul class="nav-drop${mega ? ' mega' : ''}" id="${id}">${contenu}</ul></li>`;
};
const lien = (l: Lien) => `<li><a href="${l.href}">${esc(l.label)}</a></li>`;
function rendre(e: Entree) {
  switch (e.type) {
    case 'lien': return `<li><a class="nav-link" href="${e.href}">${esc(e.label)}</a></li>`;
    case 'sous': return sousMenu(e.label, e.items.map(lien).join(''));
    case 'mega': return sousMenu(e.label, e.colonnes.map(c => `<li class="mega-col"><span class="mega-title">${esc(c.titre)}</span><ul>${c.items.map(lien).join('')}</ul></li>`).join(''), true);
    case 'bouton': return `<li class="nav-espace nav-cta"><a class="btn small${e.style ? ' ' + e.style : ''}" href="${e.href}">${esc(e.label)}</a></li>`;
    case 'espace': return espaceHtml;
    case 'langues': return languesHtml;
  }
}
const L = {
  concept: { label: 'Concept', href: '#concept' }, parcours: { label: 'Le parcours', href: '#comment' }, prix: { label: 'Le prix', href: '#prix' },
  faq: { label: 'Questions fréquentes', href: '#faq' }, ecrire: { label: 'Écrivez-nous', href: '#contact' },
  publier: { label: 'Publier une tâche', href: 'app.html#mine' }, voir: { label: 'Voir les flemmes', href: 'app.html#find' },
  brigadier: { label: 'Devenir Brigadier', href: '#brigadier' }, version: { label: 'Ce que fait cette version', href: '#comment' },
};
const MENUS: { id: string; nom: string; detail: string; recherche: 'barre' | 'compacte'; entrees: Entree[] | null }[] = [
  { id: 'actuel', nom: 'A · Actuel', detail: 'Recherche, Concept, Comment ça marche, Contact, Mon espace, Langues', recherche: 'barre', entrees: null },
  { id: 'profils', nom: 'B · Par profil', detail: 'Je délègue, J’aide, À propos', recherche: 'barre', entrees: [
    { type: 'sous', label: 'Je délègue', items: [L.publier, L.prix, L.faq] },
    { type: 'sous', label: 'J’aide', items: [L.voir, L.brigadier, L.parcours] },
    { type: 'sous', label: 'À propos', items: [L.concept, L.version, L.ecrire] },
    { type: 'espace' }, { type: 'langues' }] },
  { id: 'actions', nom: 'C · Deux boutons d’action', detail: 'Liens courts + Déléguer et Résoudre toujours visibles', recherche: 'compacte', entrees: [
    { type: 'lien', label: 'Concept', href: '#concept' }, { type: 'lien', label: 'Parcours', href: '#comment' },
    { type: 'sous', label: 'Aide', items: [L.faq, L.ecrire] }, { type: 'langues' },
    { type: 'bouton', label: 'Résoudre', href: 'app.html#find', style: 'green' }, { type: 'bouton', label: 'Déléguer', href: 'app.html#mine' }, { type: 'espace' }] },
  { id: 'mega', nom: 'D · Grand menu « Découvrir »', detail: 'Une entrée qui ouvre trois colonnes', recherche: 'barre', entrees: [
    { type: 'mega', label: 'Découvrir', colonnes: [
      { titre: 'Comprendre', items: [L.concept, L.parcours, L.prix] },
      { titre: 'Agir', items: [L.publier, L.voir, L.brigadier] },
      { titre: 'Aide', items: [L.faq, L.ecrire] }] },
    { type: 'espace' }, { type: 'langues' }] },
  { id: 'minimal', nom: 'E · Minimal', detail: 'Recherche, Comment ça marche, Mon espace, et un bouton Déléguer', recherche: 'barre', entrees: [
    { type: 'lien', label: 'Comment ça marche', href: '#comment' }, { type: 'lien', label: 'Contact', href: '#contact' },
    { type: 'langues' }, { type: 'bouton', label: 'Mon espace', href: 'app.html#mine', style: 'secondary' }, { type: 'bouton', label: 'Déléguer', href: 'app.html#mine' }] },
];
function appliquerMenu(id: string) {
  const m = MENUS.find(x => x.id === id) || MENUS[0];
  links.innerHTML = m.entrees ? m.entrees.map(rendre).join('') : menuActuel;
  root.dataset.menu = m.id;
  root.dataset.recherche = m.recherche;
}

/* ---------- Boutons d’accueil ---------- */
const BOUTONS = [
  { id: '', nom: 'Pilules (actuel)', detail: 'Grandes pilules avec flèche' },
  { id: 'cartes', nom: 'Cartes', detail: 'Deux grandes cartes côte à côte' },
  { id: 'sobres', nom: 'Sobres', detail: 'Boutons simples, sans sous-titre' },
  { id: 'contour', nom: 'Contour', detail: 'Un bouton plein, un bouton en contour' },
];
const appliquerBoutons = (id: string) => { if (id) root.dataset.cta = id; else delete root.dataset.cta; };

/* ---------- Sections proposées ---------- */
const icones: Record<string, string> = { administratif: '✎', maison: '⌂', numerique: '✳', organisation: '◷', autre: '✦' };
const SECTIONS: { id: string; nom: string; apres: string; html: string }[] = [
  { id: 'categories', nom: 'Catégories de flemmes', apres: '#concept', html: `<section class="block propose" id="categories"><span class="propose-tag">Proposition</span><p class="eyebrow">Par où commencer</p><h2 class="heading">Les flemmes les plus courantes</h2><div class="cats">${CATEGORIES.map(c => `<a class="cat" href="app.html#find"><span class="cat-icon" aria-hidden="true">${icones[c.value] || '✦'}</span><span>${esc(c.value === 'autre' ? 'Et tout le reste' : c.label)}</span><span class="cat-arrow" aria-hidden="true">→</span></a>`).join('')}</div></section>` },
  { id: 'confiance', nom: 'Confiance et sécurité', apres: '#comment', html: `<section class="block propose" id="confiance"><span class="propose-tag">Proposition</span><p class="eyebrow">En confiance</p><h2 class="heading">Ce qui vous protège, l’un comme l’autre</h2><div class="trust"><div><b>Chaque demande est relue</b><p>L’équipe valide les flemmes et les candidatures avant qu’elles soient visibles.</p></div><div><b>Un accord écrit</b><p>Résultat attendu, délai et prix sont acceptés par les deux avant de commencer.</p></div><div><b>Un examen humain</b><p>Un désaccord peut être signalé. Rien n’est effacé : messages et historique sont conservés.</p></div><div><b>Un prix clair</b><p>Le forfait du Brigadier, plus 10&#8239;% pour FLEMME. Pas d’abonnement, pas de frais cachés.</p></div></div></section>` },
  { id: 'mobile', nom: 'L’app mobile (bientôt)', apres: '#faq', html: `<section class="block propose mobile-teaser" id="app-mobile"><span class="propose-tag">Proposition</span><div><p class="eyebrow">Bientôt dans ta poche</p><h2 class="heading">FLEMME sur iPhone et Android</h2><p class="narrow">Les mêmes flemmes, les mêmes Brigadiers, avec les notifications en plus. L’app est en test et arrivera sur les stores prochainement.</p></div><div class="phone" aria-hidden="true"><span class="phone-notch"></span><span class="phone-line"></span><span class="phone-card">Ma flemme</span><span class="phone-card alt">Résoudre</span></div></section>` },
  { id: 'final', nom: 'Bandeau d’appel final', apres: '#contact', html: `<section class="block propose final-cta" id="appel"><span class="propose-tag">Proposition</span><h2 class="heading">Une flemme en tête&#8239;?</h2><p>Publie-la en deux minutes, ou donne un coup de main près de chez toi.</p><div class="final-actions"><a class="btn" href="app.html#mine">Je publie ma tâche</a><a class="btn green" href="app.html#find">Je propose mon aide</a></div></section>` },
];
function appliquerSections(ids: string[]) {
  document.querySelectorAll('section.propose').forEach(s => s.remove());
  for (const s of SECTIONS) {
    if (!ids.includes(s.id)) continue;
    document.querySelector(s.apres)?.insertAdjacentHTML('afterend', s.html);
  }
}

/* ---------- Panneau ---------- */
if (enLigne) {
  appliquerFond('');
} else {
  const etat = {
    fond: lire('fond') ?? 'glacier', menu: lire('menu') ?? 'actuel', cta: lire('cta') ?? '',
    sections: (lire('sections') ?? '').split(',').filter(Boolean),
  };
  appliquerFond(etat.fond); appliquerMenu(etat.menu); appliquerBoutons(etat.cta); appliquerSections(etat.sections);

  const option = (groupe: string, id: string, nom: string, detail = '', swatch = '') =>
    `<button type="button" data-groupe="${groupe}" data-id="${id}">${swatch ? `<span class="swatch" style="background:${swatch}"></span>` : ''}<span class="opt-text"><b>${esc(nom)}</b>${detail ? `<small>${esc(detail)}</small>` : ''}</span></button>`;
  const panel = document.createElement('div');
  panel.className = 'essais';
  panel.innerHTML = `<div class="essais-panel" id="essaisPanel" hidden>
    <p class="essais-intro">Essais de mise en page, visibles seulement en test. Ton choix est gardé sur cet appareil.</p>
    <div class="essais-tabs" role="tablist">${['Menu', 'Boutons', 'Sections', 'Fond'].map((t, i) => `<button type="button" role="tab" data-tab="${i}" aria-selected="${i === 0}">${t}</button>`).join('')}</div>
    <div class="essais-group" data-panel="0">${MENUS.map(m => option('menu', m.id, m.nom, m.detail)).join('')}</div>
    <div class="essais-group" data-panel="1" hidden>${BOUTONS.map(b => option('cta', b.id, b.nom, b.detail)).join('')}</div>
    <div class="essais-group" data-panel="2" hidden><p class="essais-intro">Sections à ajouter à la page, marquées « Proposition ».</p>${SECTIONS.map(s => option('sections', s.id, s.nom)).join('')}</div>
    <div class="essais-group" data-panel="3" hidden><p class="essais-intro">Fais défiler la page pour voir les variations.</p>${FONDS.map(f => option('fond', f.id, f.nom, '', f.swatch)).join('')}</div>
  </div><button type="button" class="essais-toggle" aria-expanded="false" aria-controls="essaisPanel"><span class="swatch" style="background:${FONDS[0].swatch}"></span>Essais</button>`;
  document.body.append(panel);
  const box = panel.querySelector<HTMLElement>('.essais-panel')!, tog = panel.querySelector<HTMLButtonElement>('.essais-toggle')!;
  const marquer = () => box.querySelectorAll<HTMLButtonElement>('button[data-groupe]').forEach(b => {
    const g = b.dataset.groupe!, id = b.dataset.id!;
    const on = g === 'sections' ? etat.sections.includes(id) : (etat as unknown as Record<string, string>)[g] === id;
    b.setAttribute('aria-pressed', String(on));
  });
  marquer();
  tog.addEventListener('click', () => { box.hidden = !box.hidden; tog.setAttribute('aria-expanded', String(!box.hidden)); });
  box.addEventListener('click', e => {
    const t = e.target as Element;
    const tab = t.closest<HTMLButtonElement>('[data-tab]');
    if (tab) {
      box.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', String(x === tab)));
      box.querySelectorAll<HTMLElement>('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
      return;
    }
    const b = t.closest<HTMLButtonElement>('button[data-groupe]');
    if (!b) return;
    const g = b.dataset.groupe!, id = b.dataset.id!;
    if (g === 'fond') { etat.fond = id; appliquerFond(id); garder('fond', id); }
    if (g === 'menu') { etat.menu = id; appliquerMenu(id); garder('menu', id); }
    if (g === 'cta') { etat.cta = id; appliquerBoutons(id); garder('cta', id); }
    if (g === 'sections') {
      etat.sections = etat.sections.includes(id) ? etat.sections.filter(x => x !== id) : [...etat.sections, id];
      appliquerSections(etat.sections); garder('sections', etat.sections.join(','));
      if (etat.sections.includes(id)) document.getElementById(SECTIONS.find(s => s.id === id)!.html.match(/id="([^"]+)"/)![1])?.scrollIntoView({ block: 'center' });
    }
    marquer(); suivre();
  });
}
