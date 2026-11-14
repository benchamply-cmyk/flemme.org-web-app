// Navigation pastille de la vitrine (src/site/entete.html), commune à l’accueil (landing.ts) et aux pages intérieures (commun.ts).
// Toujours visible, fixe en haut de l’écran pendant le défilement (demande de Ben, 14/11/2026) ; panneau « Menu » sous 720 px ; menu déroulant « Menu » dans la barre (ordinateur) ; page courante marquée.
const pn = document.getElementById('pn');
const menu = document.getElementById('pnMenu') as HTMLButtonElement | null;
const panneau = document.getElementById('pnPanneau');

if (pn && menu && panneau) {
  const ouvrirMenu = (ouvert: boolean) => {
    panneau.hidden = !ouvert;
    menu.setAttribute('aria-expanded', String(ouvert));
    menu.querySelector('span')!.textContent = ouvert ? 'Fermer' : 'Menu';
  };
  menu.addEventListener('click', () => ouvrirMenu(panneau.hidden === true));
  panneau.addEventListener('click', e => { if ((e.target as Element).closest('a')) ouvrirMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panneau.hidden) { ouvrirMenu(false); menu.focus(); } });
  document.addEventListener('click', e => { if (!panneau.hidden && !pn.contains(e.target as Node)) ouvrirMenu(false); });

  // Menus déroulants de la barre (ordinateur) : « Recherche » et « Menu », listes de liens choisies par Ben.
  // Un seul ouvert à la fois ; fermeture par Échap, clic ailleurs, clic sur un lien ou passage sous 720 px.
  const groupes = [...pn.querySelectorAll<HTMLElement>('.pn-plus')].map(g => ({
    g, btn: g.querySelector<HTMLButtonElement>('.pn-plus-btn')!, liste: g.querySelector<HTMLElement>('.pn-deroulant')!,
  })).filter(x => x.btn && x.liste);
  const ouvrirDeroulant = (x: typeof groupes[number], ouvert: boolean) => {
    x.liste.hidden = !ouvert;
    x.btn.setAttribute('aria-expanded', String(ouvert));
  };
  const fermerTout = (sauf?: typeof groupes[number]) => groupes.forEach(x => { if (x !== sauf && !x.liste.hidden) ouvrirDeroulant(x, false); });
  groupes.forEach(x => {
    x.btn.addEventListener('click', () => { const ouvrir = x.liste.hidden === true; fermerTout(x); ouvrirDeroulant(x, ouvrir); });
    x.liste.addEventListener('click', e => { if ((e.target as Element).closest('a')) ouvrirDeroulant(x, false); });
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const ouvert = groupes.find(x => !x.liste.hidden);
    if (ouvert) { ouvrirDeroulant(ouvert, false); ouvert.btn.focus(); }
  });
  document.addEventListener('click', e => groupes.forEach(x => { if (!x.liste.hidden && !x.g.contains(e.target as Node)) ouvrirDeroulant(x, false); }));
  addEventListener('resize', () => { if (matchMedia('(max-width: 720px)').matches) fermerTout(); });

  // Page courante : lien marqué (aria-current) dans la barre et dans le panneau.
  const page = location.pathname.split('/').pop()?.replace(/\.html$/, '') || 'index';
  pn.querySelectorAll<HTMLAnchorElement>('.pn-liens a, .pn-panneau a').forEach(a => {
    if (a.getAttribute('href') === page) a.setAttribute('aria-current', 'page');
  });
}
