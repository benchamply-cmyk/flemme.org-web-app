import { BUDGET_FILTERS, CATEGORIES, DEADLINES, MODES } from '../../../../../packages/shared/src/index.ts';
import type { Option, SearchFilter } from '../../../../../packages/shared/src/index.ts';
import { ouvrirCatalogue } from '../filtre.ts';
import '../commun.ts';

// Recherche et filtres de la page Résoudre : mêmes choix que la création d’une flemme et que le catalogue de l’app.
// Les choix sont transmis au catalogue (/flemmes), qui fait la recherche côté serveur.
const filtre: SearchFilter = {};
const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const menus: { cle: keyof SearchFilter; nom: string; options: readonly Option[]; ville?: boolean }[] = [
  { cle: 'category', nom: 'Catégorie', options: CATEGORIES },
  { cle: 'mode', nom: 'Où', options: MODES, ville: true },
  { cle: 'deadline', nom: 'Quand', options: DEADLINES },
  { cle: 'budget', nom: 'Budget', options: BUDGET_FILTERS },
];
const zone = document.getElementById('filtres')!;
zone.insertAdjacentHTML('beforeend', menus.map(m => `<details class="filtre" data-cle="${m.cle}"><summary>${m.nom} ▾</summary><div class="filtre-choix">${m.options.map(o =>
  `<label class="puce"><input type="radio" name="${m.cle}" value="${o.value}"><span>${esc(o.label)}</span></label>`).join('')}${m.ville ? '<label style="width:100%"><span class="sr">Ville ou secteur</span><input type="text" name="place" placeholder="Ville ou secteur" maxlength="100"></label>' : ''}</div></details>`).join('')
  + '<button type="button" class="effacer" id="effacer">Effacer les filtres</button>');

const libelle = (m: typeof menus[number]) => m.options.find(o => o.value === filtre[m.cle])?.label;
function rafraichir() {
  zone.querySelectorAll<HTMLDetailsElement>('.filtre').forEach(d => {
    const m = menus.find(x => x.cle === d.dataset.cle)!, choisi = libelle(m) || (m.ville ? filtre.place : '');
    d.classList.toggle('actif', !!choisi);
    d.querySelector('summary')!.textContent = (choisi ? m.nom + ' : ' + choisi : m.nom) + ' ▾';
  });
}
zone.addEventListener('change', e => {
  const t = e.target as HTMLInputElement;
  (filtre as Record<string, string>)[t.name] = t.value.trim();
  if (t.type === 'radio') (t.closest('details') as HTMLDetailsElement).open = false;
  rafraichir();
});
// Un seul menu ouvert à la fois ; un clic ailleurs les referme.
zone.addEventListener('toggle', e => { const d = e.target as HTMLDetailsElement; if (d.open) zone.querySelectorAll<HTMLDetailsElement>('.filtre').forEach(x => { if (x !== d) x.open = false; }); }, true);
document.addEventListener('click', e => { if (!(e.target as Element).closest('.filtre')) zone.querySelectorAll<HTMLDetailsElement>('.filtre').forEach(x => { x.open = false; }); });
document.getElementById('effacer')!.addEventListener('click', () => {
  for (const k of Object.keys(filtre)) delete (filtre as Record<string, string>)[k];
  zone.querySelectorAll<HTMLInputElement>('input').forEach(i => { if (i.type === 'radio') i.checked = false; else i.value = ''; });
  rafraichir();
});
document.getElementById('rechercheForm')!.addEventListener('submit', e => {
  e.preventDefault();
  ouvrirCatalogue({ ...filtre, q: (document.getElementById('rechercheQ') as HTMLInputElement).value });
});
