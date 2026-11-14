import './landing-page.ts';
import './site/accueil-lp.css';

// Accueil (index.html, 14/11/2026) : même page que la landing (landing-page.ts), sur le fond de l’accueil
// (rubans chromés menthe). Demande de Ben sur l’aperçu 71 : tous les retours de la landing s’appliquent à l’accueil.

// Anciennes ancres de la page unique : renvoyées vers leur nouvelle page.
const anciennes: Record<string, string> = { '#concept': 'concept#concept', '#prix': 'concept#prix', '#comment': 'concept', '#faq': 'faq' };
if (anciennes[location.hash]) location.replace(anciennes[location.hash]);
