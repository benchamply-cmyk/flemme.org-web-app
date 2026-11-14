import './beta/runtime.ts';
import './site/landing.css';
import './site/nav.ts';
import { animerFonds } from './site/fond-flemme.ts';

// Accueil (index.html, via accueil-page.ts ; ex-landing.html, 14/11/2026), d’après l’aperçu vidéo envoyé par Ben le 13/11, en thème clair
// et sur le plan de l’accueil actuel (PR #76). Nav commune (nav.ts), titre dont le début change, chiffres qui comptent,
// phrase « Tu décris. On s’en occupe. Tu valides. » mot par mot, carrousel d’exemples, moments du catalogue
// avec flèches et barre de progression, apparitions au défilement, collines qui montent, copie de l’adresse e-mail.
// Tout reste lisible sans JS et avec « mouvements réduits ».

const racine = document.documentElement;
const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
const observe = 'IntersectionObserver' in window;

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

/* ---------- Phrase géante découpée en mots pour l’apparition floue ---------- */
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

/* ---------- Carrousel d’exemples : avance seul (5 s), même au survol (demande de Ben, 14/11/2026) ; s’arrête au focus clavier et hors écran ---------- */
const carrousel = document.getElementById('carrousel');
if (carrousel) {
  const diapos = [...carrousel.querySelectorAll<HTMLElement>('.lp-diapo')];
  const onglets = [...carrousel.querySelectorAll<HTMLButtonElement>('[data-diapo]')];
  const duree = 5000;
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
  // Seul le focus au clavier met en pause (un clic sur un onglet garde le défilement automatique).
  carrousel.addEventListener('focusin', () => { if (carrousel.matches(':focus-within:has(:focus-visible)')) { enPause = true; relancer(); } });
  carrousel.addEventListener('focusout', () => { if (!reduit) { enPause = false; relancer(); } });
  if (observe) new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) montrer(actif); else relancer(); }, { threshold: .3 }).observe(carrousel);
  montrer(0);
}

/* ---------- Nos services : flèches et barre de progression calées sur le défilement horizontal ---------- */
const piste = document.getElementById('momentsPiste');
const barreMoments = document.getElementById('momentsBarre');
if (piste && piste.children.length > 1) {
  const cartes = [...piste.children] as HTMLElement[];
  const [precedent, suivant] = [...document.querySelectorAll<HTMLButtonElement>('[data-moment]')];
  const pas = () => cartes[1].offsetLeft - cartes[0].offsetLeft || 1;
  const majMoments = () => {
    const max = piste.scrollWidth - piste.clientWidth;
    const vu = piste.clientWidth / piste.scrollWidth;
    if (barreMoments) barreMoments.style.width = `${Math.min(100, (vu + (max > 0 ? piste.scrollLeft / max : 1) * (1 - vu)) * 100)}%`;
    if (precedent) precedent.disabled = piste.scrollLeft < 4;
    if (suivant) suivant.disabled = piste.scrollLeft >= max - 4;
  };
  document.querySelectorAll<HTMLButtonElement>('[data-moment]').forEach(b => b.addEventListener('click', () => {
    const k = Math.max(0, Math.min(cartes.length - 1, Math.round(piste.scrollLeft / pas()) + Number(b.dataset.moment)));
    piste.scrollTo({ left: cartes[k].offsetLeft - cartes[0].offsetLeft, behavior: reduit ? 'auto' : 'smooth' });
  }));
  piste.addEventListener('scroll', () => requestAnimationFrame(majMoments), { passive: true });
  addEventListener('resize', majMoments);
  majMoments();
}

/* ---------- Copier l’adresse e-mail (repli : sélection du texte si le presse-papiers est refusé) ---------- */
document.querySelectorAll<HTMLButtonElement>('[data-copier]').forEach(b => b.addEventListener('click', async () => {
  const cible = document.getElementById(b.dataset.copier || ''), note = document.getElementById(b.dataset.note || '');
  if (!cible) return;
  try { await navigator.clipboard.writeText(cible.textContent || ''); if (note) note.textContent = 'Adresse copiée.'; }
  catch { getSelection()?.selectAllChildren(cible); if (note) note.textContent = 'Adresse sélectionnée : copie-la avec Ctrl+C ou ⌘C.'; }
}));

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
