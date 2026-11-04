# Admin et alertes e-mail : mise en service

La migration `migrations/20261103130000_flemme_v2_admin.sql` ajoute l'exploitation minimale au schéma `flemme_v2`. Elle fournit une page admin (https://flemme.org/admin) pour traiter les signalements, les litiges et les comptes, et envoie une alerte e-mail à chaque événement important. Rien ne s'applique automatiquement.

## Ce que fait la migration

| Élément | Rôle |
|---|---|
| `flemme_v2.admins` | Comptes autorisés sur la page admin. Au départ, seulement `ben.champly@gmail.com`, s'il a un compte confirmé sur le projet. Aucun compte ne peut s'y ajouter lui-même. |
| `flemme_v2.disputes` | Un litige par flemme signalée, avec trois états : « À traiter », « Pris en charge » et « Clos ». Un nouveau signalement rouvre un litige clos. Les signalements restent les événements `report` de `flemme_v2.events`. |
| `flemme_v2.suspensions` | Comptes suspendus. Un compte suspendu lit encore ses flemmes, mais ne peut plus rien publier ni modifier. Un admin ne peut pas être suspendu. |
| `flemme_v2.admin_log` | Journal des décisions de l'équipe : prise en charge, clôture, suspension, rétablissement. |
| `flemme_v2.alerts` | File des alertes : nouvelle flemme, accord conclu, signalement. Chaque alerte est enregistrée avant d'être envoyée. Un envoi raté reste visible dans l'onglet « Alertes e-mail » et peut être relancé. Il ne bloque jamais l'action du membre. |
| Événement `admin` | Les décisions sur un litige s'ajoutent à l'historique de la flemme, que le déposant et le Brigadier voient. Pour cela, la contrainte `events_kind_check` est élargie. |
| `public.flemme_admin_api` | Seul point d'entrée de la page admin. Le rôle admin est revérifié en base à chaque appel. Aucune clé `service_role` n'est utilisée. |

L'onglet « Utilisateurs » lit `auth.users`, y compris les comptes de l'ancien espace client, qui sont repris dans `flemme_v2.profiles`.

## Mise en service

1. **Prérequis** : les migrations `flemme_v2` (tables et API) doivent être appliquées.
2. **Compte admin** : `ben.champly@gmail.com` doit exister et avoir confirmé son e-mail. Si le compte est créé après la migration :

       insert into flemme_v2.admins(user_id) select id from auth.users where lower(email) = 'ben.champly@gmail.com';

3. **pg_net** : dans Database > Extensions, activer `pg_net`. La migration essaie aussi de l'activer elle-même.
4. **Secrets dans Vault** : choisir un secret long et aléatoire, puis mettre la même valeur dans Netlify à l'étape 6. Pour la préprod, utiliser son adresse.

       select vault.create_secret('https://flemme.org/api/alerte', 'flemme_alerte_url');
       select vault.create_secret('<le même secret que ALERTE_SECRET>', 'flemme_alerte_secret');

5. **Migration** : avec `npx supabase db push` (voir `README.md`), ou en collant le fichier dans l'éditeur SQL, comme pour les migrations `flemme_v2`. Si une installation existe déjà, la migration échoue sans rien remplacer.
6. **Netlify** (projet `flemmeorg`, menu Site configuration > Environment variables) :
   - `RESEND_API_KEY` : la clé Resend. Le domaine `flemme.org` doit être vérifié dans Resend.
   - `ALERTE_SECRET` : la même valeur que `flemme_alerte_secret`.
   - `ALERTE_EMAIL` (facultatif) : les destinataires, séparés par des virgules. Par défaut, `ben.champly@gmail.com`.
   - `ALERTE_FROM` (facultatif) : l'expéditeur. Par défaut, `FLEMME <alertes@flemme.org>`.

   L'ancien site utilisait déjà `RESEND_API_KEY` et `ALERTE_SECRET` sur ce projet Netlify. Si ces variables existent encore, elles servent telles quelles.
7. **Vérifier** :
   - Publier une flemme de test avec un compte membre. L'e-mail « Nouvelle flemme » doit arriver, et l'onglet « Alertes e-mail » doit indiquer « Transmise ».
   - Se connecter avec un compte non admin sur /admin. La page doit afficher « Accès réservé à l'équipe FLEMME ».

## Limites

- pg_net envoie les requêtes de façon asynchrone. « Transmise » veut dire que Supabase a envoyé la requête, pas que Resend l'a acceptée. En cas de doute, consulter les logs de la fonction `alerte` dans Netlify.
- L'ancien `alertes.sql` de FlemmeV2.0 (déclencheurs sur `public.demandes` et `public.messages`) appelle la même adresse. La nouvelle fonction ignore ces appels et répond 204.
- La page admin ne fait ni remboursement ni paiement. La décision d'un litige est un texte ajouté à l'historique de la flemme.

## Tests

    cd supabase/tests && npm ci && npm test

`admin.test.mjs` applique toutes les migrations dans PGlite, sans pg_net ni Vault. Il vérifie :
- la migration sans compte admin et l'accès réservé ;
- les alertes mises en file sans bloquer le membre ;
- les signalements et les litiges : prise en charge, clôture, réouverture ;
- les comptes, la suspension, le journal et la RLS.
