// Catalogue des services : SEULE source des noms, prix, délais et livrables (demande de Ben, 14/11/2026).
// Au build, vite.config.ts remplace <!--#catalogue--> (page /services, catalogue complet) et
// <!--#catalogue-extrait--> (accueil, un service par famille) par le HTML produit ici : le HTML publié reste statique.
// Pour changer un prix ou un délai, ne modifier que ce fichier.
// Délais et « ce que tu reçois » : première rédaction du 14/11/2026, à valider par Ben.

export type Service = { nom: string; prix: number; delai: string; recu: string };
export type Famille = { id: string; nom: string; couleur: string; services: Service[] };

export const URGENCE = { prix: 10, delai: '24 h' };
export const DELAI_HABITUEL = '2 à 3 jours ouvrés';

export const CATALOGUE: Famille[] = [
  { id: 'demarches', nom: 'Démarches et courriers', couleur: 'glacier-clair', services: [
    { nom: 'Courrier de résiliation ou de changement', prix: 19, delai: '2 jours ouvrés', recu: 'Le courrier prêt à envoyer, adressé au bon service, avec la marche à suivre pour l’envoi.' },
    { nom: 'Changement d’adresse groupé (8 organismes)', prix: 29, delai: '3 jours ouvrés', recu: 'La liste des 8 organismes, chaque démarche préparée et un suivi de ce qui est fait.' },
    { nom: 'Dossier d’aide (CAF, logement, bourse)', prix: 49, delai: '3 jours ouvrés', recu: 'Ton droit vérifié, la liste des pièces et le dossier rempli, prêt à déposer.' },
  ] },
  { id: 'reclamations', nom: 'SAV et réclamations', couleur: 'vert-tendre', services: [
    { nom: 'Réclamation produit ou colis, avec une relance', prix: 19, delai: '2 jours ouvrés', recu: 'La réclamation prête à envoyer, puis une relance rédigée si personne ne répond.' },
    { nom: 'Litige opérateur, énergie ou abonnement', prix: 29, delai: '2 jours ouvrés', recu: 'Une réclamation argumentée avec les textes applicables, et la marche à suivre jusqu’au médiateur.' },
    { nom: 'Indemnisation d’un vol retardé ou annulé', prix: 29, delai: '2 jours ouvrés', recu: 'Ton droit à indemnisation vérifié et la demande à la compagnie prête à envoyer.' },
  ] },
  { id: 'annonces', nom: 'Vente et annonces', couleur: 'peche', services: [
    { nom: '1 annonce (titre, texte, prix, conseils photo)', prix: 15, delai: '2 jours ouvrés', recu: 'Titre, description, prix conseillé et trois conseils pour les photos.' },
    { nom: 'Pack 3 annonces Leboncoin ou Vinted', prix: 39, delai: '2 jours ouvrés', recu: 'Trois annonces complètes, chacune avec son prix conseillé.' },
    { nom: 'Pack vide-grenier : 10 annonces et grille de prix', prix: 89, delai: '3 jours ouvrés', recu: 'Dix annonces prêtes à publier et une grille de prix pour tout le reste.' },
  ] },
  { id: 'logement', nom: 'Logement', couleur: 'lagon', services: [
    { nom: 'Dossier de location complet et vérifié', prix: 39, delai: '2 jours ouvrés', recu: 'Un dossier unique classé dans l’ordre attendu par les agences, pièces manquantes signalées.' },
    { nom: 'Veille : 10 logements sélectionnés en 7 jours', prix: 49, delai: '7 jours', recu: 'Dix annonces choisies selon tes critères, avec le lien et notre avis pour chacune.' },
    { nom: 'Pack déménagement administratif', prix: 59, delai: '3 jours ouvrés', recu: 'Les démarches dans l’ordre, avec les résiliations et changements d’adresse prêts à envoyer.' },
  ] },
  { id: 'voyage', nom: 'Voyage et sorties', couleur: 'menthe', services: [
    { nom: 'Organisation d’une sortie ou d’un anniversaire', prix: 29, delai: '2 jours ouvrés', recu: 'Trois idées de lieux ou d’activités, prix et disponibilités vérifiés, et l’invitation prête.' },
    { nom: 'Comparatif voyage : 3 options', prix: 39, delai: '3 jours ouvrés', recu: 'Trois options comparées (trajet, logement, prix total) et notre recommandation.' },
    { nom: 'Itinéraire clés en main, jour par jour', prix: 59, delai: '3 jours ouvrés', recu: 'Un programme jour par jour avec trajets, horaires, adresses et budget.' },
  ] },
  { id: 'comparatifs', nom: 'Recherche et comparaison', couleur: 'lavande', services: [
    { nom: 'Comparatif matériel ou achat : 3 produits', prix: 29, delai: '2 jours ouvrés', recu: 'Les trois produits comparés (prix, points forts, limites) et notre choix.' },
    { nom: 'Comparatif énergie, box ou mutuelle', prix: 39, delai: '2 jours ouvrés', recu: 'Les offres comparées à ta situation actuelle, avec l’économie estimée.' },
    { nom: 'Trouver 3 artisans vérifiés et comparer leurs devis', prix: 49, delai: '5 jours ouvrés', recu: 'Trois artisans vérifiés (assurance, avis, SIRET) et leurs devis comparés.' },
  ] },
];

const e = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const euros = (n: number) => `${n}&#8239;€`;

/** Page /services : une carte par famille, chaque service est un lien vers /deleguer (le nom est ajouté par services.ts). */
export const htmlCatalogue = () => CATALOGUE.map(f =>
  `<div class="carte famille-s" style="--c:var(--${f.couleur})" id="${f.id}"><span class="pastille-s">${e(f.nom)}</span><ul class="tarifs-s">` +
  f.services.map(s => `<li><a href="deleguer#decrire" data-service="${e(s.nom)}"><span class="nom-s">${e(s.nom)}<small><b>Tu reçois&#8239;:</b> ${e(s.recu)}<br><b>Délai&#8239;:</b> ${e(s.delai)}</small></span><b>${euros(s.prix)}</b></a></li>`).join('') +
  `</ul></div>`).join('\n      ');

/** Accueil : un extrait, le premier service de chaque famille, et un lien vers la famille sur /services. */
export const htmlExtrait = () => CATALOGUE.map(f => {
  const s = f.services[0], min = Math.min(...f.services.map(x => x.prix));
  return `<div class="famille revele"><span class="pastille-p" style="--c:var(--${f.couleur})">${e(f.nom)}</span><ul class="tarifs-p"><li><span>${e(s.nom)}</span><b>${euros(s.prix)}</b></li></ul><a class="lien-p" href="services#${f.id}">${f.services.length} services dès ${euros(min)} →</a></div>`;
}).join('\n      ');

/** Repères de prix dans les autres textes de l’accueil : <!--#prix:annonces.0--> (famille.rang), <!--#fourchette-->, <!--#urgence-->. */
export function remplacerPrix(html: string) {
  const tous = CATALOGUE.flatMap(f => f.services.map(s => s.prix));
  return html
    .replace(/<!--#prix:([a-z-]+)\.(\d+)-->/g, (m, id: string, rang: string) => {
      const s = CATALOGUE.find(f => f.id === id)?.services[Number(rang)];
      if (!s) throw new Error('Prix inconnu dans le HTML : ' + m);
      return euros(s.prix);
    })
    .replace(/<!--#fourchette-->/g, `${Math.min(...tous)} à ${euros(Math.max(...tous))}`)
    .replace(/<!--#urgence-->/g, euros(URGENCE.prix));
}
