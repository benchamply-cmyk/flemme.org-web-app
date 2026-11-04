import { useEffect, useRef } from 'react';
import { date, fileAccept, fileSize } from '../../../../packages/shared/src/index.ts';
import type { FileItem, Task } from '../../../../packages/shared/src/index.ts';
import { session } from '../session.ts';
import { Action } from '../ui.tsx';

// Pièces jointes d’une flemme (lot 4) : PDF, JPEG, PNG ou Word, 10 Mo au plus, visibles du déposant et du Brigadier retenu.
export function Pieces({ task, actorId, files, busy }: { task: Task; actorId: string; files: FileItem[] | undefined; busy: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { void session.loadFiles(task.id); }, [task.id]);
  async function open(f: FileItem) {
    // Fenêtre ouverte tout de suite (sinon bloquée), adresse signée ensuite : valable 10 minutes.
    const w = window.open('', '_blank'); const url = await session.fileUrl(f.path);
    if (w && url) w.location.href = url; else w?.close();
  }
  return <><h2 className="section-title">Pièces jointes</h2>
    <p className="note">Visibles seulement du déposant et du Brigadier retenu. PDF, JPEG, PNG ou Word, 10 Mo au plus.</p>
    {files?.length ? files.map(f => <div className="card" key={f.id}><span className="row"><button type="button" className="link" onClick={() => void open(f)}>{f.name}</button><span className="note">{fileSize(f.size)}</span></span>
      <span className="note">Ajouté par {f.owner.name} · {date(f.at)}</span>
      {f.owner.id === actorId && <button type="button" className="btn small secondary" disabled={busy} onClick={() => session.deleteFile(task.id, f)}>Supprimer</button>}</div>)
      : <p className="muted">{files ? 'Aucun fichier pour l’instant.' : 'Chargement des fichiers…'}</p>}
    <input ref={input} id={'pj-' + task.id} type="file" accept={fileAccept()} hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void session.upload(task.id, f); }}/>
    <Action secondary disabled={busy} onClick={() => input.current?.click()}>Joindre un fichier</Action></>;
}
