// Catalogue des services de l'accueil, lu dans apps/web/contenu/services.json (12 nov. 2026).
// Ben modifie ce fichier JSON (noms, prix, familles, textes) sans toucher au code : au build,
// vite.config.ts vérifie le fichier puis remplace <!--#services--> (index.html) et <!--#pied-familles--> (pied.html) ;
// landing.ts en tire les exemples du carrousel. Un fichier mal rempli arrête le build avec un message clair.

export type Exemple = { titre: string; prix: number; delai: string; livre: string };
export type Service = { nom: string; prix: number; visible?: boolean };
export type Famille = { nom: string; couleur: string; icone: string; visible?: boolean; services: Service[]; exemple?: Exemple };
export type Carte = { visible?: boolean; etiquette: string; titre: string; texte: string; lien: string; prixMin?: number };
export type Catalogue = {
  titre: string;
  intro: string;
  urgence: { visible?: boolean; prix: number; texte: string };
  familles: Famille[];
  horsCatalogue: { titre: string; autres: Carte; devis: Carte; note: string };
};

export const COULEURS = ['glacier-clair', 'vert-tendre', 'peche', 'lagon', 'menthe', 'lavande', 'ciel', 'glacier'] as const;

const trait = (d: string) => `<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter">${d}</g>`;
export const ICONES: Record<string, string> = {
  courrier: trait('<path d="M6 4h9l3 3v13H6z"/><path d="M9 11h6M9 15h4"/>'),
  sav: trait('<path d="M5 12a7 7 0 0 1 12-5l2 2M19 12a7 7 0 0 1-12 5l-2-2"/><path d="M19 5v4h-4M5 19v-4h4"/>'),
  annonce: trait('<rect x="5" y="6" width="14" height="10"/><path d="M9 19h6"/>'),
  maison: trait('<path d="M5 11l7-6 7 6v8H5z"/><path d="M10 19v-5h4v5"/>'),
  voyage: trait('<path d="M4 13l16-7-7 16-2-7z"/>'),
  loupe: trait('<circle cx="11" cy="11" r="5.5"/><path d="M15 15l4 4"/>'),
  etoile: trait('<path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6 9.6 9z"/>'),
  outil: trait('<path d="M14 6a4 4 0 0 0 4 6l-8 8-2-2 8-8a4 4 0 0 0-2-4z"/>'),
  calendrier: trait('<rect x="5" y="6" width="14" height="13"/><path d="M5 10h14M9 4v4M15 4v4"/>'),
  cle: trait('<circle cx="8" cy="12" r="3.5"/><path d="M11.5 12H20M17 12v3M20 12v2"/>'),
};

export const icone = (nom: string, taille = 14) =>
  `<svg class="ico" viewBox="0 0 24 24" width="${taille}" height="${taille}" aria-hidden="true">${ICONES[nom] ?? ICONES.etoile}</svg>`;

// Échappe le HTML et applique la typographie française (espace fine insécable avant ? ! : ; et €).
export function texte(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/[   ]+([?!:;€])/g, ' $1')
    .replace(/(\d)[  ]+(h|jours?)\b/g, '$1 $2');
}
export const prix = (n: number) => `${n} €`;
const visible = (x: { visible?: boolean }) => x.visible !== false;

// Contrôle du fichier : renvoie la liste des problèmes (vide si tout va bien), avec l'emplacement en clair.
export function verifierCatalogue(c: unknown): string[] {
  const pb: string[] = [];
  const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
  const chaine = (v: unknown, ou: string) => { if (typeof v !== 'string' || !v.trim()) pb.push(`${ou} : texte manquant`); };
  const nombre = (v: unknown, ou: string) => { if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) pb.push(`${ou} : prix à écrire en chiffres, sans guillemets ni € (ex. 19)`); };
  const bool = (v: unknown, ou: string) => { if (v !== undefined && typeof v !== 'boolean') pb.push(`${ou}.visible : true ou false, sans guillemets`); };
  if (!obj(c)) return ['Le fichier doit commencer par { et finir par }'];
  chaine(c.titre, 'titre'); chaine(c.intro, 'intro');
  if (!obj(c.urgence)) pb.push('urgence : bloc manquant'); else { nombre(c.urgence.prix, 'urgence.prix'); chaine(c.urgence.texte, 'urgence.texte'); bool(c.urgence.visible, 'urgence'); }
  if (!Array.isArray(c.familles) || c.familles.length === 0) pb.push('familles : au moins une famille');
  else c.familles.forEach((f: unknown, i) => {
    const ou = `familles[${i + 1}]`;
    if (!obj(f)) { pb.push(`${ou} : bloc { … } attendu`); return; }
    const nom = typeof f.nom === 'string' ? ` « ${f.nom} »` : '';
    chaine(f.nom, `${ou}.nom`); bool(f.visible, ou + nom);
    if (!COULEURS.includes(f.couleur as never)) pb.push(`${ou}${nom}.couleur : choisir parmi ${COULEURS.join(', ')}`);
    if (typeof f.icone !== 'string' || !ICONES[f.icone]) pb.push(`${ou}${nom}.icone : choisir parmi ${Object.keys(ICONES).join(', ')}`);
    if (!Array.isArray(f.services) || f.services.length === 0) pb.push(`${ou}${nom}.services : au moins un service`);
    else f.services.forEach((s: unknown, j) => {
      const o = `${ou}${nom}.services[${j + 1}]`;
      if (!obj(s)) { pb.push(`${o} : bloc { … } attendu`); return; }
      chaine(s.nom, `${o}.nom`); nombre(s.prix, `${o}.prix`); bool(s.visible, o);
    });
    if (f.exemple !== undefined) {
      const e = f.exemple, o = `${ou}${nom}.exemple`;
      if (!obj(e)) pb.push(`${o} : bloc { … } attendu`);
      else { chaine(e.titre, `${o}.titre`); nombre(e.prix, `${o}.prix`); chaine(e.delai, `${o}.delai`); chaine(e.livre, `${o}.livre`); }
    }
  });
  if (!pb.length && exemplesCarrousel(c as Catalogue).length === 0) pb.push('carrousel : au moins une famille visible doit avoir un « exemple »');
  const h = c.horsCatalogue;
  if (!obj(h)) pb.push('horsCatalogue : bloc manquant');
  else {
    chaine(h.titre, 'horsCatalogue.titre'); chaine(h.note, 'horsCatalogue.note');
    for (const k of ['autres', 'devis'] as const) {
      const x = h[k], ou = `horsCatalogue.${k}`;
      if (!obj(x)) { pb.push(`${ou} : bloc manquant`); continue; }
      for (const champ of ['etiquette', 'titre', 'texte', 'lien']) chaine(x[champ], `${ou}.${champ}`);
      if (x.prixMin !== undefined) nombre(x.prixMin, `${ou}.prixMin`);
      bool(x.visible, ou);
    }
  }
  return pb;
}

const familles = (c: Catalogue) => c.familles.filter(visible).map(f => ({ ...f, services: f.services.filter(visible) })).filter(f => f.services.length);

// Section « Nos services » de l'accueil (contenu de la balise <!--#services-->).
export function htmlCatalogue(c: Catalogue): string {
  const cartes = familles(c).map(f =>
    `<div class="carte"><span class="etiquette" style="background:var(--${f.couleur})">${icone(f.icone)} ${texte(f.nom)}</span><ul class="tarifs">${f.services.map(s => `<li><span>${texte(s.nom)}</span><b>${prix(s.prix)}</b></li>`).join('')}</ul></div>`).join('\n      ');
  const h = c.horsCatalogue;
  const carte = (x: Carte, couleur: string, lien: string) => visible(x)
    ? `<div class="carte"><span class="etiquette" style="background:var(--${couleur})">${texte(x.etiquette)}</span><b>${texte(x.titre)}</b><p class="doux">${texte(x.texte)}${x.prixMin !== undefined ? ` À partir de ${prix(x.prixMin)}.` : ''}</p><a class="lien-fort" href="${lien}">${texte(x.lien)}</a></div>` : '';
  const hors = [carte(h.autres, 'glacier-clair', 'app.html#deposer-autre'), carte(h.devis, 'lavande', 'app.html#deposer-devis')].filter(Boolean);
  return [
    `<h2 class="titre">${texte(c.titre)}</h2>`,
    `<p class="doux">${texte(c.intro)}</p>`,
    `<div class="grille" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">\n      ${cartes}\n    </div>`,
    visible(c.urgence) ? `<p class="doux">${texte(c.urgence.texte)} <b>${prix(c.urgence.prix)}</b> de plus.</p>` : '',
    hors.length ? `<h3 style="margin:8px 0 0">${texte(h.titre)}</h3>\n    <div class="grille" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">\n      ${hors.join('\n      ')}\n    </div>` : '',
    `<p class="doux" style="font-size:13px">${texte(h.note)}</p>`,
  ].filter(Boolean).join('\n    ');
}

// Liens du pied de page : une ligne par famille visible.
export function htmlPiedFamilles(c: Catalogue): string {
  return familles(c).map(f => `<a href="./#services">${texte(f.nom)}</a>`).join('\n      ');
}

// Exemples du carrousel : un par famille visible qui en a un.
export function exemplesCarrousel(c: Catalogue) {
  return familles(c).filter(f => f.exemple).map(f => ({
    cat: texte(f.nom), icone: icone(f.icone, 16), titre: texte(f.exemple!.titre), prix: prix(f.exemple!.prix), delai: texte(f.exemple!.delai), livre: texte(f.exemple!.livre),
  }));
}
