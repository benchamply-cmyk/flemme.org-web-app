import '../tests/internes/runtime.ts';
import './vitrine.css';
import './reglages.css';
import { ouvrirCatalogue } from './filtre.ts';

// Comportements communs à toutes les pages de la vitrine : menu burger, liens vers le catalogue filtré.
const burger = document.querySelector<HTMLDetailsElement>('.burger');
if (burger) {
  // Un clic ailleurs ou Échap referme le menu.
  document.addEventListener('click', e => { if (document.documentElement.dataset.testsInternesNav !== 'visible' && burger.open && !burger.contains(e.target as Node)) burger.open = false; });
  document.addEventListener('keydown', e => { if (document.documentElement.dataset.testsInternesNav !== 'visible' && e.key === 'Escape' && burger.open) { burger.open = false; burger.querySelector('summary')?.focus(); } });
  // La page courante est marquée dans le menu.
  const page = location.pathname.split('/').pop() || 'index.html';
  burger.querySelectorAll('a').forEach(a => { if (a.getAttribute('href') === page) a.setAttribute('aria-current', 'page'); });
}

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
