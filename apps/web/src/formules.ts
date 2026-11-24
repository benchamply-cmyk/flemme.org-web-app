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
    titre: 'Décrivez l’autre service dont vous avez besoin',
    intro: 'Votre besoin n’est pas dans le catalogue ? Décrivez-le : l’équipe analyse votre demande et vous propose un prix fixe.',
    etapes: ['Vous décrivez le service et le résultat attendu.', 'L’équipe analyse votre demande sous un jour ouvré.', 'Vous recevez un prix fixe et un délai : vous acceptez ou non.'],
    aide: 'Exemple : « Trier et renommer les photos de mes vacances dans des dossiers par jour. » Le résultat attendu, le délai, ce qui vous bloque…',
  },
  devis: {
    hash: '#deleguer-devis',
    ancien: '#deposer-devis',
    prefixe: 'Demande de devis · ',
    titre: 'Demandez un devis',
    intro: 'Pour un service précis ou difficile à chiffrer : l’équipe étudie votre demande et vous envoie un devis détaillé, gratuit et sans engagement.',
    etapes: ['Vous décrivez précisément ce qu’il faut faire, avec vos contraintes.', 'L’équipe peut vous poser quelques questions pour bien chiffrer.', 'Vous recevez un devis détaillé (périmètre, étapes, prix, délai) : vous acceptez ou non.'],
    aide: 'Exemple : « Préparer ma demande de logement social, la liste des pièces et un calendrier de relances sur trois mois. » Le contexte, les pièces dont vous disposez, l’échéance…',
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
