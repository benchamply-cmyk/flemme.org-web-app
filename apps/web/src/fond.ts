import './fonds.css';

// Fond de page Glacier aurore (choix de Ben du 5 novembre 2026) : formes floues qui glissent au défilement.
// --p vaut 0 en haut de page et 1 en bas ; les couleurs sont dans fonds.css (html[data-fond]).
const root = document.documentElement;
const fond = document.createElement('div');
fond.className = 'fond'; fond.setAttribute('aria-hidden', 'true');
fond.innerHTML = '<i class="b1"></i><i class="b2"></i><i class="b3"></i>';
document.body.prepend(fond);
let attente = 0;
const suivre = () => { attente = 0; const max = root.scrollHeight - innerHeight; root.style.setProperty('--p', (max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0).toFixed(3)); };
addEventListener('scroll', () => { if (!attente) attente = requestAnimationFrame(suivre); }, { passive: true });
addEventListener('resize', suivre); suivre();
