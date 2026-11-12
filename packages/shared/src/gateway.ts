import { applyCommand, createTask, visibleTask } from './domain.ts';
import type { Actor, Command, Input, Task } from './domain.ts';
import type { SavedDraft, SearchFilter, SearchPage } from './parcours.ts';
import { searchTasks } from './parcours.ts';
import type { Profile } from './accord.ts';
import type { FileItem, HelpRequest, Upload } from './aide.ts';
import { fileInput } from './aide.ts';

// Identifiants de ressources/idempotence uniquement : jamais utilisés comme secrets.
export const newId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const n = Math.floor(Math.random() * 16); return (c === 'x' ? n : (n & 3) | 8).toString(16);
});
// Une page de flemmes ; nextCursor permet de demander la suivante (null : plus rien).
export type TaskPage = { tasks: Task[]; nextCursor: string | null };
export const PAGE_SIZE = 50;
export interface Gateway {
  actor: Actor;
  list(cursor?: string | null): Promise<TaskPage>;
  create(data: Input, requestId: string): Promise<Task>;
  command(taskId: string, action: Command, data: Input, requestId: string): Promise<Task>;
  /** Recherche parmi les flemmes publiées des autres membres (filtres et tri côté serveur). */
  search(filter: SearchFilter, cursor?: string | null): Promise<SearchPage>;
  /** Brouillons de demande et de candidature, enregistrés sur le compte. */
  drafts(): Promise<SavedDraft[]>;
  saveDraft(draft: Omit<SavedDraft, 'updatedAt'>): Promise<SavedDraft>;
  deleteDraft(id: string): Promise<void>;
  /** Profil public d’un membre (le sien si `userId` est absent) : présentation, compétences, missions et avis. */
  profile(userId?: string): Promise<Profile>;
  saveProfile(data: Input): Promise<Profile>;
  /** Pièces jointes d’une flemme (déposant et Brigadier retenu). */
  files(taskId: string): Promise<FileItem[]>;
  /** Envoie une pièce jointe (taskId) ou la photo de profil (taskId null). */
  upload(taskId: string | null, file: Upload): Promise<FileItem>;
  deleteFile(file: FileItem): Promise<void>;
  /** Adresse temporaire pour ouvrir un fichier du bucket privé. */
  fileUrl(path: string): Promise<string>;
  helpList(): Promise<HelpRequest[]>;
  helpSend(data: Input, requestId: string): Promise<HelpRequest>;
}
export const demoActors: Actor[] = [{ id: 'demo-ben', name: 'Benjamin' }, { id: 'demo-lou', name: 'Lou' }, { id: 'demo-camille', name: 'Camille' }];
export function seed(): Task[] {
  const at = '2026-10-28T08:00:00.000Z';
  const a = createTask('demo-colis', demoActors[0], { title: 'Faire mes retours de colis', details: 'Deux colis à déposer au point relais. Étiquettes imprimées, déplacement compris dans le forfait proposé.', place: 'Aix-en-Provence', budget: 2000 }, at);
  return [applyCommand(a, demoActors[1], 'offer', { id: 'demo-offer', amount: 2000, slot: 'Samedi matin', scope: 'Récupération à domicile et dépôt des deux colis, déplacement compris.' }, at),
    createTask('demo-meuble', demoActors[2], { title: 'Monter mon meuble IKEA', details: 'Un petit meuble à monter. Outils disponibles. Sans fixation au mur.', place: 'Aix-en-Provence', budget: 3500 }, at),
    createTask('demo-cv', demoActors[1], { title: 'Remettre mon CV au propre', details: 'Une page à remettre en forme. Le contenu est déjà rédigé.', place: 'À distance', budget: null }, at)];
}
export type DemoProfile = { bio: string | null; skills: string[]; experience: string | null };
export type DemoState = { version: 1; tasks: Task[]; requests: Record<string, Task>; drafts?: (SavedDraft & { ownerId: string })[]; profiles?: Record<string, DemoProfile>;
  help?: (HelpRequest & { ownerId: string })[] };
export class DemoGateway implements Gateway {
  actor = demoActors[0];
  private state: DemoState;
  private persist: (s: DemoState) => Promise<void>;
  constructor(saved: DemoState | null, persist: (s: DemoState) => Promise<void>) {
    this.persist = persist;
    this.state = saved || { version: 1, tasks: seed(), requests: {} };
  }
  async list(): Promise<TaskPage> {
    return { tasks: this.state.tasks.filter(t => t.status === 'open' || t.owner.id === this.actor.id || t.offers.some(o => o.brigadier.id === this.actor.id)).map(t => visibleTask(t, this.actor)), nextCursor: null };
  }
  private async commit(task: Task, request: string): Promise<Task> {
    const next: DemoState = JSON.parse(JSON.stringify(this.state));
    const index = next.tasks.findIndex(t => t.id === task.id);
    if (index < 0) next.tasks.unshift(task); else next.tasks[index] = task;
    next.requests[this.actor.id + ':' + request] = task;
    await this.persist(next); // Ne jamais annoncer un succès si la sauvegarde échoue.
    this.state = next;
    return visibleTask(task, this.actor);
  }
  async create(data: Input, request: string) {
    const prior = this.state.requests[this.actor.id + ':' + request];
    if (prior) return visibleTask(prior, this.actor);
    const task = await this.commit(createTask(newId(), this.actor, data, new Date().toISOString()), request);
    if (typeof data.draftId === 'string') await this.deleteDraft(data.draftId);
    return task;
  }
  async search(filter: SearchFilter, cursor: string | null = null): Promise<SearchPage> {
    const all = searchTasks(this.state.tasks, this.actor.id, filter), start = Number(cursor || 0);
    return { tasks: all.slice(start, start + PAGE_SIZE).map(t => visibleTask(t, this.actor)), total: all.length,
      nextCursor: start + PAGE_SIZE < all.length ? String(start + PAGE_SIZE) : null };
  }
  async drafts(): Promise<SavedDraft[]> {
    return (this.state.drafts || []).filter(d => d.ownerId === this.actor.id).map(({ ownerId: _, ...d }) => d)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  private async saveDrafts(drafts: DemoState['drafts']) {
    const next: DemoState = { ...this.state, drafts };
    await this.persist(next); this.state = next;
  }
  async saveDraft(d: Omit<SavedDraft, 'updatedAt'>): Promise<SavedDraft> {
    const saved = { ...d, updatedAt: new Date().toISOString() };
    const others = (this.state.drafts || []).filter(x => x.id !== d.id || x.ownerId !== this.actor.id);
    await this.saveDrafts([{ ...saved, ownerId: this.actor.id }, ...others]);
    return saved;
  }
  async deleteDraft(id: string) {
    await this.saveDrafts((this.state.drafts || []).filter(x => x.id !== id || x.ownerId !== this.actor.id));
  }
  async profile(userId = this.actor.id): Promise<Profile> {
    const who = demoActors.find(a => a.id === userId);
    if (!who) throw new Error('Profil introuvable');
    const p = this.state.profiles?.[userId] || { bio: null, skills: [], experience: null };
    const done = this.state.tasks.filter(t => t.status === 'completed');
    const reviews = done.flatMap(t => (t.ratings || []).filter(r => r.targetId === userId).map(r => ({
      rating: r.rating, text: r.text, author: demoActors.find(a => a.id === r.authorId) || { id: r.authorId, name: 'Membre' }, task: t.title, at: r.at })))
      .sort((a, b) => b.at.localeCompare(a.at));
    return { id: who.id, name: who.name, ...p, avatar: this.avatars[userId] || null, since: '2026-10-28T08:00:00.000Z',
      missions: done.filter(t => t.agreement?.brigadier.id === userId).length,
      rating: reviews.length ? Math.round(reviews.reduce((n, r) => n + r.rating, 0) / reviews.length * 10) / 10 : null, reviews };
  }
  async saveProfile(data: Input): Promise<Profile> {
    const p: DemoProfile = { bio: (data.bio as string | null) ?? null, experience: (data.experience as string | null) ?? null, skills: (data.skills as string[]) || [] };
    const next: DemoState = { ...this.state, profiles: { ...this.state.profiles, [this.actor.id]: p } };
    await this.persist(next); this.state = next;
    return this.profile();
  }
  // Démo : fichiers gardés en mémoire le temps de la visite (jamais envoyés, perdus au rechargement).
  private blobs = new Map<string, { item: FileItem; taskId: string | null; url: string }>();
  async files(taskId: string) { return [...this.blobs.values()].filter(b => b.taskId === taskId).map(b => b.item); }
  async upload(taskId: string | null, file: Upload) {
    const meta = fileInput({ name: file.name, type: file.type, size: file.size }, taskId == null);
    const id = newId(), item: FileItem = { id, name: meta.name as string, mime: meta.mime as string, size: file.size, path: this.actor.id + '/' + id, owner: this.actor, at: new Date().toISOString() };
    if (taskId == null) for (const [k, b] of this.blobs) if (b.taskId == null && b.item.owner.id === this.actor.id) this.blobs.delete(k);
    this.blobs.set(item.path, { item, taskId, url: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '' });
    if (taskId == null) this.avatars[this.actor.id] = item.path;
    return item;
  }
  private avatars: Record<string, string> = {};
  async deleteFile(f: FileItem) { if (f.owner.id !== this.actor.id) throw new Error('Fichier introuvable'); this.blobs.delete(f.path); }
  async fileUrl(path: string) { const b = this.blobs.get(path); if (!b) throw new Error('Fichier introuvable'); return b.url; }
  async helpList(): Promise<HelpRequest[]> { return (this.state.help || []).filter(h => h.ownerId === this.actor.id).map(({ ownerId: _, ...h }) => h); }
  async helpSend(data: Input): Promise<HelpRequest> {
    const h: HelpRequest = { id: newId(), topic: data.topic as HelpRequest['topic'], text: String(data.text), status: 'open', answer: null,
      taskId: (data.taskId as string | null) || null, at: new Date().toISOString(), answeredAt: null };
    const next: DemoState = { ...this.state, help: [{ ...h, ownerId: this.actor.id }, ...(this.state.help || [])] };
    await this.persist(next); this.state = next;
    return h;
  }
  async command(taskId: string, action: Command, data: Input, request: string) {
    const prior = this.state.requests[this.actor.id + ':' + request];
    if (prior) return visibleTask(prior, this.actor);
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) throw new Error('Flemme introuvable.');
    const next = await this.commit(applyCommand(task, this.actor, action, action === 'offer' || action === 'apply' ? { ...data, id: newId() } : data, new Date().toISOString()), request);
    if (action === 'apply' && typeof data.draftId === 'string') await this.deleteDraft(data.draftId);
    return next;
  }
}

export interface TokenStorage { get(): Promise<string | null>; set(value: string): Promise<void>; clear(): Promise<void> }
type Session = { access_token: string; refresh_token: string; expires_in: number; user: { id: string; email: string } };
// Codes d’erreur stables de Supabase Auth, traduits pour l’utilisateur.
const authErrors: Record<string, string> = {
  invalid_credentials: 'E-mail ou mot de passe incorrect.',
  email_not_confirmed: 'Confirme d’abord ton adresse avec le lien reçu par e-mail.',
  user_already_exists: 'Un compte existe déjà avec cette adresse : connecte-toi, ou choisis « Mot de passe oublié ? ».',
  email_address_invalid: 'Cette adresse e-mail n’est pas valide.',
  weak_password: 'Mot de passe trop faible : choisis-en un plus long.',
  same_password: 'C’est déjà ton mot de passe actuel.',
  over_email_send_rate_limit: 'Trop d’e-mails envoyés pour l’instant. Réessaie un peu plus tard ou utilise le dernier e-mail reçu.',
  over_request_rate_limit: 'Trop de tentatives. Patiente une minute avant de réessayer.',
  otp_expired: 'Ce lien a expiré ou a déjà servi. Demande-en un nouveau.',
  flow_state_expired: 'Ce lien a expiré. Demande-en un nouveau.',
  flow_state_not_found: 'Ce lien a été ouvert dans un autre navigateur que celui de la demande. Redemande-le depuis ce navigateur.',
  access_denied: 'Connexion annulée.',
};
export const authMessage = (code: string | null | undefined, fallback: string) => (code && authErrors[code]) || fallback;
// Clé « anon » historique (JWT) : refuser une clé service_role collée par erreur, elle finirait dans le code public.
const jwtRole = (key: string) => {
  try { return String(JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role || ''); } catch { return ''; }
};
export const isSecretKey = (key: string) => key.startsWith('sb_secret_') || jwtRole(key) === 'service_role';
// Liens envoyés par e-mail (inscription, mot de passe oublié) : page de retour et empreinte PKCE facultatives.
export type AuthLinkOptions = { redirectTo?: string; codeChallenge?: string };
export class RemoteGateway implements Gateway {
  actor: Actor = { id: '', name: '' };
  private access = '';
  private expires = 0;
  private refreshing: Promise<void> | null = null;
  private url: string;
  private key: string;
  private tokens: TokenStorage;
  private transport: typeof fetch;
  // fetch enveloppé : appelé comme méthode (this.transport), le fetch natif du navigateur lève « Illegal invocation ».
  constructor(url: string, key: string, tokens: TokenStorage, transport: typeof fetch = (input, init) => fetch(input, init)) {
    this.url = url; this.key = key; this.tokens = tokens; this.transport = transport;
    if (!/^https:\/\//.test(url)) throw new Error('La connexion Supabase doit utiliser HTTPS.');
    if (!key || isSecretKey(key)) throw new Error('Utilise uniquement une clé Supabase publique.');
  }
  private async request(path: string, body: unknown, token = '', method = 'POST') {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try { response = await this.transport(this.url.replace(/\/$/, '') + path, { method, headers: { apikey: this.key, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body), signal: controller.signal }); }
    catch { throw new Error('Connexion interrompue. Réessaie : ton action ne sera pas dupliquée.'); }
    finally { clearTimeout(timeout); }
    // Certaines réponses sont vides (déconnexion : 204) : ne pas les prendre pour une erreur.
    let result: any = {};
    try { const text = await response.text(); if (text) result = JSON.parse(text); } catch { if (response.ok) throw new Error('Réponse illisible du service.'); }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error('Session ou accès refusé. Reconnecte-toi si nécessaire.');
      throw new Error(authMessage(result.error_code || result.code, result.message || result.msg || 'Le service est indisponible.'));
    }
    return result;
  }
  private async session(s: Session) {
    if (!s.access_token || !s.refresh_token || !s.user?.id) throw new Error('Session invalide.');
    await this.tokens.set(s.refresh_token); // Seulement le jeton de renouvellement dans le coffre natif.
    this.access = s.access_token; this.expires = Date.now() + s.expires_in * 1000;
    // Nom provisoire : le nom affiché fait foi côté serveur (profil), chargé juste après.
    if (this.actor.id !== s.user.id) this.actor = { id: s.user.id, name: 'Membre' };
  }
  private async loadMe() { this.actor = (await this.rpc('me', null, {}, null)).profile; }
  async login(email: string, password: string) { await this.session(await this.request('/auth/v1/token?grant_type=password', { email: email.trim(), password })); await this.loadMe(); }
  private link(path: string, o: AuthLinkOptions = {}) { return o.redirectTo ? path + '?redirect_to=' + encodeURIComponent(o.redirectTo) : path; }
  private pkce(o: AuthLinkOptions = {}) { return o.codeChallenge ? { code_challenge: o.codeChallenge, code_challenge_method: 's256' } : {}; }
  async signup(email: string, password: string, o?: AuthLinkOptions) { await this.request(this.link('/auth/v1/signup', o), { email: email.trim(), password, ...this.pkce(o) }); }
  // Mot de passe oublié, ou jamais créé (anciens comptes ouverts par lien e-mail, Google ou Apple).
  // Supabase répond pareil que l’adresse existe ou non : rien n’indique si un compte existe.
  async recover(email: string, o?: AuthLinkOptions) { await this.request(this.link('/auth/v1/recover', o), { email: email.trim(), ...this.pkce(o) }); }
  // Retour d’un lien e-mail (flux PKCE) : le code à usage unique ne sert qu’avec le secret gardé par ce navigateur.
  async exchangeCode(code: string, verifier: string) { await this.session(await this.request('/auth/v1/token?grant_type=pkce', { auth_code: code, code_verifier: verifier })); await this.loadMe(); }
  async setPassword(password: string) {
    if (Date.now() > this.expires - 60000) await this.refresh();
    await this.request('/auth/v1/user', { password }, this.access, 'PUT');
  }
  async restore() { if (!(await this.tokens.get())) return false; await this.refresh(); await this.loadMe(); return true; }
  async updateProfile(displayName: string) { this.actor = (await this.rpc('update_profile', null, { displayName }, null)).profile; }
  private async refresh() {
    if (!this.refreshing) this.refreshing = (async () => {
      const token = await this.tokens.get(); if (!token) throw new Error('Connecte-toi pour continuer.');
      await this.session(await this.request('/auth/v1/token?grant_type=refresh_token', { refresh_token: token }));
    })().finally(() => { this.refreshing = null; });
    return this.refreshing;
  }
  async logout() {
    try { if (this.access) await this.request('/auth/v1/logout?scope=local', {}, this.access); }
    finally { await this.tokens.clear(); this.access = ''; this.expires = 0; this.actor = { id: '', name: '' }; }
  }
  private async rpc(action: string, task: string | null, data: Input, requestId: string | null) {
    if (Date.now() > this.expires - 60000) await this.refresh();
    return this.request('/rest/v1/rpc/flemme_mobile_api', { p_action: action, p_task: task, p_data: data, p_request: requestId }, this.access);
  }
  async list(cursor: string | null = null): Promise<TaskPage> {
    const page = await this.rpc('list', null, { limit: PAGE_SIZE, cursor }, null);
    return { tasks: page.tasks, nextCursor: page.nextCursor ?? null };
  }
  // Autre fonction RPC exposée, appelée avec la session du membre (page admin du site : flemme_admin_api).
  async call(fn: string, body: Input) {
    if (!/^[a-z_]+$/.test(fn)) throw new Error('Fonction inconnue.');
    if (Date.now() > this.expires - 60000) await this.refresh();
    return this.request('/rest/v1/rpc/' + fn, body, this.access);
  }
  // Web only: exchange the current session for a same-origin test cookie.
  // Never place this bearer token in a URL or forward it to a preview origin.
  async betaAccess(): Promise<boolean> {
    if (Date.now() > this.expires - 60000) await this.refresh();
    const response = await this.transport('/.netlify/functions/beta-auth', {
      method: 'POST', headers: { Authorization: 'Bearer ' + this.access, 'Content-Type': 'application/json' },
      body: '{}', signal: AbortSignal.timeout(10000),
    });
    return response.ok && (await response.json()).allowed === true;
  }
  // Paiement en ligne (Stripe Connect) via les fonctions Edge : renvoie l'adresse Stripe à ouvrir.
  // 'onboarding' : le Brigadier active ses paiements. 'checkout' : le déposant paie une tâche terminée.
  async paymentLink(kind: 'onboarding' | 'checkout', taskId?: string): Promise<string> {
    if (Date.now() > this.expires - 60000) await this.refresh();
    const { url } = await this.request('/functions/v1/stripe-' + kind, kind === 'checkout' ? { taskId } : {}, this.access);
    if (typeof url !== 'string' || !/^https:\/\/(checkout|connect)\.stripe\.com\//.test(url)) throw new Error('Lien de paiement invalide.');
    return url;
  }
  async search(filter: SearchFilter, cursor: string | null = null): Promise<SearchPage> {
    const clean = Object.fromEntries(Object.entries(filter).filter(([, v]) => v));
    const page = await this.rpc('search', null, { ...clean, limit: PAGE_SIZE, cursor }, null);
    return { tasks: page.tasks, total: page.total, nextCursor: page.nextCursor ?? null };
  }
  async drafts(): Promise<SavedDraft[]> { return (await this.rpc('drafts', null, {}, null)).drafts; }
  async saveDraft(d: Omit<SavedDraft, 'updatedAt'>): Promise<SavedDraft> { return (await this.rpc('draft_save', null, d, null)).draft; }
  async deleteDraft(id: string) { await this.rpc('draft_delete', null, { id }, null); }
  async profile(userId?: string): Promise<Profile> { return (await this.rpc('profile_get', null, userId ? { userId } : {}, null)).profile; }
  async saveProfile(data: Input): Promise<Profile> {
    const p: Profile = (await this.rpc('profile_save', null, data, null)).profile;
    this.actor = { id: p.id, name: p.name };
    return p;
  }
  async files(taskId: string): Promise<FileItem[]> { return (await this.rpc('file_list', taskId, {}, null)).files; }
  // Envoi en deux temps : déclaration (file_prepare, qui fixe le chemin et contrôle format et taille), puis dépôt dans le bucket privé.
  async upload(taskId: string | null, file: Upload): Promise<FileItem> {
    const prepared = await this.rpc('file_prepare', taskId, fileInput({ name: file.name, type: file.type, size: file.size }, taskId == null), null);
    const item: FileItem = prepared.file;
    try { await this.storage('POST', 'object/flemme-fichiers/' + item.path, file, item.mime); }
    catch (e) { await this.rpc('file_delete', null, { id: item.id }, null).catch(() => {}); throw e; }
    // Nouvelle photo : l’ancienne est retirée du bucket, puis oubliée.
    if (prepared.previous) await this.deleteFile(prepared.previous).catch(() => {});
    return item;
  }
  async deleteFile(f: FileItem) {
    await this.storage('DELETE', 'object/flemme-fichiers/' + f.path);
    await this.rpc('file_delete', null, { id: f.id }, null);
  }
  async fileUrl(path: string) {
    const r = await this.storage('POST', 'object/sign/flemme-fichiers/' + path, JSON.stringify({ expiresIn: 600 }), 'application/json');
    if (typeof r.signedURL !== 'string') throw new Error('Lien du fichier indisponible.');
    return this.url.replace(/\/$/, '') + '/storage/v1' + r.signedURL;
  }
  private async storage(method: string, path: string, body?: BodyInit, type?: string) {
    if (Date.now() > this.expires - 60000) await this.refresh();
    let response: Response;
    try { response = await this.transport(this.url.replace(/\/$/, '') + '/storage/v1/' + path.split('/').map(encodeURIComponent).join('/'), { method, body,
      headers: { apikey: this.key, Authorization: 'Bearer ' + this.access, ...(type ? { 'Content-Type': type } : {}), 'x-upsert': 'false' } }); }
    catch { throw new Error('Connexion interrompue pendant l’envoi du fichier. Réessaie.'); }
    const text = await response.text().catch(() => '');
    if (!response.ok) throw new Error(response.status === 413 ? 'Fichier trop lourd : 10 Mo au plus.' : 'Fichier refusé ou introuvable.');
    try { return text ? JSON.parse(text) : {}; } catch { return {}; }
  }
  async helpList(): Promise<HelpRequest[]> { return (await this.rpc('help_list', null, {}, null)).requests; }
  async helpSend(data: Input, requestId: string): Promise<HelpRequest> { return (await this.rpc('help_send', null, data, requestId)).request; }
  async create(data: Input, requestId: string): Promise<Task> { return (await this.rpc('create', null, data, requestId)).task; }
  async command(taskId: string, action: Command, data: Input, requestId: string): Promise<Task> {
    try { return (await this.rpc(action, taskId, data, requestId)).task; }
    catch (e) {
      // Base pas encore migrée (lot 3 absent) : la candidature part par l’ancienne action, sans résultat promis.
      if (action !== 'apply' || !/Action inconnue/.test((e as Error).message)) throw e;
      return (await this.rpc('offer', taskId, { amount: data.amount, slot: data.slot, scope: data.scope }, requestId)).task;
    }
  }
}
