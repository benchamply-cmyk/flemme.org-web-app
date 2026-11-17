import '../beta/runtime.ts';
import './vitrine.css';
import './reglages.css';
import './reglages-retenus.css';
import './reglages-pr55.css';
import './nav.css';
import './nav.ts';
import './marque.css';
import { ouvrirCatalogue } from './filtre.ts';

// Comportements communs à toutes les pages de la vitrine : menu burger, liens vers le catalogue filtré.
// V0.6 : deux menus dans l’en-tête (« Menu » et « ? » Aide). Un seul reste ouvert à la fois.
const menus = [...document.querySelectorAll<HTMLDetailsElement>('.burger')];
const navVisible = () => document.documentElement.dataset.betaNav === 'visible';
menus.forEach(burger => {
  burger.addEventListener('toggle', () => { if (!navVisible() && burger.open) menus.forEach(m => { if (m !== burger) m.open = false; }); });
  // Un clic ailleurs ou Échap referme le menu.
  document.addEventListener('click', e => { if (!navVisible() && burger.open && !burger.contains(e.target as Node)) burger.open = false; });
  document.addEventListener('keydown', e => { if (!navVisible() && e.key === 'Escape' && burger.open) { burger.open = false; burger.querySelector('summary')?.focus(); } });
  // La page courante est marquée dans le menu.
  const page = location.pathname.split('/').pop()?.replace(/\.html$/, '') || 'index';
  burger.querySelectorAll('a').forEach(a => { if (a.getAttribute('href') === page) a.setAttribute('aria-current', 'page'); });
});

// Liens « catégorie » (accueil, pied de page) : le catalogue s’ouvre déjà filtré.
document.querySelectorAll<HTMLAnchorElement>('[data-filtre-categorie]').forEach(a => a.addEventListener('click', e => {
  e.preventDefault();
  ouvrirCatalogue({ category: a.dataset.filtreCategorie || '' });
}));

// Copier une adresse e-mail (repli : sélection du texte si le presse-papiers est refusé).
document.querySelectorAll<HTMLButtonElement>('[data-copier]').forEach(b => b.addEventListener('click', async () => {
  const cible = document.getElementById(b.dataset.copier || ''), note = document.getElementById(b.dataset.note || '');
  if (!cible) return;
  try { await navigator.clipboard.writeText(cible.textContent || ''); if (note) note.textContent = 'Adresse copiée.'; }
  catch { getSelection()?.selectAllChildren(cible); if (note) note.textContent = 'Adresse sélectionnée : copie-la avec Ctrl+C ou ⌘C.'; }
}));
