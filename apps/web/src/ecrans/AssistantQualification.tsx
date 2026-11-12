import { useRef, useState } from 'react';

declare const __QUALIFICATION_ENABLED__: boolean;
export const qualificationEnabled = __QUALIFICATION_ENABLED__;

type Conversation = {
  id: string;
  version: number;
  history: { role: 'user' | 'assistant'; content: string }[];
  summary: { ready: boolean; human_required: boolean; expected_result: string; facts: Record<string, string | null> };
};
type Session = { id: string; token: string };
const labels = [
  ['scope', 'Périmètre'], ['location', 'Lieu'], ['budget', 'Budget indicatif'],
  ['deadline', 'Délai'], ['success_criteria', 'Critères de réussite'], ['constraints', 'Contraintes'],
];

async function request<T>(path: string, method: string, token?: string, data?: object): Promise<T> {
  const response = await fetch('/api/qualification/conversations' + path, {
    method, cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(50_000),
    headers: { ...(token && { Authorization: 'Bearer ' + token }), ...(data && { 'Content-Type': 'application/json' }) },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!response.ok) {
    if (response.status === 404) throw new Error('Échange expiré ou assistant indisponible. Tu peux continuer avec le formulaire.');
    if (response.status === 429) throw new Error('Limite atteinte. Tu peux continuer avec le formulaire.');
    throw new Error('L’assistant ne répond pas. Réessaie ou continue avec le formulaire.');
  }
  return response.status === 204 ? undefined as T : response.json();
}

export function AssistantQualification({ details, onApply, disabled }: {
  details: string; onApply: (details: string) => void; disabled: boolean;
}) {
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState<Conversation>();
  const [proposal, setProposal] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const session = useRef<Session>(null);
  const pending = useRef<{ text: string; id: string }>(null);
  const locked = useRef(false);
  const send = async () => {
    const text = message.trim();
    if (!consent || !text || disabled || locked.current) return;
    locked.current = true;
    setBusy(true); setStatus('L’assistant prépare sa réponse…');
    try {
      if (!session.current) {
        const started = await request<Conversation & { token: string }>('', 'POST', undefined, { task: text, consent: true });
        session.current = { id: started.id, token: started.token };
      }
      const { id, token } = session.current;
      const path = '/' + encodeURIComponent(id);
      const current = await request<Conversation>(path, 'GET', token);
      setConversation(current);
      if (pending.current?.text !== text) pending.current = { text, id: crypto.randomUUID() };
      const next = await request<Conversation>(path + '/messages', 'POST', token, {
        version: current.version, request_id: pending.current.id, message: text,
      });
      setConversation(next);
      setProposal(next.summary.ready || next.summary.human_required
        ? [next.summary.expected_result, ...labels.flatMap(([key, label]) =>
          next.summary.facts[key] ? [label + ' : ' + next.summary.facts[key]] : [])].join('\n').slice(0, 1000)
        : '');
      setMessage(''); pending.current = null; setStatus('');
    } catch (error) {
      setStatus(error instanceof Error && error.message.startsWith('Échange expiré') ? error.message :
        error instanceof Error && error.message.startsWith('Limite atteinte') ? error.message :
        'L’assistant ne répond pas. Réessaie ou continue avec le formulaire.');
    } finally { locked.current = false; setBusy(false); }
  };
  const erase = async () => {
    if (locked.current || !session.current) return;
    locked.current = true; setBusy(true);
    try {
      const { id, token } = session.current;
      await request<void>('/' + encodeURIComponent(id), 'DELETE', token);
      session.current = null; pending.current = null;
      setConversation(undefined); setProposal(''); setMessage(''); setConsent(false);
      setStatus('Échange supprimé.');
    } catch { setStatus('La suppression n’a pas été confirmée. Réessaie.'); }
    finally { locked.current = false; setBusy(false); }
  };
  return <details className="card">
    <summary>Préparer ma demande avec l’assistant</summary>
    <p className="muted">Facultatif. L’assistant pose des questions et propose une description. Tu gardes la main sur le texte et sur l’envoi de la demande.</p>
    <label><input type="checkbox" checked={consent} disabled={busy || disabled} onChange={e => setConsent(e.target.checked)} /> J’accepte que mes messages soient analysés par OpenAI. N’y indique ni coordonnées, ni adresse précise, ni document confidentiel. <a href="/confidentialite.html">Confidentialité</a></label>
    {conversation && <div aria-label="Échange avec l’assistant">
      {conversation.history.map((item, i) => <p key={i} style={{ whiteSpace: 'pre-wrap' }}><strong>{item.role === 'assistant' ? 'Assistant : ' : 'Toi : '}</strong>{item.content}</p>)}
    </div>}
    {consent && <>
      {details.trim() && !conversation && <button className="btn small secondary" type="button" disabled={busy || disabled} onClick={() => setMessage(details.slice(0, 1500))}>Reprendre ma description</button>}
      <label>Ton message<textarea value={message} maxLength={1500} disabled={busy || disabled} onChange={e => setMessage(e.target.value)} /></label>
      <button className="btn small secondary" type="button" disabled={busy || disabled || !message.trim()} onClick={() => void send()}>Envoyer à l’assistant</button>
    </>}
    {proposal && <div>
      <label>Description proposée (modifiable)<textarea maxLength={1000} value={proposal} disabled={busy || disabled} onChange={e => setProposal(e.target.value)} /></label>
      <button className="btn small secondary" type="button" disabled={busy || disabled || !proposal.trim()} onClick={() => {
        onApply(proposal.trim()); setStatus('Description reprise. Vérifie-la dans le formulaire avant l’envoi.');
      }}>Remplacer la description du formulaire</button>
    </div>}
    <p role="status" className="muted">{status}</p>
    {session.current && <button className="btn small secondary" type="button" disabled={busy} onClick={() => void erase()}>Supprimer cet échange</button>}
  </details>;
}
