import { Linking } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { fileAccept } from '../../../packages/shared/src/index.ts';
import type { Upload } from '../../../packages/shared/src/index.ts';

// Choix d’un fichier sur le téléphone (pièce jointe ou photo de profil), transformé en Blob nommé pour packages/shared.
// Les contrôles de type et de taille (10 Mo) restent ceux de fileInput(), refaits par le serveur.
export async function pickFile(avatar = false): Promise<Upload | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: fileAccept(avatar).split(',').filter(t => t.includes('/')), copyToCacheDirectory: true, multiple: false });
  if (r.canceled || !r.assets?.length) return null;
  const a = r.assets[0];
  // Navigateur : un File, qui a déjà son nom. Téléphone : on relit le fichier copié en cache.
  if (a.file) return a.file;
  const blob = await (await fetch(a.uri)).blob();
  const typed = blob.type || !a.mimeType ? blob : blob.slice(0, blob.size, a.mimeType);
  return Object.assign(typed, { name: a.name });
}
/** Ouvre un fichier par son adresse temporaire (navigateur ou application du téléphone). */
export const openUrl = (url: string) => Linking.openURL(url);
