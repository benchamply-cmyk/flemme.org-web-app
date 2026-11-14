// Formules de dépôt hors catalogue (modèle hybride, 12 nov. 2026).
// Le catalogue de la vitrine reste à prix fixes ; deux options s'y ajoutent :
// - « Autres services » : le client décrit un service hors catalogue, l'équipe analyse la demande et propose un prix fixe ;
// - « Demande de devis » : pour un service précis ou difficile à chiffrer, l'équipe envoie un devis détaillé.
// Liens depuis la vitrine : app.html#deleguer-autre et app.html#deleguer-devis (plan du site du 13/11/2026).
// Les anciennes adresses #deposer-autre et #deposer-devis restent reconnues (liens déjà partagés).
// Aucune migration : la formule est portée par un préfixe du titre, lisible par l'équipe dans /admin.

export type Formule = 'autre' | 'devis';

export const FORMULES: Record<Formule, { hash: string; ancien: string; prefixe: string; titre: string; intro: string; etapes: readonly string[]; aide: string }> = {
  autre: {
    hash: '#deleguer-autre',
    ancien: '#deposer-autre',
    prefixe: 'Autre service · ',
    titre: 'Décris l’autre service dont tu as besoin',
    intro: 'Ton besoin n’est pas dans le catalogue ? Décris-le : l’équipe analyse ta demande et te propose un prix fixe.',
    etapes: ['Tu décris le service et le résultat attendu.', 'L’équipe analyse ta demande sous un jour ouvré.', 'Tu reçois un prix fixe et un délai : tu acceptes ou non.'],
    aide: 'Exemple : « Trier et renommer les photos de mes vacances dans des dossiers par jour. » Le résultat attendu, le délai, ce qui te bloque…',
  },
  devis: {
    hash: '#deleguer-devis',
    ancien: '#deposer-devis',
    prefixe: 'Demande de devis · ',
    titre: 'Demande un devis',
    intro: 'Pour un service précis ou difficile à chiffrer : l’équipe étudie ta demande et t’envoie un devis détaillé, gratuit et sans engagement.',
    etapes: ['Tu décris précisément ce qu’il faut faire, avec tes contraintes.', 'L’équipe peut te poser quelques questions pour bien chiffrer.', 'Tu reçois un devis détaillé (périmètre, étapes, prix, délai) : tu acceptes ou non.'],
    aide: 'Exemple : « Préparer ma demande de logement social, la liste des pièces et un calendrier de relances sur trois mois. » Le contexte, les pièces dont tu disposes, l’échéance…',
  },
};

export function formuleDepuisHash(hash: string): Formule | null {
  return (Object.keys(FORMULES) as Formule[]).find(f => FORMULES[f].hash === hash || FORMULES[f].ancien === hash) ?? null;
}

// Titre envoyé au serveur : préfixé par la formule (une seule fois), dans la limite de 100 caractères du titre.
export function titreAvecFormule(titre: string, formule: Formule | null | undefined): string {
  const t = titre.trim();
  if (!formule || !FORMULES[formule]) return t;
  const p = FORMULES[formule].prefixe;
  return (t.startsWith(p) ? t : p + t).slice(0, 100);
}
