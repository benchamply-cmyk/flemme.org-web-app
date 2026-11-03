# Admin et alertes e-mail : mise en service

`admin.sql` ajoute l'exploitation minimale au backend V2 : une page admin (https://flemme.org/admin) pour traiter les signalements, les litiges et les comptes, et une alerte e-mail à chaque événement important. Rien n'est appliqué automatiquement : chaque étape ci-dessous se fait à la main, dans cet ordre.

## Ce que fait le script

| Élément | Rôle |
|---|---|
| `flemme_mobile_v1.admins` | Comptes autorisés sur la page admin. Au départ, seulement `ben.champly@gmail.com`. Aucun compte ne peut s'y ajouter lui-même. |
| `flemme_mobile_v1.disputes` | Un litige par flemme signalée : « À traiter », « Pris en charge », « Clos ». Un nouveau signalement rouvre un litige clos. |
| `flemme_mobile_v1.suspensions` | Comptes suspendus : ils lisent encore leurs flemmes mais ne peuvent plus rien publier ni modifier. Un admin ne peut pas être suspendu. |
| `flemme_mobile_v1.admin_log` | Journal des décisions de l'équipe (prise en charge, clôture, suspension, rétablissement). |
| `flemme_mobile_v1.alerts` | File des alertes : nouvelle flemme, accord conclu, signalement. Chaque alerte est d'abord enregistrée, puis envoyée. Un envoi raté reste visible dans l'admin (onglet « Alertes e-mail ») et peut être relancé. Il ne bloque jamais l'action du membre. |
| `public.flemme_admin_api` | Seul point d'entrée de la page admin. Le rôle admin est revérifié en base à chaque appel. Pas de clé `service_role`. |

Les comptes listés dans « Utilisateurs » sont ceux de `auth.users` : comme le projet de prod reste `yktpabnqkhwcshvjuncs`, les comptes de l'ancien espace client y apparaissent directement.

## Mise en service

1. **Backend V2** : `install.sql` doit déjà être installé sur le projet.
2. **Compte admin** : `ben.champly@gmail.com` doit exister dans Supabase (Authentication > Users) avec son e-mail confirmé. Sinon le script s'arrête sans rien changer.
3. **pg_net** : Database > Extensions, activer `pg_net` (le script essaie aussi de l'activer).
4. **Secrets dans Vault** (Project Settings > Vault, ou SQL ci-dessous). Choisir un secret long et aléatoire, et mettre la même valeur dans Netlify à l'étape 6. Pour la préprod, mettre l'adresse de la préprod.

       select vault.create_secret('https://flemme.org/api/alerte', 'flemme_alerte_url');
       select vault.create_secret('<le même secret que ALERTE_SECRET>', 'flemme_alerte_secret');

5. **Script** : SQL Editor, coller `admin.sql` et lancer. Une installation déjà présente échoue sans rien remplacer.
6. **Netlify** (projet `flemmeorg`, Site configuration > Environment variables) :
   - `RESEND_API_KEY` : clé Resend (domaine `flemme.org` vérifié dans Resend).
   - `ALERTE_SECRET` : la même valeur que `flemme_alerte_secret`.
   - `ALERTE_EMAIL` (facultatif) : destinataires séparés par des virgules. Par défaut `ben.champly@gmail.com`.
   - `ALERTE_FROM` (facultatif) : expéditeur. Par défaut `FLEMME <alertes@flemme.org>`.

   L'ancien site utilisait déjà `RESEND_API_KEY` et `ALERTE_SECRET` sur ce même projet Netlify : s'ils existent encore, ils sont réutilisés tels quels.
7. **Vérifier** : publier une flemme de test avec un compte membre. L'e-mail « Nouvelle flemme » doit arriver, et l'onglet « Alertes e-mail » de l'admin doit indiquer « Transmise ». Un compte non admin doit voir « Accès réservé à l'équipe FLEMME » sur /admin.

## Limites

- pg_net est asynchrone : « Transmise » veut dire que Supabase a envoyé la requête, pas que Resend l'a acceptée. En cas de doute, regarder les logs de la fonction `alerte` dans Netlify.
- L'ancien script `alertes.sql` de FlemmeV2.0 (déclencheurs sur `public.demandes` et `public.messages`) appelle la même adresse. La nouvelle fonction ignore ces anciens appels (réponse 204). On peut supprimer ces déclencheurs si l'ancien espace n'est plus utilisé.
- Pas de remboursement ni de paiement depuis l'admin : la décision d'un litige est un texte ajouté à l'historique de la flemme, visible du déposant et du Brigadier.

## Tests

    npm ci --ignore-scripts && npm test

`admin.test.mjs` installe `install.sql` puis `admin.sql` dans PGlite (sans pg_net ni Vault) et vérifie : refus sans compte admin, accès réservé, alertes enregistrées sans bloquer, signalements, litiges (prise en charge, clôture, réouverture), comptes, suspension, journal et RLS.
