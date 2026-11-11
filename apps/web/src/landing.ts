import './site/commun.ts';

// Accueil de la vitrine (maquette V0.3, recommandations UX et contenus du 5 novembre 2026).

// Anciennes ancres de la page unique : renvoyées vers leur nouvelle page.
const anciennes: Record<string, string> = { '#concept': 'comment-ca-marche.html#concept', '#prix': 'comment-ca-marche.html#prix', '#comment': 'comment-ca-marche.html', '#faq': 'faq.html', '#contact': 'contact.html' };
if (anciennes[location.hash]) location.replace(anciennes[location.hash]);

// Carrousel du haut de page : un exemple fictif par service, avec ce que Flemme livre (bêta, 11 nov. 2026).
const exemples = [
  { cat: 'Démarches et courriers', icone: '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter"><path d="M6 4h9l3 3v13H6z"/><path d="M9 11h6M9 15h4"/></g></svg>', titre: 'Résilier ma salle de sport…', prix: '19 €', delai: '2 jours ouvrés', livre: 'La lettre de résiliation prête à envoyer, l’adresse et le mode d’envoi conseillé.' },
  { cat: 'Annonces de vente', icone: '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter"><rect x="5" y="6" width="14" height="10"/><path d="M9 19h6"/></g></svg>', titre: 'Vendre ma poussette sur Leboncoin…', prix: '19 €', delai: '2 jours ouvrés', livre: 'Titre, description, prix conseillé et trois conseils pour les photos.' },
  { cat: 'Recherche et comparaison', icone: '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter"><circle cx="11" cy="11" r="5.5"/><path d="M15 15l4 4"/></g></svg>', titre: 'Changer d’assurance habitation…', prix: '39 €', delai: '3 jours ouvrés', livre: 'Trois offres comparées sur tes critères, avec les liens et ce qu’il faut vérifier.' },
];
const carte = document.getElementById('exemple')!;
const points = document.getElementById('exemplePoints')!;
const region = carte.parentElement!;
let index = 0, minuterie: number | undefined, pause = false;
points.innerHTML = exemples.map((x, i) => `<button type="button" data-i="${i}" aria-label="Exemple ${i + 1} : ${x.cat}"></button>`).join('');
function montrer(i: number) {
  index = (i + exemples.length) % exemples.length;
  const x = exemples[index];
  carte.innerHTML = `<span class="exemple-etiquette" aria-hidden="true">Exemple ✦</span><span class="exemple-cat"><span class="exemple-icone" aria-hidden="true">${x.icone}</span>${x.cat}</span><b class="exemple-titre">${x.titre}</b><span class="exemple-meta">${x.prix} · ${x.delai}</span><div class="exemple-reponse"><b>Ce que tu reçois</b><br>${x.livre}</div>`;
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
