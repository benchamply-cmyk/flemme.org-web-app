// Feature flags FLEMME : registre officiel des fonctionnalités activables (proposition validée par Ben, 16/11/2026).
// Ce fichier dit QUELS flags existent et leur valeur par défaut (repli si Supabase ne répond pas).
// L'interrupteur réel vit dans la table flemme_v2.feature_flags, réglé depuis /admin, onglet « Fonctionnalités ».
// Un flag masque ou montre de l'interface : il ne donne aucun droit. Les écritures sensibles sont revérifiées en base.

export type EtatFlag = 'off' | 'testeurs' | 'tous';
export type Environnement = 'local' | 'beta' | 'preprod' | 'prod';
export type TypeFlag = 'lancement' | 'coupe-circuit' | 'variante';
export type Domaine = 'Modèle' | 'Mon espace' | 'Design et visuel' | 'Menu et navigation' | 'Catalogue de services' | 'Formulaires';

export type DefinitionFlag = {
  domaine: Domaine;
  libelle: string;
  description: string;
  type: TypeFlag;
  /** Valeur par défaut de l'état, par environnement. */
  defaut: Record<Environnement, EtatFlag>;
  /** Flags « variante » : valeurs permises, la première est celle appliquée par défaut. */
  valeurs?: readonly string[];
  /** Flags « variante » : valeur par défaut propre à un environnement (sinon la première de « valeurs »). */
  valeurDefaut?: Partial<Record<Environnement, string>>;
  creeLe: string;
  /** Flags de lancement : date à laquelle retirer le flag du code une fois la fonctionnalité stable. */
  retraitPrevu?: string;
};

export const ETATS: readonly EtatFlag[] = ['off', 'testeurs', 'tous'];
export const ENVIRONNEMENTS: readonly Environnement[] = ['local', 'beta', 'preprod', 'prod'];
export const ETAT_LIBELLE: Record<EtatFlag, string> = { off: 'Éteint', testeurs: 'Testeurs', tous: 'Tout le monde' };

const partout = (etat: EtatFlag): Record<Environnement, EtatFlag> => ({ local: etat, beta: etat, preprod: etat, prod: etat });

// Clé = domaine.fonction, en minuscules. Ajouter un flag = une ligne ici, dans une PR.
export const FLAGS = {
  // Modèle économique affiché (décision de Ben du 17/11/2026) : « hybride » = catalogue à prix fixes (v1.5.x),
  // « ouvert » = mise en relation ouverte (v2.0.0, marketplace ouverte). Depuis le 18/11/2026 (choix de Ben) : ouvert partout,
  // y compris preprod et les aperçus de PR. L’hybride reste visible en le choisissant dans /admin › Fonctionnalités.
  'modele.version': { domaine: 'Modèle', libelle: 'Modèle affiché', type: 'variante', defaut: partout('tous'), valeurs: ['ouvert', 'hybride'],
    valeurDefaut: { local: 'ouvert', beta: 'ouvert', preprod: 'ouvert', prod: 'ouvert' }, creeLe: '2026-11-17',
    description: 'Hybride : catalogue à prix fixes, formules et Devenir Brigadier. Ouvert : ces blocs sont masqués (mise en relation ouverte).' },
  'espace.mon_espace': { domaine: 'Mon espace', libelle: 'Mon espace', type: 'coupe-circuit', defaut: partout('tous'), creeLe: '2026-11-16',
    description: 'Éteint : la connexion et Mon espace affichent « bientôt disponible ».' },
  'espace.aide': { domaine: 'Mon espace', libelle: 'Aide dans l’app', type: 'lancement', defaut: partout('tous'), creeLe: '2026-11-16', retraitPrevu: '2026-12-31',
    description: 'Éteint : masque les accès à l’aide humaine dans l’app.' },
  // Abonnements (v2.0.0, 18/11/2026) : code de souscription prêt, éteint partout. La base exige en plus une ligne « tous » ou « testeurs »
  // et une formule « open » avec un prix Stripe (supabase/migrations/20261118130000_flemme_v2_abonnements.sql).
  'abonnements.souscription': { domaine: 'Mon espace', libelle: 'Souscription aux abonnements', type: 'lancement', defaut: partout('off'), creeLe: '2026-11-18',
    description: 'Allumé : Mon espace propose les formules ouvertes et la page Premium affiche « S’abonner ». Éteint : « Bientôt ».' },
  // Confiance (v2.1.0, 18/11/2026, recommandations 1 à 4 du comparatif Airtasker / TaskRabbit) : questions publiques et livraison avec
  // libération du paiement. Demande la migration 20261118140000_flemme_v2_confiance.sql : allumer preprod dans /admin une fois
  // la migration appliquée sur flemme-preprod. Le masquage des coordonnées et les repères du profil ne dépendent pas de ce flag.
  'espace.confiance': { domaine: 'Mon espace', libelle: 'Questions publiques et livraison', type: 'lancement',
    defaut: { local: 'tous', beta: 'off', preprod: 'off', prod: 'off' }, creeLe: '2026-11-18', retraitPrevu: '2027-01-31',
    description: 'Allumé : questions publiques sous les demandes, bouton « mission livrée » et libération automatique après 7 jours. Éteint : masqués.' },
  'espace.premium': { domaine: 'Mon espace', libelle: 'Liens Premium', type: 'lancement', defaut: partout('tous'), creeLe: '2026-11-16',
    description: 'Éteint : masque les liens vers la page Premium (gelée jusqu’à 10 clients payants).' },
  'design.theme': { domaine: 'Design et visuel', libelle: 'Thème du site', type: 'variante', defaut: partout('tous'), valeurs: ['clair', 'nuit', 'papier'], creeLe: '2026-11-16',
    description: 'Thème appliqué à tous les visiteurs. Un testeur peut encore le changer pour lui dans /beta.' },
  'navigation.style': { domaine: 'Menu et navigation', libelle: 'Style du menu', type: 'variante', defaut: partout('tous'), valeurs: ['burger', 'visible', 'compacte'], creeLe: '2026-11-16',
    description: 'Menu burger, liens visibles ou barre compacte, pour tous les visiteurs.' },
  'catalogue.services': { domaine: 'Catalogue de services', libelle: 'Catalogue des services', type: 'coupe-circuit', defaut: partout('tous'), creeLe: '2026-11-16',
    description: 'Éteint : masque la section « Nos services » et ses liens.' },
  'formulaires.deleguer': { domaine: 'Formulaires', libelle: 'Formulaire « Déléguer »', type: 'coupe-circuit', defaut: partout('tous'), creeLe: '2026-11-16',
    description: 'Éteint : le formulaire affiche « bientôt disponible » et la base refuse les nouvelles demandes.' },
  'formulaires.resoudre': { domaine: 'Formulaires', libelle: 'Parcours « Résoudre »', type: 'coupe-circuit', defaut: partout('tous'), creeLe: '2026-11-16',
    description: 'Éteint : masque « Résoudre une flemme » et la base refuse les candidatures.' },
} as const satisfies Record<string, DefinitionFlag>;

export type CleFlag = keyof typeof FLAGS;
export const CLES = Object.keys(FLAGS) as CleFlag[];
export const estCle = (k: string): k is CleFlag => Object.hasOwn(FLAGS, k);

/** Ligne renvoyée par public.flemme_flags (une par flag réglé dans l'environnement). */
export type LigneFlag = { key: string; state: EtatFlag; value: string | null };
export type ValeurFlag = { etat: EtatFlag; actif: boolean; valeur: string | null; source: 'registre' | 'base' };
export type EtatFlags = Record<CleFlag, ValeurFlag>;

/** Environnement de build à partir des variables Netlify (BRANCH, CONTEXT). Une branche inconnue (aperçu de PR) lit preprod. */
export function environnementDepuis(branche = '', contexte = ''): Environnement {
  if (branche === 'prod' || branche === 'preprod' || branche === 'beta') return branche;
  return contexte ? 'preprod' : 'local';
}

/** Un état vaut « actif » pour tous, pour les testeurs vérifiés, ou pour personne. */
export const estActif = (etat: EtatFlag, testeur: boolean) => etat === 'tous' || (etat === 'testeurs' && testeur);

/** Combine le registre et les lignes de la base. Une ligne inconnue ou invalide est ignorée : le défaut s'applique. */
export function resoudreFlags(env: Environnement, lignes: readonly LigneFlag[] | null, testeur: boolean): EtatFlags {
  const base = new Map((lignes || []).filter(l => estCle(l.key) && ETATS.includes(l.state)).map(l => [l.key, l]));
  return Object.fromEntries(CLES.map(cle => {
    const def: DefinitionFlag = FLAGS[cle], ligne = base.get(cle);
    const etat = ligne ? ligne.state : def.defaut[env];
    const parDefaut = def.valeurDefaut?.[env];
    const valeur = def.valeurs ? (ligne?.value && def.valeurs.includes(ligne.value) ? ligne.value
      : parDefaut && def.valeurs.includes(parDefaut) ? parDefaut : def.valeurs[0]) : null;
    return [cle, { etat, actif: estActif(etat, testeur), valeur, source: ligne ? 'base' : 'registre' }];
  })) as EtatFlags;
}

/** Lecture publique : ne demande aucune session. Renvoie null si Supabase est absent ou ne répond pas (repli sur le registre). */
export async function lireLignes(url: string, cle: string, env: Environnement, transport: typeof fetch = (i, o) => fetch(i, o)): Promise<LigneFlag[] | null> {
  if (!url || !cle) return null;
  try {
    const res = await transport(url.replace(/\/$/, '') + '/rest/v1/rpc/flemme_flags', {
      method: 'POST', headers: { apikey: cle, Authorization: 'Bearer ' + cle, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_environment: env }), signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.flags) ? data.flags as LigneFlag[] : null;
  } catch { return null; }
}
