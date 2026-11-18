import { useEffect, useState } from 'react';
import { CONDITIONS_COMMUNES, RemoteGateway, abonnementActif, date, money, resumeAbonnement } from '../../../../packages/shared/src/index.ts';
import type { Abonnement, FormuleServeur } from '../../../../packages/shared/src/index.ts';
import { useFlag } from '../flags/useFlag.tsx';
import { session } from '../session.ts';
import { Action } from '../ui.tsx';

// Abonnements dans Mon espace (v2.0.0). Rien ne s'affiche tant que le flag « abonnements.souscription » est éteint ;
// la base vérifie à nouveau le flag, la formule et son prix Stripe avant toute souscription.
export function Abonnements({ busy }: { busy: boolean }) {
  const flag = useFlag('abonnements.souscription');
  const [data, setData] = useState<{ plans: FormuleServeur[]; mine: Abonnement[] } | null>(null);
  const gateway = session.getState().gateway;
  const remote = gateway instanceof RemoteGateway;
  useEffect(() => {
    if (!flag.actif || !(gateway instanceof RemoteGateway)) return;
    gateway.subscriptions().then(setData, () => setData(null));
  }, [flag.actif, gateway]);
  if (!flag.actif || !remote || !data) return null;
  const g = gateway as RemoteGateway;
  const ouvrir = (cible: Parameters<RemoteGateway['subscriptionLink']>[0]) => session.execute(async () => { location.assign(await g.subscriptionLink(cible)); });
  const nom = (id: string) => data.plans.find(p => p.id === id)?.name || id;
  const vivants = data.mine.filter(a => abonnementActif(a.status));
  if (!data.plans.length && !data.mine.length) return null;
  return <><h2 className="section-title">Abonnement</h2>
    {data.mine.slice(0, 3).map(a => <p className="note" key={a.planId + a.status + a.currentPeriodEnd}>{resumeAbonnement(a, nom(a.planId), date)}</p>)}
    {data.mine.some(a => a.status !== 'canceled') && <Action secondary disabled={busy} onClick={() => ouvrir('portal')}>Gérer ou résilier mon abonnement</Action>}
    {data.plans.filter(p => !vivants.some(a => a.planId === p.id)).map(p => <div className="card" key={p.id}>
      <span className="card-title">{p.name}</span>
      <ul>{p.perks.map(x => <li key={x}>{x}</li>)}</ul>
      {p.trialDays > 0 && <p className="note">{p.trialDays} jours d’essai gratuits.</p>}
      <ul className="note">{[...p.conditions, ...CONDITIONS_COMMUNES].map(x => <li key={x}>{x}</li>)}</ul>
      {p.monthlyAmount != null && <Action disabled={busy} onClick={() => ouvrir({ planId: p.id, period: 'month' })}>S’abonner · {money(p.monthlyAmount)} / mois</Action>}
      {p.yearlyAmount != null && <Action secondary disabled={busy} onClick={() => ouvrir({ planId: p.id, period: 'year' })}>S’abonner · {money(p.yearlyAmount)} / an</Action>}
    </div>)}</>;
}
