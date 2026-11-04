import { useEffect } from 'react';
import { date, profileFields, profileInput, stars } from '../../../../packages/shared/src/index.ts';
import { session } from '../session.ts';
import { Action } from '../ui.tsx';
import type { Ctx } from './contexte.ts';

// Écran « profile » : profil public d’un membre (présentation, compétences, missions, avis) ; le sien est modifiable.
export function Profil({ state: { busy, actorId, profile }, place: { userId }, draft, field, fill, validated }: Ctx) {
  const id = userId || actorId, own = id === actorId;
  useEffect(() => { void session.openProfile(id).then(() => { const p = session.getState().profile; if (own && p) fill(profileFields(p)); }); }, [id]);
  if (!profile || profile.id !== id) return busy ? null : <><h1 className="heading">Profil indisponible</h1><Action secondary onClick={() => session.openProfile(id)}>Réessayer</Action></>;
  return <><h1 className="heading">{own ? 'Mon profil public' : profile.name}</h1>
    <p className="muted">Membre depuis le {date(profile.since).split(' ')[0]} · {profile.missions} mission(s) réalisée(s){profile.rating != null ? ` · ${stars(profile.rating)} ${String(profile.rating).replace('.', ',')}/5` : ' · pas encore d’avis'}</p>
    {profile.bio && <p>{profile.bio}</p>}
    {profile.skills.length > 0 && <p>{profile.skills.map(s => <span className="tag" key={s}>{s}</span>)}</p>}
    {profile.experience && <><h2 className="section-title">Expérience</h2><p>{profile.experience}</p></>}
    <h2 className="section-title">Avis reçus</h2>
    {profile.reviews.length === 0 && <p className="muted">Aucun avis pour l’instant. Les avis arrivent après chaque mission terminée.</p>}
    {profile.reviews.map((r, i) => <div className="bubble" key={i}><span className="strong">{stars(r.rating)} · {r.author.name}</span>{r.text && <span>{r.text}</span>}<span className="note">{r.task} · {date(r.at)}</span></div>)}
    {own && <><h2 className="section-title">Modifier mon profil</h2><p className="note">Visible des autres membres connectés. Jamais ton e-mail ni ton adresse.</p>
      {field('Nom affiché', 'displayName', { max: 40 })}
      {field('Présentation', 'bio', { multiline: true, max: 600, hint: 'Quelques mots sur toi et ce que tu aimes faire.' })}
      {field('Compétences', 'skills', { max: 500, hint: 'Séparées par des virgules, 10 au plus. Ex. : montage de meubles, démarches en ligne' })}
      {field('Expérience', 'experience', { multiline: true, max: 1000 })}
      <Action disabled={busy} onClick={() => validated(() => { void session.saveProfile(profileInput(draft), () => {}); })}>Enregistrer mon profil</Action></>}</>;
}
