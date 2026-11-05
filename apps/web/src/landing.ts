import './site/commun.ts';

// Accueil de la vitrine (maquette V0.3, recommandations UX et contenus du 5 novembre 2026).

// Anciennes ancres de la page unique : renvoyées vers leur nouvelle page.
const anciennes: Record<string, string> = { '#concept': 'comment-ca-marche.html#concept', '#prix': 'comment-ca-marche.html#prix', '#comment': 'comment-ca-marche.html', '#faq': 'faq.html', '#contact': 'contact.html' };
if (anciennes[location.hash]) location.replace(anciennes[location.hash]);
