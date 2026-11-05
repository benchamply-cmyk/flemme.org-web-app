import './site/commun.ts';

// Accueil de la vitrine (maquette V0.3 « 01 · Accueil »).

// Anciennes ancres de la page unique : renvoyées vers leur nouvelle page.
const anciennes: Record<string, string> = { '#concept': 'concept.html', '#prix': 'concept.html#prix', '#comment': 'comment-ca-marche.html', '#faq': 'faq.html', '#contact': 'contact.html' };
if (anciennes[location.hash]) location.replace(anciennes[location.hash]);

// Exemples fictifs qui défilent dans le haut de page (repris de l’aperçu validé par Ben le 4 novembre 2026).
const exemples = [
  { cat: 'Administratif', title: 'Ce CV qui attend depuis trois semaines…', place: 'À distance', delay: 'Environ 3 jours', who: 'Sam', reply: 'Je peux t’aider. On précise ce dont tu as besoin ?' },
  { cat: 'Maison', title: 'Cette étagère toujours en pièces détachées…', place: 'Lyon · Croix-Rousse', delay: 'Demain', who: 'Nadia', reply: 'J’ai une visseuse et une heure samedi matin.' },
  { cat: 'Numérique', title: '4 000 photos de vacances jamais triées…', place: 'À distance', delay: 'Environ 1 semaine', who: 'Hugo', reply: 'Je te propose une sélection de 80 photos, sans doublons.' },
  { cat: 'Démarches', title: 'Ce dossier de la CAF qui me fait peur…', place: 'À distance', delay: 'Environ 1 semaine', who: 'Inès', reply: 'On le remplit ensemble en visio, pièce par pièce ?' },
  { cat: 'Organisation', title: 'L’anniversaire de Léa dans dix jours…', place: 'Paris · 11e', delay: 'Environ 1 mois', who: 'Malik', reply: 'Je peux préparer la liste des courses et le planning.' },
  { cat: 'Quotidien', title: 'Ces cartons du déménagement…', place: 'Nantes · Centre', delay: 'Ce week-end', who: 'Chloé', reply: 'Deux heures dimanche, ça te va pour commencer ?' },
];
const carte = document.getElementById('exemple')!;
const points = document.getElementById('exemplePoints')!;
const region = carte.parentElement!;
let index = 0, minuterie: number | undefined, pause = false;
points.innerHTML = exemples.map((x, i) => `<button type="button" data-i="${i}" aria-label="Exemple ${i + 1} : ${x.cat}"></button>`).join('');
function montrer(i: number) {
  index = (i + exemples.length) % exemples.length;
  const x = exemples[index];
  carte.innerHTML = `<span class="exemple-etiquette" aria-hidden="true">Un peu moins à faire ✦</span><span class="exemple-cat">Ma flemme · ${x.cat}</span><b class="exemple-titre">${x.title}</b><span class="exemple-meta">${x.place} · ${x.delay}</span><div class="exemple-reponse"><b>${x.who} · Brigadier</b><br>${x.reply}</div>`;
  points.querySelectorAll('button').forEach((d, n) => n === index ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current'));
}
function lancer() {
  window.clearInterval(minuterie);
  if (pause || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  minuterie = window.setInterval(() => montrer(index + 1), 4500);
}
const aller = (i: number) => { montrer(i); lancer(); };
document.getElementById('exemplePrec')!.addEventListener('click', () => aller(index - 1));
document.getElementById('exempleSuiv')!.addEventListener('click', () => aller(index + 1));
carte.addEventListener('click', () => aller(index + 1));
points.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('button'); if (b) aller(Number(b.dataset.i)); });
const suspendre = (on: boolean) => () => { pause = on; lancer(); };
region.addEventListener('mouseenter', suspendre(true));
region.addEventListener('mouseleave', suspendre(false));
region.addEventListener('focusin', suspendre(true));
region.addEventListener('focusout', suspendre(false));
montrer(0);
lancer();
