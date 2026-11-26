import { money, parseMoney } from '../../../../../packages/shared/src/domain.ts';
import { ACTIVITES_INTERDITES, ACTIVITES_RESERVEES_PROS, ASSISTANCE_ACCORD, ASSISTANCE_LIMITE, fraisBareme, tauxEffectifBps } from '../../../../../packages/shared/src/bareme.ts';
import '../commun.ts';

// Comment ça marche : calculateur « Quel prix vais-je payer ou recevoir ? » avec le barème par tranches (analyse v0.2, décision de Ben du 23/11/2026).
const input = document.getElementById('amount') as HTMLInputElement;
const out = (id: string, value: string) => { document.getElementById(id)!.textContent = value; };
const pct = (bps: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(bps / 100) + ' %';
function update() {
  try {
    const prix = parseMoney(input.value) as number;
    const frais = fraisBareme(prix);
    out('cBase', money(prix)); out('cFee', money(frais)); out('cTotal', money(prix + frais)); out('calcError', '');
    out('cFeeLabel', 'Frais de plateforme · ' + pct(tauxEffectifBps(prix)));
    input.removeAttribute('aria-invalid');
  } catch (e) { out('calcError', (e as Error).message); input.setAttribute('aria-invalid', 'true'); }
}
input.addEventListener('input', update);
document.getElementById('calc')!.addEventListener('submit', e => e.preventDefault());
update();

// Listes tenues à un seul endroit (packages/shared/src/bareme.ts).
const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const remplir = (id: string, html: string) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
remplir('listeInterdites', ACTIVITES_INTERDITES.map(a => `<li>${esc(a)}</li>`).join(''));
remplir('listeReservees', ACTIVITES_RESERVEES_PROS.map(a => `<li>${esc(a)}</li>`).join(''));
remplir('assistanceListe', ASSISTANCE_ACCORD.map(a => `<div class="carte"><b>${esc(a.nom)} · ${a.prix === null ? 'option payante' : a.prix ? esc(money(a.prix)) : 'inclus'}</b><p class="doux">${esc(a.detail)}</p></div>`).join(''));
out('assistanceLimite', ASSISTANCE_LIMITE);
