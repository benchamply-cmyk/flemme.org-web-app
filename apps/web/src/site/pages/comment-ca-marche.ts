import { money, parseMoney, price } from '../../../../../packages/shared/src/domain.ts';
import '../commun.ts';

// Comment ça marche : calculateur « Quel prix vais-je payer ou recevoir ? » : même arrondi au centime que l’accord enregistré par l’app.
const input = document.getElementById('amount') as HTMLInputElement;
const out = (id: string, value: string) => { document.getElementById(id)!.textContent = value; };
function update() {
  try {
    const p = price(parseMoney(input.value) as number);
    out('cBase', money(p.payout)); out('cFee', money(p.total - p.amount)); out('cTotal', money(p.total)); out('calcError', '');
    input.removeAttribute('aria-invalid');
  } catch (e) { out('calcError', (e as Error).message); input.setAttribute('aria-invalid', 'true'); }
}
input.addEventListener('input', update);
document.getElementById('calc')!.addEventListener('submit', e => e.preventDefault());
update();
