import { useEffect, useRef, useState } from 'react';
import { appendDictation } from '../../../../packages/shared/src/index.ts';

// Dictée avec la reconnaissance vocale du navigateur (Web Speech API), sans service FLEMME ni clé.
// Chrome et Edge envoient l’audio à leur propre service (Google, Microsoft) : la personne en est prévenue.
// Absente (Firefox…) : le bouton n’est pas affiché.
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };
const Engine = (globalThis as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition
  || (globalThis as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
const errors: Record<string, string> = {
  'not-allowed': 'Micro refusé. Autorise-le dans les réglages du navigateur pour dicter.',
  'no-speech': 'Aucune parole détectée. Réessaie plus près du micro.',
  network: 'Dictée indisponible sans connexion.',
};

export function Dictee({ current, onText, disabled }: { current: string; onText: (text: string) => void; disabled?: boolean }) {
  const [listening, setListening] = useState(false), [error, setError] = useState('');
  const engine = useRef<Recognition | null>(null), text = useRef(current);
  text.current = current;
  useEffect(() => () => engine.current?.stop(), []);
  if (!Engine) return null;
  function toggle() {
    if (listening) { engine.current?.stop(); return; }
    const r = new Engine!();
    r.lang = 'fr-FR'; r.interimResults = false; r.continuous = true;
    r.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) {
        text.current = appendDictation(text.current, e.results[i][0].transcript.trim()); onText(text.current);
      }
    };
    r.onerror = e => setError(errors[e.error] || 'La dictée s’est interrompue.');
    r.onend = () => setListening(false);
    engine.current = r; setError(''); setListening(true); r.start();
  }
  return <div className="dictee">
    <button type="button" className="btn small secondary" disabled={disabled} aria-pressed={listening} onClick={toggle}>{listening ? '■ Arrêter la dictée' : '◉ Dicter'}</button>
    <span className="note" aria-live="polite">{listening ? 'Je t’écoute… Le texte s’ajoute à la description, modifiable.' : 'La reconnaissance vocale de ton navigateur peut envoyer l’audio à son éditeur (Google pour Chrome).'}</span>
    {error && <span role="alert" className="note">{error}</span>}
  </div>;
}
