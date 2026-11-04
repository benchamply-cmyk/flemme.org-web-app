// Tests des scripts de reprise de l'ancien /espace (supabase/reprise-espace/), sur PGlite, sans Supabase.
// Les migrations de supabase/migrations sont rejouées dans l'ordre, comme dans api.test.mjs.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const { PGlite } = await import(process.env.PGLITE_MODULE_URL || '@electric-sql/pglite');
const db = new PGlite();
const script = name => readFile(new URL('../reprise-espace/' + name, import.meta.url), 'utf8');
// Sous-ensemble de Supabase et de l'ancien espace (FlemmeV2.0/supabase/espace.sql).
await db.exec(`
  create role anon; create role authenticated; create role service_role; create schema auth;
  create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb, email_confirmed_at timestamptz,
    encrypted_password text, last_sign_in_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
  grant usage on schema auth to authenticated; grant execute on function auth.uid(),auth.jwt() to authenticated;
  create table public.demandes(id uuid primary key default gen_random_uuid(), ref text unique not null,
    user_id uuid references auth.users(id) on delete set null, email text, besoin text not null, precisions text,
    statut text not null default 'recue', created_at timestamptz not null default now());
  create table public.profils(user_id uuid primary key references auth.users(id) on delete cascade, pseudo text not null);
  create table public.equipe(user_id uuid primary key references auth.users(id) on delete cascade);`);
const [alice, bob, carole, nonConfirme] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
await db.query(`insert into auth.users(id,email,email_confirmed_at,encrypted_password,last_sign_in_at) values
  ($1,'alice@exemple.fr',now(),'$2a$10$abc',now()),
  ($2,'Bob@Exemple.fr',now(),null,null),
  ($3,'carole@exemple.fr',now(),'$2a$10$def',null),
  ($4,'nc@exemple.fr',null,'$2a$10$ghi',null)`, [alice, bob, carole, nonConfirme]);
await db.query(`insert into public.profils values ($1,'alice_42')`, [alice]);
await db.query(`insert into public.equipe values ($1)`, [carole]);
await db.query(`insert into public.demandes(ref,user_id,email,besoin,precisions,statut,created_at) values
  ('FL-AAAA1',$1,'alice@exemple.fr','Monter   une armoire','Au 3e sans ascenseur','en_cours','2026-10-10T08:00:00Z'),
  ('FL-AAAA2',$1,'alice@exemple.fr','Ancienne demande',null,'terminee',now()),
  ('FL-BBBB1',null,'bob@exemple.fr','  ', null,'recue',now()),
  ('FL-NNNN1',$2,'nc@exemple.fr','Pas confirmé',null,'en_etude',now()),
  ('FL-XXXX1',null,'inconnu@exemple.fr','Sans compte',null,'recue',now())`, [alice, nonConfirme]);

// 01 et 02 : lecture seule, valables avant comme après les migrations.
const inventaire = Object.fromEntries((await db.query(await script('01-inventaire.sql'))).rows
  .map(r => [r.indicateur.split(' ')[0], Number(r.valeur)]));
assert.deepEqual(inventaire, {
  comptes_total: 4, comptes_confirmes: 3, comptes_non_confirmes: 1, comptes_prets_pour_la_v2: 2,
  comptes_confirmes_sans_mot_de_passe: 1, comptes_avec_pseudo: 1, comptes_equipe: 1, demandes_total: 5,
  demandes_actives: 4, demandes_actives_rattachables: 2, demandes_actives_sans_compte_confirme: 2 });
const contacts = (await db.query(await script('02-a-contacter.sql'))).rows;
assert.deepEqual(contacts.map(c => c.email).sort(), ['Bob@Exemple.fr', 'alice@exemple.fr', 'carole@exemple.fr']);
assert.match(contacts.find(c => c.email === 'Bob@Exemple.fr').action, /mot de passe oublié/);
assert.equal(contacts.find(c => c.email === 'alice@exemple.fr').pseudo, 'alice_42');

const dir = new URL('../migrations/', import.meta.url);
for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, dir), 'utf8'));

const reprise = await script('03-reprise-demandes.sql');
assert.match(reprise.trimEnd(), /\nrollback;$/);
// Par défaut : simulation, rien n'est écrit.
await db.exec(reprise);
assert.equal((await db.query('select count(*)::int n from flemme_v2.tasks')).rows[0].n, 0);
assert.equal((await db.query("select to_regclass('flemme_v2.reprise_espace') r")).rows[0].r, null);
// Avec commit : deux demandes reprises, puis rien de plus si on relance.
const applique = reprise.trimEnd().replace(/rollback;$/, 'commit;');
await db.exec(applique); await db.exec(applique);
const repris = (await db.query(`select r.demande_ref, t.* from flemme_v2.reprise_espace r
  join flemme_v2.tasks t on t.id = r.task_id order by r.demande_ref`)).rows;
assert.deepEqual(repris.map(r => r.demande_ref), ['FL-AAAA1', 'FL-BBBB1']);
const [a, b] = repris;
assert.equal(a.owner_id, alice); assert.equal(a.title, 'Monter une armoire');
assert.equal(a.details, 'Monter une armoire\n\nAu 3e sans ascenseur'); assert.equal(a.place, 'À préciser');
assert.equal(a.status, 'open'); assert.equal(a.budget, null); assert.equal(a.created_at.toISOString(), '2026-10-10T08:00:00.000Z');
assert.equal(b.owner_id, bob); assert.equal(b.title, 'Demande FL-BBBB1');
assert.equal((await db.query("select count(*)::int n from flemme_v2.events where kind='create'")).rows[0].n, 2);
assert.equal((await db.query('select count(*)::int n from public.demandes')).rows[0].n, 5);

// Les flemmes reprises fonctionnent avec l'API V2 : Carole (Brigadière) propose, Alice accepte.
async function as(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{}',false)", [id]);
  await db.exec('set role authenticated');
}
const api = async (action, task = null, data = {}) => (await db.query('select public.flemme_mobile_api($1,$2,$3::jsonb,$4) d',
  [action, task, JSON.stringify(data), randomUUID()])).rows[0].d;
await as(alice);
const mine = (await api('list')).tasks.find(t => t.id === a.id);
assert.equal(mine.owner.name, 'alice_42');
assert.match(mine.history[0].text, /^Flemme publiée · sans expiration · reprise de la demande FL-AAAA1/);
await as(carole);
const offre = (await api('offer', a.id, { amount: 6000, slot: 'Samedi', scope: 'Montage' })).task.offers[0];
await as(alice);
assert.equal((await api('accept', a.id, { offerId: offre.id })).task.status, 'assigned');
await assert.rejects(db.query('select * from flemme_v2.reprise_espace'), /permission denied/);
await db.exec('reset role');

// Retour arrière documenté (docs/migration-comptes-espace.md) : seule la flemme sans proposition part.
await db.exec(`delete from flemme_v2.tasks t using flemme_v2.reprise_espace r
  where t.id = r.task_id and not exists (select 1 from flemme_v2.offers o where o.task_id = t.id);`);
assert.deepEqual((await db.query('select demande_ref from flemme_v2.reprise_espace')).rows.map(r => r.demande_ref), ['FL-AAAA1']);
// Suppression d'un compte repris : ses flemmes et la correspondance partent avec lui.
await db.query('delete from auth.users where id = $1', [alice]);
assert.equal((await db.query('select count(*)::int n from flemme_v2.reprise_espace')).rows[0].n, 0);
console.log('Reprise /espace : inventaire, liste à contacter, simulation, reprise idempotente, API V2, retour arrière et suppression vérifiés.');
