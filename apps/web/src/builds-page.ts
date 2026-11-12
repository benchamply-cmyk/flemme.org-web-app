import { adresse, buildPR, buildsDepuisPR, DEPOT, FIXES, lireEtat, PAGES, type Build, type PR } from './builds';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const choixBuild = $<HTMLSelectElement>('build'), choixPage = $<HTMLSelectElement>('page');
const cadre = $<HTMLIFrameElement>('cadre'), ouvrir = $<HTMLAnchorElement>('ouvrir'), etat = $<HTMLElement>('etat');
const autre = $<HTMLFormElement>('autre'), numero = $<HTMLInputElement>('numero');
let builds: Build[] = [...FIXES];

const option = (b: Build) => Object.assign(document.createElement('option'), { value: b.id, textContent: b.nom });
function remplir(prs: Build[]) {
  const sel = choixBuild.value || lireEtat(location.hash).build;
  choixBuild.replaceChildren(...FIXES.map(option));
  const groupe = Object.assign(document.createElement('optgroup'), { label: 'Builds des PR vers beta' });
  groupe.append(...prs.map(option));
  if (prs.length) choixBuild.append(groupe);
  builds = [...FIXES, ...prs];
  const m = /^pr(\d+)$/.exec(sel);
  if (m && !builds.some(b => b.id === sel)) { const b = buildPR(+m[1]); builds.push(b); choixBuild.append(option(b)); }
  choixBuild.value = builds.some(b => b.id === sel) ? sel : 'preprod';
}

function afficher() {
  const b = builds.find(x => x.id === choixBuild.value) ?? FIXES[0];
  const url = adresse(b, choixPage.value);
  if (cadre.src !== url) cadre.src = url;
  ouvrir.href = url;
  history.replaceState(null, '', `#build=${b.id}&page=${choixPage.value}`);
  document.title = `${b.nom.split(' · ')[0]} — Builds Flemme`;
}

choixPage.replaceChildren(...PAGES.map(p => Object.assign(document.createElement('option'), { value: p.id, textContent: p.nom })));
const depart = lireEtat(location.hash);
choixPage.value = depart.page;
remplir([]);
afficher();
choixBuild.addEventListener('change', afficher);
choixPage.addEventListener('change', afficher);
autre.addEventListener('submit', e => {
  e.preventDefault();
  const n = Number(numero.value);
  if (!Number.isInteger(n) || n < 1) return;
  if (!builds.some(b => b.id === `pr${n}`)) { const b = buildPR(n); builds.push(b); choixBuild.append(option(b)); }
  choixBuild.value = `pr${n}`; numero.value = ''; afficher();
});

fetch(`https://api.github.com/repos/${DEPOT}/pulls?base=beta&state=all&per_page=50`, { headers: { Accept: 'application/vnd.github+json' } })
  .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
  .then((prs: PR[]) => { remplir(buildsDepuisPR(prs)); afficher(); etat.textContent = `${prs.length} PR vers beta. Une PR fermée sans build récent peut afficher une page Netlify « introuvable ».`; })
  .catch(() => { etat.textContent = 'Liste des PR indisponible (GitHub). Tape un numéro de PR.'; });
