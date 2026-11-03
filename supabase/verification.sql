-- FLEMME : contrôles en lecture seule du backend flemme_v2 sur le projet de production
-- (yktpabnqkhwcshvjuncs). Aucune modification. À coller dans Supabase > SQL Editor.
-- Procédure complète : docs/supabase-mise-en-service.md.

-- 1. Installation et droits : toutes les colonnes doivent valoir true.
select
  to_regnamespace('flemme_v2') is not null as schema_installe,
  to_regprocedure('public.flemme_mobile_api(text,uuid,jsonb,uuid)') is not null as rpc_installee,
  has_function_privilege('authenticated', 'public.flemme_mobile_api(text,uuid,jsonb,uuid)', 'execute') as rpc_ouverte_aux_membres,
  not has_function_privilege('anon', 'public.flemme_mobile_api(text,uuid,jsonb,uuid)', 'execute') as rpc_fermee_aux_visiteurs,
  not has_table_privilege('authenticated', 'flemme_v2.tasks', 'select') as tables_non_lisibles_directement,
  not has_table_privilege('anon', 'flemme_v2.profiles', 'select') as profils_fermes_aux_visiteurs,
  (select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'flemme_v2' and c.relkind = 'r') as rls_active;

-- 2. Reprise des comptes de l'ancien espace : chaque compte doit avoir un profil (sans_profil = 0).
--    « sans_mot_de_passe » : comptes ouverts par lien e-mail, Google ou Apple ; ils passeront par
--    « Mot de passe oublié ? ». « non_confirmes » ne peuvent rien faire tant que l'adresse n'est pas confirmée.
select
  count(*) as comptes,
  count(*) filter (where p.user_id is null) as sans_profil,
  count(*) filter (where u.email_confirmed_at is null) as non_confirmes,
  count(*) filter (where coalesce(u.encrypted_password, '') = '') as sans_mot_de_passe
from auth.users u left join flemme_v2.profiles p on p.user_id = u.id
where u.deleted_at is null;
select provider, count(*) as comptes from auth.identities group by provider order by 2 desc;

-- 3. Historique des migrations : 20261103120000 et 20261103120100 (inscrites par le script appliqué
--    le 03/11/2026) et 20261014010810 (FlemmeV2.0). Si les deux premières manquent, un futur
--    « supabase db push » voudra les rejouer : voir docs/supabase-mise-en-service.md.
select version, name from supabase_migrations.schema_migrations order by version;

-- 4. Suivi après ouverture : flemmes par statut.
select status, count(*) from flemme_v2.tasks group by 1 order by 1;
