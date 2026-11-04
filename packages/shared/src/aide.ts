// Lot 4 du parcours complet : pièces jointes, photo de profil, assistant (réponses prédéfinies) et aide humaine.
// Mêmes règles que supabase/migrations/20261104150000_flemme_v2_fichiers_aide.sql ; le serveur refait chaque contrôle.
import type { Actor, Input } from './domain.ts';

export type FileItem = { id: string; name: string; mime: string; size: number; path: string; owner: Actor; at: string };
/** Fichier à envoyer : un File du navigateur, ou tout objet équivalent (mobile). */
export type Upload = Blob & { name: string };

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const FILE_TYPES: Record<string, string> = {
  'application/pdf': 'PDF', 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'application/msword': 'Word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
};
export const AVATAR_TYPES = ['image/jpeg', 'image/png'];
/** Valeur de l’attribut accept d’un champ fichier. */
export const fileAccept = (avatar = false) => avatar ? AVATAR_TYPES.join(',') : Object.keys(FILE_TYPES).join(',') + ',.doc,.docx';
// Certains navigateurs ne donnent pas le type d’un .doc/.docx : on le déduit de l’extension.
const byExtension: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
export function fileType(name: string, type: string) {
  return FILE_TYPES[type] ? type : byExtension[(name.split('.').pop() || '').toLowerCase()] || type;
}
/** Contrôle avant envoi ; renvoie les données de file_prepare. */
export function fileInput(f: { name: string; type: string; size: number }, avatar = false): Input {
  const mime = fileType(f.name, f.type);
  if (avatar ? !AVATAR_TYPES.includes(mime) : !FILE_TYPES[mime]) throw new Error(avatar ? 'Photo au format JPEG ou PNG.' : 'Format accepté : PDF, JPEG, PNG ou Word.');
  if (f.size < 1 || f.size > MAX_FILE_SIZE) throw new Error('Fichier trop lourd : 10 Mo au plus.');
  const name = f.name.trim().slice(-120) || 'fichier';
  return { name, mime, size: f.size };
}
export const fileSize = (n: number) => n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' Ko' : (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' Mo';

export const HELP_TOPICS = [
  { value: 'compte', label: 'Mon compte' }, { value: 'demande', label: 'Une demande' }, { value: 'mission', label: 'Une mission en cours' },
  { value: 'paiement', label: 'Paiement' }, { value: 'securite', label: 'Sécurité ou comportement' }, { value: 'autre', label: 'Autre' },
] as const;
export type HelpTopic = typeof HELP_TOPICS[number]['value'];
export type HelpRequest = { id: string; topic: HelpTopic; text: string; status: 'open' | 'answered' | 'closed'; answer: string | null; taskId: string | null; at: string; answeredAt: string | null };
export const helpStatus: Record<HelpRequest['status'], string> = { open: 'En attente de réponse', answered: 'Répondu', closed: 'Clos' };
export function helpInput(topic: string | undefined, text: string | undefined, taskId?: string | null): Input {
  if (!HELP_TOPICS.some(t => t.value === topic)) throw new Error('Choisis un sujet.');
  const body = (text || '').trim();
  if (!body) throw new Error('Explique ta question en quelques mots.');
  if (body.length > 2000) throw new Error('2 000 caractères au plus.');
  return { topic, text: body, taskId: taskId || null };
}

/** Réponses prédéfinies de l’assistant. Aucune IA : recherche par mots clés, puis proposition de parler à un humain. */
export const FAQ: { id: string; question: string; keywords: string[]; answer: string; topic: HelpTopic }[] = [
  { id: 'deposer', topic: 'demande', question: 'Comment déposer une flemme ?', keywords: ['deposer', 'publier', 'demande', 'creer', 'nouvelle'],
    answer: 'Depuis « Mes flemmes », choisis « Déléguer ma flemme ». Décris ce qu’il faut faire, le délai et un budget indicatif. L’équipe FLEMME relit ta demande avant de la publier.' },
  { id: 'validation', topic: 'demande', question: 'Pourquoi ma demande n’est pas visible ?', keywords: ['visible', 'validation', 'attente', 'publiee', 'privee', 'refusee'],
    answer: 'Chaque demande reste privée jusqu’à sa validation par l’équipe. Si une correction est demandée, le message de l’équipe s’affiche sur ta demande : corrige-la, elle repart en validation.' },
  { id: 'candidature', topic: 'mission', question: 'Comment proposer mon aide ?', keywords: ['proposer', 'candidature', 'aider', 'brigadier', 'offre'],
    answer: 'Ouvre une flemme dans « Résoudre une flemme », indique ton forfait, tes disponibilités et le résultat promis. L’équipe relit ta candidature avant de la transmettre au déposant.' },
  { id: 'prix', topic: 'paiement', question: 'Combien coûte FLEMME ?', keywords: ['prix', 'commission', 'frais', 'cout', 'tarif', 'pourcentage'],
    answer: 'Le Brigadier fixe son forfait. FLEMME ajoute sa commission au forfait accepté : le détail est affiché avant d’accepter, puis figé dans l’accord.' },
  { id: 'payer', topic: 'paiement', question: 'Comment payer le Brigadier ?', keywords: ['payer', 'paiement', 'carte', 'stripe', 'virement', 'rembourse'],
    answer: 'Une fois la tâche terminée, paie selon ce que propose la fiche : en ligne par carte si c’est activé, sinon en direct, puis déclare le paiement. Le Brigadier confirme la réception.' },
  { id: 'accord', topic: 'mission', question: 'À quoi sert l’accord écrit ?', keywords: ['accord', 'contrat', 'signer', 'signature', 'conditions'],
    answer: 'Après le choix du Brigadier, vous écrivez ensemble le périmètre, le résultat attendu, le délai, l’annulation et la confidentialité. L’équipe le contrôle, puis chacun le signe (acceptation simple et horodatée).' },
  { id: 'litige', topic: 'securite', question: 'Ça se passe mal, que faire ?', keywords: ['probleme', 'litige', 'signaler', 'desaccord', 'arnaque', 'comportement', 'annuler'],
    answer: 'Sur la fiche de la flemme, choisis « Signaler un désaccord ». L’équipe examine chaque signalement à la main. Aucun remboursement n’est automatique.' },
  { id: 'fichiers', topic: 'mission', question: 'Puis-je envoyer des documents ?', keywords: ['fichier', 'document', 'piece', 'jointe', 'photo', 'pdf', 'envoyer'],
    answer: 'Oui : une fois le Brigadier choisi, le déposant et lui peuvent joindre des PDF, images ou documents Word (10 Mo au plus). Ils ne sont visibles que d’eux deux.' },
  { id: 'motdepasse', topic: 'compte', question: 'J’ai oublié mon mot de passe', keywords: ['mot', 'passe', 'connexion', 'connecter', 'email', 'oublie', 'compte'],
    answer: 'Sur l’écran de connexion, choisis « Mot de passe oublié ? ». Ouvre le lien reçu dans le même navigateur. Pense à regarder dans les indésirables.' },
];
const plain = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Jusqu’à 3 réponses, les plus proches de la question d’abord. */
export function assistant(question: string) {
  const words = plain(question).split(/[^a-z0-9]+/).filter(w => w.length > 2);
  if (!words.length) return [];
  return FAQ.map(f => ({ f, score: words.filter(w => f.keywords.some(k => k.startsWith(w) || w.startsWith(k))).length }))
    .filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map(x => x.f);
}
