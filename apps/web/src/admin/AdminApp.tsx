import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { money } from '../../../../packages/shared/src/domain.ts';
import { RemoteGateway } from '../../../../packages/shared/src/gateway.ts';
import { tokenStore } from '../storage.ts';
import type { AdminAction, AdminSource, AlertRow, DisputeRow, Overview, ReportRow, UserRow } from './model.ts';
import { DemoAdmin, alertLabel, disputeLabel, filterDisputes, filterUsers, logLabel, taskLabel, when } from './model.ts';

// Page admin de flemme.org : signalements, litiges, utilisateurs et alertes.
// Toutes les données passent par public.flemme_admin_api, qui revérifie le rôle admin en base.
type Tab = 'overview' | 'reports' | 'disputes' | 'users' | 'alerts';
type Data = { overview?: Overview; reports?: ReportRow[]; disputes?: DisputeRow[]; users?: UserRow[]; alerts?: AlertRow[] };
const url = import.meta.env.VITE_SUPABASE_URL || '';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const remoteMode = !!(url || key);
const tabs: [Tab, string][] = [['overview', 'Vue d’ensemble'], ['reports', 'Signalements'], ['disputes', 'Litiges'], ['users', 'Utilisateurs'], ['alerts', 'Alertes e-mail']];

function remoteSource(g: RemoteGateway, email: string): AdminSource {
  return { demo: false, email, call: (action: AdminAction, data = {}) => g.call('flemme_admin_api', { p_action: action, p_data: data }) };
}
function Button({ children, onClick, secondary = false, disabled = false }: { children: ReactNode; onClick: () => void; secondary?: boolean; disabled?: boolean }) {
  return <button type="button" className={'btn small' + (secondary ? ' secondary' : '')} disabled={disabled} onClick={onClick}>{children}</button>;
}
function Stat({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return <div className={'stat' + (warn && value > 0 ? ' warn' : '')}><span className="stat-value">{value}</span><span className="muted">{label}</span></div>;
}

export default function AdminApp() {
  const [source, setSource] = useState<AdminSource | null>(null), [gateway, setGateway] = useState<RemoteGateway | null>(null);
  const [tab, setTab] = useState<Tab>('overview'), [data, setData] = useState<Data>({});
  const [busy, setBusy] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<Record<string, string>>({}), [disputeView, setDisputeView] = useState<'todo' | 'resolved' | 'all'>('todo');
  const [query, setQuery] = useState(''), [onlySuspended, setOnlySuspended] = useState(false), [focus, setFocus] = useState('');
  const locked = useRef(false);

  async function run(fn: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); setNotice('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Une erreur est survenue.'); }
    finally { locked.current = false; setBusy(false); }
  }
  async function load(s: AdminSource, which: Tab) {
    const [field, action]: [keyof Data, AdminAction] = which === 'overview' ? ['overview', 'overview'] : [which, which];
    const result = await s.call(action);
    setData(d => ({ ...d, [field]: which === 'overview' ? result : result[which] }));
  }
  async function open(s: AdminSource) {
    // Le premier appel vérifie le rôle : un compte non admin reçoit « Accès réservé » et ne voit rien.
    await load(s, 'overview'); setSource(s); await Promise.all((['reports', 'disputes'] as Tab[]).map(t => load(s, t)));
  }
  useEffect(() => {
    void run(async () => {
      if (!remoteMode) { await open(new DemoAdmin()); return; }
      if (!url || !key) throw new Error('Configuration incomplète : renseigne l’URL et la clé publique Supabase.');
      const g = new RemoteGateway(url, key, tokenStore('flemme-admin-refresh')); setGateway(g);
      if (await g.restore()) await open(remoteSource(g, 'Compte admin'));
    }).then(() => setReady(true));
  }, []);
  function show(next: Tab) { setTab(next); setDraft({}); setNotice(''); if (source) void run(() => load(source, next)); }
  async function act(action: AdminAction, payload: Record<string, unknown>, message: string, reload: Tab[]) {
    if (!source) return;
    await run(async () => {
      await source.call(action, payload);
      for (const t of new Set<Tab>([...reload, 'overview'])) await load(source, t);
      setDraft({}); setNotice(message);
    });
  }
  async function logout() {
    await run(async () => { try { await gateway?.logout(); } finally { setSource(null); setData({}); } });
  }
  const set = (name: string) => (e: { target: { value: string } }) => setDraft(d => ({ ...d, [name]: e.target.value }));

  let content: ReactNode = null;
  const o = data.overview;
  if (!ready) content = <p className="muted" role="status">Chargement…</p>;
  else if (!source) content = <div className="narrow"><h1 className="heading">Admin FLEMME</h1><p>Connecte-toi avec un compte de l’équipe.</p>
    <div className="field"><label htmlFor="a-email">E-mail</label><input id="a-email" type="email" autoComplete="email" value={draft.email || ''} onChange={set('email')} disabled={busy}/></div>
    <div className="field"><label htmlFor="a-password">Mot de passe</label><input id="a-password" type="password" autoComplete="current-password" value={draft.password || ''} onChange={set('password')} disabled={busy}/></div>
    <button type="button" className="btn" disabled={busy || !gateway} onClick={() => run(async () => { const g = gateway as RemoteGateway; await g.login(draft.email || '', draft.password || ''); setDraft({}); try { await open(remoteSource(g, (draft.email || '').trim())); } catch (e) { await g.logout(); throw e; } })}>Me connecter</button></div>;
  else if (tab === 'overview' && o) content = <>
    <div className="stats">
      <Stat label="Litiges à traiter" value={o.disputes.open} warn/><Stat label="Litiges pris en charge" value={o.disputes.in_review}/>
      <Stat label="Flemmes ouvertes" value={o.tasks.open}/><Stat label="Flemmes attribuées" value={o.tasks.assigned}/><Stat label="Flemmes terminées" value={o.tasks.completed}/>
      <Stat label="Comptes" value={o.users}/><Stat label="Comptes suspendus" value={o.suspended}/><Stat label="Alertes en échec (7 j)" value={o.alertErrors} warn/>
    </div>
    <h2 className="section-title">Dernières décisions</h2>
    {o.log.length ? o.log.map(l => <div className="history" key={l.id}><p><span className="strong">{logLabel[l.action] || l.action}</span>{typeof l.details.note === 'string' ? ' · ' + l.details.note : typeof l.details.reason === 'string' ? ' · ' + l.details.reason : ''}</p><span className="note">{when(l.at)} · {l.admin || 'équipe'} · {l.target.slice(0, 8)}</span></div>) : <p className="muted">Aucune décision enregistrée pour l’instant.</p>}
  </>;
  else if (tab === 'reports') content = <>
    <p className="muted">Chaque signalement ouvre (ou rouvre) un litige sur la flemme concernée. Aucun remboursement n’est déclenché automatiquement.</p>
    {data.reports?.length ? data.reports.map((r, i) => <div className="card" key={r.taskId + i}>
      <div className="row"><span className="tag">{disputeLabel[r.disputeStatus]}</span><span className="note">{when(r.at)}</span></div>
      <p className="card-title">{r.title}</p><p>{r.text}</p><p className="muted">Signalé par {r.actor.name} · flemme {taskLabel[r.taskStatus].toLowerCase()}</p>
      <Button secondary onClick={() => { setFocus(r.taskId); setDisputeView('all'); show('disputes'); }}>Voir le litige</Button>
    </div>) : <p className="muted">Aucun signalement.</p>}
  </>;
  else if (tab === 'disputes') {
    const rows = filterDisputes(data.disputes || [], disputeView);
    content = <>
      <div className="chips" role="group" aria-label="Filtrer les litiges">{(['todo', 'resolved', 'all'] as const).map(v => <button type="button" key={v} aria-pressed={disputeView === v} className="chip" onClick={() => setDisputeView(v)}>{v === 'todo' ? 'À traiter' : v === 'resolved' ? 'Clos' : 'Tous'}</button>)}</div>
      {rows.length ? rows.map(d => { const t = d.task, a = t.agreement; return <div className={'card' + (focus === d.taskId ? ' focus' : '')} key={d.taskId}>
        <div className="row"><span className="tag">{disputeLabel[d.status]}</span><span className="note">Ouvert le {when(d.openedAt)}{d.updatedBy ? ' · dernière action : ' + d.updatedBy : ''}</span></div>
        <p className="card-title">{t.title}</p>
        <p className="muted">{t.place} · {taskLabel[t.status]} · déposée par {t.owner.name}{a ? ' · Brigadier : ' + a.brigadier.name + ' · forfait ' + money(a.amount) + ' + commission ' + money(a.commission) : ''}</p>
        {a && <p className="note">{t.paymentConfirmed ? 'Paiement confirmé par les deux personnes (déclaratif)' : t.paymentDeclared ? 'Paiement déclaré par le déposant, non confirmé par le Brigadier' : 'Paiement non déclaré'}</p>}
        {t.reports.map((r, i) => <div className="bubble" key={i}><span className="strong">Signalement de {r.actor.name}</span><span>{r.text}</span><span className="note">{when(r.at)}</span></div>)}
        {d.resolution && <p><span className="strong">Résolution : </span>{d.resolution}</p>}
        <details><summary>Historique de la flemme ({t.history.length})</summary>{t.history.map((h, i) => <div key={i} className="history"><p>{h.text}</p><span className="note">{when(h.at)}</span></div>)}</details>
        {d.status !== 'resolved' && <>
          {d.status === 'open' && <Button secondary disabled={busy} onClick={() => act('dispute_update', { taskId: d.taskId, status: 'in_review' }, 'Litige pris en charge. Les deux participants le voient dans l’historique.', ['disputes', 'reports'])}>Prendre en charge</Button>}
          <div className="field"><label htmlFor={'n-' + d.taskId}>Décision (visible du déposant et du Brigadier)</label><textarea id={'n-' + d.taskId} maxLength={1000} value={draft['n-' + d.taskId] || ''} onChange={set('n-' + d.taskId)} disabled={busy}/></div>
          <Button disabled={busy} onClick={() => act('dispute_update', { taskId: d.taskId, status: 'resolved', note: draft['n-' + d.taskId] || '' }, 'Litige clos. La décision est ajoutée à l’historique de la flemme.', ['disputes', 'reports'])}>Clore le litige</Button>
        </>}
      </div>; }) : <p className="muted">{disputeView === 'todo' ? 'Aucun litige à traiter.' : 'Aucun litige.'}</p>}
    </>;
  } else if (tab === 'users') {
    const rows = filterUsers(data.users || [], query, onlySuspended);
    content = <>
      <p className="muted">Tous les comptes du projet Supabase, y compris ceux de l’ancien espace client. Un compte suspendu peut encore se connecter et lire ses flemmes, mais ne peut plus rien publier ni modifier.</p>
      <div className="field"><label htmlFor="u-search">Rechercher (e-mail ou nom)</label><input id="u-search" type="search" value={query} onChange={e => setQuery(e.target.value)}/></div>
      <label className="check"><input type="checkbox" checked={onlySuspended} onChange={e => setOnlySuspended(e.target.checked)}/> Seulement les comptes suspendus</label>
      <p className="note">{rows.length} compte(s) affiché(s)</p>
      {data.users && rows.map(u => <div className="card" key={u.id}>
        <div className="row"><span><span className="strong">{u.email}</span>{u.displayName && <span className="muted"> · {u.displayName}</span>}</span><span>{u.admin && <span className="tag">Admin</span>} {u.suspendedReason && <span className="tag warn">Suspendu</span>} {!u.confirmed && <span className="tag">E-mail non confirmé</span>}</span></div>
        <p className="note">Inscrit le {when(u.createdAt)} · dernière connexion : {when(u.lastSignInAt)}</p>
        <p className="muted">{u.tasks} flemme(s) déposée(s) · {u.offers} proposition(s) · {u.missions} mission(s) · {u.reports} signalement(s)</p>
        {u.suspendedReason ? <><p><span className="strong">Motif : </span>{u.suspendedReason} <span className="note">({when(u.suspendedAt)})</span></p>
          <Button secondary disabled={busy} onClick={() => act('user_restore', { userId: u.id }, 'Compte rétabli.', ['users'])}>Rétablir le compte</Button></>
        : !u.admin && <><div className="field"><label htmlFor={'s-' + u.id}>Motif de suspension</label><input id={'s-' + u.id} maxLength={500} value={draft['s-' + u.id] || ''} onChange={set('s-' + u.id)} disabled={busy}/></div>
          <Button secondary disabled={busy} onClick={() => act('user_suspend', { userId: u.id, reason: draft['s-' + u.id] || '' }, 'Compte suspendu.', ['users'])}>Suspendre</Button></>}
      </div>)}
    </>;
  } else if (tab === 'alerts') content = <>
    <p className="muted">Chaque nouvelle flemme, accord ou signalement est enregistré ici puis envoyé par e-mail. Une alerte en échec ne bloque jamais l’action du membre.</p>
    {data.alerts?.length ? data.alerts.map(a => <div className="card" key={a.id}>
      <div className="row"><span className="tag">{alertLabel[a.kind] || a.kind}</span><span className="note">{when(a.createdAt)}</span></div>
      <p className="card-title">{String(a.payload.title || '')}</p>
      {a.error ? <><p className="alert">Non envoyée : {a.error}</p><Button secondary disabled={busy} onClick={() => act('alert_retry', { id: a.id }, 'Nouvel envoi demandé.', ['alerts'])}>Réessayer l’envoi</Button></>
        : <p className="note">Transmise le {when(a.dispatchedAt)}</p>}
    </div>) : <p className="muted">Aucune alerte.</p>}
  </>;

  return <>
    <header className="top"><a href="/" aria-label="FLEMME · retour au site"><img src={import.meta.env.BASE_URL + 'flemme-logo.png'} alt="FLEMME"/></a>
      {source && <nav><span className="note">{source.email}</span>{!source.demo && <Button secondary disabled={busy} onClick={logout}>Me déconnecter</Button>}</nav>}</header>
    <main className="admin" aria-busy={busy}>
      {source && <><p className="eyebrow">Exploitation</p><h1 className="heading">Admin FLEMME</h1>
        <div className="chips" role="tablist" aria-label="Rubriques">{tabs.map(([id, label]) => <button type="button" role="tab" key={id} aria-selected={tab === id} className="chip" onClick={() => show(id)}>{label}{id === 'disputes' && o ? ' (' + (o.disputes.open + o.disputes.in_review) + ')' : id === 'reports' && data.reports ? ' (' + data.reports.length + ')' : ''}</button>)}
          <button type="button" className="chip" disabled={busy} onClick={() => show(tab)}>↻ Actualiser</button></div></>}
      {!!error && <div role="alert" className="alert">{error}</div>}
      {!!notice && <p aria-live="polite" className="notice">{notice}</p>}
      {content}
      {busy && <p className="muted" role="status">En cours…</p>}
    </main>
    <p className="foot">{source?.demo ? 'Démonstration · données fictives · aucune alerte envoyée' : 'Accès réservé à l’équipe FLEMME'}</p>
  </>;
}
