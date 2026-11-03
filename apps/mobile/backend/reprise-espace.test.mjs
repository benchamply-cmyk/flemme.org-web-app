// Tests des scripts de reprise de l'ancien /espace (reprise-espace/), sur PGlite, sans Supabase.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const { PGlite } = await import(process.env.PGLITE_MODULE_URL || '@electric-sql/pglite');
const db = new PGlite();
const file = name => readFile(new URL(name, import.meta.url), 'utf8');
// Sous-ensemble des tables Supabase et de l'ancien espace (FlemmeV2.0/supabase/espace.sql).
await db.exec(`
  create role anon; create role authenticated; create schema auth;
  create table auth.users(id uuid primary key, email text, encrypted_password text,
    email_confirmed_at timestamptz, last_sign_in_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
  grant usage on schema auth to authenticated; grant execute on function auth.uid(),auth.jwt() to authenticated;
  create table public.demandes(id uuid primary key default gen_random_uuid(), ref text unique not null,
    user_id uuid references auth.users(id), email text, besoin text not null, precisions text,
    statut text not null default 'recue', created_at timestamptz not null default now());
  create table public.profils(user_id uuid primary key references auth.users(id), pseudo text not null);
  create table public.equipe(user_id uuid primary key references auth.users(id));`);
const [alice, bob, carole, nonConfirme] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
await db.query(`insert into auth.users values
  ($1,'alice@exemple.fr','$2a$10$abc',now(),now()),
  ($2,'Bob@Exemple.fr',null,now(),null),
  ($3,'carole@exemple.fr','$2a$10$def',now(),null),
  ($4,'nc@exemple.fr','$2a$10$ghi',null,null)`, [alice, bob, carole, nonConfirme]);
await db.query(`insert into public.profils values ($1,'alice_42')`, [alice]);
await db.query(`insert into public.equipe values ($1)`, [carole]);
await db.query(`insert into public.demandes(ref,user_id,email,besoin,precisions,statut) values
  ('FL-AAAA1',$1,'alice@exemple.fr','Monter   une armoire','Au 3e sans ascenseur','en_cours'),
  ('FL-AAAA2',$1,'alice@exemple.fr','Ancienne demande',null,'terminee'),
  ('FL-BBBB1',null,'bob@exemple.fr','  ', null,'recue'),
  ('FL-NNNN1',$2,'nc@exemple.fr','Pas confirmé',null,'en_etude'),
  ('FL-XXXX1',null,'inconnu@exemple.fr','Sans compte',null,'recue')`, [alice, nonConfirme]);

const inventaire = Object.fromEntries((await db.query(await file('./reprise-espace/01-inventaire.sql'))).rows
  .map(r => [r.indicateur.split(' ')[0], Number(r.valeur)]));
assert.deepEqual(inventaire, {
  comptes_total: 4, comptes_confirmes: 3, comptes_non_confirmes: 1, comptes_prets_pour_la_v2: 2,
  comptes_confirmes_sans_mot_de_passe: 1, comptes_avec_pseudo: 1, comptes_equipe: 1, demandes_total: 5,
  demandes_actives: 4, demandes_actives_rattachables: 2, demandes_actives_sans_compte_confirme: 2 });

const contacts = (await db.query(await file('./reprise-espace/02-a-contacter.sql'))).rows;
assert.deepEqual(contacts.map(c => c.email).sort(), ['Bob@Exemple.fr', 'alice@exemple.fr', 'carole@exemple.fr']);
assert.match(contacts.find(c => c.email === 'Bob@Exemple.fr').action, /mot de passe oublié/);
assert.equal(contacts.find(c => c.email === 'alice@exemple.fr').pseudo, 'alice_42');

await db.exec(await file('./install.sql'));
const reprise = await file('./reprise-espace/03-reprise-demandes.sql');
assert.match(reprise.trimEnd(), /\nrollback;$/);
// Par défaut : simulation, rien n'est écrit.
await db.exec(reprise);
assert.equal((await db.query('select count(*)::int n from flemme_mobile_v1.tasks')).rows[0].n, 0);
assert.equal((await db.query("select to_regclass('flemme_mobile_v1.reprise_espace') r")).rows[0].r, null);
// Avec commit : deux demandes reprises, puis rien de plus si on relance.
const applique = reprise.trimEnd().replace(/rollback;$/, 'commit;');
await db.exec(applique); await db.exec(applique);
const tasks = (await db.query('select owner_id, document from flemme_mobile_v1.tasks order by document->>\'legacyRef\'')).rows;
assert.equal(tasks.length, 2);
const [a, b] = tasks.map(t => t.document);
assert.equal(a.legacyRef, 'FL-AAAA1'); assert.equal(a.owner.id, alice); assert.equal(a.owner.name, 'alice');
assert.equal(a.title, 'Monter une armoire'); assert.equal(a.details, 'Monter une armoire\n\nAu 3e sans ascenseur');
assert.equal(a.status, 'open'); assert.equal(a.budget, null); assert.match(a.history[0].text, /FL-AAAA1/);
assert.equal(b.legacyRef, 'FL-BBBB1'); assert.equal(b.owner.id, bob); assert.equal(b.title, 'Demande FL-BBBB1');
assert.equal((await db.query('select count(*)::int n from public.demandes')).rows[0].n, 5);

// Les flemmes reprises fonctionnent avec l'API V2 : Carole (Brigadière) propose, Alice accepte.
async function as(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{}',false)", [id]);
  await db.exec('set role authenticated');
}
const api = async (action, task, data) => (await db.query('select public.flemme_mobile_api($1,$2,$3::jsonb,$4) d',
  [action, task, JSON.stringify({ actorName: 'Membre', ...data }), randomUUID()])).rows[0].d;
await as(alice); assert.equal((await api('list', null, {})).tasks.length, 2);
await as(carole);
const offre = (await api('offer', a.id, { amount: 6000, slot: 'Samedi', scope: 'Montage' })).task.offers[0];
await as(alice);
assert.equal((await api('accept', a.id, { offerId: offre.id })).task.status, 'assigned');
await assert.rejects(db.query('select * from flemme_mobile_v1.reprise_espace'), /permission denied/);
await db.exec('reset role');
// Retour arrière documenté (docs/migration-comptes-espace.md) : seule la flemme sans proposition part.
await db.exec(`with r as (
  delete from flemme_mobile_v1.reprise_espace r using flemme_mobile_v1.tasks t
  where t.id = r.task_id and t.document->'offers' = '[]'::jsonb
  returning r.task_id)
delete from flemme_mobile_v1.tasks where id in (select task_id from r);`);
assert.deepEqual((await db.query('select demande_ref from flemme_mobile_v1.reprise_espace')).rows.map(r => r.demande_ref), ['FL-AAAA1']);
assert.equal((await db.query('select count(*)::int n from flemme_mobile_v1.tasks')).rows[0].n, 1);
console.log('Reprise /espace : inventaire, liste à contacter, simulation, reprise idempotente et API V2 vérifiés.');
