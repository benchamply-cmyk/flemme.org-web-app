import { CONTRACT_COMMON_CLAUSES, CONTRACT_FIELDS, contractInput, money, notices, parseMoney } from '../../../../packages/shared/src/index.ts';
import { Action, Bill } from '../ui.tsx';
import type { Ctx } from './contexte.ts';

// Écran « contract » : rédaction de l’accord écrit par le déposant ou le membre retenu.
// Toute modification remet l’accord en brouillon et efface les signatures : chacun relit la nouvelle version.
export function Accord({ state: { busy }, task, can, draft, field, mutate, validated }: Ctx) {
  if (!task) return null;
  if (!can.canContract) return <><h1 className="heading">Accord écrit</h1><p className="muted">L’accord se prépare une fois le membre choisi, avant la fin de la tâche.</p></>;
  const signed = task.contract?.ownerSignedAt || task.contract?.brigadierSignedAt;
  return <><h1 className="heading">{task.contract ? 'Modifier l’accord écrit' : 'Rédiger l’accord écrit'}</h1><p className="card-title">{task.title}</p>
    {task.agreement && !can.viaFlemme && <p className="muted">Prix convenu : {money(task.agreement.amount)} pour le membre, {money(task.agreement.total)} au total. Il ne change pas ici : c’est celui de la proposition acceptée.</p>}
    {task.agreement && can.viaFlemme && <><p className="muted">Prix convenu jusqu’ici : {money(task.agreement.amount)} pour la personne qui réalise la mission, {money(task.agreement.total)} au total avec les frais de plateforme. Si vous en avez convenu autrement dans la discussion, modifiez-le ici : le taux des frais reste celui fixé au choix de la proposition.</p>
      {field('Prix convenu de la prestation', 'amount', { numeric: true })}
      {(() => { try { const n = parseMoney(draft.amount || '', true); return n != null ? <Bill amount={n} agreed={{ ...task.agreement, ...priceFor(n, task.agreement) }}/> : null; } catch { return null; } })()}</>}
    <p className="note">Écrivez ensemble ce que chacun attend. L’équipe FLEMME relit l’accord avant la signature.</p>
    {CONTRACT_FIELDS.map(c => field(c.label, c.name, { multiline: c.max > 200, max: c.max, hint: c.hint }))}
    <div className="note"><span className="strong">Clauses communes à tout accord Flemme</span><ul>{CONTRACT_COMMON_CLAUSES.map(c => <li key={c}>{c}</li>)}</ul></div>
    {signed && <p className="alert" role="status">Une signature a déjà été donnée : enregistrer une modification l’annule, et les deux parties devront signer la nouvelle version.</p>}
    <Action disabled={busy} onClick={() => validated(() => { const { amount, ...terms } = contractInput(draft); const data = can.viaFlemme && amount != null ? { ...terms, amount } : terms; void mutate('agreement_save', data, 'detail', notices.contractSaved); })}>Enregistrer l’accord</Action></>;
}

// Même calcul que domain.ts (price) avec le taux figé dans l’accord : aperçu seulement, le serveur recalcule.
function priceFor(amount: number, a: { model: 'ajout' | 'prelevement'; rateBps: number }) {
  const fee = Math.round(amount * a.rateBps / 10000);
  return a.model === 'ajout' ? { amount, commission: fee, total: amount + fee, payout: amount } : { amount, commission: fee, total: amount, payout: amount - fee };
}
