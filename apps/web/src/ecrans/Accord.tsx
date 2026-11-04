import { CONTRACT_FIELDS, contractInput, money, notices } from '../../../../packages/shared/src/index.ts';
import { Action } from '../ui.tsx';
import type { Ctx } from './contexte.ts';

// Écran « contract » : rédaction de l’accord écrit par le déposant ou le Brigadier retenu.
// Toute modification remet l’accord en brouillon et efface les signatures : chacun relit la nouvelle version.
export function Accord({ state: { busy }, task, can, draft, field, mutate, validated }: Ctx) {
  if (!task) return null;
  if (!can.canContract) return <><h1 className="heading">Accord écrit</h1><p className="muted">L’accord se prépare une fois le Brigadier choisi, avant la fin de la tâche.</p></>;
  const signed = task.contract?.ownerSignedAt || task.contract?.brigadierSignedAt;
  return <><h1 className="heading">{task.contract ? 'Modifier l’accord écrit' : 'Rédiger l’accord écrit'}</h1><p className="card-title">{task.title}</p>
    {task.agreement && <p className="muted">Prix convenu : {money(task.agreement.amount)} pour le Brigadier, {money(task.agreement.total)} au total. Il ne change pas ici : c’est celui de la proposition acceptée.</p>}
    <p className="note">Écrivez ensemble ce que chacun attend. L’équipe FLEMME relit l’accord avant la signature.</p>
    {CONTRACT_FIELDS.map(c => field(c.label, c.name, { multiline: c.max > 200, max: c.max, hint: c.hint }))}
    {signed && <p className="alert" role="status">Une signature a déjà été donnée : enregistrer une modification l’annule, et les deux parties devront signer la nouvelle version.</p>}
    <Action disabled={busy} onClick={() => validated(() => { const data = contractInput(draft); void mutate('agreement_save', data, 'detail', notices.contractSaved); })}>Enregistrer l’accord</Action></>;
}
