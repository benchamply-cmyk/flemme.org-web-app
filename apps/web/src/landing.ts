import './beta/runtime.ts';
import './site/accueil-union.css';
import './site/nav.ts';

// Accueil de la vitrine (13/11/2026) : proposition de la PR #67, inspirée de l’implémentation d’UNION :
// navigation qui se cache, titre écrit lettre par lettre, apparitions en cascade, moments de vie, test de flemme.
// Tout reste lisible sans JS et avec « mouvements réduits ».

// Anciennes ancres de la page unique : renvoyées vers leur nouvelle page.
const anciennes: Record<string, string> = { '#concept': 'concept#concept', '#prix': 'concept#prix', '#comment': 'concept', '#faq': 'faq' };
if (anciennes[location.hash]) location.replace(anciennes[location.hash]);

const racine = document.documentElement;
const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
const observe = 'IntersectionObserver' in window;

/* ---------- Navigation pastille : partagée avec les pages intérieures (site/nav.ts) ---------- */

/* ---------- Titre du hero écrit lettre par lettre, puis l’italique et le reste en fondu ---------- */
const titre = document.querySelector<HTMLElement>('[data-ecrire]');
function heroPret() { racine.classList.add('pret'); titre?.classList.add('italique'); }
if (titre && !reduit) {
  titre.setAttribute('aria-label', titre.textContent!.replace(/\s+/g, ' ').trim());
  titre.classList.add('ecrit');
  const lettres: HTMLSpanElement[] = [];
  [...titre.childNodes].forEach(n => {
    if (n.nodeType !== Node.TEXT_NODE) return; // l’italique (<em>) arrive en fondu, pas lettre par lettre
    const frag = document.createDocumentFragment();
    for (const c of n.textContent || '') {
      const s = document.createElement('span'); s.className = 'ec-l'; s.setAttribute('aria-hidden', 'true'); s.textContent = c;
      frag.append(s); lettres.push(s);
    }
    n.replaceWith(frag);
  });
  let i = 0, courant: HTMLSpanElement | null = null;
  const frappe = () => {
    courant?.classList.remove('curseur');
    if (i >= lettres.length) { setTimeout(() => titre.classList.add('italique'), 120); setTimeout(() => racine.classList.add('pret'), 700); return; }
    courant = lettres[i++]; courant.classList.add('vue', 'curseur');
    // Rythme humain : plus lent après un espace ou une ponctuation, rares hésitations.
    const c = courant.textContent || '';
    let d = 20 + Math.random() * 28;
    if (c === ' ') d = 40 + Math.random() * 45;
    if (/[,.!?]/.test(c)) d = 220 + Math.random() * 90;
    if (Math.random() < .05) d += 90;
    setTimeout(frappe, d);
  };
  setTimeout(frappe, 350);
} else heroPret();

/* ---------- Apparition en cascade : les éléments qui entrent ensemble s’affichent l’un après l’autre ---------- */
const aReveler = [...document.querySelectorAll<HTMLElement>('.revele, .titre-p, .cmp-case')];
if (reduit || !observe) aReveler.forEach(el => el.classList.add('vu'));
else {
  const io = new IntersectionObserver(entrees => {
    const visibles = entrees.filter(e => e.isIntersecting).map(e => e.target as HTMLElement);
    visibles.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (ra.top - rb.top) || (ra.left - rb.left); });
    visibles.forEach((el, k) => { el.style.setProperty('--cd', `${Math.min(k * .09, .9)}s`); el.classList.add('vu'); io.unobserve(el); });
  }, { threshold: .25, rootMargin: '0px 0px -6% 0px' });
  aReveler.forEach(el => io.observe(el));
}

/* ---------- Moments de vie : flèches et points calés sur le défilement horizontal ---------- */
const piste = document.getElementById('momentsPiste')!;
const cartes = [...piste.children] as HTMLElement[];
const points = [...document.querySelectorAll<HTMLElement>('#momentsPoints i')];
const [precedent, suivant] = [...document.querySelectorAll<HTMLButtonElement>('[data-moment]')];
const momentActuel = () => Math.round(piste.scrollLeft / (cartes[1].offsetLeft - cartes[0].offsetLeft || 1));
function majMoments() {
  const k = Math.min(cartes.length - 1, momentActuel());
  points.forEach((p, n) => p.classList.toggle('actif', n === k));
  precedent.disabled = piste.scrollLeft < 4;
  suivant.disabled = piste.scrollLeft + piste.clientWidth >= piste.scrollWidth - 4;
}
document.querySelectorAll<HTMLButtonElement>('[data-moment]').forEach(b => b.addEventListener('click', () => {
  const k = Math.max(0, Math.min(cartes.length - 1, momentActuel() + Number(b.dataset.moment)));
  piste.scrollTo({ left: cartes[k].offsetLeft - cartes[0].offsetLeft, behavior: reduit ? 'auto' : 'smooth' });
}));
piste.addEventListener('scroll', () => requestAnimationFrame(majMoments), { passive: true });
addEventListener('resize', majMoments);
majMoments();

/* ---------- Test de flemme : 6 questions, 0 à 3 points, score sur 18 ---------- */
// Inactif quand la section #test n’est pas sur la page (retirée de l’accueil le 13/11/2026, plan du site de Ben).
if (document.getElementById('test')) {
  // Chaque question correspond à une famille du catalogue : la plus forte réponse donne la flemme à confier en premier.
  const QUESTIONS = [
    { q: 'Un abonnement que tu voudrais résilier traîne depuis des semaines.', famille: 'un courrier de résiliation (19 €)' },
    { q: 'Tu as déjà renoncé à un remboursement parce que la réclamation te décourageait.', famille: 'une réclamation avec relance (19 €)' },
    { q: 'Des objets à vendre dorment chez toi, faute d’avoir écrit l’annonce.', famille: 'un pack 3 annonces (39 €)' },
    { q: 'Monter un dossier de location ou prévenir les organismes après un déménagement te paralyse.', famille: 'un dossier de location vérifié (39 €)' },
    { q: 'Tu repousses un voyage parce que comparer les options t’épuise.', famille: 'un comparatif voyage (39 €)' },
    { q: 'Tu restes chez le même fournisseur d’énergie, de box ou de mutuelle par flemme de comparer.', famille: 'un comparatif énergie, box ou mutuelle (39 €)' },
  ];
  const REPONSES = ['Jamais', 'Parfois', 'Souvent', 'Tout le temps'];
  const NIVEAUX = [
    { max: 4, nom: 'Flemme légère', couleur: '#1f9d5a', texte: 'Tu gères plutôt bien. Garde Flemme pour le jour où une démarche te résiste.' },
    { max: 9, nom: 'Flemme installée', couleur: '#3a7bd5', texte: 'Quelques corvées s’accumulent. En déléguer une ou deux libère vite la tête.' },
    { max: 14, nom: 'Flemme chronique', couleur: '#3a2fa0', texte: 'Plusieurs démarches attendent. Commence par celle qui te coûte le plus, on s’occupe du reste.' },
    { max: 18, nom: 'Flemme olympique', couleur: '#c2185b', texte: 'Le podium est à toi. Décris ta pile de flemmes, on te propose un prix pour chacune.' },
  ];
  const $ = (id: string) => document.getElementById(id)!;
  const couverture = $('testCouverture'), jeu = $('testJeu'), resultat = $('testResultat');
  const compte = $('testCompte'), barre = $('testBarre'), question = $('testQuestion'), reponses = $('testReponses');
  const retour = $('testRetour') as HTMLButtonElement;
  let rep: number[] = [], q = 0;

  reponses.innerHTML = REPONSES.map((r, v) => `<button type="button" role="radio" aria-checked="false" data-v="${v}">${r}</button>`).join('');
  const boutons = [...reponses.querySelectorAll<HTMLButtonElement>('button')];

  // La carte garde la même hauteur quelle que soit la question : la zone prend la hauteur de la plus longue.
  function caleHauteur() {
    if (!question.offsetParent) return;
    const actuel = question.textContent; let max = 0;
    question.style.minHeight = '0px';
    QUESTIONS.forEach(x => { question.textContent = x.q; max = Math.max(max, question.offsetHeight); });
    question.textContent = actuel; question.style.minHeight = `${max}px`;
  }

  function afficher() {
    const fini = q >= QUESTIONS.length;
    jeu.hidden = fini; resultat.hidden = !fini;
    if (!fini) {
      compte.textContent = `Question ${q + 1} / ${QUESTIONS.length}`;
      barre.style.width = `${(q + 1) / QUESTIONS.length * 100}%`;
      question.textContent = QUESTIONS[q].q;
      boutons.forEach((b, v) => b.setAttribute('aria-checked', String(rep[q] === v)));
      retour.disabled = q === 0;
      [...jeu.children].forEach(el => { (el as HTMLElement).style.animation = 'none'; void (el as HTMLElement).offsetWidth; (el as HTMLElement).style.animation = ''; });
      return;
    }
    const score = rep.reduce((t, v) => t + v, 0);
    const niveau = NIVEAUX.find(n => score <= n.max)!;
    const top = rep.indexOf(Math.max(...rep));
    resultat.style.setProperty('--niveau', niveau.couleur);
    $('testNiveau').textContent = niveau.nom;
    $('testMessage').textContent = `${niveau.texte} (score : ${score} / 18)`;
    $('testConseil').textContent = Math.max(...rep) === 0
      ? 'Aucune flemme en vue : reviens nous voir quand une démarche traîne.'
      : `À confier en premier : ${QUESTIONS[top].famille}.`;
    const jauge = $('testJauge');
    jauge.style.width = '0%'; void jauge.offsetWidth; jauge.style.width = `${Math.round(score / 18 * 100)}%`;
    $('testNiveau').focus({ preventScroll: true });
  }
  boutons.forEach(b => b.addEventListener('click', () => { rep[q] = Number(b.dataset.v); q++; afficher(); if (q < QUESTIONS.length) boutons[0].focus({ preventScroll: true }); }));
  retour.addEventListener('click', () => { q = Math.max(0, q - 1); afficher(); });
  $('testLancer').addEventListener('click', () => { couverture.hidden = true; afficher(); caleHauteur(); boutons[0].focus({ preventScroll: true }); });
  $('testRecommencer').addEventListener('click', () => { rep = []; q = 0; afficher(); boutons[0].focus({ preventScroll: true }); });
  addEventListener('resize', caleHauteur);
}

/* ---------- Copier l’adresse de contact (repli : sélection du texte si le presse-papiers est refusé) ---------- */
document.querySelectorAll<HTMLButtonElement>('[data-copier]').forEach(b => b.addEventListener('click', async () => {
  const cible = document.getElementById(b.dataset.copier || ''), note = document.getElementById(b.dataset.note || '');
  if (!cible) return;
  try { await navigator.clipboard.writeText(cible.textContent || ''); if (note) note.textContent = 'Adresse copiée.'; }
  catch { getSelection()?.selectAllChildren(cible); if (note) note.textContent = 'Adresse sélectionnée : copie-la avec Ctrl+C ou ⌘C.'; }
}));
