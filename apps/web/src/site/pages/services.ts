import '../commun.ts';

// Page /services : chaque ligne du catalogue ouvre /deleguer avec le nom du service déjà écrit dans la description.
// Sans JS, le lien mène simplement à /deleguer#decrire.
document.querySelectorAll<HTMLAnchorElement>('.tarifs-s a').forEach(a => {
  const nom = a.dataset.service?.trim();
  if (nom) a.href = 'deleguer?service=' + encodeURIComponent(nom) + '#decrire';
});
