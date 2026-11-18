// Lot 3 du parcours complet : profils publics, avis, candidatures validées, accord écrit et signatures simples.
// Mêmes règles que supabase/migrations/20261104140000_flemme_v2_accord.sql ; le serveur refait chaque contrôle.
// Signature = acceptation électronique simple (nom saisi + case cochée, horodatée par le serveur), pas une signature qualifiée.
import type { Actor, Input } from './domain.ts';
import { parseMoney } from './domain.ts';

export type OfferReview = 'pending' | 'changes_requested' | 'approved' | 'rejected';
export const offerReviewLabel: Record<OfferReview, string> = {
  pending: 'En attente de validation par l’équipe FLEMME', changes_requested: 'Correction demandée par l’équipe FLEMME',
  approved: 'Validée', rejected: 'Refusée par l’équipe FLEMME',
};

export type ContractStatus = 'draft' | 'pending' | 'changes_requested' | 'approved' | 'signed';
/** Rubriques de l’accord. v0.1 : les cinq premières ; v0.2 (18/11/2026) : livrable et réception obligatoires, accès et responsabilités facultatifs.
 *  Un accord v0.1 déjà enregistré reste valable et s’affiche tel quel. */
export type ContractTerms = { scope: string; quality: string; deadline: string; cancellation: string; confidentiality: string;
  template?: '0.2'; deliverable?: string; acceptance?: string; access?: string; liability?: string };
export const CONTRACT_TEMPLATE = '0.2';
/** Accord écrit d’une mission (champ `contract` d’une flemme ; `agreement` reste le récapitulatif du prix). */
export type Contract = {
  terms: ContractTerms; status: ContractStatus; reviewNote: string | null;
  ownerSignedAt: string | null; ownerSignature: string | null;
  brigadierSignedAt: string | null; brigadierSignature: string | null;
  updatedAt: string; updatedBy: Actor | null;
  /** v2.0.0 : numéro de version (chaque enregistrement en crée une, les anciennes restent en base). Absent = 1. */
  version?: number;
  /** v2.0.0 : date à laquelle les frais de plateforme sont devenus dus (seconde signature). */
  feeDueAt?: string | null;
};
export const contractStatusLabel: Record<ContractStatus, string> = {
  draft: 'Brouillon · à relire puis soumettre', pending: 'En cours de contrôle par l’équipe FLEMME',
  changes_requested: 'Correction demandée par l’équipe FLEMME', approved: 'Contrôlé · prêt à signer', signed: 'Signé par les deux parties',
};
/** Rubriques de l’accord : libellé, aide et longueur maximale (mêmes limites que flemme_v2.agreement_terms). */
export const CONTRACT_FIELDS = [
  { name: 'scope', label: 'Périmètre de la mission', hint: 'Ce qui est inclus, et ce qui ne l’est pas.', max: 1000, required: true },
  { name: 'deliverable', label: 'Livrable', hint: 'Ce qui sera remis ou fait concrètement (document, objet monté, rendez-vous pris…).', max: 1000, required: true },
  { name: 'quality', label: 'Résultat attendu', hint: 'À quoi chacun reconnaîtra que c’est bien fait.', max: 1000, required: true },
  { name: 'deadline', label: 'Date ou délai', hint: 'Ex. : samedi 8 novembre au matin.', max: 200, required: true },
  { name: 'acceptance', label: 'Réception et validation', hint: 'Comment le déposant vérifie le résultat, et sous quel délai il valide ou signale un problème.', max: 1000, required: true },
  { name: 'cancellation', label: 'Annulation', hint: 'Jusqu’à quand et à quelles conditions chacun peut annuler.', max: 1000, required: true },
  { name: 'confidentiality', label: 'Confidentialité', hint: 'Informations à ne pas partager (adresse, documents…).', max: 1000, required: true },
  { name: 'access', label: 'Accès et informations fournis (facultatif)', hint: 'Ce que le déposant fournit : documents, accès, clés, matériel. Jamais de mot de passe.', max: 1000, required: false },
  { name: 'liability', label: 'Responsabilités et assurance (facultatif)', hint: 'Ex. : dégâts éventuels, assurance de la personne qui intervient.', max: 1000, required: false },
] as const satisfies readonly { name: keyof ContractTerms; label: string; hint: string; max: number; required: boolean }[];

/** Textes proposés à la première rédaction (modifiables). */
export const CONTRACT_DEFAULTS: Partial<Record<keyof ContractTerms, string>> = {
  acceptance: 'Le déposant vérifie le résultat dans les 7 jours suivant la livraison, puis confirme la fin de la mission ou signale un problème dans l’app.',
  cancellation: 'Annulation gratuite d’un commun accord avant le début de la mission. Ensuite, la part déjà réalisée reste due.',
  confidentiality: 'Les informations personnelles et documents échangés ne servent qu’à cette mission et ne sont pas partagés.',
};

/** Clauses communes à tout accord signé sur Flemme (non modifiables), affichées avant la signature. Reprennent les CGU et CGV. */
export const CONTRACT_COMMON_CLAUSES = [
  'L’accord engage les deux membres. Flemme fournit l’outil, le contrat type et son contrôle, mais n’est pas partie à l’accord.',
  'Le paiement de la mission passe par Flemme, en une fois, après la double signature. La part du membre lui est versée à la fin de la mission.',
  'Les frais de plateforme, affichés avant la signature, sont à la charge du déposant et deviennent dus à la seconde signature.',
  'Toute modification crée une nouvelle version de l’accord et efface les signatures : chacun relit et signe à nouveau.',
  'En cas de désaccord, les membres cherchent d’abord une solution ensemble, puis peuvent signaler le problème à Flemme.',
  'Aucun mot de passe n’est demandé ni transmis. Rien n’est envoyé, publié ou acheté au nom du déposant sans son accord.',
] as const;

const need = (value: string | undefined, max: number, what: string) => {
  const v = (value || '').trim();
  if (!v) throw new Error(`Complète « ${what} ».`);
  if (v.length > max) throw new Error(`« ${what} » : ${max} caractères au plus.`);
  return v;
};
const optional = (value: string | undefined, max: number, what: string) => {
  const v = (value || '').trim();
  if (v.length > max) throw new Error(`« ${what} » : ${max} caractères au plus.`);
  return v || null;
};

/** Formulaire de l’accord → données envoyées (agreement_save). v2.0.0 : prix convenu facultatif, en euros, envoyé en centimes. */
export function contractInput(f: Record<string, string | undefined>): ContractTerms & { amount?: number } {
  const terms = { template: CONTRACT_TEMPLATE, ...Object.fromEntries(CONTRACT_FIELDS.flatMap(c => {
    const v = c.required ? need(f[c.name], c.max, c.label) : optional(f[c.name], c.max, c.label);
    return v == null ? [] : [[c.name, v]];
  })) } as ContractTerms;
  const amount = parseMoney(f.amount || '', true);
  return amount == null ? terms : { ...terms, amount };
}
/** Champs du formulaire de l’accord, avec le prix convenu actuel en euros. */
export const contractFields = (c: Contract | null | undefined, amount?: number | null): Record<string, string> => {
  const prix: Record<string, string> = amount != null ? { amount: (amount / 100).toFixed(2).replace('.', ',').replace(/,00$/, '') } : {};
  return c ? { ...c.terms, ...prix } : { ...CONTRACT_DEFAULTS, ...prix } as Record<string, string>;
};

/** Formulaire de candidature → données envoyées (apply, apply_edit). Forfait saisi en euros, envoyé en centimes. */
export function offerInput(f: Record<string, string | undefined>): Input {
  const amount = parseMoney(f.amount || '');
  if (amount == null) throw new Error('Indique ton forfait.');
  return { amount, slot: need(f.slot, 100, 'Mes disponibilités'), scope: need(f.scope, 1000, 'Ce qui est inclus et non inclus'),
    result: optional(f.result, 1000, 'Résultat promis') };
}
export const OFFER_FIELDS = ['amount', 'slot', 'scope', 'result'] as const;

/** Signature : nom saisi et case cochée. */
export function signatureInput(name: string | undefined, accept: boolean): Input {
  if (!accept) throw new Error('Coche la case pour accepter l’accord.');
  return { signature: need(name, 80, 'Ton nom complet'), accept: true };
}

export type Profile = {
  id: string; name: string; bio: string | null; skills: string[]; experience: string | null; since: string;
  /** Chemin de la photo dans le bucket privé (lot 4) ; l’app demande une adresse signée. */
  avatar?: string | null;
  missions: number; rating: number | null;
  reviews: { rating: number; text: string | null; author: Actor; task: string; at: string }[];
};
/** Formulaire du profil → données envoyées (profile_save). Compétences séparées par des virgules. */
export function profileInput(f: Record<string, string | undefined>): Input {
  const skills: string[] = [];
  for (const s of (f.skills || '').split(',').map(x => x.trim()).filter(Boolean)) {
    if (s.length > 40) throw new Error('Compétence trop longue (40 caractères au plus).');
    if (!skills.includes(s)) skills.push(s);
  }
  if (skills.length > 10) throw new Error('10 compétences au plus.');
  const data: Input = { bio: optional(f.bio, 600, 'Présentation'), experience: optional(f.experience, 1000, 'Expérience'), skills };
  const name = (f.displayName || '').trim();
  if (name) data.displayName = need(name, 40, 'Nom affiché');
  return data;
}
export const profileFields = (p: Profile): Record<string, string> =>
  ({ displayName: p.name, bio: p.bio || '', experience: p.experience || '', skills: p.skills.join(', ') });

export type MyReview = { rating: number; text: string | null };
/** Avis après mission : note de 1 à 5 et commentaire facultatif. */
export function reviewInput(rating: string | undefined, text: string | undefined): Input {
  const n = Number(rating);
  if (![1, 2, 3, 4, 5].includes(n)) throw new Error('Choisis une note de 1 à 5.');
  return { rating: n, text: optional(text, 600, 'Commentaire') };
}
export const stars = (n: number) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
