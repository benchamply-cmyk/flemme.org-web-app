import type { Screen, Tab } from './ecrans.ts';

// Adresses de l’espace connecté, les mêmes sur le site et dans l’app mobile (plan d’adresses validé par Ben le 14/11/2026).
// Le site sert app.html pour chacune (règles « rewrite » de netlify.toml) ; l’app mobile les ouvre en lien profond
// (flemme-mobile://mes-demandes, flemme-mobile://flemme/123…, ou le lien https://flemme.org/… quand il lui est confié).
// Les anciennes adresses (app.html#mine, #find, #deleguer, #deposer, #paiement-ok…) restent reconnues.
//
//   /mon-espace                      accueil « Que veux-tu faire ? » (connexion si déconnecté)
//   /connexion, /connexion/mot-de-passe
//   /mes-demandes                    mes demandes et propositions
//   /flemmes?categorie=…             flemmes à résoudre (liste réelle, filtres)
//   /deleguer/nouvelle?formule=…     formulaire Déléguer (autre | devis)
//   /flemme/:id                      fiche d’une demande (la proposition d’aide s’y fait)
//   /flemme/:id/modifier | /accord | /signaler
//   /flemme/:id/proposition/:offre   une proposition ; …/accepter : récapitulatif avant d’accepter
//   /compte, /profil, /profil/:id, /aide
//   /paiement/ok, /paiement/annule   retour de Stripe

export type Formule = 'autre' | 'devis';
export type Paiement = 'ok' | 'annule';
/** Ce qu’une adresse désigne. Les champs absents gardent leur valeur par défaut. */
export type Adresse = {
  screen: Screen; tab?: Tab; taskId?: string; offerId?: string; userId?: string;
  formule?: Formule; categorie?: string; paiement?: Paiement;
};

/** Débuts d’adresse servis par l’app (règles Netlify, serveur de développement). */
export const PREFIXES_APP = ['/mon-espace', '/connexion', '/mes-demandes', '/flemmes', '/deleguer/nouvelle', '/flemme', '/compte', '/profil', '/aide', '/paiement'] as const;

const id = (s: string | undefined) => s && /^[\w-]{1,80}$/.test(s) ? decodeURIComponent(s) : '';
const formuleDe = (v: string | null): Formule | undefined => v === 'autre' || v === 'devis' ? v : undefined;
const categorieDe = (v: string | null) => v && /^[a-z0-9-]{1,40}$/.test(v) ? v : undefined;

// Anciennes adresses en « # » (liens déjà partagés, retour Stripe, e-mails).
const ANCIENNES: Record<string, Adresse> = {
  '#mine': { screen: 'list', tab: 'mine' },
  '#find': { screen: 'list', tab: 'find' },
  '#deleguer': { screen: 'new', tab: 'mine' },
  '#deposer': { screen: 'new', tab: 'mine' },
  '#deleguer-autre': { screen: 'new', tab: 'mine', formule: 'autre' },
  '#deposer-autre': { screen: 'new', tab: 'mine', formule: 'autre' },
  '#deleguer-devis': { screen: 'new', tab: 'mine', formule: 'devis' },
  '#deposer-devis': { screen: 'new', tab: 'mine', formule: 'devis' },
  '#paiement-ok': { screen: 'list', tab: 'mine', paiement: 'ok' },
  '#paiement-annule': { screen: 'list', tab: 'mine', paiement: 'annule' },
  '#compte': { screen: 'account' },
  '#aide': { screen: 'help' },
};

/** Lit une adresse (chemin, ?requête, #ancre). null : ce n’est pas une adresse de l’espace connecté. */
export function lireAdresse(chemin: string, requete = '', ancre = ''): Adresse | null {
  const p = chemin.replace(/\/+$/, '') || '/', q = new URLSearchParams(requete);
  const s = p.split('/').slice(1);
  if (p === '/app.html' || p === '/app') return ANCIENNES[ancre] ?? { screen: 'home' };
  switch (s[0]) {
    case 'mon-espace': return s.length === 1 ? { screen: 'home' } : null;
    case 'connexion': return s.length === 1 || (s.length === 2 && s[1] === 'mot-de-passe') ? { screen: 'home' } : null;
    case 'mes-demandes': return s.length === 1 ? { screen: 'list', tab: 'mine' } : null;
    case 'flemmes': return s.length === 1 ? { screen: 'list', tab: 'find', categorie: categorieDe(q.get('categorie')) } : null;
    case 'deleguer': return s.length === 2 && s[1] === 'nouvelle' ? { screen: 'new', tab: 'mine', formule: formuleDe(q.get('formule')) } : null;
    case 'compte': return s.length === 1 ? { screen: 'account' } : null;
    case 'aide': return s.length === 1 ? { screen: 'help' } : null;
    case 'profil': return s.length === 1 ? { screen: 'profile' } : s.length === 2 && id(s[1]) ? { screen: 'profile', userId: id(s[1]) } : null;
    case 'paiement': return s.length === 2 && (s[1] === 'ok' || s[1] === 'annule') ? { screen: 'list', tab: 'mine', paiement: s[1] } : null;
    case 'flemme': {
      const taskId = id(s[1]);
      if (!taskId) return null;
      if (s.length === 2) return { screen: 'detail', taskId };
      if (s.length === 3 && s[2] === 'proposer') return { screen: 'detail', taskId };
      if (s.length === 3) return s[2] === 'modifier' ? { screen: 'edit', taskId } : s[2] === 'accord' ? { screen: 'contract', taskId } : s[2] === 'signaler' ? { screen: 'report', taskId } : null;
      const offerId = s[2] === 'proposition' ? id(s[3]) : '';
      if (!offerId) return null;
      if (s.length === 4) return { screen: 'offer', taskId, offerId };
      return s.length === 5 && s[4] === 'accepter' ? { screen: 'review', taskId, offerId } : null;
    }
    default: return null;
  }
}

/** Adresse canonique d’un écran (sans le nom de domaine). */
export function adresse(a: Adresse): string {
  const t = encodeURIComponent(a.taskId || ''), o = encodeURIComponent(a.offerId || '');
  switch (a.screen) {
    case 'home': return '/mon-espace';
    case 'list': return a.tab === 'find' ? '/flemmes' + (a.categorie ? '?categorie=' + encodeURIComponent(a.categorie) : '') : '/mes-demandes';
    case 'new': return '/deleguer/nouvelle' + (a.formule ? '?formule=' + a.formule : '');
    case 'account': return '/compte';
    case 'help': return '/aide';
    case 'profile': return a.userId ? '/profil/' + encodeURIComponent(a.userId) : '/profil';
    case 'detail': return t ? '/flemme/' + t : '/mes-demandes';
    case 'edit': return t ? `/flemme/${t}/modifier` : '/mes-demandes';
    case 'contract': return t ? `/flemme/${t}/accord` : '/mes-demandes';
    case 'report': return t ? `/flemme/${t}/signaler` : '/mes-demandes';
    case 'offer': return t && o ? `/flemme/${t}/proposition/${o}` : t ? '/flemme/' + t : '/mes-demandes';
    case 'review': return t && o ? `/flemme/${t}/proposition/${o}/accepter` : t ? '/flemme/' + t : '/mes-demandes';
  }
}

/** Vrai si le chemin est servi par l’app (et non par une page de la vitrine). */
export const estAdresseApp = (chemin: string) => chemin === '/app.html' || lireAdresse(chemin) !== null;

/** Schéma de l’app mobile (apps/mobile/app.json). flemme-mobile://lien reste réservé aux liens e-mail de connexion. */
export const SCHEMA_MOBILE = 'flemme-mobile';
const DOMAINES = ['flemme.org', 'www.flemme.org'];

/** Lien profond vers un écran : flemme-mobile://mes-demandes, flemme-mobile://flemme/123/accord… */
export const lienMobile = (a: Adresse) => SCHEMA_MOBILE + ':/' + adresse(a);

/** Lit un lien ouvert dans l’app mobile (flemme-mobile://… ou https://flemme.org/…). null : rien à ouvrir. */
export function lireLien(url: string | null | undefined): Adresse | null {
  if (!url) return null;
  const [sansAncre, ancre = ''] = url.split('#'), [base, requete = ''] = sansAncre.split('?');
  let chemin: string;
  const schema = base.match(/^flemme-mobile:\/\/\/?(.*)$/i);
  if (schema) chemin = '/' + schema[1];
  else {
    const web = base.match(/^https:\/\/([^/]+)(\/.*)?$/i);
    if (!web || !DOMAINES.includes(web[1].toLowerCase())) return null;
    chemin = web[2] || '/';
  }
  return lireAdresse(chemin, requete, ancre ? '#' + ancre : '');
}
