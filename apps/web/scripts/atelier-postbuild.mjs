import { writeFileSync } from 'node:fs';
// Only the dedicated visual beta project gets an editor at its root.
if(process.env.SITE_ID==='273ccb1e-54d7-4d72-a6ae-42774a2a613b')writeFileSync('dist/_redirects','/ /atelier.html 200!\n/beta /atelier.html 200!\n');
