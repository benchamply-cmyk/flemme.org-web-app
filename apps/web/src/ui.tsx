import type { ReactNode } from 'react';
import { money, price, rateLabel } from '../../../packages/shared/src/index.ts';
import type { Price } from '../../../packages/shared/src/index.ts';

export function Action({ children, onClick, secondary = false, disabled = false }: { children: ReactNode; onClick: () => void; secondary?: boolean; disabled?: boolean }) {
  return <button type="button" className={'btn' + (secondary ? ' secondary' : '')} disabled={disabled} onClick={onClick}>{children}</button>;
}
// Accord conclu : montants figés par le serveur (agreed) ; sinon calcul avec le réglage courant (COMMISSION).
export function Bill({ amount, agreed }: { amount: number; agreed?: Price }) {
  const p = agreed?.payout != null ? agreed : price(amount);
  return <div className="card" aria-label="Récapitulatif du prix"><div className="row"><span>{p.model === 'ajout' ? 'Forfait Brigadier' : 'Reversé au Brigadier'}</span><span className="strong">{money(p.model === 'ajout' ? p.amount : p.payout)}</span></div><div className="row"><span>FLEMME · {rateLabel(p)}</span><span className="strong">{money(p.commission)}</span></div><div className="divider"/><div className="row"><span className="strong">Total déposant</span><span className="price">{money(p.total)}</span></div></div>;
}
