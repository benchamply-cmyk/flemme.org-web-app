# Mise en service de Supabase (site réel)

Aujourd'hui, https://flemme.org est construit sans `VITE_SUPABASE_URL` ni `VITE_SUPABASE_PUBLISHABLE_KEY` : `app.html` tourne en **démonstration locale** (données fictives dans le navigateur). Pour passer en mode réel, il faut deux choses, dans cet ordre :

1. le backend `flemme_v2` (migrations de `supabase/migrations`) sur le projet Supabase de production : **appliqué le 03/11/2026** dans l'éditeur SQL, à vérifier (étape 1) ;
2. les deux variables publiques sur Netlify, puis une reconstruction du site.

Rien de tout cela n'est automatique : **chaque étape ci-dessous est faite à la main par Ben**. Le code ne modifie ni Supabase ni Netlify.

## Décisions prises (03/11/2026)

- Projet Supabase de production : **`yktpabnqkhwcshvjuncs`** (celui de l'ancien site FlemmeV2.0).
- Les comptes de l'ancien espace client sont **repris** : ils sont déjà dans `auth.users` de ce projet. La migration leur a créé un profil `flemme_v2.profiles`, avec leur pseudo comme nom affiché quand ils en avaient un.
- Le Manager IA reste dans la V2 : les migrations `flemme_v2` ne touchent à aucune de ses tables ni fonctions.

## Étapes

### 1. Vérifier le backend (lecture seule)

Supabase > projet `yktpabnqkhwcshvjuncs` > SQL Editor : coller `supabase/verification.sql`, requête par requête.

- Requête 1 : toutes les colonnes à `true` (schéma et RPC présents, RPC fermée aux visiteurs, tables non lisibles directement, RLS active).
- Requête 2 : `sans_profil` doit valoir 0. Elle donne aussi le nombre de comptes **sans mot de passe** (ouverts par lien e-mail, Google ou Apple) : ils devront utiliser « Mot de passe oublié ? » sur le nouveau site.
- Requête 3 : l'historique des migrations doit contenir `20261103120000` et `20261103120100` (le script appliqué le 03/11 les y inscrit) ainsi que `20261014010810` (FlemmeV2.0). Si les deux premières manquaient, les enregistrer avec `npx supabase migration repair --status applied 20261103120000 20261103120100`, sinon un futur `supabase db push` tenterait de les rejouer.

### 2. Authentification Supabase

Authentication > URL Configuration > **Redirect URLs** : ajouter (sans retirer celles de l'ancien site tant qu'il en reste besoin)

- `https://flemme.org/app.html`
- `https://www.flemme.org/app.html`
- `https://preprod--flemmeorg.netlify.app/app.html`
- `https://deploy-preview-*--flemmeorg.netlify.app/app.html`
- `http://localhost:5173/app.html` (développement)

Les liens de confirmation d'inscription et de mot de passe oublié reviennent sur `app.html` (flux PKCE : l'adresse ne contient qu'un code à usage unique). Les modèles d'e-mails français déjà en place (FlemmeV2.0, `supabase/emails/`) fonctionnent tels quels.

Vérifier aussi : Authentication > Providers > Email activé, « Confirm email » activé.

### 3. Netlify, d'abord sur preprod

Netlify > projet `flemmeorg` > Site configuration > Environment variables > Add a variable, pour chacune :

| Variable | Valeur |
|---|---|
| `VITE_SUPABASE_URL` | `https://yktpabnqkhwcshvjuncs.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | la clé **publique** `sb_publishable_…` du projet (Supabase > Project Settings > API Keys ; c'est aussi celle de la configuration publique du site historique dans FlemmeV2.0) |

- Scopes : Builds.
- **Deploy contexts : seulement « Branch deploys » et « Deploy Previews » dans un premier temps**, pas « Production ». flemme.org reste ainsi en démo pendant la recette.
- Ces valeurs sont inscrites dans le code au moment du build : relancer un déploiement de `preprod` (Deploys > Trigger deploy) après les avoir ajoutées.

Garde-fous : le build échoue (et rien n'est publié) si une seule des deux variables est remplie, si l'URL n'est pas en HTTPS, ou si la clé est une clé secrète (`sb_secret_…` ou JWT `service_role`).

### 4. Recette sur https://preprod--flemmeorg.netlify.app/app.html

- [ ] Le pied de page affiche « Test accompagné · paiements directs » (et non « Démo locale »).
- [ ] Nouveau compte : « Créer un compte », e-mail reçu, lien ouvert **dans le même navigateur** : connecté directement, message « Adresse confirmée ».
- [ ] Ancien compte avec mot de passe : connexion avec la même adresse e-mail.
- [ ] Ancien compte sans mot de passe : « Mot de passe oublié ? », lien reçu, écran « Choisis ton mot de passe », puis connexion.
- [ ] Déposer une flemme avec un compte, proposer un forfait avec un autre, échanger un message, accepter, terminer, déclarer puis confirmer le paiement, signaler un désaccord.
- [ ] Me déconnecter, puis me reconnecter.
- [ ] Requête 4 de `supabase/verification.sql` : les flemmes de test apparaissent.
- [ ] Ancien compte avec pseudo : le pseudo apparaît comme nom affiché, modifiable dans « Mon compte ».

### 5. Production

Quand la recette est bonne : ajouter le contexte « Production » aux deux variables, fusionner `preprod` → `prod` (ou relancer le déploiement de `prod`). Supprimer ensuite les annonces de test si besoin.

## Retour arrière

- **Revenir en démo** (immédiat, sans perte) : retirer les deux variables du contexte concerné sur Netlify, puis relancer le déploiement. Les données restent dans Supabase.
- Le backend `flemme_v2` lui-même n'a pas besoin d'être retiré pour revenir en démo : sans les variables, le site ne l'appelle plus.

## Limites connues

- Connexion par **e-mail et mot de passe** uniquement (le pseudo de l'ancien espace sert de nom affiché, pas d'identifiant) : la connexion par pseudo, par lien magique et par Google / Apple de l'ancien espace n'existe pas encore dans le nouveau site. « Mot de passe oublié ? » permet à ces comptes de se créer un mot de passe.
- Les **anciennes demandes** de l'ancien espace (tables de FlemmeV2.0) ne sont pas affichées dans le nouveau site : seuls les comptes sont repris. Elles restent intactes en base.
- La session web est gardée dans l'onglet (`sessionStorage`) : il faut se reconnecter après avoir fermé l'onglet.
- Le lien d'un e-mail doit être ouvert dans le navigateur où la demande a été faite (sécurité PKCE). Sinon, un message invite à redemander le lien.
- L'app mobile utilise le même backend : `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` avec les mêmes valeurs.
