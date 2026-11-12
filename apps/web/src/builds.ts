// Sélecteur de builds (builds.html, page d'arrivée du site flemmeorg-beta, 12 nov. 2026).
// Affiche dans un cadre le site preprod déployé (par défaut), beta, ou l'aperçu Netlify d'une PR vers beta.
// La liste des PR est lue en direct dans l'API publique de GitHub (dépôt public, aucune clé).

export type Build = { id: string; nom: string; base: string };
export type PR = { number: number; title: string; state: string; merged_at: string | null };

export const DEPOT = 'benchamply-cmyk/flemme.org-web-app';
export const FIXES: Build[] = [
  { id: 'preprod', nom: 'Preprod déployé', base: 'https://preprod--flemmeorg.netlify.app' },
  { id: 'beta', nom: 'Beta (dernière version publiée)', base: 'https://flemmeorg-beta.netlify.app' },
];
export const PAGES = [
  { id: 'index.html', nom: 'Accueil' },
  { id: 'app.html', nom: 'App' },
  { id: 'resoudre.html', nom: 'Résoudre' },
  { id: 'atelier-services.html', nom: 'Atelier des services (beta)' },
  { id: 'atelier.html', nom: 'Atelier visuel (beta)' },
];

export const buildPR = (n: number, titre = ''): Build => ({
  id: `pr${n}`, nom: `PR #${n}${titre ? ` · ${titre}` : ''}`, base: `https://deploy-preview-${n}--flemmeorg-beta.netlify.app`,
});

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
export function buildsDepuisPR(prs: PR[]): Build[] {
  return [...prs]
    .sort((a, b) => Number(b.state === 'open') - Number(a.state === 'open') || b.number - a.number)
    .map(p => buildPR(p.number, `${p.title} (${p.state === 'open' ? 'ouverte' : p.merged_at ? `fusionnée le ${date(p.merged_at)}` : 'fermée'})`));
}

// Adresse affichée : toujours /page.html, car « / » du site beta est ce sélecteur.
export const adresse = (b: Build, page: string) => `${b.base}/${page}`;

export function lireEtat(hash: string): { build: string; page: string } {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const page = p.get('page') ?? '';
  return { build: p.get('build') ?? 'preprod', page: PAGES.some(x => x.id === page) ? page : 'index.html' };
}
