-- Mode pré-bêta (27/11/2026, choix de Ben) : jusqu'à la bêta de janvier 2027, rien n'est public en prod.
-- S'applique après 20261118140000_flemme_v2_confiance.sql. Additif : aucune table ni colonne ajoutée, supprimée ou renommée ;
-- seule flemme_v2.flag_guard est remplacée (même signature, mêmes droits), ses deux contrôles d'origine sont gardés.
--
-- Registre : packages/shared/src/flags.ts, clé « espace.pre_beta ». L'écran masque déjà ces actions ; la base les refuse
-- aussi, car un flag ne donne aucun droit. La garde serveur ne s'active que sur une ligne explicite « tous » dans
-- flemme_v2.feature_flags pour l'environnement serveur (flemme_v2.settings.flag_environment) : à la promotion, Ben règle
-- /admin › Fonctionnalités › « Mode pré-bêta » sur « Tout le monde » en prod (l'écran, lui, suit déjà le registre :
-- « tous » en prod par défaut). Pour ouvrir la bêta : même réglage → Éteint. « testeurs » ne change que l'écran des testeurs.
--
-- Actions refusées en pré-bêta : publier une demande (create), proposer son aide ou la modifier (apply, apply_edit),
-- poser une question publique (ask), enregistrer, envoyer ou signer un accord (agreement_save, agreement_submit,
-- agreement_sign) et payer (pay). Restent permis : compte, profil, brouillons, recherche, aide, et tout pour l'équipe
-- (admins à l'adresse confirmée), pour tester la prod avant l'ouverture.

create or replace function flemme_v2.flag_guard(p_action text)
returns void language plpgsql stable security definer set search_path = '' as $$
declare flag text; env text; pre_beta text; uid uuid := auth.uid();
begin
  select s.flag_environment into env from flemme_v2.settings s;
  env := coalesce(env, 'prod');

  -- 1. Formulaires éteints (inchangé depuis 20261116120000).
  flag := case when p_action = 'create' then 'formulaires.deleguer' when p_action = 'apply' then 'formulaires.resoudre' end;
  if flag is not null and exists(select 1 from flemme_v2.feature_flags f where f.key = flag and f.environment = env and f.state = 'off') then
    raise exception 'Fonctionnalité momentanément indisponible' using errcode = '42501';
  end if;

  -- 2. Pré-bêta.
  if p_action in ('create', 'apply', 'apply_edit', 'ask', 'agreement_save', 'agreement_submit', 'agreement_sign', 'pay') then
    select f.state into pre_beta from flemme_v2.feature_flags f where f.key = 'espace.pre_beta' and f.environment = env;
    if pre_beta = 'tous' and not exists(select 1 from flemme_v2.admins a join auth.users u on u.id = a.user_id
                                         where a.user_id = uid and u.email_confirmed_at is not null) then
      raise exception 'La bêta ouvre en janvier 2027 : enregistrez votre demande, elle vous attend dans Mon espace.' using errcode = '42501';
    end if;
  end if;
end $$;
