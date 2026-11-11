import './site/commun.ts';

// Accueil de la vitrine (maquette V0.3, recommandations UX et contenus du 5 novembre 2026).

// Anciennes ancres de la page unique : renvoyées vers leur nouvelle page.
const anciennes: Record<string, string> = { '#concept': 'comment-ca-marche.html#concept', '#prix': 'comment-ca-marche.html#prix', '#comment': 'comment-ca-marche.html', '#faq': 'faq.html', '#contact': 'contact.html' };
if (anciennes[location.hash]) location.replace(anciennes[location.hash]);

// Surtitre et grand titre (V0.6) : alternent ensemble toutes les 3,5 secondes (pas d’alternance si l’animation est réduite).
// Le style de transition se règle par data-anim sur chaque bloc .titre-alterne (voir vitrine.css).
const groupes = [...document.querySelectorAll<HTMLElement>('.titre-alterne')].map(g => [...g.querySelectorAll<HTMLElement>(':scope > span')]).filter(p => p.length > 1);
if (groupes.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let phrase = 0;
  setInterval(() => {
    const suivante = phrase + 1;
    groupes.forEach(phrases => {
      const avant = phrases[phrase % phrases.length];
      avant.classList.replace('actif', 'sortie');
      setTimeout(() => avant.classList.remove('sortie'), 650);
      const apres = phrases[suivante % phrases.length];
      apres.classList.add('actif');
    });
    phrase = suivante;
  }, 3500);
}

// Carrousel d’exemples fictifs du haut de page : un exemple par service de l’option B (PR brouillon, 12/11/2026).
// Prix payés par le client, frais Flemme de 12 % compris. À remplacer par de vrais exemples livrés pendant la bêta.
const exemples = [
  { cat: 'Courrier', icone: '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter"><path d="M6 4h9l3 3v13H6z"/><path d="M9 11h6M9 15h4"/></g></svg>', titre: 'Résilier mon abonnement de salle de sport…', lieu: 'À distance', delai: '22,40 € · 2 jours ouvrés', qui: 'Inès, Brigadière', reponse: 'Je te prépare la lettre recommandée et la marche à suivre pour demain.' },
  { cat: 'Annonces', icone: '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter"><rect x="5" y="6" width="14" height="10"/><path d="M9 19h6"/></g></svg>', titre: 'Vendre mon vélo et ma vieille console', lieu: 'À distance', delai: '28 € les 3 annonces · 2 jours ouvrés', qui: 'Victor, Brigadier', reponse: 'Envoie-moi tes photos, je rédige les annonces et je te conseille un prix.' },
  { cat: 'Recherche', icone: '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter"><circle cx="12" cy="12" r="7"/><path d="M12 8v4h3"/></g></svg>', titre: 'Trouver une mutuelle moins chère…', lieu: 'À distance', delai: '44,80 € · 3 jours ouvrés', qui: 'Antoine, Brigadier', reponse: 'Je compare trois offres avec tes garanties actuelles et je te mets les sources.' },
  { cat: 'Dossier', icone: '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter"><path d="M6 4h9l3 3v13H6z"/><path d="M9 11h6M9 15h4"/></g></svg>', titre: 'Ce dossier de la CAF qui me fait peur…', lieu: 'À distance', delai: '67,20 € · 5 jours ouvrés', qui: 'Chloé, Brigadière', reponse: 'Je liste les pièces, je remplis avec toi et je vérifie tout avant l’envoi.' },
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
