// Barème des frais de plateforme par tranches et règles de la bêta (décisions de Ben du 23/11/2026,
// « Analyse stratégique, business model et business cases » v0.2, §2 à §5).
//
// - Frais payés par le déposant, dus à la seconde signature, paiement entier à la signature, versement à la validation.
// - Barème MARGINAL : chaque taux ne s'applique qu'à la part du prix comprise dans sa tranche (comme l'impôt sur le revenu),
//   pour éviter tout effet de seuil (une mission plus chère ne coûte jamais moins de frais). Minimum 2 € par accord.
// - Bêta de janvier 2027 sans argent réel : paiement en « crédits fondateurs » (1 crédit = 1 € fictif), jamais convertibles
//   en euros ; au lancement, ils deviennent des réductions sur les frais Flemme.
//
// Ce module ne change pas encore le calcul du serveur (flemme_v2.settings.commission_bps, 10 % fixe) : la bascule du serveur
// sur ce barème demande une migration, prévue dans une PR à part. Montants en centimes.

export type Tranche = { jusqua: number | null; tauxBps: number };
/** Tranches en centimes (bornes hautes) et taux en points de base (1500 = 15 %). */
export const BAREME_FRAIS: { version: string; minimum: number; tranches: readonly Tranche[] } = {
  version: '2026-11-23',
  minimum: 200,
  tranches: [
    { jusqua: 3000, tauxBps: 1500 },
    { jusqua: 10000, tauxBps: 1000 },
    { jusqua: 30000, tauxBps: 800 },
    { jusqua: null, tauxBps: 600 },
  ],
};

/** Frais de plateforme en centimes pour un prix convenu en centimes (0 pour une mission gratuite). */
export function fraisBareme(prix: number, bareme = BAREME_FRAIS): number {
  if (!Number.isSafeInteger(prix) || prix < 0) throw new Error('Prix invalide.');
  if (prix === 0) return 0;
  let reste = prix, bas = 0, frais = 0;
  for (const t of bareme.tranches) {
    const haut = t.jusqua ?? Number.MAX_SAFE_INTEGER;
    const part = Math.min(reste, haut - bas);
    if (part <= 0) break;
    frais += part * t.tauxBps / 10000;
    reste -= part; bas = haut;
  }
  return Math.max(bareme.minimum, Math.round(frais));
}

/** Taux effectif en points de base (frais ÷ prix), pour l'affichage. */
export const tauxEffectifBps = (prix: number, bareme = BAREME_FRAIS) => prix > 0 ? Math.round(fraisBareme(prix, bareme) * 10000 / prix) : 0;

const pct = (bps: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(bps / 100) + ' %';
const eur = (c: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: c % 100 ? 2 : 0 }).format(c / 100);

/** Lignes lisibles du barème : « Jusqu'à 30 € : 15 % », …, « Minimum par accord : 2 € ». */
export function lignesBareme(bareme = BAREME_FRAIS): { tranche: string; taux: string }[] {
  let bas = 0;
  const lignes = bareme.tranches.map(t => {
    const tranche = t.jusqua === null ? `Au-delà de ${eur(bas)}` : bas === 0 ? `Jusqu’à ${eur(t.jusqua)}` : `De ${eur(bas)} à ${eur(t.jusqua)}`;
    bas = t.jusqua ?? bas;
    return { tranche, taux: pct(t.tauxBps) };
  });
  return [...lignes, { tranche: 'Minimum par accord', taux: eur(bareme.minimum) }];
}

/** Résumé en une phrase, pour les textes du site. */
export const BAREME_RESUME = 'Des frais de plateforme dégressifs, à la charge de la personne qui délègue : 15 % jusqu’à 30 €, 10 % de 30 à 100 €, 8 % de 100 à 300 €, 6 % au-delà, 2 € au minimum. Chaque taux ne s’applique qu’à la part du prix comprise dans sa tranche.';

/** Bêta sans argent réel : les crédits fondateurs (décision de Ben du 23/11/2026). */
export const CREDITS_FONDATEURS = {
  nom: 'crédits fondateurs',
  resume: 'Pendant la bêta, aucun argent réel ne circule : les missions se paient en crédits fondateurs (1 crédit = 1 € fictif). Ils sont gratuits, plafonnés, ne s’achètent pas, ne s’échangent pas et ne seront jamais convertis en euros. À l’ouverture des paiements réels, ils deviennent des réductions sur les frais Flemme.',
} as const;

/** Familles mises en avant dans les exemples et la communication (les autres demandes restent acceptées). */
export const FAMILLES_EN_AVANT = [
  { id: 'argent', titre: 'Récupérer de l’argent', exemple: 'Réclamation SAV, colis perdu, retard de train, frais contestés' },
  { id: 'appels', titre: 'Coups de fil et relances', exemple: 'Appeler un service client, attendre en ligne, relancer un dossier' },
  { id: 'resiliations', titre: 'Résilier, changer, faire baisser', exemple: 'Abonnements oubliés, box, énergie' },
  { id: 'papiers', titre: 'Papiers et démarches', exemple: 'Constituer un dossier, classer, remplir un formulaire en ligne' },
  { id: 'occasion', titre: 'Vendre d’occasion', exemple: 'Photos, annonce, réponses aux acheteurs' },
  { id: 'annonces', titre: 'Chercher une annonce', exemple: 'Logement, objet, véhicule : une sélection, vous contactez vous-même' },
] as const;

/** Activités interdites sur Flemme, et activités réservées aux professionnels (phase ultérieure). À relire par le juriste. */
export const ACTIVITES_INTERDITES = [
  'Tout ce qui est illégal ou frauduleux : faux documents, contrefaçon, produits interdits, faux avis, faux comptes, piratage.',
  'Passer un examen, un test ou un entretien à la place de quelqu’un, ou rédiger un travail noté à la place d’un étudiant.',
  'Utiliser les identifiants bancaires ou fiscaux d’un autre, se connecter à ses comptes à sa place ou signer pour lui.',
  'Services sexuels ou de rencontre, et toute mission qui implique directement des mineurs.',
  'Prêts d’argent, change, cryptomonnaies, collectes de fonds, paris.',
  'Manipuler des produits dangereux, travailler en hauteur, livrer de l’alcool, du tabac ou des médicaments.',
] as const;
export const ACTIVITES_RESERVEES_PROS = [
  'Droit : conseil juridique, rédaction d’actes, représentation.',
  'Comptabilité et conseil fiscal.',
  'Assurance, crédit et placements (intermédiation).',
  'Immobilier : contacter le bailleur ou le vendeur à votre place, organiser les visites, négocier, monter le dossier, être payé par une agence ou au succès.',
  'Vente de voyages et de séjours.',
  'Santé et soins.',
  'Travaux réglementés : électricité, gaz, toiture, gros œuvre.',
  'Transport de personnes contre paiement.',
  'Garde d’enfants et aide aux personnes âgées ou dépendantes.',
  'Sécurité, gardiennage, et autres métiers à diplôme (coiffure, traduction assermentée, diagnostics immobiliers).',
] as const;

/** Assistance humaine sur l'accord (§5 de l'analyse v0.2) : prix en centimes, gratuite pendant la bêta. */
export const ASSISTANCE_ACCORD = [
  { id: 'alerte', nom: 'Vérification sur alerte', prix: 0, detail: 'Quand la vérification automatique repère un problème, ou au-delà de 150 €, une personne de l’équipe relit l’accord.' },
  { id: 'relecture', nom: 'Relecture Flemme', prix: 490, detail: 'Sur demande : une personne de l’équipe relit l’accord et propose des corrections écrites, sous 48 h ouvrées.' },
  { id: 'accompagne', nom: 'Accord accompagné', prix: 990, detail: 'Sur demande : 15 à 20 minutes d’échange avec vous deux pour construire l’accord, sous 72 h ouvrées.' },
] as const;
export const ASSISTANCE_LIMITE = 'Il s’agit d’aide administrative : vérifier que l’accord est complet, clair et cohérent. Ce n’est jamais un conseil juridique.';
