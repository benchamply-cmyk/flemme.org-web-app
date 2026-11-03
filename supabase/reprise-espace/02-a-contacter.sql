-- Reprise des comptes de l'ancien /espace. Étape 2 : liste des personnes à prévenir.
-- LECTURE SEULE, mais affiche des adresses e-mail : à lancer uniquement dans
-- Supabase > SQL Editor, ne pas exporter ni copier le résultat ailleurs que dans
-- l'outil d'envoi du message d'information.
--
-- Une ligne par compte confirmé. « action » dit ce que la personne doit faire pour
-- retrouver son compte dans la V2.
select u.email,
       p.pseudo,
       case when coalesce(u.encrypted_password, '') like '$2%'
            then 'se connecter avec son e-mail et son mot de passe habituels'
            else 'choisir un mot de passe (lien « mot de passe oublié »)' end as action,
       (select count(*) from public.demandes d
         where (d.user_id = u.id or (d.user_id is null and lower(d.email) = lower(u.email)))
           and d.statut in ('recue', 'en_etude', 'acceptee', 'en_cours')) as demandes_actives,
       u.last_sign_in_at as derniere_connexion
from auth.users u
left join public.profils p on p.user_id = u.id
where u.email_confirmed_at is not null
order by demandes_actives desc, u.last_sign_in_at desc nulls last;
