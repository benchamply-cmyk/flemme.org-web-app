-- Demandes de test. Étape 1 : comptes test (Flemmard et Brigadier).
--
-- Crée deux comptes e-mail déjà confirmés, marqués raw_app_meta_data.compte_test = true :
--   test.flemmard@example.com   (dépose les demandes)
--   test.brigadier@example.com  (fait les propositions)
-- Les adresses @example.com ne reçoivent aucun e-mail : pas de « mot de passe oublié ».
-- Le profil flemme_v2.profiles est créé par le trigger d'inscription.
--
-- AVANT DE LANCER : remplacer les deux 'A-REMPLACER' par des mots de passe choisis
-- (ils ne doivent pas être commités). Le script refuse de tourner sinon.
-- Sans risque à relancer : un compte qui existe déjà est ignoré (mot de passe inchangé).
-- Le 12 nov. 2026, ces deux comptes ont déjà été créés sur la production et sur flemme-preprod.
--
-- PAR DÉFAUT CE SCRIPT S'ANNULE (ROLLBACK, dernière ligne) : il affiche ce qu'il ferait.
-- Pour l'appliquer vraiment, remplacer la dernière ligne « rollback; » par « commit; ».
begin;

create temporary table comptes_test (email text primary key, mot_de_passe text not null) on commit drop;
insert into comptes_test values
  ('test.flemmard@example.com',  'A-REMPLACER'),
  ('test.brigadier@example.com', 'A-REMPLACER');

do $$
begin
  if exists (select 1 from comptes_test where mot_de_passe = 'A-REMPLACER' or length(mot_de_passe) < 10) then
    raise exception 'Choisir un mot de passe d''au moins 10 caractères pour chaque compte test.';
  end if;
end $$;

with nouveaux as (
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change,
                          email_change_token_current, reauthentication_token, is_sso_user, is_anonymous)
  select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
         c.email, extensions.crypt(c.mot_de_passe, extensions.gen_salt('bf')), now(),
         '{"provider":"email","providers":["email"],"compte_test":true}'::jsonb,
         '{"compte_test":true}'::jsonb, now(), now(), '', '', '', '', '', '', false, false
  from comptes_test c
  where not exists (select 1 from auth.users u where u.email = c.email)
  returning id, email
)
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select id::text, id, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', now(), now(), now()
from nouveaux;

select u.email, u.id, p.display_name, u.raw_app_meta_data ->> 'compte_test' as compte_test
from auth.users u
left join flemme_v2.profiles p on p.user_id = u.id
where u.email in (select email from comptes_test);

rollback;
