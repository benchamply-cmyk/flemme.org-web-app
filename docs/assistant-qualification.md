# Assistant de qualification dans la nouvelle demande web

Portage de la conversation du [prototype d’octobre](https://github.com/benchamply-cmyk/FlemmeV2.0/commit/bf6f98dff8d622c7b1d0ef4247e8c1b80ead7494) vers l’écran React « Nouvelle flemme ». Le Manager existant extrait les faits et propose jusqu’à deux questions par tour. Une fois la demande comprise ou renvoyée vers l’équipe, le client peut corriger la proposition et la reprendre dans le formulaire. Il doit ensuite envoyer le formulaire lui-même ; la demande suit la validation existante. Aucun outil externe, aucune création de demande par le chatbot et aucune file de missions parallèle.

Le widget est facultatif et masqué par défaut. Le texte n’est envoyé qu’après accord et clic ; le formulaire et l’adresse privée ne sont pas transmis automatiquement. Le jeton de l’échange est gardé en mémoire de l’onglet tant que l’écran reste monté. Un échange peut être supprimé depuis l’écran ; il n’est pas repris après rechargement. Le backend refuse les accès après sept jours, purge les données expirées au prochain accès et ne conserve pas le jeton en clair. Les réponses du relais ne sont pas mises en cache.

## Configuration d’un environnement isolé

1. Démarrer `apps/manager` depuis la branche à tester. Configurer côté API `OPENAI_API_KEY`, `FLEMME_QUALIFICATION_SERVICE_KEY` (secret dédié) et `FLEMME_QUALIFICATION_DATABASE_PATH` (fichier SQLite réservé à cet usage, sur un volume privé persistant). Conserver une seule instance API pour cette base et ses quotas. Sans chemin ou secret, les routes sont indisponibles.
2. Dans les variables **Functions** Netlify de l’environnement de test, renseigner `FLEMME_QUALIFICATION_API_URL` (origine HTTPS de cette API, sans sous-chemin) et le même `FLEMME_QUALIFICATION_SERVICE_KEY`. Activer `QUALIFICATION_ENABLED=true` dans **Builds** et **Functions** pour cet environnement seulement. Ne placer aucun secret dans les variables `VITE_*`. Le navigateur n’appelle que le relais de sa propre origine.
3. Vérifier les questions avec une demande fictive, la modification du résumé, la suppression de l’échange et l’envoi normal du formulaire. Tester aussi le formulaire avec l’assistant désactivé et une API indisponible. Ne pas utiliser une base ou un compte client de production.
4. Avant toute mise en service partagée, valider l’information sur le traitement des messages par OpenAI, la conservation, les sauvegardes et la purge. Pour purger même sans trafic, exécuter sur le volume de l’API `uv run python -c "from flemme_manager.services.conversation_store import Store; Store().prune()"` avec les variables de l’API. Les sauvegardes ont leur propre rétention.

Le portage ne change pas le service Render existant. Vérifier le commit du Manager qui sert l’environnement cible et la disponibilité de ses routes `/api/qualification` avant d’activer le widget. Pour revenir au formulaire seul, retirer le drapeau dans Builds et Functions et republier avec autorisation.

Tests : `cd apps/web && npm ci && npm test && npm run build` ; `cd apps/manager && uv sync --locked --extra dev && uv run --locked pytest -q`. Les tests de qualification simulent OpenAI et le réseau du relais.
