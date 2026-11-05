import '../commun.ts';

// Formulaire de contact : pas d’envoi par le site pour l’instant, il prépare l’e-mail dans la messagerie de la personne.
const form = document.getElementById('contactForm') as HTMLFormElement;
const adresse = document.getElementById('contactMail')!.textContent?.trim() || '';
form.addEventListener('submit', e => {
  e.preventDefault();
  const d = new FormData(form), get = (k: string) => String(d.get(k) || '').trim();
  const erreur = document.getElementById('contactErreur')!;
  if (!get('message')) { erreur.textContent = 'Écris ton message avant d’envoyer.'; (form.elements.namedItem('message') as HTMLElement).focus(); return; }
  erreur.textContent = '';
  const corps = [get('message'), '', '—', get('nom') && 'Nom : ' + get('nom'), get('email') && 'E-mail : ' + get('email')].filter(l => l !== '').join('\n');
  location.href = `mailto:${adresse}?subject=${encodeURIComponent('FLEMME · ' + (get('sujet') || 'Contact'))}&body=${encodeURIComponent(corps)}`;
});
