import type { Actor, Command, Input, Task } from './domain.ts';
import { DemoGateway, RemoteGateway, newId } from './gateway.ts';
import type { AuthLinkOptions, DemoState, Gateway, TokenStorage } from './gateway.ts';
import { notices } from './textes.ts';
import type { SavedDraft, SearchFilter, SearchPage } from './parcours.ts';
import type { Profile } from './accord.ts';
import type { FileItem, HelpRequest, Upload } from './aide.ts';

// État et actions de l’app, sans React ni DOM : le site et le mobile s’y abonnent (useSyncExternalStore)
// et ne gardent que l’affichage et la navigation. Toute la logique d’envoi (verrou, idempotence, erreurs) est ici.
export type SessionState = {
  gateway: Gateway | null; actorId: string; tasks: Task[];
  /** Curseur de la page suivante de flemmes (null : tout est chargé). */
  more: string | null;
  /** Arrivée par un lien « mot de passe oublié » : proposer d’abord de choisir un mot de passe. */
  recovering: boolean;
  busy: boolean; ready: boolean; error: string; notice: string;
  /** Brouillons de la personne connectée (demandes et candidatures). */
  drafts: SavedDraft[];
  /** Résultats de « Résoudre une flemme » pour les filtres `filter` (null : pas encore cherché). */
  found: SearchPage | null; filter: SearchFilter;
  /** Dernier profil public ouvert (le sien ou celui d’un autre membre). */
  profile: Profile | null;
  /** Pièces jointes chargées, par flemme. */
  files: Record<string, FileItem[]>;
  /** Mes demandes d’aide à l’équipe (null : pas encore chargées). */
  help: HelpRequest[] | null;
};
/** Ce que le démarrage propre à une plateforme a obtenu (ex. retour d’un lien e-mail sur le web). */
export type StartResult = { signedIn: boolean; error?: string; recovering?: boolean; notice?: string };
export type SessionOptions = {
  url: string; key: string; tokens: TokenStorage;
  readDemo: () => Promise<DemoState | null>; writeDemo: (s: DemoState) => Promise<void>;
  transport?: typeof fetch;
  /** Problème de configuration détecté par la plateforme (affiché tel quel). */
  configProblem?: string;
  /** Étape facultative avant de reprendre la session enregistrée (web : retour d’un lien e-mail). */
  onStart?: (g: RemoteGateway) => Promise<StartResult>;
};
const message = (e: unknown) => e instanceof Error ? e.message : 'Une erreur est survenue.';
const shortPassword = 'Choisis un mot de passe d’au moins 12 caractères.';

export class FlemmeSession {
  readonly remote: boolean;
  private options: SessionOptions;
  private state: SessionState = { gateway: null, actorId: '', tasks: [], more: null, recovering: false, busy: false, ready: false, error: '', notice: '', drafts: [], found: null, filter: {}, profile: null, files: {}, help: null };
  private listeners = new Set<() => void>();
  private locked = false;
  // Identifiant de requête réutilisé tant que la même action est retentée : un double envoi ne crée rien en double.
  private pending: { signature: string; id: string } | null = null;

  constructor(options: SessionOptions) {
    this.options = options;
    this.remote = !!(options.url || options.key);
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getState = () => this.state;
  private set(patch: Partial<SessionState>) { this.state = { ...this.state, ...patch }; for (const l of this.listeners) l(); }
  private remoteGateway() { return this.state.gateway as RemoteGateway; }
  clearMessages() { if (this.state.error || this.state.notice) this.set({ error: '', notice: '' }); }
  notify(notice: string) { this.set({ notice }); }
  fail(error: string) { this.set({ error }); }

  /** Une seule action à la fois ; l’erreur est affichée au lieu d’un faux succès. */
  async execute(fn: () => Promise<void>) {
    if (this.locked) return;
    this.locked = true; this.set({ busy: true, error: '', notice: '' });
    try { await fn(); } catch (e) { this.set({ error: message(e) }); }
    finally { this.locked = false; this.set({ busy: false }); }
  }
  /** Première page (remplace la liste) ou page suivante (ajoutée à la suite, sans doublon). */
  private async load(g: Gateway, cursor: string | null = null) {
    const page = await g.list(cursor);
    const old = this.state.tasks;
    this.set({ tasks: cursor ? [...old, ...page.tasks.filter(t => !old.some(v => v.id === t.id))] : page.tasks, more: page.nextCursor });
    // Les brouillons sont secondaires : une base sans la migration parcours (action « drafts » inconnue)
    // ne doit jamais empêcher d’afficher les flemmes.
    if (!cursor) this.set({ drafts: await g.drafts().catch(() => []) });
  }
  async initialize() {
    await this.execute(async () => {
      const { url, key, tokens, readDemo, writeDemo, transport, configProblem, onStart } = this.options;
      if (this.remote) {
        if (configProblem) throw new Error(configProblem);
        if (!url || !key) throw new Error('Configuration incomplète : renseigne l’URL et la clé publique Supabase.');
        const g = new RemoteGateway(url, key, tokens, transport); this.set({ gateway: g });
        const start: StartResult = onStart ? await onStart(g) : { signedIn: false };
        if (start.recovering) this.set({ recovering: true });
        if (start.notice) this.set({ notice: start.notice });
        // Lien expiré ou déjà utilisé : on garde la session éventuelle, puis on affiche l’erreur.
        if (start.signedIn || await g.restore()) { this.set({ actorId: g.actor.id }); await this.load(g); }
        if (start.error) throw new Error(start.error);
      } else {
        const g = new DemoGateway(await readDemo(), writeDemo);
        this.set({ gateway: g, actorId: g.actor.id }); await this.load(g);
      }
    });
    this.set({ ready: true });
  }
  /** Nouvelle recherche (remplace les résultats) ; `more` ajoute la page suivante. */
  async search(filter: SearchFilter, more = false) {
    const g = this.state.gateway, found = this.state.found;
    if (!g || (more && !found?.nextCursor)) return;
    await this.execute(async () => {
      const page = await g.search(filter, more ? found!.nextCursor : null);
      this.set({ filter, found: more && found ? { ...page, tasks: [...found.tasks, ...page.tasks.filter(t => !found.tasks.some(v => v.id === t.id))] } : page });
    });
  }
  async refresh() { const g = this.state.gateway; if (g) await this.execute(() => this.load(g)); }
  async loadMore() { const g = this.state.gateway, more = this.state.more; if (g && more) await this.execute(() => this.load(g, more)); }

  async login(email: string, password: string, done: () => void) {
    await this.execute(async () => {
      const g = this.remoteGateway();
      await g.login(email, password); await this.load(g);
      this.set({ actorId: g.actor.id }); done();
    });
  }
  /** `link` prépare le lien de confirmation envoyé par e-mail (web) ; `notice` remplace le message par défaut. */
  async signup(email: string, password: string, done: () => void, o: { link?: () => Promise<AuthLinkOptions>; notice?: string } = {}) {
    await this.execute(async () => {
      if (password.length < 12) throw new Error(shortPassword);
      await this.remoteGateway().signup(email, password, o.link ? await o.link() : undefined);
      this.set({ notice: o.notice || notices.checkEmail }); done();
    });
  }
  /** Mot de passe oublié, ou jamais créé (comptes repris de l’ancien espace). */
  async recover(email: string, link: () => Promise<AuthLinkOptions>, done: () => void) {
    await this.execute(async () => {
      if (!email.trim()) throw new Error('Indique ton adresse e-mail, puis choisis « Mot de passe oublié ? ».');
      await this.remoteGateway().recover(email, await link());
      this.set({ notice: notices.recoverSent }); done();
    });
  }
  async setPassword(password: string, done: () => void) {
    await this.execute(async () => {
      if (password.length < 12) throw new Error(shortPassword);
      await this.remoteGateway().setPassword(password);
      this.set({ recovering: false, notice: notices.passwordSaved }); done();
    });
  }
  skipRecovery() { this.set({ recovering: false }); }
  async updateProfile(displayName: string, done: () => void) {
    await this.execute(async () => {
      await this.remoteGateway().updateProfile(displayName);
      this.set({ notice: notices.nameUpdated }); done();
    });
  }
  /** `done` est appelé même si la déconnexion distante échoue : la session locale est toujours effacée. */
  async logout(done: () => void) {
    await this.execute(async () => {
      try { await this.remoteGateway().logout(); }
      finally { this.pending = null; this.set({ actorId: '', tasks: [], more: null, drafts: [], found: null, filter: {}, profile: null, files: {}, help: null }); done(); }
    });
  }
  /** Démo locale : changer de personnage pour tester les deux côtés d’une mission. */
  async switchActor(actor: Actor, done: () => void) {
    const g = this.state.gateway;
    if (!(g instanceof DemoGateway)) return;
    await this.execute(async () => {
      g.actor = actor; this.set({ actorId: actor.id, found: null, profile: null, files: {}, help: null }); await this.load(g); this.pending = null; done();
    });
  }
  /** Charge un profil public (le sien si `userId` est absent). */
  async openProfile(userId?: string) {
    const g = this.state.gateway;
    if (!g) return;
    this.set({ profile: null });
    await this.execute(async () => { this.set({ profile: await g.profile(userId) }); });
  }
  async saveProfile(data: Input, done: () => void) {
    const g = this.state.gateway;
    if (!g) return;
    await this.execute(async () => { this.set({ profile: await g.saveProfile(data), notice: notices.profileSaved }); done(); });
  }
  async loadFiles(taskId: string) {
    const g = this.state.gateway;
    if (!g) return;
    // Secondaire, comme les brouillons : une base sans le lot 4 ne doit pas afficher d’erreur sur chaque fiche.
    const list = await g.files(taskId).catch(() => []);
    this.set({ files: { ...this.state.files, [taskId]: list } });
  }
  /** Pièce jointe (taskId) ou photo de profil (taskId null). */
  async upload(taskId: string | null, file: Upload) {
    const g = this.state.gateway;
    if (!g) return;
    await this.execute(async () => {
      const item = await g.upload(taskId, file);
      if (taskId) this.set({ files: { ...this.state.files, [taskId]: [...(this.state.files[taskId] || []), item] }, notice: notices.fileSent });
      else { const p = this.state.profile; this.set({ profile: p && p.id === this.state.actorId ? { ...p, avatar: item.path } : p, notice: notices.avatarSaved }); }
    });
  }
  async deleteFile(taskId: string, file: FileItem) {
    const g = this.state.gateway;
    if (!g) return;
    await this.execute(async () => {
      await g.deleteFile(file);
      this.set({ files: { ...this.state.files, [taskId]: (this.state.files[taskId] || []).filter(f => f.id !== file.id) }, notice: notices.fileDeleted });
    });
  }
  /** Adresse temporaire d’un fichier, ou null (erreur affichée). */
  async fileUrl(path: string): Promise<string | null> {
    const g = this.state.gateway;
    if (!g) return null;
    try { return await g.fileUrl(path); } catch (e) { this.set({ error: message(e) }); return null; }
  }
  async loadHelp() {
    const g = this.state.gateway;
    if (!g) return;
    await this.execute(async () => { this.set({ help: await g.helpList() }); });
  }
  async sendHelp(data: Input, done: () => void) {
    const g = this.state.gateway;
    if (!g) return;
    await this.execute(async () => {
      const signature = JSON.stringify([this.state.actorId, 'help', data]);
      if (this.pending?.signature !== signature) this.pending = { signature, id: newId() };
      const h = await g.helpSend(data, this.pending.id);
      this.pending = null;
      this.set({ help: [h, ...(this.state.help || []).filter(x => x.id !== h.id)], notice: notices.helpSent }); done();
    });
  }
  /** Enregistre (ou remplace) un brouillon sur le compte. `id` absent : nouveau brouillon. */
  async saveDraft(draft: { id?: string; kind: SavedDraft['kind']; taskId?: string | null; fields: Record<string, string> }, done: (d: SavedDraft) => void) {
    const g = this.state.gateway;
    if (!g) return;
    await this.execute(async () => {
      const saved = await g.saveDraft({ id: draft.id || newId(), kind: draft.kind, taskId: draft.taskId ?? null, fields: draft.fields });
      this.set({ drafts: [saved, ...this.state.drafts.filter(d => d.id !== saved.id)], notice: notices.draftSaved });
      done(saved);
    });
  }
  async deleteDraft(id: string) {
    const g = this.state.gateway;
    if (!g) return;
    await this.execute(async () => {
      await g.deleteDraft(id);
      this.set({ drafts: this.state.drafts.filter(d => d.id !== id), notice: notices.draftDeleted });
    });
  }
  /** Crée une flemme ou applique une action. `done` reçoit la flemme à jour, avant l’affichage du message. */
  async mutate(action: Command | 'create', taskId: string, data: Input, done: (task: Task) => void) {
    const g = this.state.gateway;
    if (!g) return;
    await this.execute(async () => {
      const signature = JSON.stringify([this.state.actorId, action, taskId, data]);
      if (this.pending?.signature !== signature) this.pending = { signature, id: newId() };
      const t = action === 'create' ? await g.create(data, this.pending.id) : await g.command(taskId, action, data, this.pending.id);
      this.pending = null;
      this.set({ tasks: [t, ...this.state.tasks.filter(v => v.id !== t.id)] });
      // Une proposition envoyée sort la flemme des résultats « disponibles ».
      const found = this.state.found;
      if (found?.tasks.some(v => v.id === t.id)) this.set({ found: { ...found, tasks: found.tasks.map(v => v.id === t.id ? t : v) } });
      // Le serveur supprime le brouillon envoyé (draftId) : la liste locale suit.
      if (typeof data.draftId === 'string') this.set({ drafts: this.state.drafts.filter(d => d.id !== data.draftId) });
      done(t);
    });
  }
}
