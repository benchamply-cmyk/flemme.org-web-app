import type { ReactNode } from 'react';
import { money, price, rateLabel } from '../../../packages/shared/src/index.ts';
import type { Price } from '../../../packages/shared/src/index.ts';

export function Action({ children, onClick, secondary = false, disabled = false }: { children: ReactNode; onClick: () => void; secondary?: boolean; disabled?: boolean }) {
  return <button type="button" className={'btn' + (secondary ? ' secondary' : '')} disabled={disabled} onClick={onClick}>{children}</button>;
}
// Accord conclu : montants figés par le serveur (agreed) ; sinon calcul avec le réglage courant (COMMISSION).
export function Bill({ amount, agreed }: { amount: number; agreed?: Price }) {
  const p = agreed?.payout != null ? agreed : price(amount);
  const row = (label: string, value: number, strong = false) => <div className="row"><span className={strong ? 'strong' : undefined}>{label}</span><span className={strong ? 'price' : 'strong'}>{money(value)}</span></div>;
  if (p.model === 'partage') return <div className="card" aria-label="Récapitulatif du prix">
    {row('Forfait', p.amount)}{row('Frais FLEMME · ' + rateLabel({ rateBps: p.rateBps }), p.total - p.amount)}<div className="divider"/>{row('Total déposant', p.total, true)}
    {row('Reversé au Brigadier (forfait − ' + rateLabel({ rateBps: p.brigadierBps ?? 0 }) + ')', p.payout)}</div>;
  return <div className="card" aria-label="Récapitulatif du prix">{row(p.model === 'ajout' ? 'Forfait Brigadier' : 'Reversé au Brigadier', p.model === 'ajout' ? p.amount : p.payout)}{row('FLEMME · ' + rateLabel(p), p.commission)}<div className="divider"/>{row('Total déposant', p.total, true)}</div>;
}
