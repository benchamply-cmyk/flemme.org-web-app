import { BUDGET_FILTERS, CATEGORIES, DEADLINES, MODES } from '../../../../../packages/shared/src/index.ts';
import { ouvrirCatalogue } from '../filtre.ts';
import { monterFiltres } from '../filtres.ts';
import '../commun.ts';

// Recherche et filtres de la page Résoudre : mêmes choix que la création d’une flemme et que le catalogue de l’app.
// Les choix sont transmis au catalogue (/flemmes), qui fait la recherche côté serveur ; il faut un compte pour voir les résultats.
const filtre = monterFiltres(document.getElementById('filtres')!, [
  { cle: 'category', nom: 'Catégorie', options: CATEGORIES },
  { cle: 'mode', nom: 'Où', options: MODES, ville: true },
  { cle: 'deadline', nom: 'Quand', options: DEADLINES },
  { cle: 'budget', nom: 'Budget', options: BUDGET_FILTERS },
]);
document.getElementById('rechercheForm')!.addEventListener('submit', e => {
  e.preventDefault();
  ouvrirCatalogue({ ...filtre, q: (document.getElementById('rechercheQ') as HTMLInputElement).value });
});
