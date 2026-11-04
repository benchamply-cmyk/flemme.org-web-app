import { money, parseMoney, price } from '../../../packages/shared/src/domain.ts';
import './styles.css';
import './landing.css';

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
