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

  // Menu déroulant de la barre (ordinateur) : liste de liens choisie dans le plan du site.
  const plus = document.getElementById('pnPlus') as HTMLButtonElement | null;
  const deroulant = document.getElementById('pnDeroulant');
  const ouvrirDeroulant = (ouvert: boolean) => {
    if (!plus || !deroulant) return;
    deroulant.hidden = !ouvert;
    plus.setAttribute('aria-expanded', String(ouvert));
  };
  plus?.addEventListener('click', () => ouvrirDeroulant(deroulant?.hidden === true));
  deroulant?.addEventListener('click', e => { if ((e.target as Element).closest('a')) ouvrirDeroulant(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && deroulant && !deroulant.hidden) { ouvrirDeroulant(false); plus?.focus(); } });
  document.addEventListener('click', e => { if (deroulant && !deroulant.hidden && !plus?.parentElement?.contains(e.target as Node)) ouvrirDeroulant(false); });
  addEventListener('resize', () => { if (deroulant && !deroulant.hidden && matchMedia('(max-width: 720px)').matches) ouvrirDeroulant(false); });

  // Page courante : lien marqué (aria-current) dans la barre et dans le panneau.
  const page = location.pathname.split('/').pop() || 'index.html';
  pn.querySelectorAll<HTMLAnchorElement>('.pn-liens a, .pn-panneau a').forEach(a => {
    if (a.getAttribute('href') === page) a.setAttribute('aria-current', 'page');
  });
}
