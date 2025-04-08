# Guide Technique - MaBourse

## Introduction
MaBourse est une application fullstack moderne de gestion financière multi-utilisateur, combinant un frontend React riche et un backend Node.js/Express, avec stockage local et serveur.

---

## Architecture Générale

- **Frontend** : React + TypeScript, Vite, Tailwind CSS, Radix UI
- **Backend** : Node.js avec Express
- **Stockage** :
  - **Local** : IndexedDB dans le navigateur
  - **Serveur** : fichiers JSON dans un dossier `data/`
- **Communication** : API REST entre frontend et backend
- **Gestion multi-utilisateur** avec rôles administrateurs

---

## Frontend

### Technologies
- **React 18** avec **TypeScript**
- **Vite** pour le bundling et le serveur de développement
- **Tailwind CSS** pour le style
- **Radix UI** pour les composants d'interface accessibles
- **react-router-dom** pour la navigation
- **react-query** pour la gestion des requêtes et du cache
- **IndexedDB** pour le stockage local et la synchronisation
- **Vitest** pour les tests unitaires
- **Zod** pour la validation des schémas

### Structure
- **Pages principales** :
  - Authentification (`/auth`)
  - Tableau de bord (`/`)
  - Comptes (`/accounts`)
  - Transactions (`/transactions`)
  - Statistiques (`/statistics`)
  - Journal comptable (`/journal`)
  - Paramètres (`/settings`)
  - Administration (`/admin`)
  - 404 (`*`)
- **Gestion d'état** via Context Providers :
  - Authentification
  - Appareil
  - Mois financier
  - Filtres de comptes
- **Fonctionnalités avancées** :
  - Réparation automatique de la base locale
  - Exécution automatique des transactions récurrentes
  - Génération du journal comptable (historique + prévision 12 mois)
  - Synchronisation automatique avec le backend
  - Notifications (Toaster, Sonner)
  - Patches correctifs intégrés

---

## Backend

### Technologies
- **Node.js** avec **Express**
- **API REST** pour :
  - Authentification utilisateur/admin
  - Inscription
  - Sauvegarde/chargement des données
  - Gestion des utilisateurs et administrateurs
- **Stockage** :
  - Fichiers JSON dans `data/` (pas de base de données externe)
- **Gestion des fichiers** via modules internes (`fileStorage.js`, `adminAuth.js`)
- **Sert également** l'application frontend (buildée ou en développement)
- **Sécurité** :
  - Authentification par username/password à chaque requête
  - Contrôle d'accès administrateur
  - Pas de sessions ni JWT (stateless)

---

## Backend - Détails des API REST

### Authentification & Utilisateurs (`/api/storage/*`)
- **POST `/api/storage/login`** : Authentification utilisateur (username/password)
- **POST `/api/storage/register`** : Inscription d'un nouvel utilisateur
- **POST `/api/storage/data`** : Chargement des données utilisateur (après login)
- **POST `/api/storage/save`** : Sauvegarde des données utilisateur
- **POST `/api/storage/check-username`** : Vérification si un nom d'utilisateur est déjà pris
- **GET `/api/storage/users-list`** : Liste des utilisateurs (option détaillée)
- **POST `/api/storage/delete-user`** : Suppression d'un utilisateur (par lui-même)

### Administration (`/api/admin/*`)
- **POST `/api/admin/login`** : Authentification administrateur
- **POST `/api/admin/change-password`** : Changement du mot de passe admin
- **POST `/api/admin/add`** : Ajout d'un nouvel administrateur
- **POST `/api/admin/list`** : Liste des administrateurs
- **POST `/api/admin/remove`** : Suppression d'un administrateur
- **POST `/api/admin/delete-user`** : Suppression d'un utilisateur par un admin
- **POST `/api/admin/reset-user-password`** : Réinitialisation du mot de passe d'un utilisateur (partiellement implémenté)

### Divers
- **GET `*`** : Toutes les autres routes renvoient l'application React (SPA)

---

## Modules et fichiers clés

### Backend
- **`server.js`** : Serveur Express, expose toutes les routes API, sert le frontend
- **`fileStorage.js`** : Gestion des fichiers JSON utilisateurs (sauvegarde, chargement, suppression)
- **`adminAuth.js`** : Gestion des administrateurs (authentification, ajout, suppression)
- **`data/`** : Dossier contenant les fichiers JSON utilisateurs et administrateurs
- **`Lancement.bat`, `start_admin_panel.bat`** : Scripts pour lancer l'application

### Frontend
- **`src/main.tsx`** : Point d'entrée React, monte `<App />`
- **`src/App.tsx`** : Composant racine, configure les providers, routes, synchronisation, réparations
- **`src/pages/`** : Pages principales (Auth, Accounts, Transactions, Statistics, Journal, Settings, AdminPage, NotFound)
- **`src/components/`** : Composants UI, formulaires, graphiques, navigation, etc.
- **`src/contexts/`** : Contextes React (auth, device, mois financier, filtres)
- **`src/lib/`** :
  - **`db.ts`** : Gestion IndexedDB locale
  - **`repairDB.ts`** : Réparation de la base locale
  - **`balanceAdjustmentFix.ts`** : Correction des ajustements de solde
  - **`accountingJournalService.ts`** : Génération du journal comptable
  - **`recurringTransactionManager.ts`** : Gestion des transactions récurrentes
  - **`queryConfig.ts`** : Configuration react-query
  - **`patches/`** : Correctifs pour auth, version DB, etc.

---

## Fonctionnalités principales

- **Multi-utilisateur** avec authentification sécurisée
- **Gestion des comptes financiers**
- **Gestion des transactions, y compris récurrentes**
- **Statistiques financières et graphiques interactifs**
- **Journal comptable généré automatiquement**
- **Administration des utilisateurs et administrateurs**
- **Synchronisation locale/serveur avec gestion d'erreurs avancée**
- **Interface utilisateur moderne, responsive, accessible**
- **Notifications et gestion d'erreurs avancée**

---

## Points forts

- **Architecture modulaire** et bien organisée
- **Gestion robuste des erreurs** et récupération automatique
- **Synchronisation efficace** entre IndexedDB et backend
- **Interface utilisateur riche** avec animations et notifications
- **Facilité de déploiement** (pas de base de données externe nécessaire)
- **Solution autonome** adaptée à une gestion financière personnelle ou professionnelle

---

## Conclusion

MaBourse est une solution complète, moderne et autonome pour la gestion financière multi-utilisateur, combinant une interface utilisateur avancée avec une architecture backend simple mais efficace.
