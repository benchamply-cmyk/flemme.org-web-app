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
export type ContractTerms = { scope: string; quality: string; deadline: string; cancellation: string; confidentiality: string };
/** Accord écrit d’une mission (champ `contract` d’une flemme ; `agreement` reste le récapitulatif du prix). */
export type Contract = {
  terms: ContractTerms; status: ContractStatus; reviewNote: string | null;
  ownerSignedAt: string | null; ownerSignature: string | null;
  brigadierSignedAt: string | null; brigadierSignature: string | null;
  updatedAt: string; updatedBy: Actor | null;
};
export const contractStatusLabel: Record<ContractStatus, string> = {
  draft: 'Brouillon · à relire puis soumettre', pending: 'En cours de contrôle par l’équipe FLEMME',
  changes_requested: 'Correction demandée par l’équipe FLEMME', approved: 'Contrôlé · prêt à signer', signed: 'Signé par les deux parties',
};
/** Rubriques de l’accord : libellé, aide et longueur maximale (mêmes limites que flemme_v2.agreement_terms). */
export const CONTRACT_FIELDS = [
  { name: 'scope', label: 'Périmètre de la mission', hint: 'Ce qui est inclus, et ce qui ne l’est pas.', max: 1000 },
  { name: 'quality', label: 'Résultat attendu', hint: 'À quoi chacun reconnaîtra que c’est bien fait.', max: 1000 },
  { name: 'deadline', label: 'Date ou délai', hint: 'Ex. : samedi 8 novembre au matin.', max: 200 },
  { name: 'cancellation', label: 'Annulation', hint: 'Jusqu’à quand et à quelles conditions chacun peut annuler.', max: 1000 },
  { name: 'confidentiality', label: 'Confidentialité', hint: 'Informations à ne pas partager (adresse, documents…).', max: 1000 },
] as const satisfies readonly { name: keyof ContractTerms; label: string; hint: string; max: number }[];

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

/** Formulaire de l’accord → données envoyées (agreement_save). */
export function contractInput(f: Record<string, string | undefined>): ContractTerms {
  return Object.fromEntries(CONTRACT_FIELDS.map(c => [c.name, need(f[c.name], c.max, c.label)])) as ContractTerms;
}
export const contractFields = (c: Contract | null | undefined): Record<string, string> => c ? { ...c.terms } : {};

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
