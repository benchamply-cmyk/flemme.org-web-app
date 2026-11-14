// Catalogue des services : SEULE source des noms, prix, délais et livrables (demande de Ben, 14/11/2026).
// Au build, vite.config.ts remplace <!--#catalogue--> (page /services, catalogue complet) et
// <!--#catalogue-moments--> et <!--#catalogue-points--> (accueil, une carte par famille) par le HTML produit ici : le HTML publié reste statique.
// Pour changer un prix ou un délai, ne modifier que ce fichier.
// Délais et « ce que tu reçois » : première rédaction du 14/11/2026, à valider par Ben.

export type Service = { nom: string; prix: number; delai: string; recu: string };
/** moment : la situation de vie montrée sur l’accueil, et les rangs des deux services qu’elle met en avant. */
export type Famille = { id: string; nom: string; couleur: string; moment: { titre: string; phrase: string; couleur: string; services: [number, number] }; services: Service[] };

// Option urgence (24 h, +10 €) retirée pour l’instant (Ben, 14/11/2026).
export const DELAI_HABITUEL = '2 à 3 jours ouvrés';

export const CATALOGUE: Famille[] = [
  { id: 'demarches', nom: 'Démarches et courriers', couleur: 'glacier-clair', moment: { titre: 'Tu changes de vie', phrase: 'Résilier, prévenir, monter un dossier d’aide : on rédige, tu envoies.', couleur: 'glacier', services: [0, 2] }, services: [
    { nom: 'Courrier de résiliation ou de changement', prix: 19, delai: '2 jours ouvrés', recu: 'Le courrier prêt à envoyer, adressé au bon service, avec la marche à suivre pour l’envoi.' },
    { nom: 'Changement d’adresse groupé (8 organismes)', prix: 29, delai: '3 jours ouvrés', recu: 'La liste des 8 organismes, chaque démarche préparée et un suivi de ce qui est fait.' },
    { nom: 'Dossier d’aide (CAF, logement, bourse)', prix: 49, delai: '3 jours ouvrés', recu: 'Ton droit vérifié, la liste des pièces et le dossier rempli, prêt à déposer.' },
  ] },
  { id: 'reclamations', nom: 'SAV et réclamations', couleur: 'vert-tendre', moment: { titre: 'Un colis ou un vol tourne mal', phrase: 'Colis perdu, vol annulé, opérateur muet : on rédige et on relance.', couleur: 'peche', services: [0, 2] }, services: [
    { nom: 'Réclamation produit ou colis, avec une relance', prix: 19, delai: '2 jours ouvrés', recu: 'La réclamation prête à envoyer, puis une relance rédigée si personne ne répond.' },
    { nom: 'Litige opérateur, énergie ou abonnement', prix: 29, delai: '2 jours ouvrés', recu: 'Une réclamation argumentée avec les textes applicables, et la marche à suivre jusqu’au médiateur.' },
    { nom: 'Indemnisation d’un vol retardé ou annulé', prix: 29, delai: '2 jours ouvrés', recu: 'Ton droit à indemnisation vérifié et la demande à la compagnie prête à envoyer.' },
  ] },
  { id: 'annonces', nom: 'Vente et annonces', couleur: 'peche', moment: { titre: 'Tu fais le tri', phrase: 'Ce qui dort au placard se vend mieux avec une bonne annonce.', couleur: 'menthe', services: [0, 2] }, services: [
    { nom: '1 annonce (titre, texte, prix, conseils photo)', prix: 15, delai: '2 jours ouvrés', recu: 'Titre, description, prix conseillé et trois conseils pour les photos.' },
    { nom: 'Pack 3 annonces Leboncoin ou Vinted', prix: 39, delai: '2 jours ouvrés', recu: 'Trois annonces complètes, chacune avec son prix conseillé.' },
    { nom: 'Pack vide-grenier : 10 annonces et grille de prix', prix: 89, delai: '3 jours ouvrés', recu: 'Dix annonces prêtes à publier et une grille de prix pour tout le reste.' },
  ] },
  { id: 'logement', nom: 'Logement', couleur: 'lagon', moment: { titre: 'Tu déménages', phrase: 'Les cartons, c’est toi. Le dossier et les organismes, c’est nous.', couleur: 'lagon', services: [0, 2] }, services: [
    { nom: 'Dossier de location complet et vérifié', prix: 39, delai: '2 jours ouvrés', recu: 'Un dossier unique classé dans l’ordre attendu par les agences, pièces manquantes signalées.' },
    { nom: 'Veille : 10 logements sélectionnés en 7 jours', prix: 49, delai: '7 jours', recu: 'Dix annonces choisies selon tes critères, avec le lien et notre avis pour chacune.' },
    { nom: 'Pack déménagement administratif', prix: 59, delai: '3 jours ouvrés', recu: 'Les démarches dans l’ordre, avec les résiliations et changements d’adresse prêts à envoyer.' },
  ] },
  { id: 'voyage', nom: 'Voyage et sorties', couleur: 'menthe', moment: { titre: 'Tu pars enfin', phrase: 'Trois options comparées, ou un itinéraire jour par jour.', couleur: 'lavande', services: [1, 2] }, services: [
    { nom: 'Organisation d’une sortie ou d’un anniversaire', prix: 29, delai: '2 jours ouvrés', recu: 'Trois idées de lieux ou d’activités, prix et disponibilités vérifiés, et l’invitation prête.' },
    { nom: 'Comparatif voyage : 3 options', prix: 39, delai: '3 jours ouvrés', recu: 'Trois options comparées (trajet, logement, prix total) et notre recommandation.' },
    { nom: 'Itinéraire clés en main, jour par jour', prix: 59, delai: '3 jours ouvrés', recu: 'Un programme jour par jour avec trajets, horaires, adresses et budget.' },
  ] },
  { id: 'comparatifs', nom: 'Recherche et comparaison', couleur: 'lavande', moment: { titre: 'Tu dois choisir', phrase: 'Box, mutuelle, matériel, artisans : on compare, tu décides.', couleur: 'vert-tendre', services: [1, 2] }, services: [
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

const nbsp = (s: string) => e(s).replace(/ ([:;?!])/g, '&#8239;$1');

/** Accueil : « Vos besoins » et « Nos services » réunis (variante A, 14/11/2026) : une carte par famille, sa situation de vie et deux services. */
export const htmlMoments = () => CATALOGUE.map((f, i) =>
  `<li class="moment" style="--c:var(--${f.moment.couleur})"><span class="moment-num">${String(i + 1).padStart(2, '0')}</span><b>${nbsp(f.moment.titre)}</b><p>${nbsp(f.moment.phrase)}</p><ul>` +
  f.moment.services.map(r => f.services[r]).map(s => `<li><span>${e(s.nom)}</span><b>${euros(s.prix)}</b></li>`).join('') +
  `</ul><a class="lien-p" href="services#${f.id}">Voir les ${f.services.length} services →</a></li>`).join('\n      ');

/** Points du carrousel, un par carte. */
export const htmlPoints = () => '<i></i>'.repeat(CATALOGUE.length);

/** Repères de prix dans les autres textes de l’accueil : <!--#prix:annonces.0--> (famille.rang), <!--#fourchette-->. */
export function remplacerPrix(html: string) {
  const tous = CATALOGUE.flatMap(f => f.services.map(s => s.prix));
  return html
    .replace(/<!--#prix:([a-z-]+)\.(\d+)-->/g, (m, id: string, rang: string) => {
      const s = CATALOGUE.find(f => f.id === id)?.services[Number(rang)];
      if (!s) throw new Error('Prix inconnu dans le HTML : ' + m);
      return euros(s.prix);
    })
    .replace(/<!--#fourchette-->/g, `${Math.min(...tous)} à ${euros(Math.max(...tous))}`);
}
