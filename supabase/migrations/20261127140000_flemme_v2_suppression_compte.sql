-- Suppression du compte par le membre (27/11/2026, demande de Ben) : bouton « Supprimer mon compte et mes données » dans Mon espace.
-- S'applique après 20261127130000_flemme_v2_recherches.sql. Additif : deux fonctions nouvelles, aucune table ni colonne touchée.
--
-- Déroulé côté app (RemoteGateway.deleteAccount) :
--   1. public.flemme_compte_fichiers()            → { paths: [...] } : fichiers du membre dans le bucket privé « flemme-fichiers » ;
--   2. l'app supprime chaque objet par l'API Storage (règle flemme_fichiers_suppression : l'auteur seulement) ;
--   3. public.flemme_supprimer_compte('SUPPRIMER') → { ok: true } : supprime auth.users, et en cascade le profil, les flemmes,
--      brouillons, recherches enregistrées, fichiers (lignes), demandes d'aide, abonnements, compte Brigadier et journal des requêtes.
--      Ailleurs (propositions, messages, paiements, versions d'accord, questions), l'auteur passe à « Compte supprimé » (on delete set null) :
--      les paiements restent pour les obligations comptables.
-- Refus : connexion absente ou anonyme, confirmation différente de « SUPPRIMER », compte de l'équipe (table admins),
-- mission en cours (déposant ou Brigadier retenu, statut « assigned »), abonnement actif, fichiers encore présents dans le bucket.
-- Autorisée en pré-bêta (aucune garde de flag).

create function public.flemme_compte_fichiers()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Connectez-vous pour continuer.' using errcode = '42501';
  end if;
  return jsonb_build_object('paths', coalesce((select jsonb_agg(f.path order by f.created_at) from flemme_v2.files f where f.owner_id = uid), '[]'::jsonb));
end $$;

create function public.flemme_supprimer_compte(p_confirmation text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Connectez-vous pour continuer.' using errcode = '42501';
  end if;
  if p_confirmation is distinct from 'SUPPRIMER' then
    raise exception 'Écrivez SUPPRIMER pour confirmer la suppression.';
  end if;
  if exists(select 1 from flemme_v2.admins a where a.user_id = uid) then
    raise exception 'Compte de l''équipe : retirez d''abord son rôle d''administrateur.';
  end if;
  if exists(select 1 from flemme_v2.tasks t left join flemme_v2.offers o on o.id = t.accepted_offer_id
            where t.status = 'assigned' and (t.owner_id = uid or o.brigadier_id = uid)) then
    raise exception 'Une mission est en cours : terminez-la ou écrivez à bonjour@flemme.org avant de supprimer votre compte.';
  end if;
  if exists(select 1 from flemme_v2.subscriptions s where s.user_id = uid and s.status in ('trialing', 'active', 'past_due')) then
    raise exception 'Résiliez d''abord votre abonnement, puis supprimez votre compte.';
  end if;
  if exists(select 1 from flemme_v2.files f join storage.objects o on o.bucket_id = 'flemme-fichiers' and o.name = f.path where f.owner_id = uid) then
    raise exception 'Vos fichiers n''ont pas tous été retirés. Réessayez.';
  end if;
  delete from auth.users where id = uid;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.flemme_compte_fichiers() from public, anon;
revoke all on function public.flemme_supprimer_compte(text) from public, anon;
grant execute on function public.flemme_compte_fichiers() to authenticated;
grant execute on function public.flemme_supprimer_compte(text) to authenticated;
