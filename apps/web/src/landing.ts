import { money, parseMoney, price } from '../../../packages/shared/src/domain.ts';
import { FAQ } from '../../../packages/shared/src/aide.ts';
import './styles.css';
import './landing.css';
import './essais.ts';

// Calculateur de la vitrine : même arrondi au centime que l’accord enregistré par l’app.
const input = document.getElementById('amount') as HTMLInputElement;
const out = (id: string, value: string) => { document.getElementById(id)!.textContent = value; };
function update() {
  try {
    const amount = parseMoney(input.value) as number;
    const p = price(amount); out('cBase', money(p.amount)); out('cFee', money(p.commission)); out('cTotal', money(p.total)); out('calcError', '');
    input.removeAttribute('aria-invalid');
  } catch (e) { out('calcError', (e as Error).message); input.setAttribute('aria-invalid', 'true'); }
}
input.addEventListener('input', update);
document.getElementById('calc')!.addEventListener('submit', e => e.preventDefault());
update();

// Exemples fictifs qui défilent dans l’en-tête (repris de l’aperçu validé par Ben le 4 novembre 2026).
const exemples = [
  { cat: 'Administratif', icon: '☕', title: 'Ce CV qui attend<br>depuis trois semaines…', place: 'À distance', delay: 'Environ 3 jours', who: 'Sam', reply: 'Je peux t’aider. On précise ce dont tu as besoin ?' },
  { cat: 'Maison', icon: '⌂', title: 'Cette étagère toujours<br>en pièces détachées…', place: 'Lyon · Croix-Rousse', delay: 'Demain', who: 'Nadia', reply: 'J’ai une visseuse et une heure samedi matin.' },
  { cat: 'Numérique', icon: '✳', title: '4 000 photos de vacances<br>jamais triées…', place: 'À distance', delay: 'Environ 1 semaine', who: 'Hugo', reply: 'Je te propose une sélection de 80 photos, sans doublons.' },
  { cat: 'Démarches', icon: '✉', title: 'Ce dossier de la CAF<br>qui me fait peur…', place: 'À distance', delay: 'Environ 1 semaine', who: 'Inès', reply: 'On le remplit ensemble en visio, pièce par pièce ?' },
  { cat: 'Organisation', icon: '◷', title: 'L’anniversaire de Léa<br>dans dix jours…', place: 'Paris · 11e', delay: 'Environ 1 mois', who: 'Malik', reply: 'Je peux préparer la liste des courses et le planning.' },
  { cat: 'Quotidien', icon: '✦', title: 'Ces cartons du<br>déménagement…', place: 'Nantes · Centre', delay: 'Ce week-end', who: 'Chloé', reply: 'Deux heures dimanche, ça te va pour commencer ?' },
];
const card = document.getElementById('showcase')!;
const dots = document.getElementById('showcaseDots')!;
const region = card.parentElement!;
let index = 0, timer: number | undefined, paused = false;
dots.innerHTML = exemples.map((x, i) => `<button type="button" class="showcase-dot" data-i="${i}" aria-label="Exemple ${i + 1} : ${x.cat}"></button>`).join('');
function show(i: number) {
  index = (i + exemples.length) % exemples.length;
  const x = exemples[index];
  card.innerHTML = `<div class="showcase-slide"><div class="showcase-top"><span class="pill">MA FLEMME · ${x.cat.toUpperCase()}</span><span aria-hidden="true">${x.icon}</span></div><p class="showcase-title">${x.title}</p><div class="mockline"></div><div class="mockline short"></div><p class="showcase-meta"><span>${x.place}</span><span>${x.delay}</span></p><div class="mini-reply"><span class="avatar" aria-hidden="true">☺</span><p><b>${x.who} · Brigadier</b><br>${x.reply}</p></div></div>`;
  dots.querySelectorAll('button').forEach((d, n) => n === index ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current'));
}
function start() {
  window.clearInterval(timer);
  if (paused || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  timer = window.setInterval(() => show(index + 1), 4500);
}
const step = (i: number) => { show(i); start(); };
document.getElementById('showcasePrev')!.addEventListener('click', () => step(index - 1));
document.getElementById('showcaseNext')!.addEventListener('click', () => step(index + 1));
card.addEventListener('click', () => step(index + 1));
dots.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('button'); if (b) step(Number(b.dataset.i)); });
const pause = (on: boolean) => () => { paused = on; start(); };
region.addEventListener('mouseenter', pause(true));
region.addEventListener('mouseleave', pause(false));
region.addEventListener('focusin', pause(true));
region.addEventListener('focusout', pause(false));
show(0);
start();

// Menu : sous-menus Contact et Langues, menu repliable sous 1100 px, barre de recherche.
const nav = document.getElementById('nav')!;
const toggle = document.getElementById('navToggle')!;
// Délégation : le contenu du menu peut être remplacé (essais d’organisation, voir essais.ts).
const subs = () => [...nav.querySelectorAll<HTMLButtonElement>('.nav-sub > button')];
const closeSubs = (except?: Element) => subs().forEach(b => { if (b !== except) b.setAttribute('aria-expanded', 'false'); });
const setMenu = (open: boolean) => {
  toggle.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('open', open);
  document.documentElement.classList.toggle('nav-locked', open);
  if (!open) closeSubs();
};
toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
nav.addEventListener('click', e => {
  const t = e.target as Element;
  const b = t.closest<HTMLButtonElement>('.nav-sub > button');
  if (b) { closeSubs(b); b.setAttribute('aria-expanded', String(b.getAttribute('aria-expanded') !== 'true')); return; }
  // Un lien du menu ferme tout ; un clic ailleurs ou Échap ferme les sous-menus.
  if (t.closest('a')) setMenu(false);
});
document.addEventListener('click', e => { if (!(e.target as Element).closest('.nav-sub')) closeSubs(); });
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const open = subs().find(b => b.getAttribute('aria-expanded') === 'true');
  if (open) { closeSubs(); open.focus(); } else if (nav.classList.contains('open')) { setMenu(false); toggle.focus(); }
});
matchMedia('(min-width: 1100px)').addEventListener('change', e => { if (e.matches) setMenu(false); });
// L’ombre de l’en-tête n’apparaît qu’une fois la page défilée.
const onScroll = () => nav.classList.toggle('scrolled', scrollY > 8);
addEventListener('scroll', onScroll, { passive: true }); onScroll();

// La recherche se fait dans l’app (Résoudre une flemme) : la vitrine lui passe les mots cherchés.
document.getElementById('navSearch')!.addEventListener('submit', e => {
  e.preventDefault();
  const q = (document.getElementById('navQ') as HTMLInputElement).value.trim();
  try { if (q) sessionStorage.setItem('flemme.recherche', q); else sessionStorage.removeItem('flemme.recherche'); } catch { /* stockage bloqué : la liste s’ouvre sans filtre */ }
  location.href = 'app.html#find';
});

// Questions fréquentes : mêmes réponses que l’assistant de l’app (packages/shared/src/aide.ts).
const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!).replace(/ ([?!:;])/g, '\u202f$1');
document.getElementById('faqList')!.innerHTML = FAQ.map(f => `<details class="faq-item"><summary>${esc(f.question)}</summary><p>${esc(f.answer)}</p></details>`).join('');

// Copier l’adresse de contact (repli : sélection du texte si le presse-papiers est refusé).
document.getElementById('copyMail')!.addEventListener('click', async () => {
  const mail = document.getElementById('contactMail')!, note = document.getElementById('copyNote')!;
  try { await navigator.clipboard.writeText(mail.textContent || ''); note.textContent = 'Adresse copiée.'; }
  catch { getSelection()?.selectAllChildren(mail); note.textContent = 'Adresse sélectionnée : copie-la avec Ctrl+C ou ⌘C.'; }
});
