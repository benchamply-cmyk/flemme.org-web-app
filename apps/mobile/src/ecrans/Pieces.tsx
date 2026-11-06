import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { date, fileSize } from '../../../../packages/shared/src/index.ts';
import type { FileItem, Task } from '../../../../packages/shared/src/index.ts';
import { openUrl, pickFile } from '../fichiers';
import { session } from '../session';
import { Action } from '../ui/composants';
import { styles } from '../ui/styles';

// Pièces jointes d’une demande : PDF, JPEG, PNG ou Word, 10 Mo au plus, visibles du déposant et du Brigadier retenu.
export function Pieces({ task, actorId, files, busy }: { task: Task; actorId: string; files: FileItem[] | undefined; busy: boolean }) {
  useEffect(() => { void session.loadFiles(task.id); }, [task.id]);
  async function open(f: FileItem) { const url = await session.fileUrl(f.path); if (url) await openUrl(url).catch(() => session.fail('Impossible d’ouvrir ce fichier sur cet appareil.')); }
  async function add() { try { const f = await pickFile(); if (f) await session.upload(task.id, f); } catch (e) { session.fail((e as Error).message); } }
  return <><Text style={styles.sectionTitle}>Pièces jointes</Text>
    <Text style={styles.note}>Visibles seulement du déposant et du Brigadier retenu. PDF, JPEG, PNG ou Word, 10 Mo au plus.</Text>
    {files?.length ? files.map(f => <View style={styles.card} key={f.id}><View style={styles.row}><Text style={[styles.strong, styles.inlineLink]} accessibilityRole="link" onPress={() => void open(f)}>{f.name}</Text><Text style={styles.note}>{fileSize(f.size)}</Text></View>
      <Text style={styles.note}>Ajouté par {f.owner.name} · {date(f.at)}</Text>
      {f.owner.id === actorId && <Action small secondary disabled={busy} onPress={() => session.deleteFile(task.id, f)}>Supprimer</Action>}</View>)
      : <Text style={styles.muted}>{files ? 'Aucun fichier pour l’instant.' : 'Chargement des fichiers…'}</Text>}
    <Action secondary disabled={busy} onPress={() => void add()}>Joindre un fichier</Action></>;
}
