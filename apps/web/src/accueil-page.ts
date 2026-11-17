import './landing-page.ts';
import './site/accueil-lp.css';

// Accueil (index.html, 14/11/2026) : contenu et animations de la landing (landing-page.ts), sur le fond de l’ancien accueil
// (rubans chromés menthe). La page landing.html séparée a été retirée (demande de Ben).

// Anciennes ancres de la page unique : renvoyées vers leur nouvelle page.
const anciennes: Record<string, string> = { '#concept': 'concept#concept', '#prix': 'concept#prix', '#comment': 'concept', '#faq': 'faq' };
if (anciennes[location.hash]) location.replace(anciennes[location.hash]);
