## Résumé

<!-- Ce que change la PR, en une ou deux phrases. -->

## Type

<!-- Étiquette à poser : nouveaute, correction, migration, docs ou promotion. -->

## Contrôles

- [ ] Branche créée depuis `preprod`, nommée `type/sujet`
- [ ] Ligne ajoutée sous « À venir » dans `CHANGELOG.md`
- [ ] Migration Supabase : non / oui (fichier et ordre d'application)
- [ ] Flag concerné : aucun / nom du flag et état par défaut
- [ ] Vérifié sur l'aperçu de la PR

## Promotion `preprod` → `prod` uniquement

<!-- Titre : « Promotion vX.Y.Z ». Supprimer cette section pour une PR ordinaire. -->

- Version : `vX.Y.Z` (candidate `vX.Y.Z-rc.N` publiée le …)
- PR embarquées : #…
- Migrations à appliquer en production avant la fusion : …
- Après fusion : tag `vX.Y.Z` sur le merge commit, release « Generate release notes », déploiement Netlify renommé, registre des versions à jour
