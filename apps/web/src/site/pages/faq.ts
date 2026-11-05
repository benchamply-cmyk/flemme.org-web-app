import { FAQ } from '../../../../../packages/shared/src/aide.ts';
import '../commun.ts';

// Questions fréquentes : mêmes réponses que l’assistant de l’app (packages/shared/src/aide.ts), rangées par profil.
const groupes: { titre: string; sujets: string[] }[] = [
  { titre: 'Pour les Flemmards', sujets: ['demande', 'paiement'] },
  { titre: 'Pour les Brigadiers', sujets: ['mission'] },
  { titre: 'Confiance, sécurité et compte', sujets: ['securite', 'compte'] },
];
const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!).replace(/ ([?!:;])/g, ' $1');
const plat = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const liste = document.getElementById('faqListe')!;
const rangees = groupes.map(g => ({ ...g, questions: FAQ.filter(f => g.sujets.includes(f.topic)) }));
const autres = FAQ.filter(f => !groupes.some(g => g.sujets.includes(f.topic)));
if (autres.length) rangees.push({ titre: 'Autres questions', sujets: [], questions: autres });
liste.innerHTML = rangees.filter(g => g.questions.length).map(g => `<div class="groupe" style="display:flex;flex-direction:column;gap:8px;margin-top:8px"><b class="groupe-faq">${esc(g.titre)}</b><div class="questions">${g.questions.map(f =>
  `<details data-texte="${esc(plat([f.question, f.answer, ...f.keywords].join(' ')))}"><summary>${esc(f.question)}</summary><p>${esc(f.answer)}</p></details>`).join('')}</div></div>`).join('');

// Recherche dans les questions : filtre au fil de la frappe, sans accents ni majuscules.
const champ = document.getElementById('faqQ') as HTMLInputElement, vide = document.getElementById('faqVide')!;
champ.addEventListener('input', () => {
  const mots = plat(champ.value).split(/\s+/).filter(Boolean);
  let total = 0;
  liste.querySelectorAll<HTMLElement>('.groupe').forEach(g => {
    let visibles = 0;
    g.querySelectorAll<HTMLDetailsElement>('details').forEach(d => { const ok = mots.every(m => (d.dataset.texte || '').includes(m)); d.hidden = !ok; if (ok) visibles++; });
    g.hidden = !visibles; total += visibles;
  });
  vide.hidden = total > 0;
});
