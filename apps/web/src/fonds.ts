import './fonds.css';

// Fond de page Glacier (choix de Ben du 5 novembre 2026) : bleus diffus qui glissent avec le défilement.
const root = document.documentElement;
root.dataset.fond = 'glacier';

const fond = document.createElement('div');
fond.className = 'fond'; fond.setAttribute('aria-hidden', 'true');
fond.innerHTML = '<i class="b1"></i><i class="b2"></i><i class="b3"></i>';
document.body.prepend(fond);

// --p : 0 en haut de page, 1 en bas. Les formes et les couleurs glissent avec le défilement.
let attente = 0;
const suivre = () => { attente = 0; const max = document.documentElement.scrollHeight - innerHeight; root.style.setProperty('--p', (max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0).toFixed(3)); };
addEventListener('scroll', () => { if (!attente) attente = requestAnimationFrame(suivre); }, { passive: true });
addEventListener('resize', suivre); suivre();
