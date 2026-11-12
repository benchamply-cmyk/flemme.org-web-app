import { writeFileSync } from 'node:fs';
// Site flemmeorg-beta seulement : « / » ouvre le sélecteur de builds (preprod déployé par défaut, beta, aperçus des PR vers beta),
// « /beta » garde l'atelier visuel. Le site normal reste à /index.html.
if(process.env.SITE_ID==='273ccb1e-54d7-4d72-a6ae-42774a2a613b')writeFileSync('dist/_redirects','/ /builds.html 200!\n/builds /builds.html 200!\n/beta /atelier.html 200!\n');
