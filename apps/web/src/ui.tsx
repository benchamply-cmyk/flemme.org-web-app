import type { ReactNode } from 'react';
import { FRAIS_LIBELLE, money, price, rateLabel, recapitulatif } from '../../../packages/shared/src/index.ts';
import type { Price } from '../../../packages/shared/src/index.ts';

export function Action({ children, onClick, secondary = false, disabled = false }: { children: ReactNode; onClick: () => void; secondary?: boolean; disabled?: boolean }) {
  return <button type="button" className={'btn' + (secondary ? ' secondary' : '')} disabled={disabled} onClick={onClick}>{children}</button>;
}
// Accord conclu : montants figés par le serveur (agreed) ; sinon calcul avec le réglage courant (COMMISSION).
export function Bill({ amount, agreed }: { amount: number; agreed?: Price }) {
  const p = agreed?.payout != null ? agreed : price(amount);
  return <div className="card" aria-label="Récapitulatif du prix"><div className="row"><span>{p.model === 'ajout' ? 'Forfait Brigadier' : 'Reversé au Brigadier'}</span><span className="strong">{money(p.model === 'ajout' ? p.amount : p.payout)}</span></div><div className="row"><span>{FRAIS_LIBELLE} · {rateLabel(p)}</span><span className="strong">{money(p.commission)}</span></div><div className="divider"/><div className="row"><span className="strong">Total déposant</span><span className="price">{money(p.total)}</span></div></div>;
}

// v2.0.0 : écran unique avant signature (étude de monétisation v0.2) : une seule ligne de frais, total et part de l’intervenant.
export function Recap({ agreed, cancellation }: { agreed: Price; cancellation?: string }) {
  return <div className="card" aria-label="Récapitulatif avant signature"><p className="strong" style={{ margin: 0 }}>Ce que vous signez</p>
    {recapitulatif(agreed, money).map(l => <div className="row" key={l.label}><span>{l.label}</span><span className={l.strong ? 'price' : 'strong'}>{l.value}</span></div>)}
    {cancellation && <p className="note" style={{ margin: 0 }}>Annulation : {cancellation}</p>}</div>;
}
