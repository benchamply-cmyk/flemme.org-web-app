import { BUDGET_RANGES, CATEGORIES, DEADLINES, MODES } from '../../../../../packages/shared/src/index.ts';
import { monterFiltres } from '../filtres.ts';
import { ecrireBrouillon, lireBrouillon } from '../brouillon.ts';
import '../commun.ts';

// Page Déléguer (/deleguer), même structure que Résoudre (demande de Ben, 14/11/2026) : un texte principal pour décrire
// la flemme, puis les filtres du formulaire de l’app pour la qualifier. On peut tout remplir sans compte ;
// « Continuer » ouvre le formulaire de l’app (/deleguer/nouvelle), qui demande la connexion ou la création du compte
// et reprend ce brouillon. Rien n’est publié avant « Envoyer ma demande ».
const FORMULES = [
  { value: 'catalogue', label: 'Service du catalogue' }, { value: 'autre', label: 'Autre service (prix proposé par l’équipe)' }, { value: 'devis', label: 'Demande de devis' },
] as const;
const depart = lireBrouillon();
const texte = document.getElementById('deleguerDetails') as HTMLTextAreaElement;
texte.value = depart.details || '';
const garder = () => ecrireBrouillon({ ...choix, details: texte.value, formule: choix.formule === 'catalogue' ? '' : choix.formule });
const choix = monterFiltres(document.getElementById('filtresDeleguer')!, [
  { cle: 'category', nom: 'Catégorie', options: CATEGORIES },
  { cle: 'mode', nom: 'Où', options: MODES, ville: true },
  { cle: 'deadline', nom: 'Quand', options: DEADLINES },
  { cle: 'budgetRange', nom: 'Budget', options: BUDGET_RANGES },
  { cle: 'formule', nom: 'Formule', options: FORMULES },
], depart, () => garder());
const aideDepart = document.getElementById('deleguerAide')!.textContent;
texte.addEventListener('input', () => { garder(); document.getElementById('deleguerAide')!.textContent = aideDepart; });
// Lien « Décrire un autre service » ou « Demander un devis » des cartes : la formule est choisie, le texte gardé.
document.querySelectorAll<HTMLAnchorElement>('[data-formule]').forEach(a => a.addEventListener('click', () => { choix.formule = a.dataset.formule || ''; garder(); }));
document.getElementById('deleguerForm')!.addEventListener('submit', e => {
  e.preventDefault();
  const aide = document.getElementById('deleguerAide')!;
  if (texte.value.trim().length < 10) { aide.textContent = 'Décris ta flemme en une phrase au moins : ce que tu attends, ce qui te bloque.'; texte.focus(); return; }
  garder();
  location.href = '/deleguer/nouvelle' + (choix.formule === 'autre' || choix.formule === 'devis' ? '?formule=' + choix.formule : '');
});
