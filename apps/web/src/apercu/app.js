"use strict";
import {
  FOURCHETTES,
  appendDictation,
  budgetLabel,
  filterTasks,
  tarif,
  validateRequest as checkRequest,
} from "./logique.ts";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const key = "flemme-preview-20261104-v1";
let saved;
try {
  saved = JSON.parse(localStorage.getItem(key) || "{}");
} catch {
  saved = {};
}
let state = {
  signed: false,
  role: "flemmard",
  requests: [],
  drafts: [],
  messages: [],
  profile: {
    name: "Camille Martin",
    intro: "J’aime rendre les petits projets plus simples.",
    skills: "Rédaction, organisation, démarches",
    experience: "Deux ans d’accompagnement de projets associatifs.",
  },
  agreement: {},
  ...saved,
};
function persist() {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    toast(
      "Stockage local indisponible : les modifications restent dans cet onglet.",
    );
  }
}
let route = "",
  selected = "1",
  filter = {},
  draft = {},
  draftId = null,
  notice = "",
  supportMessages = [],
  supportHuman = false,
  lastChat = null;
const tasks = [
  {
    id: "1",
    icon: "↗",
    category: "Administratif",
    title: "Remettre mon CV au propre",
    description:
      "J’ai un CV de deux pages que je voudrais rendre plus clair et plus facile à lire. Je peux fournir le document Word et les informations à jour. J’aimerais en discuter avant de fixer le contenu final.",
    place: "À distance",
    city: "",
    delay: "3 jours",
    rank: 3,
    budget: "30–50 €",
    price: 40,
    author: "Léa",
    files: "CV_exemple.docx · document fictif",
    mode: "À distance",
  },
  {
    id: "2",
    icon: "⌂",
    category: "Maison & quotidien",
    title: "Monter une petite bibliothèque",
    description:
      "Les pièces sont déjà sur place. Il faudrait assembler une bibliothèque et vérifier ensemble qu’elle est stable. Les dimensions et la notice seront partagées en privé.",
    place: "Lyon · Croix-Rousse",
    city: "Lyon",
    delay: "Demain",
    rank: 2,
    budget: "À discuter",
    price: null,
    author: "Noé",
    files: "notice.pdf · document fictif",
    mode: "Sur place",
  },
  {
    id: "3",
    icon: "✳",
    category: "Numérique",
    title: "Trier mes photos de vacances",
    description:
      "J’ai beaucoup de doublons et je voudrais préparer une sélection pour un album. Nous définirons ensemble le volume, le rangement et les règles de confidentialité.",
    place: "À distance",
    city: "",
    delay: "1 semaine",
    rank: 7,
    budget: "50–100 €",
    price: 75,
    author: "Inès",
    files: "Aucun fichier public",
    mode: "À distance",
  },
  {
    id: "4",
    icon: "◷",
    category: "Autre",
    title: "M’aider à organiser un anniversaire",
    description:
      "J’ai besoin d’un coup de main pour préparer une liste de tâches et chercher des idées. Le lieu, le nombre de personnes et le résultat attendu seront précisés ensemble.",
    place: "Paris · 11e",
    city: "Paris",
    delay: "1 mois",
    rank: 30,
    budget: "À discuter",
    price: null,
    author: "Alex",
    files: "Aucun fichier public",
    mode: "Les deux",
  },
];
const categories = [
  "Administratif",
  "Maison & quotidien",
  "Numérique",
  "Organisation",
  "Autre",
];
const delays = [
  "Urgent",
  "Aujourd’hui",
  "Demain",
  "3 jours",
  "1 semaine",
  "1 mois",
  "1 an",
  "Autre",
];
const btn = (text, href, cls = "") =>
  `<a class="button ${cls}" href="#${href}">${text}</a>`;
const badge = (text, cls = "") => `<span class="pill ${cls}">${text}</span>`;
// Modèle retenu : 10 % ajoutés au forfait du Brigadier (packages/shared, price() et COMMISSION).
function tarifText(price) {
  let t = tarif(price);
  return t
    ? `Forfait Brigadier <b>${t.forfait}</b> + frais Flemme ${t.taux} <b>${t.frais}</b> = <b>${t.total}</b> payés par le Flemmard. Le Brigadier reçoit ${t.recu}.`
    : "Indique un prix pour voir le total : forfait du Brigadier + 10 % de frais Flemme, payés par le Flemmard.";
}
const tarifBox = (price) =>
  `<div class="info blue" id="tarif" aria-live="polite">${tarifText(price)}</div>`;
function toast(t) {
  $("#toast").textContent = t;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 4500);
}
function go(to) {
  if (location.hash === "#" + to) render();
  else location.hash = to;
}
function page(title, sub, eyebrow = "À toi de jouer") {
  return `<div class="pagehead"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div>`;
}
function taskCard(t) {
  return `<a class="card clickable" href="#task/${t.id}"><div class="topline">${badge(t.category)}<span class="muted">${t.icon}</span></div><h3>${esc(t.title)}</h3><p>${esc(t.description.slice(0, 88))}…</p><div class="meta"><span>⌖ ${t.place}</span><span>◷ Environ ${t.delay.toLowerCase()}</span></div><div class="card-bottom"><span><b>${t.budget}</b><br><span class="muted">Budget indicatif</span></span><span class="arrow">↗</span></div></a>`;
}
// Exemples fictifs qui défilent dans l’accueil (carrousel).
const showcase = [
  { cat: "Administratif", icon: "☕", title: "Ce CV qui attend<br>depuis trois semaines…", place: "À distance", delay: "Environ 3 jours", who: "Sam", reply: "Je peux t’aider. On précise ce dont tu as besoin ?" },
  { cat: "Maison", icon: "⌂", title: "Cette étagère toujours<br>en pièces détachées…", place: "Lyon · Croix-Rousse", delay: "Demain", who: "Nadia", reply: "J’ai une visseuse et une heure samedi matin." },
  { cat: "Numérique", icon: "✳", title: "4 000 photos de vacances<br>jamais triées…", place: "À distance", delay: "Environ 1 semaine", who: "Hugo", reply: "Je te propose une sélection de 80 photos, sans doublons." },
  { cat: "Démarches", icon: "✉", title: "Ce dossier de la CAF<br>qui me fait peur…", place: "À distance", delay: "Environ 1 semaine", who: "Inès", reply: "On le remplit ensemble en visio, pièce par pièce ?" },
  { cat: "Organisation", icon: "◷", title: "L’anniversaire de Léa<br>dans dix jours…", place: "Paris · 11e", delay: "Environ 1 mois", who: "Malik", reply: "Je peux préparer la liste des courses et le planning." },
  { cat: "Quotidien", icon: "✦", title: "Ces cartons du<br>déménagement…", place: "Nantes · Centre", delay: "Ce week-end", who: "Chloé", reply: "Deux heures dimanche, ça te va pour commencer ?" },
];
let showcaseIndex = 0,
  showcaseTimer = null,
  showcasePaused = false;
function showcaseCard(i) {
  let x = showcase[i];
  return `<div class="showcase-slide"><div class="row">${badge("MA FLEMME · " + x.cat.toUpperCase(), "blue")}<span aria-hidden="true">${x.icon}</span></div><div class="taskname">${x.title}</div><div class="mockline"></div><div class="mockline short"></div><div class="meta"><span>${x.place}</span><span>${x.delay}</span></div><div class="mini-reply"><div class="avatar" aria-hidden="true">☺</div><div><p><b>${x.who} · Brigadier</b></p><p>${x.reply}</p></div></div></div>`;
}
function showShowcase(i) {
  let box = $("#showcase");
  if (!box) return;
  showcaseIndex = (i + showcase.length) % showcase.length;
  box.innerHTML = showcaseCard(showcaseIndex);
  document.querySelectorAll(".showcase-dot").forEach((d, n) => {
    if (n === showcaseIndex) d.setAttribute("aria-current", "true");
    else d.removeAttribute("aria-current");
  });
}
function stopShowcase() {
  clearInterval(showcaseTimer);
  showcaseTimer = null;
}
function startShowcase() {
  stopShowcase();
  if (!$("#showcase") || showcasePaused || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  showcaseTimer = setInterval(() => showShowcase(showcaseIndex + 1), 4500);
}
// Les 5 étapes du parcours affichées sur l’accueil : [titre, texte, rôle concerné, icône].
const parcours = [
  ["Le Flemmard publie sa flemme", "Il décrit ce qu’il repousse, avec un budget et un délai indicatifs.", "flemmard", "☕"],
  ["Les Brigadiers postulent", "Ceux que la demande inspire proposent de s’en charger.", "brigadier", "✋"],
  ["Mise en relation en privé", "Une conversation s’ouvre : questions, précisions, prix négocié.", "deux", "✉"],
  ["Préparation d’un contrat", "Résultat attendu, délai, prix et conditions, acceptés par les deux.", "deux", "✍"],
  ["Suivi de la prestation", "Étapes, fichiers et accompagnement jusqu’au résultat.", "deux", "✓"],
];
function home() {
  return `<section class="hero"><div><p class="eyebrow">Le droit d’avoir la flemme.</p><h1>Passe le relais.<br><em>Ou prends-le.</em></h1><p class="lead">Ce que tu repousses, quelqu’un peut t’aider à le faire. Décris ta flemme, échange avec un Brigadier et mettez-vous d’accord.</p><div class="actions">${btn('<span class="cta-text"><b>Déléguer ma flemme</b><small>Je décris ce que je repousse</small></span><span class="cta-arrow" aria-hidden="true">↗</span>', "new", "dark cta")}${btn('<span class="cta-text"><b>Résoudre une flemme</b><small>Je propose mon coup de main</small></span><span class="cta-arrow" aria-hidden="true">↗</span>', "find", "cta green")}</div><p class="smallnote">Une demande libre. Un prix discuté ensemble.</p></div><div class="illustration" role="region" aria-roledescription="carrousel" aria-label="Exemples fictifs de mises en relation"><span class="float-label">Un peu moins à faire ✦</span><div class="visual-card" id="showcase" aria-live="polite">${showcaseCard(showcaseIndex)}</div><div class="showcase-nav"><button type="button" class="showcase-arrow" id="showcase-prev" aria-label="Exemple précédent">←</button><div class="showcase-dots">${showcase.map((x, i) => `<button type="button" class="showcase-dot" data-i="${i}" aria-label="Exemple ${i + 1} : ${esc(x.cat)}" ${i === showcaseIndex ? 'aria-current="true"' : ""}></button>`).join("")}</div><button type="button" class="showcase-arrow" id="showcase-next" aria-label="Exemple suivant">→</button></div></div></section><section class="parcours-wrap" aria-labelledby="parcours-titre"><div class="section-head"><div><p class="eyebrow">Le parcours</p><h2 id="parcours-titre">De la flemme au coup de main, en 5 étapes.</h2></div>${btn("Comment ça marche ↗", "how", "small ghost")}</div><ol class="parcours">${parcours
    .map(
      ([titre, texte, role, icone], i) =>
        `<li class="etape etape-${role}"><div class="etape-tete"><span class="etape-num">${i + 1}</span><span class="etape-icone" aria-hidden="true">${icone}</span></div><span class="etape-role">${role === "flemmard" ? "Flemmard" : role === "brigadier" ? "Brigadier" : "Les deux"}</span><h3>${titre}</h3><p>${texte}</p></li>`,
    )
    .join("")}</ol></section>`;
}
function options(items, value = "", first = "Choisir") {
  return (
    `<option value="">${first}</option>` +
    items
      .map(
        (x) =>
          `<option ${x === value ? "selected" : ""} value="${esc(x)}">${esc(x)}</option>`,
      )
      .join("")
  );
}
function field(label, name, value = "", type = "text", extra = "") {
  return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}></div>`;
}
function area(label, name, value = "", extra = "") {
  return `<div class="field"><label for="${name}">${label}</label><textarea id="${name}" name="${name}" ${extra}>${esc(value)}</textarea></div>`;
}
function select(label, name, items, value = "", first = "Choisir") {
  return `<div class="field"><label for="${name}">${label}</label><select id="${name}" name="${name}">${options(items, value, first)}</select></div>`;
}
function newRequest() {
  return `<a class="back" href="#space/flemmard/drafts">← Mes brouillons</a>${page(draftId !== null || draft.from ? "Reprendre ma flemme" : "La flemme de quoi ?", "Pas besoin d’un brief parfait. Commence avec tes mots.", "Déléguer ma flemme")}<div class="form-layout"><form id="request-form" class="form-panel">${field("Un titre pour ta flemme", "title", draft.title || "", "text", 'required maxlength="120" placeholder="Ex. Remettre mon CV au propre"')}${area("Raconte ce dont tu as besoin", "description", draft.description || "", 'required placeholder="La tâche, ce que tu attends, ce qui te bloque…"')}<div class="row" style="margin-bottom:22px"><button type="button" class="button small ghost" id="dictate">◉ Dicter · simulation</button><span class="muted" style="font-size:11px">Transcription modifiable · micro non activé</span></div><div class="fields">${select("Catégorie", "category", categories, draft.category)}${select("Délai approximatif", "delay", delays, draft.delay, "À discuter")}${field("Si « Autre », précise le délai", "otherDelay", draft.otherDelay || "")}${field("Budget libre en € · facultatif", "budget", draft.budget || "", "number", 'min="0" step="0.01" placeholder="À discuter"')}${select("Ou une fourchette · facultatif", "range", FOURCHETTES, draft.range, "À discuter")}${select("Où se déroule la tâche ?", "mode", ["À distance", "Sur place", "Les deux"], draft.mode || "À distance")}<div id="location-fields" class="field full" ${!draft.mode || draft.mode === "À distance" ? "hidden" : ""}>${field("Ville / secteur · public", "city", draft.city || "", "text", 'placeholder="Ex. Lyon · Croix-Rousse"')}${field("Adresse précise · privée", "address", draft.address || "")}<small>L’adresse précise est réservée aux échanges privés. Elle n’apparaît pas sur la fiche publique.</small></div></div><div class="field"><label for="files">Ajouter des fichiers</label><input id="files" type="file" name="files" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"><small>PDF, JPEG, PNG, Word · 10 Mo max. par fichier dans cet aperçu. Autres formats à cadrer. Seuls les noms sont mémorisés ; aucun fichier n’est envoyé.${draft.fileNames ? "<br>Fichiers précédemment sélectionnés : " + esc(draft.fileNames) : ""}</small></div><p id="form-error" class="error" role="alert"></p><div class="actions"><button class="button dark" type="submit">Envoyer pour validation ↗</button><button class="button" type="button" id="save-draft">Enregistrer le brouillon</button></div><p class="smallnote">${state.signed ? "Compte démo connecté." : "Connexion ou création de compte requise pour envoyer."} Ta demande reste privée jusqu’à validation admin.</p></form><aside class="stack"><div class="card"><p class="eyebrow">Tu gardes la main</p><h3>Une demande. Puis une discussion.</h3><ol class="checklist"><li><b>01 · Décris ta flemme</b>Budget et délai indicatifs, à préciser ensemble.</li><li><b>02 · Examen avant publication</b>Flemme peut demander une correction. Ce contrôle ne garantit pas le résultat.</li><li><b>03 · Échange en privé</b>Choisis à qui parler et négocie le prix.</li><li><b>04 · Prépare un accord</b>Définissez le résultat, les délais et les conditions.</li></ol></div><div class="info">N’ajoute pas d’informations sensibles dans la partie publique. Tu pourras transmettre les détails utiles dans la conversation.</div>${btn("Besoin d’un coup de main ?", "help", "small ghost")}</aside></div>`;
}
function find() {
  return `${page("Une flemme à résoudre ?", "Choisis une demande qui te parle. Les détails et le prix se discutent en privé.", "Espace ouvert aux coups de main")}<div class="searchbar"><input id="search" aria-label="Rechercher une flemme" placeholder="Un mot, une compétence, une envie…" value="${esc(filter.q || "")}"><button id="filter-toggle" class="button" aria-expanded="${filter.open ? "true" : "false"}" aria-controls="filters">☷ Filtres</button><select id="sort" aria-label="Trier les demandes" style="max-width:210px"><option value="delay">Délai le plus proche</option><option value="budget" ${filter.sort === "budget" ? "selected" : ""}>Budget croissant</option></select></div><div id="filters" class="filterbox" ${filter.open ? "" : "hidden"}>${select("Catégorie", "filter-category", categories, filter.category, "Toutes")}${field("Localisation", "filter-city", filter.city || "")}${select("Budget indicatif", "filter-price", ["Moins de 50 €", "50 à 200 €", "Plus de 200 €", "À discuter"], filter.price, "Tous")}${select("Délai approximatif", "filter-delay", delays, filter.delay, "Tous")}<button class="button small ghost" id="clear-filters">Réinitialiser les filtres</button></div><p id="count" class="smallnote" style="margin-bottom:18px"></p><div class="grid" id="results">${tasks.map(taskCard).join("")}</div><p class="smallnote">Exemples fictifs · Seules les demandes validées sont visibles ici. Prix indicatifs hors frais Flemme : 10 % s’ajoutent au forfait convenu.</p>`;
}
function applyFilters() {
  let result = filterTasks(tasks, filter);
  $("#results").innerHTML = result.length
    ? result.map(taskCard).join("")
    : '<div class="card empty">Aucune flemme pour ces critères. Essaie d’élargir les filtres.</div>';
  $("#count").textContent =
    result.length +
    " demande" +
    (result.length > 1 ? "s" : "") +
    " · exemples de démonstration";
}
function taskDetail(id) {
  let t = tasks.find((t) => t.id === id) || tasks[0];
  selected = t.id;
  return `<a class="back" href="#find">← Retour aux flemmes</a><div class="detail-layout"><article class="card detail-copy"><div class="row">${badge(t.category)}${badge("Publication validée · exemple", "green")}</div><h1 style="margin-top:25px">${t.title}</h1><div class="meta"><span>Par ${t.author}</span><span>⌖ ${t.place}</span><span>◷ Environ ${t.delay.toLowerCase()}</span></div><p>${t.description}</p><h2>Les repères pour commencer</h2><div class="listitem"><span>Budget indicatif</span><b>${t.budget}</b></div><div class="listitem"><span>Lieu</span><b>${t.mode}</b></div><div class="listitem"><span>Fichiers illustratifs</span><span>${t.files}</span></div><p class="smallnote">Aucun fichier réel consultable dans cette démo. Une adresse précise éventuelle reste privée.</p></article><aside class="stack"><div class="card"><p class="eyebrow">Ça te parle ?</p><h3>Commence par un message.</h3><p style="margin:15px 0 20px">Pose tes questions, précise tes disponibilités et négocie le prix. Consulter cette fiche n’ouvre aucune conversation.</p><button class="button dark" id="start-chat">Écrire à ${t.author} ↗</button><p class="smallnote">${state.signed ? "Compte démo connecté" : "Connexion requise pour écrire"} · échange privé simulé</p></div><div class="info">Une candidature et un accord passent aussi par un examen admin. Ce suivi ne constitue pas une garantie de résultat.</div>${btn("Comment ça marche ?", "how", "small ghost")}</aside></div>`;
}
function space() {
  return `${page("Un compte. Deux façons d’agir.", "Choisis ton espace. Tu peux changer de rôle à tout moment.", "Mon espace")}<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))"><a class="card clickable" href="#space/flemmard/overview"><span style="font-size:32px">☕</span><h2 style="margin:25px 0 15px">Espace Flemmard</h2><p>Mes demandes, mes brouillons et mes prochaines étapes pour passer le relais.</p><span class="button blue" style="margin-top:25px">Entrer côté Flemmard ↗</span></a><a class="card clickable" href="#space/brigadier/overview"><span style="font-size:32px">↗</span><h2 style="margin:25px 0 15px">Espace Brigadier</h2><p>Mon profil, mes candidatures et les prestations dans lesquelles je m’engage.</p><span class="button" style="margin-top:25px">Entrer côté Brigadier ↗</span></a></div><div class="soft-panel"><div><h3>${state.signed ? "Compte démo connecté" : "Explore librement le compte démo."}</h3><p>Les données restent dans ce navigateur. Aucun compte réel n’est créé.</p></div>${state.signed ? btn("Gérer mon compte", "account", "small") : '<button class="button small" id="demo-login">Entrer avec le compte démo</button>'}</div>`;
}
const draftsFor = (role) =>
  state.drafts
    .map((d, i) => ({ ...d, index: i }))
    .filter(
      (d) => (d.kind === "application" ? "brigadier" : "flemmard") === role,
    );
const menu = [
  ["overview", "Vue d’ensemble"],
  ["requests", "Mes demandes"],
  ["drafts", "Brouillons"],
  ["conversations", "Conversations"],
  ["services", "Prestations"],
  ["files", "Fichiers"],
  ["contracts", "Contrats"],
  ["account", "Mon compte"],
  ["help", "Aide & accompagnement"],
];
function workspace(role, tab) {
  state.role = role;
  persist();
  let brig = role === "brigadier";
  let items = brig
    ? [
        ["overview", "Vue d’ensemble"],
        ["profile", "Mon profil"],
        ["applications", "Candidatures"],
        ["commitments", "Engagements"],
        ...menu.slice(2),
      ]
    : menu;
  return `<div class="row"><div class="pagehead"><p class="eyebrow">Même compte · rôle actif : ${brig ? "Brigadier" : "Flemmard"}</p><h1>Espace ${brig ? "Brigadier" : "Flemmard"}</h1></div><div class="role-switch" role="group" aria-label="Changer d’espace"><a href="#space/flemmard/overview" class="${brig ? "" : "active"}" ${brig ? "" : 'aria-current="page"'}>☕ Flemmard</a><a href="#space/brigadier/overview" class="${brig ? "active" : ""}" ${brig ? 'aria-current="page"' : ""}>↗ Brigadier</a></div></div><div class="workspace"><nav class="sidebar" aria-label="Menu espace ${role}">${items.map(([id, label]) => `<a class="${tab === id ? "active" : ""}" ${tab === id ? 'aria-current="page"' : ""} href="#${id === "account" ? "account" : id === "help" ? "help" : "space/" + role + "/" + id}">${label}</a>`).join("")}</nav><section>${workspaceContent(role, tab)}</section></div>`;
}
function requestRows() {
  return (
    state.requests
      .map(
        (r, i) =>
          `<div class="listitem"><div><h3>${esc(r.title)}</h3><p>${esc(r.status || "En attente de validation admin")} · Privée · ${esc(budgetLabel(r))} · ${esc(r.delay === "Autre" ? r.otherDelay : r.delay || "Délai à discuter")}</p></div>${btn("Modifier", "edit/" + i, "small ghost")}</div>`,
      )
      .join("") +
    (state.correctionSent
      ? ""
      : `<div class="listitem"><div><h3>Organiser mes documents administratifs</h3><p>Correction demandée · Préciser le résultat attendu · Privée</p></div>${btn("Corriger", "correct", "small ghost")}</div>`) +
    `<div class="listitem"><div><h3>Remettre mon CV au propre</h3><p>Publiée · Discussion en cours · Exemple fictif</p></div>${btn("Voir les échanges", "chat/1", "small ghost")}</div>`
  );
}
function workspaceContent(role, tab) {
  let brig = role === "brigadier";
  if (tab === "overview")
    return `<div class="metrics"><div class="metric"><b>${brig ? "2" : state.requests.length + 2}</b><span>${brig ? "Candidatures" : "Demandes suivies"}</span></div><div class="metric"><b>1</b><span>Prochaine action</span></div><div class="metric"><b>${draftsFor(role).length}</b><span>Brouillons</span></div></div><div class="info blue"><b>Ta prochaine action</b><p>${brig ? "Complète ton profil et précise les livrables de ta candidature." : state.correctionSent ? "Ta demande corrigée attend un nouvel examen. Tu peux en déposer une autre." : "Précise le résultat attendu pour ta demande en correction."}</p>${btn(brig ? "Compléter mon profil" : state.correctionSent ? "Déléguer une flemme" : "Corriger ma demande", brig ? "space/brigadier/profile" : state.correctionSent ? "new" : "correct", "small")}</div><div class="card"><div class="section-head"><h3>${brig ? "Mes candidatures récentes" : "Mes demandes"}</h3>${btn(brig ? "Explorer" : "＋ Ajouter", "" + (brig ? "find" : "new"), "small ghost")}</div>${brig ? applicationRows() : requestRows()}</div>`;
  if (tab === "requests")
    return `<div class="section-head"><h2>Mes demandes</h2>${btn("＋ Ajouter une demande", "new", "small dark")}</div><div class="card">${requestRows()}</div>`;
  if (tab === "drafts")
    return `<div class="section-head"><h2>Mes brouillons</h2>${btn("＋ Nouveau brouillon", "new", "small")}</div><div class="card">${
      draftsFor(role).length
        ? draftsFor(role)
            .map(
              (d) =>
                `<div class="listitem"><div><h3>${esc(d.title || "Sans titre")}</h3><p>Privé · ${d.kind === "application" ? "Candidature" : "Demande"} · sauvegardé dans ce navigateur</p></div>${btn("Reprendre", d.kind === "application" ? "application/draft-" + d.index : "draft/" + d.index, "small ghost")}</div>`,
            )
            .join("")
        : "<p>Aucun brouillon pour le moment. Tu peux commencer une demande et la reprendre plus tard.</p>"
    }</div>`;
  if (tab === "profile") return profile();
  if (tab === "applications")
    return `<h2 style="margin-bottom:22px">Mes candidatures</h2><div class="card">${applicationRows()}</div>`;
  if (tab === "commitments")
    return `<h2 style="margin-bottom:22px">Mes engagements</h2><div class="card"><h3>Trier une photothèque</h3><p style="margin:14px 0">Résultat convenu : sélection de 80 photos sans doublons. Prestation en cours · exemple fictif.</p>${badge("Accord préparé · simulation", "blue")}<div style="margin-top:20px">${btn("Ouvrir le suivi", "chat/3", "small")}</div></div>`;
  if (tab === "conversations")
    return `<h2 style="margin-bottom:22px">Mes conversations</h2><div class="card"><a class="listitem" href="#chat/1"><div><h3>Léa · Remettre mon CV au propre</h3><p>Une question sur le résultat attendu · conversation démo</p></div><span>↗</span></a></div>`;
  if (tab === "services")
    return `<h2 style="margin-bottom:22px">Mes prestations</h2><div class="card"><div class="listitem"><div><h3>Trier une photothèque</h3><p>En cours · Point d’étape à organiser · démo</p></div>${btn("Suivre", "chat/3", "small ghost")}</div><div class="listitem"><div><h3>Mettre au propre un dossier associatif</h3><p>Terminée · exemple fictif</p></div>${btn("Voir la mission", "mission", "small ghost")}</div></div>`;
  if (tab === "files")
    return `<h2 style="margin-bottom:22px">Mes fichiers</h2><div class="info">Cet aperçu conserve uniquement les noms des fichiers sélectionnés. Aucun fichier n’est transféré ou hébergé.</div><div class="card"><div class="listitem"><div><h3>CV_exemple.docx</h3><p>Conversation avec Léa · fichier fictif non téléchargeable</p></div>${badge("Privé")}</div>${state.requests
      .filter((r) => r.fileNames)
      .map(
        (r) =>
          `<div class="listitem"><div><h3>${esc(r.fileNames)}</h3><p>${esc(r.title)} · noms seulement</p></div></div>`,
      )
      .join("")}</div>`;
  if (tab === "contracts")
    return `<h2 style="margin-bottom:22px">Mes contrats</h2><div class="card"><h3>Remettre mon CV au propre</h3><p style="margin:14px 0">${esc(state.agreement.status || "Brouillon d’accord · à compléter")}</p>${btn("Préparer l’accord", "agreement/1", "small dark")}<p class="smallnote">Préparation et signature représentées à titre de démonstration. Aucun contrat juridiquement signé.</p></div>`;
  return "";
}
function applicationRows() {
  return `<div class="listitem"><div><h3>Remettre mon CV au propre</h3><p>${state.applicationStatus || "Correction demandée · Préciser le périmètre"} · démo</p></div>${btn("Reprendre", "application", "small ghost")}</div><div class="listitem"><div><h3>Préparer un dossier associatif</h3><p>En attente de validation admin · Non transmise · démo</p></div>${badge("À examiner", "amber")}</div>`;
}
function profile() {
  let p = state.profile;
  return `<div class="card"><div class="profile-row"><div class="avatar lg" role="img" aria-label="Photo de profil illustrative">☺</div><div><h2>${esc(p.name)}</h2><p>Profil simple · Brigadier</p><span class="stars">★★★★★</span><p>5/5 · 1 mission terminée fictive</p></div></div><form id="profile-form">${field("Nom affiché", "name", p.name)}<div class="field"><label for="photo">Photo de profil</label><input type="file" id="photo" accept="image/jpeg,image/png"><small>Aperçu local uniquement, sans transfert.</small></div>${area("Présentation", "intro", p.intro)}${field("Compétences", "skills", p.skills)}${area("Expériences", "experience", p.experience)}<button class="button dark">Enregistrer mon profil</button></form></div><div class="card" style="margin-top:20px"><h3>Recommandation liée à une mission</h3><p style="margin-top:15px">« Un dossier clair et rendu dans le délai convenu. »</p><p class="smallnote">Alex · Mettre au propre un dossier associatif · mission terminée fictive. Aucune note réelle attribuée.</p>${btn("Voir la mission associée", "mission", "small ghost")}</div>`;
}
function login(next) {
  return `${page("On passe en privé.", "Connecte-toi ou crée un compte pour envoyer ta demande ou commencer une discussion.", "Compte de démonstration")}<div class="form-layout"><div class="form-panel"><div class="info amber">Cet écran simule l’authentification. Aucun identifiant réel ni mot de passe ne sont demandés. Aucun compte réel n’est créé.</div><h2 style="margin-bottom:20px">Choisis ton parcours démo</h2><div class="stack"><button class="button dark" id="login-existing" data-next="${esc(next)}">Simuler la connexion</button><button class="button" id="login-new" data-next="${esc(next)}">Simuler la création de compte</button></div></div><div class="card"><h3>Un seul compte, deux espaces.</h3><p style="margin-top:15px">Espace Flemmard pour déléguer. Espace Brigadier pour proposer ton aide. La bascule reste disponible à tout moment.</p></div></div>`;
}
function chat(id) {
  let t = tasks.find((t) => t.id === id) || tasks[0];
  selected = t.id;
  lastChat = t.id;
  let other = state.role === "flemmard" ? "Sam" : t.author,
    otherRole = state.role === "flemmard" ? "Brigadier" : "Flemmard",
    myRole = state.role === "flemmard" ? "Flemmard" : "Brigadier";
  return `<a class="back" href="#space/${state.role}/conversations">← Mes conversations</a>${page(t.title, "Conversation privée de démonstration · rien n’est envoyé à une autre personne.", "Échanger avant de s’engager")}<div class="conversation"><div class="chatbox"><div class="chat-head"><div class="avatar">L</div><div><b>${other} · ${otherRole}</b><p class="smallnote" style="margin:3px 0 0">Demande publiée · exemple fictif</p></div></div><div class="messages"><div class="message"><small>${other} · exemple</small>Bonjour ! Je voudrais qu’on précise ensemble le résultat attendu et le délai avant de se mettre d’accord.</div><div class="message mine"><small>Toi · ${myRole} · exemple</small>Oui. On peut partir d’un document modifiable et prévoir une relecture ensemble.</div>${state.messages
    .filter((m) => m.task === id)
    .map(
      (m) =>
        `<div class="message mine"><small>Toi · enregistré localement</small>${esc(m.text)}</div>`,
    )
    .join(
      "",
    )}</div><form id="message-form" class="composer">${area("Ton message privé", "message", "", 'required placeholder="Une question, une précision, une proposition…"')}<div class="row"><button class="button dark small">Envoyer · simulation</button><label class="button small ghost" for="chat-file">＋ Fichier</label><input type="file" id="chat-file" hidden></div><p class="smallnote" id="chat-file-name"></p></form></div><aside class="stack"><div class="card"><p class="eyebrow">Le fil de la mission</p><h3>On avance à votre rythme.</h3><ol class="checklist"><li><b>1 · Échanger</b>Questions et négociation en privé.</li><li><b>2 · Candidature</b>${esc(state.applicationStatus || "À préparer · examen admin requis")}${btn("Préparer ma candidature", "application", "small ghost")}</li><li><b>3 · Accord</b>${esc(state.agreement.status || "À définir ensemble")}${btn("Préparer un accord", "agreement/" + id, "small blue")}</li><li><b>4 · Paiement futur</b>Forfait convenu + 10 % de frais Flemme, payés par le Flemmard. Prestataire externe à brancher : aucun encaissement ici.</li></ol></div><div class="support"><b>Un doute ou un blocage ?</b><p>Commence avec l’assistant, puis demande une personne Flemme.</p>${btn("Ouvrir l’accompagnement", "help", "small")}</div></aside></div>`;
}
function application() {
  let d = state.application || {};
  return `<a class="back" href="#chat/${selected}">← Revenir à la conversation</a>${page("Proposer mon aide", "Ta candidature reste à examiner avant d’être transmise.", "Espace Brigadier")}<div class="form-layout"><form id="application-form" class="form-panel">${area("Ce qui est inclus et le résultat proposé", "scope", d.scope || "", "required")}${field("Disponibilités / délai approximatif", "slot", d.slot || "", "text", "required")}${field("Prix proposé en € · à négocier", "price", d.price || "", "number", 'min="0" step="0.01" required')}${tarifBox(d.price)}<div class="info amber">Correction demandée dans cet exemple : précise le nombre de retours inclus. Le contrôle admin ne garantit pas la qualité de la prestation.</div><div class="actions"><button class="button dark">Envoyer pour examen admin</button><button type="button" class="button" id="draft-application">Sauvegarder le brouillon</button></div></form><div class="card"><h3>Pas d’engagement financier ici.</h3><p style="margin-top:15px">Aucun paiement d’engagement Brigadier. Le prix est discuté entre les deux utilisateurs. Tu reçois le forfait convenu ; les frais Flemme de 10 % s’y ajoutent côté Flemmard.</p></div></div>`;
}
function agreement(id) {
  let a = state.agreement;
  return `<a class="back" href="#chat/${id}">← Revenir à la conversation</a>${page("On se met d’accord sur quoi ?", "Une trame à compléter ensemble avant toute prestation.", "Préparation de l’accord")}<div class="form-layout"><form id="agreement-form" class="form-panel"><div class="info amber">Simulation uniquement. Aucune signature juridique réelle. Le futur prestataire de paiement reste à choisir.</div>${area("Tâche et résultat attendu", "scope", a.scope || "Remettre le CV au propre dans un document modifiable.", "required")}${area("Qualité et critères d’acceptation", "quality", a.quality || "Informations relues ensemble, mise en page lisible, un retour inclus.", "required")}${field("Délai convenu", "deadline", a.deadline || "À convenir ensemble", "text", "required")}${field("Prix négocié en € · forfait du Brigadier", "price", a.price || "40", "number", 'min="0" step="0.01" required')}${tarifBox(a.price || "40")}${area("Annulation et remboursement", "cancellation", a.cancellation || "À définir ensemble avant de signer. Aucune règle ni remboursement automatique dans cet aperçu.", "required")}${area("Confidentialité et fichiers", "confidentiality", a.confidentiality || "Documents partagés uniquement pour la tâche. Durée de conservation et modalités à préciser.", "required")}<div class="info">Commission <b>retenue</b> : 10 % ajoutés au forfait. Acompte 50 %, retenue 20 % et délai d’annulation proportionnel : <b>pistes non arrêtées</b>. Aucun montant n’est exigé.</div><div class="actions"><button class="button dark">Soumettre au contrôle admin · démo</button><button class="button" type="button" id="save-agreement">Sauvegarder le brouillon</button></div><div class="status-track"><span class="done"></span><span class="${a.status ? "done" : ""}"></span><span></span></div><p class="smallnote">Statut : ${esc(a.status || "Brouillon à compléter")}</p></form><aside class="stack"><div class="card"><h3>Les étapes avant la mission</h3><ol class="checklist"><li><b>Préparation conjointe</b>Résultat, qualité, délai, prix et conditions.</li><li><b>Contrôle admin</b>Correction possible, sans garantie de résultat.</li><li><b>Signature représentée</b>Un parcours de démonstration distinct de toute signature juridique.</li></ol><button class="button small" id="simulate-review" ${a.status ? "" : "disabled"}>Simuler le retour admin</button></div>${a.reviewed ? `<div class="card"><h3>Retour admin simulé</h3><p style="margin:15px 0">Trame examinée pour cette démo. Précisez les conditions d’annulation avant toute utilisation réelle.</p><button class="button blue" id="simulate-sign">Représenter les deux signatures</button><p class="smallnote">${a.signed ? "Deux signatures représentées · aucune valeur juridique réelle." : "Aucune signature juridique ne sera créée."}</p></div>` : ""}<div class="card"><h3>Paiement · emplacement futur</h3><p style="margin-top:15px">Un prestataire externe pourra être proposé ici et dans la conversation. Montant prévu : forfait + 10 % de frais Flemme.</p><button class="button small" disabled style="margin-top:15px">Paiement non disponible</button></div></aside></div>`;
}
function help() {
  return `${lastChat ? `<a class="back" href="#chat/${lastChat}">← Revenir à la conversation</a>` : `<a class="back" href="#home">← Accueil</a>`}${page("Tu n’as pas à rester bloqué.", "Assistant d’abord, personne Flemme ensuite si nécessaire.", "Aide & accompagnement")}<div class="conversation"><div class="chatbox"><div class="chat-head"><div class="avatar">✦</div><div><b>Assistant Flemme · simulation</b><p class="smallnote" style="margin:0">Réponses prédéfinies · aucun chatbot connecté</p></div></div><div class="messages"><div class="message">Je peux t’aider à préciser une demande, préparer un accord ou comprendre une étape. Qu’est-ce qui te bloque ?</div>${supportMessages.map((m) => `<div class="message ${m.mine ? "mine" : ""}">${esc(m.text)}</div>`).join("")}</div><form class="composer" id="support-form">${area("Décris ton besoin", "support-message", "", "required")}<button class="button dark small">Demander de l’aide · démo</button></form></div><aside class="card"><h3>Besoin d’une personne ?</h3><p style="margin:15px 0">Une personne Flemme pourra prendre le relais, initialement le fondateur. Le téléphone support est reporté.</p><button class="button" id="human-help">Solliciter une personne Flemme</button>${supportHuman ? '<div class="info blue" style="margin-top:20px">Demande simulée : aucun message envoyé au fondateur. Statut démo : en attente de prise en charge.</div>' : ""}<p class="smallnote">Aucun délai de réponse garanti.</p></aside></div>`;
}
function how() {
  return `${page("Moins à porter. Plus clair pour chacun.", "Une mise en relation, des échanges et un accord explicite.", "Comment ça marche")}<div class="detail-layout"><article class="card">${[
    [
      "Tu décris ta flemme",
      "Raconte la tâche, choisis un délai approximatif et, si tu veux, un budget. Connecte-toi pour envoyer.",
    ],
    [
      "Les Brigadiers proposent",
      "Les Brigadiers étudient ta demande et proposent de s’en charger : ils postulent à ton annonce.",
    ],
    [
      "Vous échangez en privé",
      "Une conversation privée se crée entre vous. Le Brigadier pose ses questions pour bien comprendre la demande et confirmer sa candidature. Le prix se négocie entre vous. La candidature passe par un examen admin.",
    ],
    [
      "Vous préparez un accord",
      "Tâche, résultat, qualité, critères d’acceptation, délai, prix, annulation, remboursement et confidentialité. Contrôle admin puis parcours de signature représenté dans cet aperçu.",
    ],
    [
      "Vous suivez la prestation",
      "Conversations, fichiers, contrats, étapes et assistance dans vos espaces respectifs. Les avis sont liés à des missions réellement effectuées dans le service cible.",
    ],
  ]
    .map(
      ([h, p], i) =>
        `<div class="step"><span class="step-number">${i + 1}</span><div><h3>${h}</h3><p>${p}</p></div></div>`,
    )
    .join(
      "",
    )}</article><aside class="stack"><div class="info amber">Flemme met en relation. Les contrôles admin ne constituent pas une promesse de résultat, d’assurance ou de remboursement.</div><div class="card"><h3>Confidentialité</h3><p style="margin:15px 0">La ville ou le secteur peuvent être publics. L’adresse précise et les échanges restent privés dans le parcours prévu.</p>${btn("Comprendre la confidentialité", "privacy", "small")}</div><div class="support"><h3>Un accompagnement accessible</h3><p>Depuis la conversation, commence avec l’assistant puis sollicite une personne Flemme.</p>${btn("Voir l’aide", "help", "small")}</div></aside></div>`;
}
function faq() {
  return `${page("Les questions qu’on se pose.", "", "Questions fréquentes")}<div class="card prose">${[
    [
      "Qu’est-ce que je peux déléguer ?",
      "Des demandes variées, décrites librement, sans catalogue imposé. La recevabilité est examinée avant publication. Les catégories servent à s’orienter.",
    ],
    [
      "Qui fixe le prix ?",
      "Les utilisateurs discutent et négocient le prix entre eux. Le budget de la demande est facultatif : s’il est vide, il apparaît « À discuter ». Flemme ajoute 10 % de frais au forfait convenu, payés par le Flemmard : le Brigadier reçoit le forfait entier.",
    ],
    [
      "Ma demande est-elle immédiatement publique ?",
      "Non. Après envoi depuis un compte, elle reste en attente d’une validation admin. Une correction peut être demandée.",
    ],
    [
      "Puis-je être Flemmard et Brigadier ?",
      "Oui. Le même compte donne accès à deux espaces distincts, avec une bascule visible. Chaque espace conserve ses fonctions personnelles.",
    ],
    [
      "Quand une conversation s’ouvre-t-elle ?",
      "Uniquement quand tu choisis d’écrire. Lire une fiche n’ouvre pas automatiquement une conversation.",
    ],
    [
      "Puis-je payer ou signer dans cet aperçu ?",
      "Non. Les signatures sont représentées sans valeur juridique réelle. Aucun paiement n’est connecté. Les frais sont fixés (10 % ajoutés au forfait) ; le prestataire de paiement et les modalités d’acompte restent à définir.",
    ],
    [
      "Flemme garantit-il la prestation ?",
      "Non. Le suivi, les contrôles admin et l’accompagnement ne constituent pas une garantie de résultat, de sécurité, d’assurance ou de remboursement.",
    ],
    [
      "Que deviennent les fichiers dans la démo ?",
      "Seuls leurs noms peuvent être conservés localement. Aucun contenu de fichier n’est envoyé. Les autres formats et les règles finales de stockage restent à cadrer.",
    ],
  ]
    .map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`)
    .join("")}</div>`;
}
function privacy() {
  return `${page("Le bon détail, au bon endroit.", "", "Confidentialité")}<div class="card prose"><h2>Public pour se repérer</h2><p>Après validation, le titre, la description, la catégorie, le délai approximatif, le budget indicatif, la ville ou le secteur permettent de comprendre une demande. Évite d’y mettre des informations sensibles.</p><h2>Privé pour avancer</h2><p>Adresse précise, conversations, documents et accord sont prévus dans le parcours privé. Cette maquette représente leur emplacement, sans tester de contrôle d’accès réel.</p><h2>Dans cet aperçu local</h2><p>Les données fictives et les saisies sont enregistrées dans ce navigateur. Aucun compte réel, message externe, téléversement de fichier ou paiement n’est effectué. La photo de profil éventuelle n’est affichée que pendant la session.</p><div class="info amber">Il s’agit d’une explication du parcours envisagé, pas d’une politique juridique finalisée. Les droits d’accès, la conservation des données et les formats de fichiers devront être cadrés avant une mise en service.</div></div>`;
}
function account() {
  return `${page("Mon compte", "Un compte partagé par les espaces Flemmard et Brigadier.", "Paramètres")}<div class="form-layout"><form id="account-form" class="form-panel">${field("Nom affiché", "account-name", state.profile.name)}<div class="info">Identité de démonstration. E-mail, mot de passe, récupération et authentification ne sont pas connectés.</div><button class="button dark">Enregistrer localement</button></form><div class="card"><h3>Mes deux espaces</h3><div class="stack" style="margin-top:20px">${btn("Espace Flemmard", "space/flemmard/overview")}${btn("Espace Brigadier", "space/brigadier/overview")}</div><p class="smallnote">${state.signed ? "Connecté au compte démo" : "Exploration sans connexion réelle"}</p></div><div class="card"><h3>Repartir de zéro</h3><p style="margin:15px 0">Efface les demandes, brouillons, messages et accords de cet aperçu dans ce navigateur.</p><button class="button small" type="button" id="reset-demo">Réinitialiser la démo</button></div></div>`;
}
function correct() {
  draft = {
    title: "Organiser mes documents administratifs",
    description:
      "Je veux trier mes documents et préparer des dossiers faciles à retrouver.",
    category: "Administratif",
    mode: "À distance",
    from: "correction",
  };
  draftId = null;
  return (
    `<div class="info amber"><b>Correction demandée · démo</b><p>Précise le volume de documents et le résultat attendu. La demande reste privée avant un nouvel examen.</p></div>` +
    newRequest()
  );
}
function render() {
  route = location.hash.slice(1) || "home";
  let parts = route.split("/"),
    html = "";
  switch (parts[0]) {
    case "home":
      html = home();
      break;
    case "new":
      draft = {};
      draftId = null;
      html = newRequest();
      break;
    case "correct":
      html = correct();
      break;
    case "edit": {
      let r = state.requests[Number(parts[1])];
      draft = r ? { ...r, from: "request-" + parts[1] } : {};
      draftId = null;
      html = newRequest();
      break;
    }
    case "draft":
      draft = { ...state.drafts[Number(parts[1])] };
      draftId = state.drafts[Number(parts[1])] ? Number(parts[1]) : null;
      html = newRequest();
      break;
    case "find":
      html = find();
      break;
    case "task":
      html = taskDetail(parts[1]);
      break;
    case "space":
      html = parts[1] ? workspace(parts[1], parts[2] || "overview") : space();
      break;
    case "login":
      html = login(parts.slice(1).join("/") || "space");
      break;
    case "chat":
      html = chat(parts[1] || "1");
      break;
    case "application":
      if (parts[1]?.startsWith("draft-")) {
        state.applicationDraft = Number(parts[1].slice(6));
        state.application = state.drafts[state.applicationDraft];
      }
      html = application();
      break;
    case "agreement":
      html = agreement(parts[1] || selected);
      break;
    case "help":
      html = help();
      break;
    case "how":
      html = how();
      break;
    case "faq":
      html = faq();
      break;
    case "privacy":
      html = privacy();
      break;
    case "account":
      html = account();
      break;
    case "mission":
      html =
        page(
          "Une mission terminée",
          "Exemple fictif lié à la recommandation du profil.",
          "Historique de prestation",
        ) +
        '<div class="card prose"><h2>Mettre au propre un dossier associatif</h2><p>Résultat prévu : document modifiable, informations structurées et relecture avec Alex.</p><p>Statut illustratif : prestation terminée · Note 5/5 · Aucun avis réel enregistré.</p>' +
        btn("Voir le profil Brigadier", "space/brigadier/profile") +
        "</div>";
      break;
    case "sent":
      html =
        page(
          "Ta flemme est en attente.",
          "Elle n’est pas publique. Tu peux suivre son examen dans ton espace.",
          "Envoi simulé",
        ) +
        '<div class="card prose">' +
        badge("En attente de validation admin", "amber") +
        '<h2 style="margin:25px 0">La suite se passe ici.</h2><p>Un administrateur examinera la demande dans le service prévu. Dans cette démo, aucune personne n’a été contactée et aucune publication ne sera faite.</p><div style="margin-top:22px">' +
        btn("Suivre mes demandes", "space/flemmard/requests", "dark") +
        "</div></div>";
      break;
    default:
      html = home();
  }
  stopShowcase();
  showcasePaused = false;
  $("#main").innerHTML = html;
  bind();
  startShowcase();
  if (parts[0] === "find") applyFilters();
  if (notice) {
    toast(notice);
    notice = "";
  }
}
function getForm(id) {
  return Object.fromEntries(new FormData($(id)).entries());
}
function readRequest() {
  let d = getForm("#request-form");
  delete d.files;
  let files = $("#files").files;
  d.fileNames = files.length
    ? [...files].map((f) => f.name).join(", ")
    : draft.fileNames || "";
  if (d.mode === "À distance") {
    d.city = "";
    d.address = "";
  }
  if (draft.from) d.from = draft.from;
  return d;
}
function validateRequest(d) {
  return checkRequest(d, [...$("#files").files]);
}
function saveDraft() {
  let d = readRequest();
  if (typeof draftId === "number") state.drafts[draftId] = { ...d };
  else state.drafts.push({ ...d });
  draft = { ...d };
  if (typeof draftId !== "number") draftId = state.drafts.length - 1;
  persist();
  toast("Brouillon enregistré dans ce navigateur.");
}
function submitRequest() {
  let d = readRequest(),
    error = validateRequest(d);
  if (error) {
    $("#form-error").textContent = error;
    return;
  }
  draft = { ...d };
  if (!state.signed) {
    // Gardée dans le navigateur : un rechargement de l’écran de connexion ne perd pas la demande.
    state.pending = { draft: d };
    persist();
    go("login/submit-request");
    return;
  }
  finishRequest();
}
function finishRequest() {
  let src = state.pending?.draft || draft;
  delete state.pending;
  if (!src.title) {
    persist();
    go("new");
    return;
  }
  let { from, ...data } = src,
    record = { ...data, status: "En attente de validation admin" },
    index = from?.startsWith("request-") ? Number(from.slice(8)) : -1;
  if (index >= 0 && state.requests[index]) state.requests[index] = record;
  else state.requests.push(record);
  if (from === "correction") state.correctionSent = true;
  persist();
  draft = {};
  draftId = null;
  go("sent");
}
function bind() {
  let on = (id, event, fn) => {
    let e = $(id);
    if (e) e.addEventListener(event, fn);
  };
  on("#request-form", "submit", (e) => {
    e.preventDefault();
    submitRequest();
  });
  on("#save-draft", "click", saveDraft);
  on("#dictate", "click", () => {
    $("#description").value = appendDictation(
      $("#description").value,
      "Exemple de transcription : j’aimerais de l’aide pour remettre mon CV au propre, avec une version modifiable et une relecture.",
    );
    toast(
      "Transcription d’exemple insérée. Tu peux la modifier. Aucun micro utilisé.",
    );
  });
  on("#mode", "change", () => {
    $("#location-fields").hidden = $("#mode").value === "À distance";
  });
  on("#filter-toggle", "click", () => {
    filter.open = !filter.open;
    $("#filters").hidden = !filter.open;
    $("#filter-toggle").setAttribute("aria-expanded", String(filter.open));
  });
  on("#search", "input", () => {
    filter.q = $("#search").value;
    applyFilters();
  });
  for (let [id, k] of [
    ["category", "category"],
    ["city", "city"],
    ["price", "price"],
    ["delay", "delay"],
  ])
    on("#filter-" + id, id === "city" ? "input" : "change", () => {
      filter[k] = $("#filter-" + id).value;
      applyFilters();
    });
  on("#sort", "change", () => {
    filter.sort = $("#sort").value;
    applyFilters();
  });
  on("#clear-filters", "click", () => {
    filter = { open: true };
    render();
  });
  on("#start-chat", "click", () => {
    if (state.signed) {
      state.role = "brigadier";
      persist();
      go("chat/" + selected);
    } else go("login/chat/" + selected);
  });
  on("#demo-login", "click", () => {
    state.signed = true;
    persist();
    render();
    toast("Connexion démo activée. Aucun compte réel créé.");
  });
  for (let id of ["#login-existing", "#login-new"])
    on(id, "click", (e) => {
      state.signed = true;
      persist();
      let next = e.currentTarget.dataset.next;
      if (next === "submit-request") finishRequest();
      else {
        if (next.startsWith("chat/")) state.role = "brigadier";
        go(next);
      }
      notice =
        id === "#login-new"
          ? "Création de compte simulée."
          : "Connexion simulée.";
    });
  on("#message-form", "submit", (e) => {
    e.preventDefault();
    let text = $("#message").value.trim();
    if (!text) return;
    state.messages.push({ task: selected, text });
    persist();
    render();
    toast("Message enregistré localement. Rien n’a été envoyé.");
  });
  on("#chat-file", "change", () => {
    $("#chat-file-name").textContent =
      "Fichier sélectionné : " +
      [...$("#chat-file").files].map((f) => f.name).join(", ") +
      " · aucun transfert";
  });
  on("#profile-form", "submit", (e) => {
    e.preventDefault();
    state.profile = getForm("#profile-form");
    persist();
    toast("Profil enregistré localement.");
  });
  on("#photo", "change", () => {
    let f = $("#photo").files[0];
    if (f) {
      let avatar = $(".avatar.lg");
      avatar.innerHTML = "";
      let img = document.createElement("img");
      img.src = URL.createObjectURL(f);
      img.alt = "Photo de profil sélectionnée localement";
      img.style = "width:100%;height:100%;object-fit:cover;border-radius:50%";
      avatar.appendChild(img);
      toast("Photo affichée pour cette session uniquement.");
    }
  });
  on("#account-form", "submit", (e) => {
    e.preventDefault();
    state.profile.name = $("#account-name").value;
    persist();
    toast("Nom enregistré localement.");
  });
  on("#application-form", "submit", (e) => {
    e.preventDefault();
    state.application = getForm("#application-form");
    state.applicationStatus = "En attente de validation admin · non transmise";
    persist();
    go("space/brigadier/applications");
    notice =
      "Candidature soumise pour examen simulé. Aucun destinataire contacté.";
  });
  on("#draft-application", "click", () => {
    state.application = getForm("#application-form");
    let record = {
      ...state.application,
      kind: "application",
      title: "Candidature · Remettre mon CV au propre",
    };
    if (state.drafts[state.applicationDraft]?.kind === "application")
      state.drafts[state.applicationDraft] = record;
    else {
      state.drafts.push(record);
      state.applicationDraft = state.drafts.length - 1;
    }
    persist();
    toast("Brouillon de candidature enregistré localement.");
  });
  function saveAgreement() {
    state.agreement = { ...state.agreement, ...getForm("#agreement-form") };
    persist();
  }
  on("#save-agreement", "click", () => {
    saveAgreement();
    toast("Brouillon d’accord enregistré localement.");
  });
  on("#agreement-form", "submit", (e) => {
    e.preventDefault();
    saveAgreement();
    state.agreement.status = "En attente de contrôle admin · simulation";
    state.agreement.reviewed = false;
    state.agreement.signed = false;
    persist();
    render();
    toast("Accord en attente d’un examen simulé.");
  });
  on("#simulate-review", "click", () => {
    state.agreement.reviewed = true;
    state.agreement.status =
      "Examiné pour la démonstration · conditions à préciser";
    persist();
    render();
  });
  on("#simulate-sign", "click", () => {
    state.agreement.signed = true;
    state.agreement.status =
      "Deux signatures représentées · sans valeur juridique";
    persist();
    render();
    toast("Signatures représentées. Aucun contrat juridiquement signé.");
  });
  for (let form of ["#agreement-form", "#application-form"])
    on(form + " [name=price]", "input", (e) => {
      $("#tarif").innerHTML = tarifText(e.target.value);
    });
  on("#reset-demo", "click", (e) => {
    // Confirmation dans la page : confirm() est bloqué dans certains cadres (artefact, aperçus intégrés).
    let b = e.currentTarget;
    if (!b.dataset.armed) {
      b.dataset.armed = "1";
      b.textContent = "Confirmer : tout effacer";
      b.classList.add("dark");
      return;
    }
    try {
      localStorage.removeItem(key);
    } catch {}
    location.hash = "home";
    location.reload();
  });
  on("#showcase-prev", "click", () => {
    showShowcase(showcaseIndex - 1);
    startShowcase();
  });
  on("#showcase-next", "click", () => {
    showShowcase(showcaseIndex + 1);
    startShowcase();
  });
  document.querySelectorAll(".showcase-dot").forEach((d) =>
    d.addEventListener("click", () => {
      showShowcase(Number(d.dataset.i));
      startShowcase();
    }),
  );
  on("#showcase", "click", () => {
    showShowcase(showcaseIndex + 1);
    startShowcase();
  });
  let carousel = $(".illustration");
  if (carousel) {
    // Pause tant que la souris ou le focus clavier est sur le carrousel.
    let pause = (on) => () => {
      showcasePaused = on;
      on ? stopShowcase() : startShowcase();
    };
    carousel.addEventListener("mouseenter", pause(true));
    carousel.addEventListener("mouseleave", pause(false));
    carousel.addEventListener("focusin", pause(true));
    carousel.addEventListener("focusout", pause(false));
  }
  on("#support-form", "submit", (e) => {
    e.preventDefault();
    let text = $("#support-message").value.trim();
    if (!text) return;
    supportMessages.push(
      { mine: true, text },
      {
        mine: false,
        text: "Réponse prédéfinie de démonstration : précisez le résultat attendu, le délai approximatif et les points à convenir dans la conversation. Si cela ne suffit pas, sollicitez une personne Flemme.",
      },
    );
    render();
  });
  on("#human-help", "click", () => {
    supportHuman = true;
    render();
    toast("Sollicitation simulée. Aucun message envoyé.");
  });
}
addEventListener("hashchange", () => {
  render();
  scrollTo(0, 0);
  $("#main").focus({ preventScroll: true });
});
document.addEventListener("click", (e) => {
  let skip = e.target.closest(".skip");
  if (skip) {
    e.preventDefault();
    $("#main").focus();
    return;
  }
});
render();
