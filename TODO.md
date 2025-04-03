# TODO: Maintenance et Optimisation de "MaBourse"

## Problèmes Corrigés

- [x] **SyntaxError - Variable redéfinie**: Suppression des redéclarations multiples de `DATA_DIR` et `USERS_FILE` dans server.js
- [x] **Erreur CORS**: Ajout des en-têtes manquants dans la configuration CORS (`Cache-Control`, `X-Requested-With`, `Accept`, `Origin`) pour résoudre les erreurs de préflight CORS entre le frontend (localhost:5173) et le backend (localhost:3001)
- [x] **Import manquant**: Ajout de l'import explicite de `path` dans server.js
- [x] **Pragma header dans serverCheck.ts**: Retrait de l'en-tête 'Pragma' qui causait des erreurs CORS

## Problèmes Identifiés

- [ ] **Redondance de code**: Plusieurs références au même fichier `USERS_FILE` dans différentes parties du code - à centraliser
- [ ] **Gestion des timeout**: Erreur de timeout détectée dans Auth.tsx:30 ("Timeout - La vérification auth a pris trop de temps") - problème lié aux erreurs CORS qui bloquent la vérification du serveur
- [x] **Problème CORS dans serverCheck.ts**: Le fichier serverCheck.ts incluait l'en-tête 'Pragma' qui n'était pas autorisé dans la configuration CORS - corrigé
- [ ] **Validation côté serveur**: Comme indiqué dans le commentaire TODO du server.js, il manque une validation et prévention des doublons côté backend

## Optimisations Recommandées

- [ ] **Refactorisation de la gestion des fichiers**: Centraliser toutes les opérations liées aux fichiers dans fileStorage.js
- [ ] **Gestion des erreurs**: Améliorer la gestion des erreurs avec des messages plus spécifiques et un logging structuré
- [ ] **Sécurité**: Revoir la sécurité des routes administratives et implémenter une validation plus stricte
- [ ] **Performance**: Analyser et optimiser les appels API, en particulier pour la vérification du serveur qui semble causer des timeouts

## Tâches en Cours

- [ ] **Architecture et structure du code**: Compléter l'analyse de l'architecture pour identifier d'autres améliorations potentielles

## Prochaines Étapes

1. Vérifier si la correction des erreurs CORS résout les problèmes de timeout d'authentification
2. Implémenter la validation côté serveur pour prévenir les doublons
3. Refactoriser la gestion des fichiers pour une meilleure maintenabilité
4. Renforcer la sécurité des routes administratives
5. Tester complètement le flux d'authentification pour s'assurer que les problèmes ont été résolus
