# M Bourse v1.5

<p align="center">
  <img src="public/og-image.png" alt="M Bourse Logo" width="200" />
</p>

<p align="center">
  Une application web moderne de gestion financière personnelle
</p>

<p align="center">
  <a href="#fonctionnalités">Fonctionnalités</a> •
  <a href="#démarrage-rapide">Démarrage rapide</a> •
  <a href="#installation">Installation</a> •
  <a href="#capture-décran">Captures d'écran</a> •
  <a href="#technologies">Technologies</a> •
  <a href="#structure-du-projet">Structure</a> •
  <a href="#contribution">Contribution</a> •
  <a href="#licence">Licence</a>
</p>

## 📊 Présentation

**M Bourse** (anciennement MaBourse) est une application web complète de gestion financière personnelle, permettant aux utilisateurs de suivre leurs finances, analyser leurs dépenses et prévoir leur situation budgétaire future. Elle offre une interface intuitive adaptée aux appareils mobiles et de bureau.

## ✨ Fonctionnalités

- **🏦 Gestion des comptes** - Création et gestion de différents types de comptes financiers
- **💸 Suivi des transactions** - Enregistrement des revenus, dépenses et transferts entre comptes
- **🔄 Transactions récurrentes** - Configuration de transactions automatiques à intervalles réguliers
- **📈 Statistiques avancées** - Visualisation de l'évolution financière via graphiques dynamiques
- **🔍 Analyse par catégories** - Répartition des dépenses par catégorie avec visualisations
- **📱 Interface responsive** - Design moderne s'adaptant aux mobiles et ordinateurs
- **🌓 Thèmes personnalisables** - Choix entre plusieurs thèmes visuels (clair, sombre, cyber, softbank)
- **🔄 Synchronisation** - Stockage local avec synchronisation sur serveur
- **👥 Multi-utilisateurs** - Support de plusieurs utilisateurs avec système d'authentification
- **🔒 Sécurité** - Hachage des mots de passe et isolation des données par utilisateur

## 🚀 Démarrage rapide

Une fois l'application démarrée, elle sera accessible à l'adresse suivante:
- Développement: `http://localhost:5173`
- Production: `http://localhost:3001`

### Premier lancement

Lors du premier lancement, un compte administrateur par défaut est créé avec les identifiants:
- **Nom d'utilisateur**: `admin`
- **Mot de passe**: `admin123`

> ⚠️ **Important**: Pour des raisons de sécurité, veuillez changer ce mot de passe immédiatement après la première connexion!

### Modes de fonctionnement

L'application propose deux modes:

1. **📱 Mode Standard (Local)** - Données stockées uniquement en local via IndexedDB, parfait pour une utilisation sur un seul appareil
2. **☁️ Mode Centralisé (avec serveur)** - Authentification requise, données synchronisées sur le serveur, idéal pour une utilisation multi-appareils

## 💻 Installation

### Prérequis

- Node.js v22+
- NPM ou Bun
- Navigateur moderne avec support IndexedDB

### Installation manuelle

1. Cloner ce dépôt:
   ```bash
   git clone https://github.com/votre-username/M-Bourse.git
   cd M-Bourse
   ```

2. Installer les dépendances:
   ```bash
   npm install
   ```

3. Lancer le serveur de développement:
   ```bash
   npm run dev
   ```

4. Ou construire puis démarrer l'application en production:
   ```bash
   npm run build
   npm run server
   ```

### Installation rapide (Windows)

Utilisez les scripts batch fournis:
- `start_with_server.bat` - Lance l'application avec le serveur
- `github_prepare.bat` - Prépare le projet pour GitHub
- `build_and_run.bat` - Construit et lance l'application

## 📱 Captures d'écran

*Captures d'écran à venir*

## 🧰 Technologies

### Frontend
- ⚛️ React 18 avec TypeScript
- 🎨 Tailwind CSS pour le styling
- 🧩 shadcn/ui (basé sur Radix UI) pour les composants
- 🔀 react-router-dom (v6) pour le routage
- 📝 react-hook-form pour la gestion des formulaires
- ✅ Zod pour la validation
- 📊 Recharts pour les graphiques
- 🏗️ Vite pour le build

### Backend
- 🖥️ Express.js pour le serveur
- 🔐 Système personnalisé d'authentification avec PBKDF2
- 📂 Stockage de données centralisé en JSON

### Stockage
- 🗄️ IndexedDB pour le stockage local
- 🔄 Synchronisation avec le serveur

## 📁 Structure du projet

```
src/
  ├── components/                # Composants React
  │   ├── accounts/              # Gestion des comptes
  │   ├── auth/                  # Authentification
  │   ├── layout/                # Mise en page
  │   ├── statistics/            # Visualisations et statistiques
  │   ├── tips/                  # Système d'astuces
  │   ├── transactions/          # Gestion des transactions
  │   └── ui/                    # Composants UI réutilisables
  ├── contexts/                  # Contextes React pour l'état global
  ├── hooks/                     # Hooks personnalisés
  ├── lib/                       # Utilitaires et gestion de données
  │   ├── patches/               # Correctifs pour l'application
  │   └── ...
  ├── pages/                     # Composants de page
  └── styles/                    # Styles spécifiques
```

## 🛠️ Scripts disponibles

- `npm run dev` - Lance le serveur de développement Vite
- `npm run build` - Construit l'application pour la production
- `npm run build:dev` - Construit l'application en mode développement
- `npm run lint` - Vérifie le code avec ESLint
- `npm run preview` - Prévisualise l'application construite
- `npm run server` - Démarre le serveur Express
- `npm run start` - Construit puis lance l'application (production)
- `npm run test` - Exécute les tests unitaires
- `npm run test:watch` - Exécute les tests en mode watch
- `npm run test:coverage` - Génère un rapport de couverture des tests

## 👥 Contribution

Les contributions sont les bienvenues ! Consultez notre [guide de contribution](CONTRIBUTING.md) pour plus d'informations.

## 📜 Licence

Ce projet est sous licence [MIT](LICENSE).
