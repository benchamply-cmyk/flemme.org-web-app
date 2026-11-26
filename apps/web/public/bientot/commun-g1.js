/* Scripts communs Flemme /bientot (figés le 26/11/2026, PR 111) : grain dynamique du décor et traits sous les titres. */
/* Grain dynamique (commentaires du 26/11/2026) :
   - au repos, le grain est plein en haut à gauche de l'écran et s'éclaircit en dégradé jusqu'en bas à droite ;
   - en descendant, un front de révélation suit le défilement avec un léger retard : les nouveaux points apparaissent
     de gauche à droite et de haut en bas ;
   - en remontant, les points s'effacent et laissent le fond gris clair ; ils reviennent en haut de page ou dès qu'on redescend. */
(() => {
  const cv = document.getElementById('g1Grain'); if (!cv || !cv.getContext) return;
  const ctx = cv.getContext('2d'), PAS = 14, R = 2, R_FIN = 1.1, ATTENUE = .55, TRANSITION = 260, FONDU = 200, PENTE = .35, MARGE = 120;
  const hero = document.getElementById('haut');
  // Sous le premier écran (le hero), le grain devient plus fin et plus discret ; dans le hero il reste tel quel.
  const basHero = () => hero ? hero.offsetTop + hero.offsetHeight : 0;
  const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const couleur = (getComputedStyle(document.documentElement).getPropertyValue('--g1-grain') || 'rgba(58,143,94,.35)').trim();
  const alea = (x, y) => { const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return v - Math.floor(v); };
  let l = 0, h = 0, dpr = 1, boucle = 0, front = 0, vis = 1, cibleVis = 1, dernierY = scrollY, montee = 0;
  const cibleFront = () => scrollY + h + l * PENTE + MARGE;
  const taille = () => { dpr = Math.min(devicePixelRatio || 1, 2); l = innerWidth; h = innerHeight; cv.width = l * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  const dessiner = () => {
    ctx.clearRect(0, 0, l, h); if (vis <= .01) return; ctx.fillStyle = couleur;
    const y0 = scrollY, decal = y0 % PAS, hb = basHero();
    for (let yv = -decal + PAS / 2; yv < h + PAS; yv += PAS) {
      const yd = yv + y0, ry = Math.round(yd / PAS);
      for (let x = PAS / 2; x < l; x += PAS) {
        const base = Math.max(.12, 1 - (x / l * .55 + yv / h * .45) * .95);              // dégradé haut gauche → bas droite
        const rev = reduit ? 1 : Math.max(0, Math.min(1, (front - (yd + x * PENTE + alea(x, ry) * 90)) / FONDU));
        const k = Math.max(0, Math.min(1, (yd - hb) / TRANSITION));      // 0 dans le hero, 1 dans le reste de la page
        const a = base * rev * vis * (1 - ATTENUE * k); if (a <= .02) continue;
        const r = (R * (1 - k) + R_FIN * k) * (.55 + .45 * rev);
        ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, yv, r, 0, 6.2832); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };
  const pas = () => {
    const cf = cibleFront();
    front = cf < front ? cf : front + (cf - front) * .12;        // le front suit la descente avec retard, recule instantanément
    vis += (cibleVis - vis) * .14;
    dessiner();
    boucle = (Math.abs(cf - front) > 1 || Math.abs(cibleVis - vis) > .01) ? requestAnimationFrame(pas) : 0;
  };
  const relancer = () => { if (!boucle) boucle = requestAnimationFrame(pas); };
  addEventListener('scroll', () => {
    const y = scrollY;
    if (y < dernierY - 2) { cibleVis = y < 60 ? 1 : 0; clearTimeout(montee); }   // on remonte : le grain s'efface (sauf tout en haut)
    else if (y > dernierY + 2) cibleVis = 1;                                      // on redescend : il revient
    if (y < 60) cibleVis = 1;
    dernierY = y; relancer();
  }, { passive: true });
  addEventListener('resize', () => { taille(); front = cibleFront(); relancer(); });
  taille(); front = cibleFront(); dessiner();
})();

/* Traits sous les titres : tracés quand ils entrent à l'écran (repris pour toutes les pages). */
(() => {
  const traits = [...document.querySelectorAll('.g1-trait')];
  if (!('IntersectionObserver' in window)) { traits.forEach(t => t.classList.add('vu')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('vu');
    else if (e.boundingClientRect.top > 0) e.target.classList.remove('vu');
  }), { threshold: .9 });
  traits.forEach(t => io.observe(t));
})();
