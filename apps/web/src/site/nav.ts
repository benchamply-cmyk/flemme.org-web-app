// Navigation pastille de la vitrine (src/site/entete.html), commune à l’accueil (landing.ts) et aux pages intérieures (commun.ts).
// Cachée quand on descend, visible dès qu’on remonte ; panneau « Menu » sous 920 px ; page courante marquée.
const pn = document.getElementById('pn');
const menu = document.getElementById('pnMenu') as HTMLButtonElement | null;
const panneau = document.getElementById('pnPanneau');

if (pn && menu && panneau) {
  const ouvrirMenu = (ouvert: boolean) => {
    panneau.hidden = !ouvert;
    menu.setAttribute('aria-expanded', String(ouvert));
    menu.querySelector('span')!.textContent = ouvert ? 'Fermer' : 'Menu';
    if (ouvert) pn.classList.remove('cachee');
  };
  menu.addEventListener('click', () => ouvrirMenu(panneau.hidden === true));
  panneau.addEventListener('click', e => { if ((e.target as Element).closest('a')) ouvrirMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panneau.hidden) { ouvrirMenu(false); menu.focus(); } });
  document.addEventListener('click', e => { if (!panneau.hidden && !pn.contains(e.target as Node)) ouvrirMenu(false); });

  let dernierY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    if (panneau.hidden && !pn.contains(document.activeElement)) pn.classList.toggle('cachee', y > dernierY && y > 160);
    dernierY = y;
  }, { passive: true });

  // Page courante : lien marqué (aria-current) dans la barre et dans le panneau.
  const page = location.pathname.split('/').pop() || 'index.html';
  pn.querySelectorAll<HTMLAnchorElement>('.pn-liens a, .pn-panneau a').forEach(a => {
    if (a.getAttribute('href') === page) a.setAttribute('aria-current', 'page');
  });
}
