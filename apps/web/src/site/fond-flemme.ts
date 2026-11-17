import './fond-flemme.css';

// Fond de page Flemme : le ciel et l’objet suivent doucement la souris (variables --ff-x et --ff-y, de -1 à 1).
// Rien ne bouge avec « mouvements réduits », sur écran tactile ou quand la section n’est pas visible.
export function animerFonds() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(pointer: fine)').matches) return;
  document.querySelectorAll<HTMLElement>('.fond-flemme').forEach(fond => {
    let cible = { x: 0, y: 0 }, actuel = { x: 0, y: 0 }, image = 0, visible = true;
    const pas = () => {
      actuel.x += (cible.x - actuel.x) * .06;
      actuel.y += (cible.y - actuel.y) * .06;
      fond.style.setProperty('--ff-x', actuel.x.toFixed(3));
      fond.style.setProperty('--ff-y', actuel.y.toFixed(3));
      image = Math.abs(cible.x - actuel.x) + Math.abs(cible.y - actuel.y) > .002 ? requestAnimationFrame(pas) : 0;
    };
    fond.addEventListener('pointermove', e => {
      if (!visible) return;
      const r = fond.getBoundingClientRect();
      cible = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 };
      if (!image) image = requestAnimationFrame(pas);
    });
    fond.addEventListener('pointerleave', () => { cible = { x: 0, y: 0 }; if (!image) image = requestAnimationFrame(pas); });
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(fond);
  });
}
