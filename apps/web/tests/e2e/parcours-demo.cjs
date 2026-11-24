// Test de bout en bout du parcours complet de la marketplace ouverte, dans la démo locale (aucune base, aucun paiement).
// Deux membres de démo jouent les deux côtés : Benjamin (déposant, comme test.flemmard) et Lou (membre qui aide, comme test.brigadier).
// Couvre : dépôt d'une demande, question publique et réponse, proposition, coordonnées masquées avant signature,
// choix de l'offre, accord écrit (rubriques obligatoires), double signature, paiement via Flemme (simulation),
// livraison déclarée par le membre, fin confirmée par le déposant, avis, frise en 7 étapes.
// Les flags locaux allument espace.confiance et espace.refonte (registre packages/shared/src/flags.ts).
//
// Lancement : npm run e2e (dans apps/web). Demande Playwright et son navigateur Chromium installés sur le poste
// (npm i -D playwright && npx playwright install chromium) ; le test démarre lui-même Vite sur un port libre.
// Ce test ne touche ni preprod ni prod : la check-list de test avec les vrais comptes est dans docs/tests-parcours-preprod.md.
'use strict';
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');

let chromium;
try { ({ chromium } = require('playwright')); } catch {
  console.error('Playwright est introuvable. Installe-le : npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const PORT = Number(process.env.E2E_PORT || 5199);
const BASE = `http://localhost:${PORT}`;
const TITRE = 'Monter ma commode (test e2e)';

function demarrerVite() {
  const racine = path.join(__dirname, '../..');
  const vite = spawn(process.execPath, [path.join(racine, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'],
    { cwd: racine, env: { ...process.env, VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((ok, ko) => {
    const t = setTimeout(() => ko(new Error('Vite ne démarre pas.')), 30_000);
    vite.stdout.on('data', d => { if (String(d).includes('Local:')) { clearTimeout(t); ok(vite); } });
    vite.on('exit', c => { clearTimeout(t); ko(new Error('Vite s’est arrêté (code ' + c + ').')); });
  });
}

async function parcours(p) {
  // Les montants s'écrivent avec des espaces insécables (Intl) : on les ramène à des espaces simples.
  const texte = async () => (await p.locator('body').innerText()).replace(/[  ]/g, ' ');
  const voit = async (attendu, etape) => assert.ok((await texte()).includes(attendu), `${etape} : « ${attendu} » absent de ${p.url()}`);
  const bouton = (nom) => p.getByRole('button', { name: nom });
  const clic = async (nom) => { await bouton(nom).first().click(); await p.waitForTimeout(400); };
  const onglet = async (nom) => { await bouton(nom).last().click(); await p.waitForTimeout(300); };
  // L'identité de démo vit dans la session de la page : on change de personnage dans Profil, sans recharger.
  const devenir = async (qui) => { await onglet('Profil'); await clic(new RegExp('^' + qui)); };
  const ouvrir = async (qui, cote) => {
    await devenir(qui); await onglet('Demandes');
    await p.getByText(new RegExp('^' + cote)).first().click(); await p.waitForTimeout(300);
    await p.getByText(TITRE).first().click(); await p.waitForTimeout(400);
  };
  const signer = async (nom) => {
    await p.fill('#f-signature', nom); await p.getByLabel('J’ai lu l’accord et je l’accepte.').check(); await clic('Signer l’accord');
  };

  // 1. Benjamin dépose une demande (sur place : ville obligatoire), budget 40 € => 44 € avec les frais de 10 %.
  await p.goto(BASE + '/deleguer/nouvelle');
  await p.fill('#f-details', 'Monter une commode trois tiroirs. Outils sur place.');
  await p.fill('#f-title', TITRE);
  await p.selectOption('#f-category', { label: 'Maison et bricolage' });
  await p.selectOption('#f-mode', { label: 'Sur place' });
  await p.fill('#f-place', 'Aix-en-Provence');
  await p.fill('#f-amount', '40');
  await voit('tu paieras 44,00 €', 'aperçu des frais');
  await clic('Envoyer ma demande');

  // 2. Lou trouve la demande, pose une question avec un numéro (masqué) et propose 45 € avec un e-mail (masqué).
  await devenir('Lou'); await onglet('Trouver');
  await p.getByText(TITRE).first().click(); await p.waitForTimeout(400);
  await voit('Étape 1 sur 7 · Publiée', 'frise à la publication');
  await p.fill('#f-question', 'Quel étage ? Appelle-moi au 06 12 34 56 78');
  await clic('Poser ma question');
  await voit('Appelle-moi au [coordonnées masquées]', 'téléphone masqué dans la question');
  await p.fill('#f-amount', '45'); await p.fill('#f-slot', 'Samedi matin');
  await p.fill('#f-scope', 'Montage complet, écris-moi à lou@exemple.fr');
  await clic('Envoyer ma proposition');
  await voit('écris-moi à [coordonnées masquées]', 'e-mail masqué dans la proposition');
  assert.ok(!(await texte()).includes('lou@exemple.fr'), 'l’e-mail ne doit jamais apparaître avant la signature');
  // Pas de contre-proposition du déposant : seul un autre membre peut proposer (vérifié plus bas côté Benjamin).

  // 3. Benjamin répond publiquement, compare l'offre (45 € + 4,50 € = 49,50 €) et la choisit.
  await ouvrir('Benjamin', 'Je délègue');
  assert.equal(await bouton('Envoyer ma proposition').count(), 0, 'le déposant ne peut pas proposer sur sa propre demande');
  await p.locator('textarea[id^="f-answer-"]').fill('2e étage avec ascenseur');
  await clic('Répondre');
  await voit('Réponse de Benjamin', 'réponse publique');
  await voit('49,50 € avec les frais', 'comparaison des offres');
  await clic(/Choisir l.offre de Lou/);
  await voit('Total déposant', 'récapitulatif avant acceptation');
  await clic(/^Accepter · 49,50 €/);
  await voit('rien n’est dû avant sa signature', 'aucun frais au choix de l’offre');

  // 4. Accord écrit : rubriques obligatoires, soumission, puis signature des deux parties.
  await p.getByText(TITRE).first().click(); await p.waitForTimeout(400);
  await voit('Étape 3 sur 7 · Contrat', 'frise après le choix');
  await clic('Rédiger l’accord');
  const termes = { '#f-scope': 'Montage de la commode', '#f-deliverable': 'Commode montée', '#f-quality': 'Stable, tiroirs qui coulissent',
    '#f-deadline': 'Samedi matin', '#f-acceptance': 'Vérifiée sur place le jour même', '#f-cancellation': 'Gratuite 24 h avant',
    '#f-confidentiality': 'Adresse privée' };
  for (const [champ, valeur] of Object.entries(termes)) await p.fill(champ, valeur);
  await clic('Enregistrer l’accord');
  await voit('VERSION 1', 'accord enregistré en version 1');
  await clic('Soumettre l’accord à l’équipe FLEMME');
  await voit('PRÊT À SIGNER', 'accord contrôlé');
  await voit('Versé à la personne qui réalise la mission', 'récapitulatif avant signature');
  await signer('Benjamin Test');
  await ouvrir('Lou', 'J’aide');
  await voit('Déposant : signé « Benjamin Test »', 'première signature visible du membre');
  await signer('Lou Test');
  await voit('SIGNÉ PAR LES DEUX PARTIES', 'double signature');
  await voit('Étape 4 sur 7 · Signé', 'frise après signature');
  assert.equal(await bouton('J’ai terminé la mission').count(), 0, 'pas de livraison avant le paiement');

  // 5. Benjamin paie via Flemme (simulation), Lou déclare la mission livrée, Benjamin confirme la fin.
  await ouvrir('Benjamin', 'Je délègue');
  await clic(/^Payer via Flemme · 49,50 €/);
  await voit('Étape 5 sur 7 · Payé', 'frise après paiement');
  await ouvrir('Lou', 'J’aide');
  await clic('J’ai terminé la mission');
  await voit('Étape 6 sur 7 · Livré', 'frise après livraison');
  await voit('tu pourras clôturer toi-même à partir du', 'libération automatique annoncée (7 jours)');
  await ouvrir('Benjamin', 'Je délègue');
  await clic('Mission terminée, je libère le paiement');
  await voit('TERMINÉE', 'mission terminée');

  // 6. Avis du déposant : la frise passe à 7 sur 7 (« Terminé » = mission terminée et avis donné).
  await p.selectOption('#f-rating', '5');
  await p.fill('#f-reviewText', 'Rapide et soigné.');
  await clic('Publier mon avis');
  await voit('Étape 7 sur 7 · Terminé', 'frise complète après l’avis');
}

(async () => {
  const vite = await demarrerVite();
  const navigateur = await chromium.launch();
  const erreurs = [];
  try {
    const p = await navigateur.newPage({ viewport: { width: 1200, height: 900 } });
    p.on('pageerror', e => erreurs.push(e.message));
    await parcours(p);
    assert.deepEqual(erreurs, [], 'aucune erreur JavaScript pendant le parcours');
    console.log('ok - parcours complet déposant / membre dans la démo locale');
  } catch (e) {
    console.error('échec - ' + e.message);
    process.exitCode = 1;
  } finally {
    await navigateur.close(); vite.kill();
  }
})();
