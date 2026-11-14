import './beta/runtime.ts';
import './site/landing.css';
import { animerFonds } from './site/fond-flemme.ts';

// Landing page (landing.html, 14/11/2026), d’après l’aperçu vidéo envoyé par Ben le 13/11.
// Nav qui se cache, titre dont le début change, chiffres qui comptent, carrousel d’exemples,
// apparitions au défilement, « Reste le prix. » mot par mot, collines qui montent.
// Tout reste lisible sans JS et avec « mouvements réduits ».

const racine = document.documentElement;
const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
const observe = 'IntersectionObserver' in window;

/* ---------- Navigation pastille : cachée quand on descend, visible dès qu’on remonte ---------- */
const pn = document.getElementById('pn')!;
const menu = document.getElementById('pnMenu') as HTMLButtonElement;
const panneau = document.getElementById('pnPanneau')!;
function ouvrirMenu(ouvert: boolean) {
  panneau.hidden = !ouvert;
  menu.setAttribute('aria-expanded', String(ouvert));
  menu.querySelector('span')!.textContent = ouvert ? 'Fermer' : 'Menu';
  if (ouvert) pn.classList.remove('cachee');
}
menu.addEventListener('click', () => ouvrirMenu(panneau.hidden === true));
panneau.querySelectorAll('a').forEach(a => a.addEventListener('click', () => ouvrirMenu(false)));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panneau.hidden) { ouvrirMenu(false); menu.focus(); } });
document.addEventListener('click', e => { if (!panneau.hidden && !pn.contains(e.target as Node)) ouvrirMenu(false); });
let dernierY = scrollY;
addEventListener('scroll', () => {
  const y = scrollY;
  if (panneau.hidden && !pn.contains(document.activeElement)) pn.classList.toggle('cachee', y > dernierY && y > 160);
  dernierY = y;
}, { passive: true });

/* ---------- Hero : apparition floue, puis le début du titre change toutes les 3 s ---------- */
requestAnimationFrame(() => setTimeout(() => racine.classList.add('pret'), 80));
const rotation = document.querySelector<HTMLElement>('[data-rotation]');
const mot = rotation?.querySelector<HTMLElement>('.lp-mot');
if (rotation && mot && !reduit) {
  const mots = rotation.dataset.rotation!.split('|');
  let i = 0;
  setInterval(() => {
    if (document.hidden) return;
    mot.classList.remove('entre');
    mot.classList.add('sort');
    setTimeout(() => {
      i = (i + 1) % mots.length;
      mot.textContent = mots[i];
      mot.classList.remove('sort');
      void mot.offsetWidth;
      mot.classList.add('entre');
    }, 430);
  }, 3000);
}

/* ---------- « Reste le prix. » découpé en mots pour l’apparition floue ---------- */
document.querySelectorAll<HTMLElement>('[data-mots]').forEach(el => {
  const texte = el.textContent!.trim();
  el.setAttribute('aria-label', texte);
  el.innerHTML = '';
  texte.split(' ').forEach((m, k) => {
    if (k) el.append(' ');
    const s = document.createElement('span'); s.className = 'm'; s.setAttribute('aria-hidden', 'true'); s.textContent = m; el.append(s);
  });
  el.classList.add('revele');
});

/* ---------- Chiffres qui comptent jusqu’à leur valeur ---------- */
function compter(el: HTMLElement) {
  const fin = Number(el.dataset.compte);
  if (reduit || fin === 0) { el.textContent = String(fin); return; }
  const debut = performance.now(), duree = 1100;
  const pas = (t: number) => {
    const p = Math.min((t - debut) / duree, 1);
    el.textContent = String(Math.round(fin * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(pas);
  };
  el.textContent = '0';
  requestAnimationFrame(pas);
}

/* ---------- Apparitions en cascade au défilement ---------- */
const aReveler = [...document.querySelectorAll<HTMLElement>('.revele, .titre-p')];
if (reduit || !observe) aReveler.forEach(el => el.classList.add('vu'));
else {
  const io = new IntersectionObserver(entrees => {
    const visibles = entrees.filter(e => e.isIntersecting).map(e => e.target as HTMLElement);
    visibles.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (ra.top - rb.top) || (ra.left - rb.left); });
    visibles.forEach((el, k) => {
      el.style.setProperty('--cd', `${Math.min(k * .09, .9)}s`);
      el.classList.add('vu');
      el.querySelectorAll<HTMLElement>('[data-compte]').forEach(compter);
      io.unobserve(el);
    });
  }, { threshold: .15, rootMargin: '0px 0px -8% 0px' });
  aReveler.forEach(el => io.observe(el));
}

/* ---------- Carrousel d’exemples : avance seul, s’arrête au survol, au focus et hors écran ---------- */
const carrousel = document.getElementById('carrousel');
if (carrousel) {
  const diapos = [...carrousel.querySelectorAll<HTMLElement>('.lp-diapo')];
  const onglets = [...carrousel.querySelectorAll<HTMLButtonElement>('[data-diapo]')];
  const duree = 6000;
  carrousel.style.setProperty('--lp-duree', `${duree}ms`);
  let actif = 0, minuteur = 0, enPause = reduit, visible = true;
  const montrer = (n: number) => {
    actif = (n + diapos.length) % diapos.length;
    diapos.forEach((d, k) => { d.classList.toggle('actif', k === actif); d.toggleAttribute('inert', k !== actif); });
    onglets.forEach((o, k) => {
      o.setAttribute('aria-selected', String(k === actif));
      // Relance la barre de progression de l’onglet actif.
      const barre = o.querySelector<HTMLElement>('.lp-barre i')!; barre.style.transition = 'none'; void barre.offsetWidth; barre.style.transition = '';
    });
    relancer();
  };
  const relancer = () => {
    clearTimeout(minuteur);
    carrousel.classList.toggle('pause', enPause || !visible);
    if (!enPause && visible) minuteur = window.setTimeout(() => montrer(actif + 1), duree);
  };
  onglets.forEach((o, k) => o.addEventListener('click', () => montrer(k)));
  carrousel.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { montrer(actif + (e.key === 'ArrowRight' ? 1 : -1)); onglets[actif].focus(); }
  });
  carrousel.addEventListener('pointerenter', () => { if (!reduit) { enPause = true; relancer(); } });
  carrousel.addEventListener('pointerleave', () => { if (!reduit) { enPause = false; montrer(actif); } });
  carrousel.addEventListener('focusin', () => { enPause = true; relancer(); });
  carrousel.addEventListener('focusout', () => { if (!reduit) { enPause = false; relancer(); } });
  if (observe) new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) montrer(actif); else relancer(); }, { threshold: .3 }).observe(carrousel);
  montrer(0);
}

/* ---------- Collines de l’appel final : elles montent quand la section entre à l’écran ---------- */
const fin = document.querySelector<HTMLElement>('.lp-fin');
if (fin && !reduit) {
  let attente = 0;
  const maj = () => {
    attente = 0;
    const r = fin.getBoundingClientRect();
    const p = Math.min(Math.max((innerHeight - r.top) / (innerHeight + r.height * .4), 0), 1);
    fin.style.setProperty('--lp-monte', `${(1 - p) * 40}%`);
  };
  addEventListener('scroll', () => { if (!attente) attente = requestAnimationFrame(maj); }, { passive: true });
  maj();
}

/* ---------- Logo : le reflet du ruban (animation SVG) s’arrête avec « mouvements réduits » ---------- */
if (reduit) document.querySelectorAll<SVGSVGElement>('svg.lp-sprite').forEach(svg => svg.pauseAnimations());

animerFonds();
