// Confiance dans la marketplace ouverte (prévue pour la v2.1.0, décision de Ben du 18/11/2026), d'après le comparatif Airtasker / TaskRabbit demandé par Ben le 18/11/2026
// (recommandations 1 à 4) : questions publiques sous une demande, coordonnées masquées avant la signature,
// livraison puis libération du paiement, profil public enrichi. Les mêmes règles sont revérifiées par le serveur
// (supabase/migrations/20261118140000_flemme_v2_confiance.sql).
import type { Actor } from './domain.ts';

/** Question publique posée sous une demande : visible de tous ceux qui voient la demande, réponse du déposant. */
export type Question = { id: string; author: Actor; text: string; at: string; answer: string | null; answeredAt: string | null };

export const COORDONNEES_MASQUEES = '[coordonnées masquées]';
// Mêmes motifs que flemme_v2.masquer (SQL) : e-mail, lien (http, https, www) et numéro de 9 chiffres ou plus,
// séparés ou non par des espaces, points, tirets ou parenthèses (06 12 34 56 78, +33 6 12 34 56 78…).
const MOTIFS = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  /(?:https?:\/\/|www\.)\S+/gi,
  /\+?\d(?:[\s.()-]{0,2}\d){8,14}/g,
];
/** Remplace e-mails, liens et numéros de téléphone : tant que l'accord n'est pas signé, on échange sur Flemme. */
export function masquerCoordonnees(text: string): string {
  return MOTIFS.reduce((t, motif) => t.replace(motif, COORDONNEES_MASQUEES), text);
}
export const contientCoordonnees = (text: string) => masquerCoordonnees(text) !== text;
export const AVIS_MASQUAGE = 'Téléphone, e-mail et liens sont masqués jusqu’à la signature de l’accord : échangez sur Flemme, l’accord et le paiement restent suivis.';
export const AVIS_QUESTIONS = 'Questions et réponses sont visibles de tous les membres qui voient la demande. Jamais d’adresse, de téléphone ni d’e-mail.';

/** Jours laissés au déposant, après la livraison déclarée, pour confirmer ou signaler un désaccord. */
export const DELAI_LIBERATION_JOURS = 7;
const JOUR = 86_400_000;
/** Date à partir de laquelle le membre peut clôturer lui-même la mission (libération automatique). */
export const liberationPossibleLe = (deliveredAt: string) => new Date(Date.parse(deliveredAt) + DELAI_LIBERATION_JOURS * JOUR).toISOString();
/**
 * Libération automatique : le membre a déclaré la mission livrée, le délai est passé et aucun désaccord
 * n'a été signalé depuis la livraison. Sinon, seul le déposant clôture.
 */
export function liberationAutomatique(t: { deliveredAt?: string | null; reports: { at: string }[] }, now: string): boolean {
  if (!t.deliveredAt) return false;
  if (Date.parse(now) < Date.parse(liberationPossibleLe(t.deliveredAt))) return false;
  return !t.reports.some(r => Date.parse(r.at) >= Date.parse(t.deliveredAt!));
}

/** Résumé de confiance d'un profil public, du plus parlant au moins parlant. Rien n'est vérifié par Flemme. */
export function reperesProfil(p: { since: string; missions: number; rating: number | null; reviews: unknown[]; ongoing?: number; requests?: number }, now = new Date().toISOString()): string[] {
  const mois = Math.max(0, Math.floor((Date.parse(now) - Date.parse(p.since)) / (30 * JOUR)));
  const avis = p.reviews.length;
  return [
    p.rating != null ? `${String(p.rating).replace('.', ',')}/5 sur ${avis} avis` : 'Pas encore d’avis',
    `${p.missions} mission${p.missions > 1 ? 's' : ''} réalisée${p.missions > 1 ? 's' : ''}`,
    ...(p.ongoing ? [`${p.ongoing} en cours`] : []),
    ...(p.requests ? [`${p.requests} demande${p.requests > 1 ? 's' : ''} menée${p.requests > 1 ? 's' : ''} à terme comme déposant`] : []),
    mois < 1 ? 'Inscrit ce mois-ci' : `Membre depuis ${mois} mois`,
  ];
}
