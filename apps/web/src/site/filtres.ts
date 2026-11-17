import type { Option } from '../../../../packages/shared/src/index.ts';

// Menus de filtres de la vitrine (pages Résoudre et Déléguer) : un bouton par critère, qui déplie ses choix.
// Un seul menu ouvert à la fois ; un clic ailleurs les referme. Les choix sont ceux du formulaire de l’app (packages/shared).
export type Menu = { cle: string; nom: string; options: readonly Option[]; ville?: boolean };
const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Monte les menus dans `zone` et renvoie les valeurs choisies (objet tenu à jour). `depart` présélectionne des choix. */
export function monterFiltres(zone: HTMLElement, menus: Menu[], depart: Record<string, string> = {}, onChange: () => void = () => {}) {
  const valeurs: Record<string, string> = {};
  zone.insertAdjacentHTML('beforeend', menus.map(m => `<details class="filtre" data-cle="${m.cle}"><summary>${m.nom} ▾</summary><div class="filtre-choix">${m.options.map(o =>
    `<label class="puce"><input type="radio" name="${m.cle}" value="${o.value}"><span>${esc(o.label)}</span></label>`).join('')}${m.ville ? '<label style="width:100%"><span class="sr">Ville ou secteur</span><input type="text" name="place" placeholder="Ville ou secteur" maxlength="100"></label>' : ''}</div></details>`).join('')
    + '<button type="button" class="effacer">Effacer les filtres</button>');
  const libelle = (m: Menu) => m.options.find(o => o.value === valeurs[m.cle])?.label;
  function rafraichir() {
    zone.querySelectorAll<HTMLDetailsElement>('.filtre').forEach(d => {
      const m = menus.find(x => x.cle === d.dataset.cle)!, choisi = libelle(m) || (m.ville ? valeurs.place : '');
      d.classList.toggle('actif', !!choisi);
      d.querySelector('summary')!.textContent = (choisi ? m.nom + ' : ' + choisi : m.nom) + ' ▾';
    });
  }
  // Valeurs de départ (brouillon gardé dans ce navigateur) : seules les valeurs connues sont reprises.
  for (const m of menus) if (m.options.some(o => o.value === depart[m.cle])) { valeurs[m.cle] = depart[m.cle]; zone.querySelector<HTMLInputElement>(`input[name="${m.cle}"][value="${depart[m.cle]}"]`)!.checked = true; }
  if (depart.place && menus.some(m => m.ville)) { valeurs.place = depart.place.slice(0, 100); zone.querySelector<HTMLInputElement>('input[name="place"]')!.value = valeurs.place; }
  rafraichir();
  zone.addEventListener('change', e => {
    const t = e.target as HTMLInputElement;
    valeurs[t.name] = t.value.trim();
    if (t.type === 'radio') (t.closest('details') as HTMLDetailsElement).open = false;
    rafraichir(); onChange();
  });
  zone.addEventListener('toggle', e => {
    const d = e.target as HTMLDetailsElement;
    if (!d.open) return;
    zone.querySelectorAll<HTMLDetailsElement>('.filtre').forEach(x => { if (x !== d) x.open = false; });
    // Sur téléphone, un menu ouvert depuis une pastille à droite sortait de l’écran : on le recale dans la largeur visible.
    const choix = d.querySelector<HTMLElement>('.filtre-choix');
    if (!choix) return;
    choix.style.left = '';
    const marge = 16, r = choix.getBoundingClientRect(), largeur = document.documentElement.clientWidth;
    if (r.right > largeur - marge) choix.style.left = `${Math.min(0, largeur - marge - r.right)}px`;
    const r2 = choix.getBoundingClientRect();
    if (r2.left < marge) choix.style.left = `${parseFloat(choix.style.left || '0') + marge - r2.left}px`;
  }, true);
  document.addEventListener('click', e => { if (!(e.target as Element).closest('.filtre')) zone.querySelectorAll<HTMLDetailsElement>('.filtre').forEach(x => { x.open = false; }); });
  zone.querySelector('.effacer')!.addEventListener('click', () => {
    for (const k of Object.keys(valeurs)) delete valeurs[k];
    zone.querySelectorAll<HTMLInputElement>('input').forEach(i => { if (i.type === 'radio') i.checked = false; else i.value = ''; });
    rafraichir(); onChange();
  });
  return valeurs;
}
