import { notices } from '../../../../packages/shared/src/index.ts';
import { session } from '../session.ts';
import { Action } from '../ui.tsx';
import type { Ctx } from './contexte.ts';

export function Signalement({ state: { busy }, draft, field, mutate }: Ctx) {
  return <><h1 className="heading">Un problème ?</h1><p>Décris les faits. L’accord et les échanges restent conservés. Aucun remboursement n’est déclenché automatiquement.</p>
    {field('Ce qui s’est passé', 'text', { multiline: true })}
    <Action disabled={busy} onClick={() => mutate('report', { text: draft.text }, 'detail', notices.report(session.remote))}>Enregistrer le signalement</Action></>;
}
