import React, { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { date, profileFields, profileInput, stars } from '../../../../packages/shared/src/index.ts';
import { pickFile } from '../fichiers';
import { session } from '../session';
import { Action } from '../ui/composants';
import { styles } from '../ui/styles';
import type { Ctx } from './contexte';

// Écran « profile » : profil public d’un membre (présentation, compétences, missions, avis) ; le sien est modifiable.
export function Profil({ state: { busy, actorId, profile }, place: { userId }, draft, field, fill, validated }: Ctx) {
  const id = userId || actorId, own = id === actorId;
  const [photo, setPhoto] = useState(''), avatar = profile?.id === id ? profile.avatar : null;
  useEffect(() => { setPhoto(''); if (avatar) void session.fileUrl(avatar).then(u => setPhoto(u || '')); }, [avatar]);
  useEffect(() => { void session.openProfile(id).then(() => { const p = session.getState().profile; if (own && p) fill(profileFields(p)); }); }, [id]);
  async function changePhoto() { try { const f = await pickFile(true); if (f) await session.upload(null, f); } catch (e) { session.fail((e as Error).message); } }
  if (!profile || profile.id !== id) return busy ? null : <><Text style={styles.heading}>Profil indisponible</Text><Action secondary onPress={() => session.openProfile(id)}>Réessayer</Action></>;
  return <><View style={styles.profileHead}><View style={styles.avatarPhoto}>{photo ? <Image source={{ uri: photo }} accessibilityLabel={'Photo de ' + profile.name} style={{ width: 64, height: 64 }}/> : <Text style={styles.avatarLettre}>{profile.name.slice(0, 1).toUpperCase()}</Text>}</View>
    <Text style={[styles.heading, { flex: 1 }]}>{own ? 'Mon profil public' : profile.name}</Text></View>
    <Text style={styles.muted}>Membre depuis le {date(profile.since).split(' ')[0]} · {profile.missions} mission(s) réalisée(s){profile.rating != null ? ` · ${stars(profile.rating)} ${String(profile.rating).replace('.', ',')}/5` : ' · pas encore d’avis'}</Text>
    {!!profile.bio && <Text style={styles.body}>{profile.bio}</Text>}
    {profile.skills.length > 0 && <View style={styles.tags}>{profile.skills.map(s => <Text style={styles.tag} key={s}>{s}</Text>)}</View>}
    {!!profile.experience && <><Text style={styles.sectionTitle}>Expérience</Text><Text style={styles.body}>{profile.experience}</Text></>}
    <Text style={styles.sectionTitle}>Avis reçus</Text>
    {profile.reviews.length === 0 && <Text style={styles.muted}>Aucun avis pour l’instant. Les avis arrivent après chaque mission terminée.</Text>}
    {profile.reviews.map((r, i) => <View style={styles.bubble} key={i}><Text style={styles.strong}>{stars(r.rating)} · {r.author.name}</Text>{!!r.text && <Text style={styles.body}>{r.text}</Text>}<Text style={styles.note}>{r.task} · {date(r.at)}</Text></View>)}
    {own && <><Text style={styles.sectionTitle}>Modifier mon profil</Text><Text style={styles.note}>Visible des autres membres connectés. Jamais ton e-mail ni ton adresse.</Text>
      <Action secondary disabled={busy} onPress={() => void changePhoto()}>{avatar ? 'Changer ma photo' : 'Ajouter une photo'} · JPEG ou PNG, 10 Mo au plus</Action>
      {field('Nom affiché', 'displayName', { max: 40 })}
      {field('Présentation', 'bio', { multiline: true, max: 600, hint: 'Quelques mots sur toi et ce que tu aimes faire.' })}
      {field('Compétences', 'skills', { max: 500, hint: 'Séparées par des virgules, 10 au plus' })}
      {field('Expérience', 'experience', { multiline: true, max: 1000 })}
      <Action disabled={busy} onPress={() => validated(() => { void session.saveProfile(profileInput(draft), () => {}); })}>Enregistrer mon profil</Action></>}</>;
}
