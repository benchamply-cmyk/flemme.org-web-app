import './site/vitrine.css';
import './site/reglages.css';
import './site/reglages-retenus.css';
import './site/reglages-pr55.css';
import './site/atelier-services.css';
import enLigne from '../contenu/services.json';
import { COULEURS, ICONES, verifierCatalogue, htmlCatalogue, exemplesCarrousel, type Catalogue, type Famille, type Carte } from './site/services.ts';

// Atelier des services (12 nov. 2026) : édition du catalogue sur téléphone, aperçu en direct avec le style réel du site.
// Le brouillon reste dans ce navigateur ; « Enregistrer » donne le fichier à coller dans GitHub (aucun jeton, aucune écriture serveur).

declare const __BRANCHE__: string;
const DEPOT = 'benchamply-cmyk/flemme.org-web-app';
const CHEMIN = 'apps/web/contenu/services.json';
const CLE = 'flemme.atelier-services.brouillon.v1';
const AIDE = (enLigne as Record<string, unknown>)._aide;

const copie = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const reference = (): Catalogue => { const c = copie(enLigne) as unknown as Catalogue & { _aide?: unknown }; delete c._aide; return c; };
const lireBrouillon = (): Catalogue | null => { try { const s = localStorage.getItem(CLE); return s ? JSON.parse(s) : null; } catch { return null; } };
const ecrireBrouillon = (c: Catalogue | null) => { try { c ? localStorage.setItem(CLE, JSON.stringify(c)) : localStorage.removeItem(CLE); } catch { /* stockage refusé : on continue sans brouillon */ } };

let cat: Catalogue = lireBrouillon() ?? reference();
if (lireBrouillon()) document.getElementById('atSource')!.textContent = 'Brouillon repris de ta dernière visite sur ce téléphone.';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ed = $('editeur');
const etat = $('etat');

// ---------- Fichier final ----------
function fichier(): string {
  return JSON.stringify(AIDE ? { _aide: AIDE, ...cat } : cat, null, 2) + '\n';
}
const modifie = () => JSON.stringify(cat) !== JSON.stringify(reference());

// ---------- Aperçu ----------
let minuterie: number | undefined;
function rafraichir(flash?: string) {
  ecrireBrouillon(modifie() ? cat : null);
  window.clearTimeout(minuterie);
  minuterie = window.setTimeout(() => {
    const pb = verifierCatalogue(cat);
    const enr = $<HTMLButtonElement>('enregistrer');
    if (pb.length) {
      etat.className = 'at-etat err'; etat.textContent = `À corriger : ${pb[0]}${pb.length > 1 ? ` (+${pb.length - 1})` : ''}`;
      enr.disabled = true; return;
    }
    enr.disabled = !modifie();
    etat.className = modifie() ? 'at-etat ok' : 'at-etat';
    etat.textContent = modifie() ? 'Modifications prêtes à enregistrer (brouillon gardé sur ce téléphone).' : 'Aucune modification.';
    $('apercuCatalogue').innerHTML = htmlCatalogue(cat);
    $('apercuExemples').innerHTML = exemplesCarrousel(cat).map(x =>
      `<div class="at-exemple"><span class="exemple-cat">${x.icone} ${x.cat}</span><b>${x.titre}</b><span class="at-petit">${x.prix} · ${x.delai}</span><span>${x.livre}</span></div>`).join('');
    if (flash) $('apercuCatalogue').querySelectorAll('.carte')[Number(flash)]?.classList.add('at-flash');
  }, 120);
}

// ---------- Petits constructeurs ----------
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {}, ...enfants: (Node | string)[]) {
  const e = document.createElement(tag);
  const { class: cl, ...rest } = props;
  if (cl) e.className = cl;
  Object.assign(e, rest);
  e.append(...enfants);
  return e;
}
let uid = 0;
function champTexte(libelle: string, valeur: string, maj: (v: string) => void, long = false, apercu?: number) {
  const id = `ch${++uid}`;
  const input = long ? el('textarea', { id, value: valeur, rows: 3 }) : el('input', { id, type: 'text', value: valeur });
  input.addEventListener('input', () => { maj(input.value); rafraichir(apercu === undefined ? undefined : String(apercu)); });
  return el('label', { class: 'at-champ', htmlFor: id }, libelle, input);
}
function champPrix(libelle: string, valeur: number, maj: (v: number) => void, apercu?: number) {
  const id = `ch${++uid}`;
  const input = el('input', { id, type: 'number', inputMode: 'numeric', min: '0', step: '1', value: String(valeur) });
  input.addEventListener('input', () => { maj(input.value === '' ? NaN : Number(input.value)); rafraichir(apercu === undefined ? undefined : String(apercu)); });
  return el('label', { class: 'at-champ', htmlFor: id }, libelle, input);
}
function bascule(libelle: string, visible: boolean | undefined, maj: (v: boolean) => void) {
  const b = el('button', { type: 'button', class: 'at-mini', textContent: visible === false ? 'Afficher' : 'Masquer', title: libelle });
  b.addEventListener('click', () => { maj(visible === false); dessiner(); rafraichir(); });
  return b;
}
function supprimer(quoi: string, action: () => void) {
  const b = el('button', { type: 'button', class: 'at-mini at-danger', textContent: 'Supprimer' });
  b.addEventListener('click', () => {
    const conf = el('span', { class: 'at-confirm' }, `Supprimer ${quoi} ?`);
    const oui = el('button', { type: 'button', class: 'at-mini at-danger', textContent: 'Oui, supprimer' });
    const non = el('button', { type: 'button', class: 'at-mini', textContent: 'Non' });
    oui.addEventListener('click', () => { action(); dessiner(); rafraichir(); });
    non.addEventListener('click', () => conf.replaceWith(b));
    conf.append(oui, non);
    b.replaceWith(conf);
  });
  return b;
}
function deplacer<T>(liste: T[], i: number, d: number) {
  const j = i + d; if (j < 0 || j >= liste.length) return;
  [liste[i], liste[j]] = [liste[j], liste[i]];
}
function fleches<T>(liste: T[], i: number, libelle: string) {
  const h = el('button', { type: 'button', class: 'at-mini', textContent: '↑', ariaLabel: `Monter ${libelle}`, disabled: i === 0 });
  const b = el('button', { type: 'button', class: 'at-mini', textContent: '↓', ariaLabel: `Descendre ${libelle}`, disabled: i === liste.length - 1 });
  h.addEventListener('click', () => { deplacer(liste, i, -1); dessiner(); rafraichir(); });
  b.addEventListener('click', () => { deplacer(liste, i, 1); dessiner(); rafraichir(); });
  return [h, b];
}

// ---------- Éditeur ----------
function blocFamille(f: Famille, i: number) {
  const bloc = el('div', { class: 'at-bloc' + (f.visible === false ? ' at-masque' : '') });
  bloc.append(el('div', { class: 'at-ligne-titre' },
    el('h2', { textContent: f.nom || 'Nouvelle famille' }),
    ...fleches(cat.familles, i, f.nom), bascule('Masquer la famille', f.visible, v => { if (v) delete f.visible; else f.visible = false; })));
  bloc.append(champTexte('Nom de la famille', f.nom, v => { f.nom = v; bloc.querySelector('h2')!.textContent = v || 'Nouvelle famille'; }, false, i));
  bloc.append(el('p', { class: 'at-sous' }, 'Services et prix (€)'));
  f.services.forEach((s, j) => {
    const ligne = el('div', { class: 'at-service' + (s.visible === false ? ' at-masque' : '') });
    const nom = el('input', { type: 'text', value: s.nom, ariaLabel: `Service ${j + 1}` });
    nom.addEventListener('input', () => { s.nom = nom.value; rafraichir(String(i)); });
    const prix = el('input', { type: 'number', inputMode: 'numeric', min: '0', step: '1', value: String(s.prix), ariaLabel: `Prix du service ${j + 1}` });
    prix.addEventListener('input', () => { s.prix = prix.value === '' ? NaN : Number(prix.value); rafraichir(String(i)); });
    const plus = el('details', { class: 'at-plus' }, el('summary', { textContent: '…', ariaLabel: 'Plus d’options' }),
      el('div', { class: 'at-outils' }, ...fleches(f.services, j, s.nom),
        bascule('Masquer le service', s.visible, v => { if (v) delete s.visible; else s.visible = false; }),
        supprimer('ce service', () => f.services.splice(j, 1))));
    ligne.append(nom, prix, plus);
    bloc.append(ligne);
  });
  const ajout = el('button', { type: 'button', class: 'at-ajout', textContent: '+ Ajouter un service' });
  ajout.addEventListener('click', () => { f.services.push({ nom: 'Nouveau service', prix: 19 }); dessiner(); rafraichir(String(i)); });
  bloc.append(ajout);

  const reglages = el('details', { class: 'at-plus' }, el('summary', { textContent: 'Couleur, icône, exemple du carrousel, suppression' }));
  const couleur = el('select', { id: `ch${++uid}` });
  COULEURS.forEach(c => couleur.append(el('option', { value: c, textContent: c, selected: c === f.couleur })));
  couleur.addEventListener('change', () => { f.couleur = couleur.value; rafraichir(String(i)); });
  const icone = el('select', { id: `ch${++uid}` });
  Object.keys(ICONES).forEach(c => icone.append(el('option', { value: c, textContent: c, selected: c === f.icone })));
  icone.addEventListener('change', () => { f.icone = icone.value; rafraichir(String(i)); });
  reglages.append(el('div', { class: 'at-deux' }, el('label', { class: 'at-champ', htmlFor: couleur.id }, 'Couleur', couleur), el('label', { class: 'at-champ', htmlFor: icone.id }, 'Icône', icone)));
  if (f.exemple) {
    const e = f.exemple;
    reglages.append(el('p', { class: 'at-sous' }, 'Exemple du carrousel'),
      champTexte('Demande du client', e.titre, v => { e.titre = v; }),
      el('div', { class: 'at-deux' }, champPrix('Prix (€)', e.prix, v => { e.prix = v; }), champTexte('Délai', e.delai, v => { e.delai = v; })),
      champTexte('Ce que tu reçois', e.livre, v => { e.livre = v; }, true));
    const retirer = el('button', { type: 'button', class: 'at-mini', textContent: 'Retirer du carrousel' });
    retirer.addEventListener('click', () => { delete f.exemple; dessiner(); rafraichir(); });
    reglages.append(retirer);
  } else {
    const ajouter = el('button', { type: 'button', class: 'at-mini', textContent: 'Ajouter un exemple au carrousel' });
    ajouter.addEventListener('click', () => { f.exemple = { titre: 'Ma demande…', prix: f.services[0]?.prix ?? 19, delai: '2 jours ouvrés', livre: 'Ce que le client reçoit.' }; dessiner(); rafraichir(); });
    reglages.append(ajouter);
  }
  reglages.append(supprimer(`la famille « ${f.nom} »`, () => cat.familles.splice(i, 1)));
  bloc.append(reglages);
  return bloc;
}

function blocCarte(x: Carte, titre: string) {
  const bloc = el('div', { class: 'at-bloc' + (x.visible === false ? ' at-masque' : '') });
  bloc.append(el('div', { class: 'at-ligne-titre' }, el('h2', { textContent: titre }), bascule('Masquer la carte', x.visible, v => { if (v) delete x.visible; else x.visible = false; })));
  bloc.append(champTexte('Étiquette', x.etiquette, v => { x.etiquette = v; }), champTexte('Titre', x.titre, v => { x.titre = v; }),
    champTexte('Texte', x.texte, v => { x.texte = v; }, true), champTexte('Lien', x.lien, v => { x.lien = v; }));
  if (x.prixMin !== undefined) bloc.append(champPrix('À partir de (€)', x.prixMin, v => { x.prixMin = v; }));
  return bloc;
}

function dessiner() {
  const ouverts = new Set([...ed.querySelectorAll('details[open]')].map((_, k) => k));
  ed.replaceChildren();
  const tete = el('div', { class: 'at-bloc' }, el('h2', { textContent: 'Titre de la section' }),
    champTexte('Titre', cat.titre, v => { cat.titre = v; }), champTexte('Phrase sous le titre', cat.intro, v => { cat.intro = v; }, true));
  ed.append(tete);
  cat.familles.forEach((f, i) => ed.append(blocFamille(f, i)));
  const ajoutF = el('button', { type: 'button', class: 'at-ajout', textContent: '+ Ajouter une famille' });
  ajoutF.addEventListener('click', () => {
    cat.familles.push({ nom: 'Nouvelle famille', couleur: 'glacier-clair', icone: 'etoile', services: [{ nom: 'Nouveau service', prix: 19 }] });
    dessiner(); rafraichir(String(cat.familles.length - 1));
    ed.querySelectorAll('.at-bloc')[cat.familles.length]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  ed.append(ajoutF);
  const u = cat.urgence;
  ed.append(el('div', { class: 'at-bloc' + (u.visible === false ? ' at-masque' : '') },
    el('div', { class: 'at-ligne-titre' }, el('h2', { textContent: 'Option urgence' }), bascule('Masquer l’option urgence', u.visible, v => { if (v) delete u.visible; else u.visible = false; })),
    champTexte('Texte (le prix est ajouté à la fin)', u.texte, v => { u.texte = v; }), champPrix('Supplément (€)', u.prix, v => { u.prix = v; })));
  const h = cat.horsCatalogue;
  ed.append(el('div', { class: 'at-bloc' }, el('h2', { textContent: 'Hors catalogue' }), champTexte('Titre', h.titre, v => { h.titre = v; }), champTexte('Note de bas de section', h.note, v => { h.note = v; })));
  ed.append(blocCarte(h.autres, 'Carte « Autres services »'), blocCarte(h.devis, 'Carte « Demande de devis »'));
  [...ed.querySelectorAll('details')].forEach((d, k) => { if (ouverts.has(k)) (d as HTMLDetailsElement).open = true; });
}

// ---------- Onglets (téléphone) ----------
function vue(apercu: boolean) {
  $('vueEd').hidden = apercu; $('vueAp').hidden = !apercu;
  $('ongletEd').setAttribute('aria-pressed', String(!apercu)); $('ongletAp').setAttribute('aria-pressed', String(apercu));
  window.scrollTo({ top: 0 });
}
$('ongletEd').addEventListener('click', () => vue(false));
$('ongletAp').addEventListener('click', () => vue(true));
// Sur grand écran, les deux vues sont côte à côte (voir atelier-services.css).

// ---------- Enregistrer / annuler ----------
const dlg = $<HTMLDialogElement>('dlg');
$('enregistrer').addEventListener('click', () => {
  $<HTMLTextAreaElement>('fichier').value = fichier();
  const a = $<HTMLAnchorElement>('ouvrirGithub');
  a.href = `https://github.com/${DEPOT}/edit/${__BRANCHE__}/${CHEMIN}`;
  $('dlgBranche').textContent = `Branche : ${__BRANCHE__}.` + (['preprod', 'prod'].includes(__BRANCHE__) ? ' Branche protégée : GitHub proposera de créer une branche et une PR, c’est normal.' : ' L’aperçu de la PR se met à jour tout seul.');
  $('copieNote').textContent = '';
  dlg.showModal();
});
$('fermer').addEventListener('click', () => dlg.close());
$('copier').addEventListener('click', async () => {
  const t = $<HTMLTextAreaElement>('fichier');
  try { await navigator.clipboard.writeText(t.value); $('copieNote').textContent = 'Copié.'; }
  catch { t.focus(); t.select(); $('copieNote').textContent = 'Copie bloquée : le texte est sélectionné, utilise « Copier » du téléphone.'; }
});
let confirmer = false;
$('annuler').addEventListener('click', () => {
  const b = $<HTMLButtonElement>('annuler');
  if (!confirmer) { confirmer = true; b.textContent = 'Effacer mon brouillon ? Toucher encore'; window.setTimeout(() => { confirmer = false; b.textContent = 'Revenir à la version en ligne'; }, 4000); return; }
  confirmer = false; b.textContent = 'Revenir à la version en ligne';
  cat = reference(); ecrireBrouillon(null);
  $('atSource').textContent = 'Version de départ : celle de ce déploiement.';
  dessiner(); rafraichir();
});

dessiner();
rafraichir();
