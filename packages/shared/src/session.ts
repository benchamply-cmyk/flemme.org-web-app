import type { Actor, Command, Input, Task } from './domain.ts';
import { DemoGateway, RemoteGateway, newId } from './gateway.ts';
import type { DemoState, Gateway, TokenStorage } from './gateway.ts';
import { notices } from './textes.ts';

// État et actions de l’app, sans React ni DOM : le site et le mobile s’y abonnent (useSyncExternalStore)
// et ne gardent que l’affichage et la navigation. Toute la logique d’envoi (verrou, idempotence, erreurs) est ici.
export type SessionState = {
  gateway: Gateway | null; actorId: string; tasks: Task[];
  busy: boolean; ready: boolean; error: string; notice: string;
};
export type SessionOptions = {
  url: string; key: string; tokens: TokenStorage;
  readDemo: () => Promise<DemoState | null>; writeDemo: (s: DemoState) => Promise<void>;
  transport?: typeof fetch;
};
const message = (e: unknown) => e instanceof Error ? e.message : 'Une erreur est survenue.';

export class FlemmeSession {
  readonly remote: boolean;
  private options: SessionOptions;
  private state: SessionState = { gateway: null, actorId: '', tasks: [], busy: false, ready: false, error: '', notice: '' };
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
  async initialize() {
    await this.execute(async () => {
      const { url, key, tokens, readDemo, writeDemo, transport } = this.options;
      if (this.remote) {
        if (!url || !key) throw new Error('Configuration incomplète : renseigne l’URL et la clé publique Supabase.');
        const g = new RemoteGateway(url, key, tokens, transport); this.set({ gateway: g });
        if (await g.restore()) this.set({ actorId: g.actor.id, tasks: await g.list() });
      } else {
        const g = new DemoGateway(await readDemo(), writeDemo);
        this.set({ gateway: g, actorId: g.actor.id, tasks: await g.list() });
      }
    });
    this.set({ ready: true });
  }
  async refresh() { const g = this.state.gateway; if (g) await this.execute(async () => { this.set({ tasks: await g.list() }); }); }

  async login(email: string, password: string, done: () => void) {
    await this.execute(async () => {
      const g = this.state.gateway as RemoteGateway;
      await g.login(email, password); const tasks = await g.list();
      this.set({ actorId: g.actor.id, tasks }); done();
    });
  }
  async signup(email: string, password: string, done: () => void) {
    await this.execute(async () => {
      if (password.length < 12) throw new Error('Choisis un mot de passe d’au moins 12 caractères.');
      await (this.state.gateway as RemoteGateway).signup(email, password);
      this.set({ notice: notices.checkEmail }); done();
    });
  }
  /** `done` est appelé même si la déconnexion distante échoue : la session locale est toujours effacée. */
  async logout(done: () => void) {
    await this.execute(async () => {
      try { await (this.state.gateway as RemoteGateway).logout(); }
      finally { this.pending = null; this.set({ actorId: '', tasks: [] }); done(); }
    });
  }
  /** Démo locale : changer de personnage pour tester les deux côtés d’une mission. */
  async switchActor(actor: Actor, done: () => void) {
    const g = this.state.gateway;
    if (!(g instanceof DemoGateway)) return;
    await this.execute(async () => {
      g.actor = actor; const tasks = await g.list(); this.pending = null;
      this.set({ actorId: actor.id, tasks }); done();
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
      done(t);
    });
  }
}
