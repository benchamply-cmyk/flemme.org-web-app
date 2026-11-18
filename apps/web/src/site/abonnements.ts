// Formules d'abonnement de la page /premium, générées au build depuis packages/shared/src/abonnements.ts (modèle générique).
// vite.config.ts remplace <!--#formules--> par ce HTML : la page publiée reste statique.
import { CONDITIONS_COMMUNES, FORMULES, prixFormule, souscriptible, verifierFormule } from '../../../../packages/shared/src/abonnements.ts';
import type { FormuleAbonnement } from '../../../../packages/shared/src/abonnements.ts';

const echapper = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const prevenir = (f: FormuleAbonnement) => `mailto:bonjour@flemme.org?subject=${encodeURIComponent('FLEMME · ' + f.nom)}`;

export function htmlFormule(f: FormuleAbonnement): string {
  verifierFormule(f);
  const liste = (items: readonly string[]) => '<ul>' + items.map(x => `<li>${echapper(x)}</li>`).join('') + '</ul>';
  // Souscription : visible seulement quand le flag est allumé ; sinon « Être prévenu ».
  const boutons = souscriptible(f)
    ? `<a class="bouton vert" href="mon-espace" data-flag="abonnements.souscription">S’abonner</a><a class="bouton vert" href="${prevenir(f)}" data-flag-off="abonnements.souscription">Être prévenu du lancement</a>`
    : `<a class="bouton vert" href="${prevenir(f)}">Être prévenu du lancement</a>`;
  return `<div class="sombre" data-formule="${echapper(f.id)}"><b style="font-size:22px">${echapper(f.nom)}</b><b class="prix">${echapper(prixFormule(f))}</b>`
    + `<p>${echapper(f.accroche)}</p>${liste(f.avantages)}${f.essaiJours > 0 ? `<p class="doux">${f.essaiJours} jours d’essai gratuits.</p>` : ''}${boutons}</div>`;
}
export const htmlFormules = () => FORMULES.filter(f => f.statut !== 'fermee').map(htmlFormule).join('\n      ');
export const htmlConditionsAbonnement = () => CONDITIONS_COMMUNES.map(c => `<li>${echapper(c)}</li>`).join('');
