# Unification FlemmeV2.0 et preprod-mobile

Comparaison du 6 novembre 2026 entre [FlemmeV2.0/main](https://github.com/benchamply-cmyk/FlemmeV2.0/tree/27b15ee82bd9dd9c0cbb57c063d1adf131e48ee2) et [preprod-mobile](https://github.com/benchamply-cmyk/flemme.org-web-app/tree/82e24f6b6f58ea3872e2bab82ee1c5eaa9ef2b04). Les arbres Git contiennent respectivement 301 et 271 fichiers suivis. Au moment de la revue, preprod et preprod-mobile pointent sur le même commit.

| Périmètre | Décision |
|---|---|
| App native et SDK (#49, #50) | Conserver apps/mobile dans la cible. Les deux versions déclarent Expo 58.0.20 et React Native 0.88.0. La cible sépare les écrans et mutualise le domaine et le transport avec le site dans packages/shared. |
| Design (#51) | Le logo, l’icône et apps/mobile/app.json ont des empreintes Git identiques. Le fichier de palette de la source est identique à packages/shared/src/brand.ts dans la cible. Conserver l’accès direct au formulaire de dépôt et le parcours enrichi de la cible. |
| Supabase et tests | Conserver les migrations et les tests de la cible. Le script historique utilise flemme_mobile_v1 alors que la cible utilise flemme_v2. Les deux exposent public.flemme_mobile_api avec des contrats qui ont évolué. |
| Web et hébergement | Garder apps/web et la configuration Netlify de la cible. Les anciens sites statiques embarquent leurs propres routes, fonctions, service workers et paramètres de publication. Les reprendre demande un besoin identifié et une recette isolée. |
| Manager | Garder apps/manager. Les modules de workflow de flemme-managerV1 et leur test principal sont déjà présents avec le même contenu. Les trois tests SQL historiques diffèrent et demandent une revue par rapport aux migrations de la cible. |
| CI | Garder les workflows mobile, web, Manager et Supabase de la cible. La CI mobile historique référence notamment l’ancien dossier backend et le workflow SDK 58 une branche de correctif. |
| Contenu et archives | Les maquettes, anciennes vitrines et notes restent consultables dans le commit source. Les personas historiques comportent des hypothèses de rémunération qui diffèrent du modèle en vigueur. |

Le diff de cette PR ajoute cette note au dépôt. La vérification porte sur les arbres Git, les fichiers de configuration et les contrats documentés. Les tests applicatifs et les environnements déployés restent à vérifier avant tout portage fonctionnel. Pour un futur portage, identifier le fichier ou comportement manquant, puis le tester avec le client de la cible sur un environnement isolé.

[PR #49](https://github.com/benchamply-cmyk/FlemmeV2.0/pull/49) · [PR #50](https://github.com/benchamply-cmyk/FlemmeV2.0/pull/50) · [PR #51](https://github.com/benchamply-cmyk/FlemmeV2.0/pull/51)
