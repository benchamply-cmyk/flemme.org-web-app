import type { ReactNode } from 'react';
import { commission, money } from '../../../packages/shared/src/index.ts';

export function Action({ children, onClick, secondary = false, disabled = false }: { children: ReactNode; onClick: () => void; secondary?: boolean; disabled?: boolean }) {
  return <button type="button" className={'btn' + (secondary ? ' secondary' : '')} disabled={disabled} onClick={onClick}>{children}</button>;
}
export function Bill({ amount }: { amount: number }) {
  return <div className="card" aria-label="Récapitulatif du prix"><div className="row"><span>Forfait Brigadier</span><span className="strong">{money(amount)}</span></div><div className="row"><span>FLEMME · 10 %</span><span className="strong">{money(commission(amount))}</span></div><div className="divider"/><div className="row"><span className="strong">Total déposant</span><span className="price">{money(amount + commission(amount))}</span></div></div>;
}
