import './fonds.css';

// Fonds de page à comparer (voir fonds.css). Le sélecteur n’apparaît pas sur flemme.org, où le fond actuel reste en place.
const FONDS = [
  { id: 'glacier', nom: 'Glacier', swatch: 'radial-gradient(circle at 35% 30%, #fff, #bcd5ff)' },
  { id: 'relief', nom: 'Relief', swatch: 'radial-gradient(circle at 30% 28%, #fff 30%, #dbe7fa)' },
  { id: 'horizon', nom: 'Horizon', swatch: 'linear-gradient(180deg, #c9defd, #fff)' },
  { id: 'givre', nom: 'Givre', swatch: 'repeating-linear-gradient(118deg, #fff 0 2px, #e3ecf8 2px 7px)' },
  { id: '', nom: 'Actuel (en ligne)', swatch: 'linear-gradient(135deg, #cbbcff, #e3eeff 50%, #bfeef0)' },
];
const enLigne = /(^|\.)flemme\.org$/.test(location.hostname);
const root = document.documentElement;
const lire = () => { try { return localStorage.getItem('flemme.fond'); } catch { return null; } };
function choisir(id: string) {
  if (id) root.dataset.fond = id; else delete root.dataset.fond;
  try { localStorage.setItem('flemme.fond', id); } catch { /* stockage bloqué : le choix vaut pour cette visite */ }
  document.querySelectorAll<HTMLButtonElement>('.fond-list button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.fond === id)));
}

const fond = document.createElement('div');
fond.className = 'fond'; fond.setAttribute('aria-hidden', 'true');
fond.innerHTML = '<i class="b1"></i><i class="b2"></i><i class="b3"></i>';
document.body.prepend(fond);

// --p : 0 en haut de page, 1 en bas. Les formes et les couleurs glissent avec le défilement.
let attente = 0;
const suivre = () => { attente = 0; const max = document.documentElement.scrollHeight - innerHeight; root.style.setProperty('--p', (max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0).toFixed(3)); };
addEventListener('scroll', () => { if (!attente) attente = requestAnimationFrame(suivre); }, { passive: true });
addEventListener('resize', suivre); suivre();

if (!enLigne) {
  const picker = document.createElement('div');
  picker.className = 'fond-picker';
  picker.innerHTML = `<div class="fond-list" id="fondList" hidden><p>Fond de page à essayer. Fais défiler pour voir les variations.</p>${FONDS.map(f => `<button type="button" data-fond="${f.id}" aria-pressed="false"><span class="swatch" style="background:${f.swatch}"></span>${f.nom}</button>`).join('')}</div><button type="button" class="fond-toggle" aria-expanded="false" aria-controls="fondList"><span class="swatch" style="background:${FONDS[0].swatch}"></span>Fond</button>`;
  document.body.append(picker);
  const toggle = picker.querySelector<HTMLButtonElement>('.fond-toggle')!, list = picker.querySelector<HTMLElement>('.fond-list')!;
  toggle.addEventListener('click', () => { list.hidden = !list.hidden; toggle.setAttribute('aria-expanded', String(!list.hidden)); });
  list.addEventListener('click', e => { const b = (e.target as Element).closest<HTMLButtonElement>('button[data-fond]'); if (b) choisir(b.dataset.fond || ''); });
  const saved = lire();
  choisir(saved !== null ? saved : 'glacier');
}
