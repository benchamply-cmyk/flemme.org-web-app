import { useEffect, useState } from 'react';
import { FAQ, HELP_TOPICS, assistant, date, helpInput, helpStatus } from '../../../../packages/shared/src/index.ts';
import { session } from '../session.ts';
import { Action } from '../ui.tsx';
import type { Ctx } from './contexte.ts';

// Écran « help » : assistant à réponses prédéfinies (sans IA), puis message à l’équipe FLEMME, traité dans /admin.
export function Aide({ state: { busy, help, tasks, actorId }, draft, field, choice, validated, clearDraft }: Ctx) {
  const [asked, setAsked] = useState(''), [human, setHuman] = useState(false);
  useEffect(() => { if (session.remote || help == null) void session.loadHelp(); }, []);
  const answers = asked ? assistant(asked) : FAQ.slice(0, 4);
  const mine = tasks.filter(t => t.owner.id === actorId || t.offers.some(o => o.brigadier.id === actorId)).map(t => ({ value: t.id, label: t.title }));
  return <><h1 className="heading">Besoin d’aide ?</h1><p className="muted">Pose ta question : l’assistant propose les réponses de l’équipe. Si ça ne suffit pas, écris-nous.</p>
    {field('Ta question', 'question', { max: 200 })}
    <Action secondary disabled={busy} onClick={() => setAsked(draft.question || '')}>Chercher une réponse</Action>
    <h2 className="section-title">{asked ? (answers.length ? 'Réponses proposées' : 'Aucune réponse toute prête') : 'Questions fréquentes'}</h2>
    {answers.map(f => <details className="card" key={f.id}><summary className="strong">{f.question}</summary><p>{f.answer}</p></details>)}
    {!human ? <Action disabled={busy} onClick={() => setHuman(true)}>Écrire à l’équipe FLEMME</Action>
      : <><h2 className="section-title">Écrire à l’équipe FLEMME</h2><p className="note">Une personne de l’équipe lit chaque message. Ne partage jamais de mot de passe ni de numéro de carte.</p>
        {choice('Sujet', 'topic', HELP_TOPICS, 'Choisir')}
        {mine.length > 0 && choice('Flemme concernée (facultatif)', 'taskId', mine, 'Aucune')}
        {field('Ton message', 'helpText', { multiline: true, max: 2000 })}
        <Action disabled={busy} onClick={() => validated(() => { void session.sendHelp(helpInput(draft.topic, draft.helpText, draft.taskId), () => { clearDraft(['topic', 'taskId', 'helpText']); setHuman(false); }); })}>Envoyer mon message</Action></>}
    {help && help.length > 0 && <><h2 className="section-title">Mes messages</h2>
      {help.map(h => <div className="bubble" key={h.id}><span className="strong">{HELP_TOPICS.find(t => t.value === h.topic)?.label} · {helpStatus[h.status]}</span><span>{h.text}</span><span className="note">{date(h.at)}</span>
        {h.answer && <><span className="strong">Réponse de l’équipe FLEMME</span><span>{h.answer}</span>{h.answeredAt && <span className="note">{date(h.answeredAt)}</span>}</>}</div>)}</>}</>;
}
