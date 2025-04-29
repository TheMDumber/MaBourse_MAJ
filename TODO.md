# TODO: Maintenance et Optimisation de "MaBourse"

## Problèmes Corrigés

- [x] **SyntaxError - Variable redéfinie**: Suppression des redéclarations multiples de `DATA_DIR` et `USERS_FILE` dans server.js
- [x] **Erreur CORS**: Ajout des en-têtes manquants dans la configuration CORS (`Cache-Control`, `X-Requested-With`, `Accept`, `Origin`) pour résoudre les erreurs de préflight CORS entre le frontend (localhost:5173) et le backend (localhost:3001)
- [x] **Import manquant**: Ajout de l'import explicite de `path` dans server.js
- [x] **Pragma header dans serverCheck.ts**: Retrait de l'en-tête 'Pragma' qui causait des erreurs CORS
- [x] **Fonction getById manquante**: Ajout de la fonction `getById` dans l'API de transactions pour permettre la récupération d'une transaction par son ID, corrigeant l'erreur lors de l'ajout de transactions récurrentes
- [x] **Problème d'ajout de transactions récurrentes**: Correction de l'implémentation des transactions récurrentes, qui ne créait pas de véritable RecurringTransaction mais uniquement des transactions simples groupées
- [x] **Calcul du solde prévisionnel incomplet**: Modification de calculateBalance.ts pour prendre en compte les transactions récurrentes dans le calcul du solde prévisionnel, résolvant le problème où les transactions récurrentes n'apparaissaient pas dans le Journal Comptable

## Architecture Générale

- [x] **Cartographie structurelle**: 
  - **Frontend**: Application React 18 + TypeScript avec Vite, utilisant Tailwind CSS et Radix UI pour l'interface
  - **Backend**: Serveur Express.js avec système d'authentification personnalisé et stockage JSON
  - **Structure de données**: IndexedDB côté client, fichiers JSON côté serveur
  - **Communication**: API REST pour l'authentification, la synchronisation et l'administration
  - **Organisation du code**:
    - `/src` contient le code frontend (React/TypeScript)
    - `/data` stocke les fichiers de données utilisateurs et administrateurs
    - `server.js` gère le serveur backend 
    - `fileStorage.js` géré les opérations de fichiers pour les utilisateurs
    - `adminAuth.js` gère l'authentification des administrateurs

## Problèmes Identifiés

- [ ] **Redondance de code**: Plusieurs références au même fichier `USERS_FILE` dans différentes parties du code - à centraliser
- [ ] **Gestion des timeout**: Erreur de timeout détectée dans Auth.tsx:30 ("Timeout - La vérification auth a pris trop de temps") - problème lié aux erreurs CORS qui bloquent la vérification du serveur
- [x] **Problème CORS dans serverCheck.ts**: Le fichier serverCheck.ts incluait l'en-tête 'Pragma' qui n'était pas autorisé dans la configuration CORS - corrigé
- [ ] **Validation côté serveur**: Comme indiqué dans le commentaire TODO du server.js, il manque une validation et prévention des doublons côté backend
- [x] **Fonction manquante dans l'API de transactions**: La fonction `getById` n'était pas implémentée dans transactionsAPI, causant une erreur lors de l'ajout de transactions récurrentes
- [ ] **Réimplémentation de la fonction reset-user-password**: La fonction pour réinitialiser le mot de passe d'un utilisateur par un administrateur est partiellement implémentée dans server.js

## Optimisations Recommandées

- [x] **Sécurité des types**: Remplacement de 'any' par 'unknown' dans src/lib/serverTypes.ts
- [x] **Rafraîchissement UI**: Optimisation du rafraîchissement après import dans src/pages/Settings.tsx via invalidation React Query
- [x] **Gestion des erreurs**: Harmonisation de la gestion des erreurs avec des messages plus spécifiques et logging (AccountsList, Settings)
- [ ] **Refactorisation de la gestion des fichiers**: Centraliser toutes les opérations liées aux fichiers dans fileStorage.js
- [ ] **Sécurité**: Revoir la sécurité des routes administratives et implémenter une validation plus stricte
- [ ] **Performance**: Analyser et optimiser les appels API, en particulier pour la vérification du serveur qui semble causer des timeouts
- [ ] **Pagination**: Compléter l'implémentation de la pagination des transactions dans l'interface utilisateur
- [x] **Journal comptable**: Correction et optimisation de la génération du journal comptable, notamment la prise en compte des transactions récurrentes pour les périodes futures
- [ ] **Gestion des sessions**: Améliorer la gestion des sessions et ajouter un mécanisme de déconnexion automatique après inactivité

## Tâches Prioritaires

1. [ ] **Implémentation de la validation côté serveur**: Ajouter une validation robuste des données dans server.js pour éviter les doublons et assurer l'intégrité des données
2. [ ] **Correction des problèmes de timeout**: Optimiser la vérification du serveur dans serverCheck.ts pour éviter les erreurs de timeout
3. [ ] **Compléter la fonction de réinitialisation de mot de passe**: Finaliser l'implémentation de la fonction reset-user-password pour les administrateurs
4. [ ] **Centralisation de la gestion des fichiers**: Refactoriser le code pour centraliser les opérations sur les fichiers dans fileStorage.js
5. [ ] **Amélioration de la sécurité des routes administratives**: Implémenter des contrôles d'accès plus stricts pour les fonctions d'administration

## Prochaines Étapes

1. Sélectionner une tâche prioritaire à implémenter
2. Développer une solution qui respecte l'architecture existante
3. Tester la solution dans l'environnement local
4. Mettre à jour la documentation après chaque modification
5. Planifier l'implémentation des autres optimisations identifiées
