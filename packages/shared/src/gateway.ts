import { applyCommand, createTask, visibleTask } from './domain.ts';
import type { Actor, Command, Input, Task } from './domain.ts';

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
}
export const demoActors: Actor[] = [{ id: 'demo-ben', name: 'Benjamin' }, { id: 'demo-lou', name: 'Lou' }, { id: 'demo-camille', name: 'Camille' }];
export function seed(): Task[] {
  const at = '2026-10-28T08:00:00.000Z';
  const a = createTask('demo-colis', demoActors[0], { title: 'Faire mes retours de colis', details: 'Deux colis à déposer au point relais. Étiquettes imprimées, déplacement compris dans le forfait proposé.', place: 'Aix-en-Provence', budget: 2000 }, at);
  return [applyCommand(a, demoActors[1], 'offer', { id: 'demo-offer', amount: 2000, slot: 'Samedi matin', scope: 'Récupération à domicile et dépôt des deux colis, déplacement compris.' }, at),
    createTask('demo-meuble', demoActors[2], { title: 'Monter mon meuble IKEA', details: 'Un petit meuble à monter. Outils disponibles. Sans fixation au mur.', place: 'Aix-en-Provence', budget: 3500 }, at),
    createTask('demo-cv', demoActors[1], { title: 'Remettre mon CV au propre', details: 'Une page à remettre en forme. Le contenu est déjà rédigé.', place: 'À distance', budget: null }, at)];
}
export type DemoState = { version: 1; tasks: Task[]; requests: Record<string, Task> };
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
    return this.commit(createTask(newId(), this.actor, data, new Date().toISOString()), request);
  }
  async command(taskId: string, action: Command, data: Input, request: string) {
    const prior = this.state.requests[this.actor.id + ':' + request];
    if (prior) return visibleTask(prior, this.actor);
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) throw new Error('Flemme introuvable.');
    return this.commit(applyCommand(task, this.actor, action, action === 'offer' ? { ...data, id: newId() } : data, new Date().toISOString()), request);
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
  private async profile() { this.actor = (await this.rpc('me', null, {}, null)).profile; }
  async login(email: string, password: string) { await this.session(await this.request('/auth/v1/token?grant_type=password', { email: email.trim(), password })); await this.profile(); }
  private link(path: string, o: AuthLinkOptions = {}) { return o.redirectTo ? path + '?redirect_to=' + encodeURIComponent(o.redirectTo) : path; }
  private pkce(o: AuthLinkOptions = {}) { return o.codeChallenge ? { code_challenge: o.codeChallenge, code_challenge_method: 's256' } : {}; }
  async signup(email: string, password: string, o?: AuthLinkOptions) { await this.request(this.link('/auth/v1/signup', o), { email: email.trim(), password, ...this.pkce(o) }); }
  // Mot de passe oublié, ou jamais créé (anciens comptes ouverts par lien e-mail, Google ou Apple).
  // Supabase répond pareil que l’adresse existe ou non : rien n’indique si un compte existe.
  async recover(email: string, o?: AuthLinkOptions) { await this.request(this.link('/auth/v1/recover', o), { email: email.trim(), ...this.pkce(o) }); }
  // Retour d’un lien e-mail (flux PKCE) : le code à usage unique ne sert qu’avec le secret gardé par ce navigateur.
  async exchangeCode(code: string, verifier: string) { await this.session(await this.request('/auth/v1/token?grant_type=pkce', { auth_code: code, code_verifier: verifier })); await this.profile(); }
  async setPassword(password: string) {
    if (Date.now() > this.expires - 60000) await this.refresh();
    await this.request('/auth/v1/user', { password }, this.access, 'PUT');
  }
  async restore() { if (!(await this.tokens.get())) return false; await this.refresh(); await this.profile(); return true; }
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
  // Paiement en ligne (Stripe Connect) via les fonctions Edge : renvoie l'adresse Stripe à ouvrir.
  // 'onboarding' : le Brigadier active ses paiements. 'checkout' : le déposant paie une tâche terminée.
  async paymentLink(kind: 'onboarding' | 'checkout', taskId?: string): Promise<string> {
    if (Date.now() > this.expires - 60000) await this.refresh();
    const { url } = await this.request('/functions/v1/stripe-' + kind, kind === 'checkout' ? { taskId } : {}, this.access);
    if (typeof url !== 'string' || !/^https:\/\/(checkout|connect)\.stripe\.com\//.test(url)) throw new Error('Lien de paiement invalide.');
    return url;
  }
  async create(data: Input, requestId: string): Promise<Task> { return (await this.rpc('create', null, data, requestId)).task; }
  async command(taskId: string, action: Command, data: Input, requestId: string): Promise<Task> { return (await this.rpc(action, taskId, data, requestId)).task; }
}
