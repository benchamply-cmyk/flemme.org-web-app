import { notices, parseMoney } from '../../../../packages/shared/src/index.ts';
import { Action } from '../ui.tsx';
import type { Ctx } from './contexte.ts';

export function NouvelleFlemme({ state: { busy }, draft, field, mutate, validated }: Ctx) {
  return <><h1 className="heading">La flemme de quoi ?</h1><p className="muted">Raconte. Un Brigadier prendra le relais.</p>
    {field('Ce qu’il faut faire', 'title')}{field('Quelques détails', 'details', { multiline: true })}{field('Ville ou « À distance »', 'place')}{field('Budget Brigadier · facultatif, hors frais', 'amount', { numeric: true })}
    <p className="note">Sans expiration. Commission FLEMME de 10 % ajoutée au forfait accepté. Les achats à avancer ne sont pas inclus dans ce premier test.</p>
    <Action disabled={busy} onClick={() => validated(() => { void mutate('create', { title: draft.title, details: draft.details, place: draft.place, budget: parseMoney(draft.amount || '', true) }, 'detail', notices.published); })}>Publier ma flemme</Action></>;
}
