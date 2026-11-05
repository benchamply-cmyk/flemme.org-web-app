import './site/commun.ts';

// Accueil de la vitrine (maquette V0.3, recommandations UX et contenus du 5 novembre 2026).

// Anciennes ancres de la page unique : renvoyées vers leur nouvelle page.
const anciennes: Record<string, string> = { '#concept': 'comment-ca-marche.html#concept', '#prix': 'comment-ca-marche.html#prix', '#comment': 'comment-ca-marche.html', '#faq': 'faq.html', '#contact': 'contact.html' };
if (anciennes[location.hash]) location.replace(anciennes[location.hash]);

// Carrousel d’exemples fictifs du haut de page : lignes « En ligne » du tableur de Ben
// « Flemme – Exemples du carrousel » (Google Sheets, 5 novembre 2026). Les lignes « Proposition » n’y sont pas encore.
const exemples = [
  { cat: 'Maison', icone: '⌂', titre: 'Monter mes nouveaux meubles Ikea…', lieu: 'Lyon · Croix-Rousse', delai: 'Dans la semaine', qui: 'Arthur', reponse: 'J’ai les outils nécessaires et je suis dispo cette semaine.' },
  { cat: 'Numérique', icone: '✳', titre: 'S’occuper de mon annonce LeBonCoin', lieu: 'À distance', delai: 'Dans le mois', qui: 'Victor', reponse: 'Je m’occupe de répondre aux appels et aux messages pour vendre ta voiture.' },
  { cat: 'Démarches', icone: '✉', titre: 'Ce dossier de la CAF qui me fait peur…', lieu: 'À distance', delai: 'Environ 1 semaine', qui: 'Antoine', reponse: 'On le remplit ensemble en visio, pièce par pièce ?' },
  { cat: 'Organisation', icone: '◷', titre: 'L’anniversaire de Léa dans dix jours…', lieu: 'Paris · 11e', delai: 'Environ 1 mois', qui: 'Malik', reponse: 'Je peux préparer la liste des courses et le planning.' },
  { cat: 'Quotidien', icone: '✦', titre: 'Ces cartons du déménagement…', lieu: 'Nantes · Centre', delai: 'Ce week-end', qui: 'Chloé', reponse: 'Deux heures dimanche, ça te va pour commencer ?' },
];
const carte = document.getElementById('exemple')!;
const points = document.getElementById('exemplePoints')!;
const region = carte.parentElement!;
let index = 0, minuterie: number | undefined, pause = false;
points.innerHTML = exemples.map((x, i) => `<button type="button" data-i="${i}" aria-label="Exemple ${i + 1} : ${x.cat}"></button>`).join('');
function montrer(i: number) {
  index = (i + exemples.length) % exemples.length;
  const x = exemples[index];
  carte.innerHTML = `<span class="exemple-etiquette" aria-hidden="true">Exemple ✦</span><span class="exemple-cat"><span class="exemple-icone" aria-hidden="true">${x.icone}</span>Exemple de demande · ${x.cat}</span><b class="exemple-titre">${x.titre}</b><span class="exemple-meta">${x.lieu} · ${x.delai}</span><div class="exemple-reponse"><b>${x.qui} propose son aide</b><br>${x.reponse}</div>`;
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
