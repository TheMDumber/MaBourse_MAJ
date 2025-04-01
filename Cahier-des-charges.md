# Cahier des Charges - M Bourse v1.5

## 1. Présentation du Projet

**M Bourse** (anciennement MaBourse) est une application web de gestion financière personnelle permettant aux utilisateurs de suivre leurs finances, analyser leurs dépenses et prévoir leur situation budgétaire future.

### 1.1 Objectifs Principaux

- Permettre aux utilisateurs de suivre leurs comptes et transactions financières
- Visualiser l'évolution du solde au fil du temps
- Analyser les dépenses par catégorie
- Gérer des transactions récurrentes
- Prévoir la situation financière future
- Offrir une expérience utilisateur fluide sur ordinateur et appareils mobiles

### 1.2 Public Cible

- Particuliers souhaitant gérer leurs finances personnelles
- Utilisateurs cherchant à mieux comprendre leurs habitudes de dépenses
- Personnes désirant planifier leur budget et anticiper leur situation financière

## 2. Architecture Technique

### 2.1 Stack Technologique

**Frontend**:
- Framework: React 18 avec TypeScript
- Styles: Tailwind CSS
- Composants UI: shadcn/ui (basé sur Radix UI)
- Routage: react-router-dom (v6)
- Gestion des formulaires: react-hook-form
- Validation: Zod
- Visualisation: Recharts pour les graphiques
- Build: Vite

**Backend**:
- Serveur: Express.js
- Authentification: Système personnalisé avec hachage PBKDF2
- Stockage de données centralisé: Système de fichiers JSON

**Stockage de données client**:
- IndexedDB pour le stockage local
- Synchronisation avec le serveur

### 2.2 Organisation du Code

La structure du projet suit une architecture par fonctionnalités:

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
  ├── lib/                       # Utilitaires, types et gestion de données
  │   ├── patches/               # Correctifs pour l'application
  │   ├── calculateBalance.ts    # Calcul des soldes
  │   ├── db.ts                  # Gestion de la base de données
  │   ├── fileStorage.ts         # Stockage de fichiers côté serveur
  │   ├── fileStorageAdapter.ts  # Adapter pour stockage côté client
  │   └── types.ts               # Définitions des types
  ├── pages/                     # Composants de page
  └── styles/                    # Styles spécifiques
```

### 2.3 Modes de Fonctionnement

L'application propose deux modes de fonctionnement:

1. **Mode Standard (Local)**: 
   - Données stockées uniquement en local via IndexedDB
   - Pas d'authentification requise
   - Adapté à une utilisation sur un seul appareil

2. **Mode Centralisé (avec serveur)**:
   - Authentification par identifiant/mot de passe
   - Stockage des données sur un serveur central
   - Synchronisation automatique entre le serveur et le client
   - Permet l'utilisation sur plusieurs appareils

## 3. Modèle de Données

### 3.1 Entités Principales

#### Compte (Account)
```typescript
interface Account {
  id?: number;
  name: string;
  type: AccountType; // checking, savings, creditCard, cash, investment, other
  initialBalance: number;
  currency: Currency; // EUR, USD, GBP, CHF, CAD, JPY
  icon?: string;
  color?: string;
  isArchived?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Transaction
```typescript
interface Transaction {
  id?: number;
  accountId: number;
  toAccountId?: number; // Pour les transferts
  amount: number;
  type: TransactionType; // income, expense, transfer
  category?: string;
  description: string;
  date: Date;
  isRecurring?: boolean;
  recurringId?: number;
  recurringMonths?: number; // Pour les transactions récurrentes mensuelles
  createdAt: Date;
  updatedAt: Date;
}
```

#### Transaction Récurrente (RecurringTransaction)
```typescript
interface RecurringTransaction {
  id?: number;
  accountId: number;
  toAccountId?: number;
  amount: number;
  type: TransactionType;
  category?: string;
  description: string;
  frequency: RecurringFrequency; // daily, weekly, biweekly, monthly, quarterly, yearly
  startDate: Date;
  endDate?: Date;
  lastExecuted?: Date;
  nextExecution: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Préférences Utilisateur (UserPreferences)
```typescript
interface UserPreferences {
  id?: number;
  defaultCurrency: Currency;
  theme: Theme; // light, dark, cyber, softbank
  defaultAccount?: number;
  dateFormat: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Ajustement de Solde (BalanceAdjustment)
```typescript
interface BalanceAdjustment {
  id?: number;
  accountId: number;
  yearMonth: string; // Format: "YYYY-MM"
  adjustedBalance: number;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.2 Base de Données

La base de données IndexedDB est structurée comme suit:

- **Version**: 3
- **Object Stores**:
  - `accounts`: Stockage des comptes
  - `transactions`: Stockage des transactions
  - `recurringTransactions`: Stockage des transactions récurrentes
  - `userPreferences`: Stockage des préférences utilisateur
  - `balanceAdjustments`: Stockage des ajustements de solde manuels

## 4. Fonctionnalités Détaillées

### 4.1 Gestion des Comptes

- Création, modification et suppression de comptes
- Types de comptes: courant, épargne, carte de crédit, espèces, investissement, autre
- Support pour différentes devises
- Possibilité d'archiver des comptes
- Solde initial configurable
- Personnalisation avec icônes et couleurs

### 4.2 Gestion des Transactions

- Ajout, modification et suppression de transactions
- Types de transactions: revenus, dépenses, transferts entre comptes
- Catégorisation des transactions
- Filtrage par date, type, catégorie et compte
- Vue en tableau (desktop) ou en cartes (mobile)
- Modification groupée des transactions récurrentes
- Recherche avancée de transactions

### 4.3 Transactions Récurrentes

- Programmation de transactions à répétition régulière
- Fréquences disponibles: quotidienne, hebdomadaire, bihebdomadaire, mensuelle, trimestrielle, annuelle
- Option pour définir une date de fin
- Support pour les revenus, dépenses et transferts récurrents
- Option de récurrence mensuelle sur X mois
- Gestion automatique des dates d'exécution

### 4.4 Statistiques et Visualisations

- Graphique d'évolution du solde
- Répartition des dépenses par catégorie
- Prévisions budgétaires futures
- Filtrage par compte et par période
- Sélection du type de visualisation
- Zoom sur périodes spécifiques
- Comparaison entre périodes

### 4.5 Prévisions Budgétaires

- Calcul du solde prévisionnel basé sur les transactions récurrentes
- Visualisation de l'évolution future du solde
- Affichage du solde prévisionnel du mois en cours dans l'interface
- Prise en compte des ajustements manuels
- Projections à court et moyen terme

### 4.6 Système d'Authentification

- Création de compte utilisateur (inscription)
- Connexion sécurisée (login)
- Hachage des mots de passe avec PBKDF2
- Gestion multi-utilisateurs (chaque utilisateur a ses propres données)
- Récupération de mot de passe (à implémenter)
- Protection contre les attaques par force brute

### 4.7 Synchronisation des Données

- Sauvegarde automatique des données sur le serveur
- Chargement des données depuis le serveur lors de la connexion
- Mécanisme de fusion pour éviter les conflits
- Indication de la dernière synchronisation
- Modes de synchronisation manuelle et automatique
- Gestion des erreurs de synchronisation

### 4.8 Personnalisation

- Sélection du thème visuel: clair, sombre, cyber, softbank
- Choix de la devise par défaut
- Format de date personnalisable
- Compte par défaut configurable
- Options d'affichage des soldes négatifs
- Personnalisation des catégories (à implémenter)

### 4.9 Import/Export de Données

- Export des données au format JSON
- Option d'export pour un compte spécifique
- Import avec différents modes (créer/écraser/fusionner)
- Validation des données importées
- Protection contre les imports malveillants
- Support de formats supplémentaires prévu (CSV, PDF)

### 4.10 Interface Utilisateur Adaptative

- Détection automatique du type d'appareil
- Interface optimisée pour mobile et desktop
- Navigation adaptée au type d'écran
- Système d'astuces interactives avec flèches indicatives pour guider les nouveaux utilisateurs
- Gestion des gestures tactiles sur mobile

## 5. Sécurité et Confidentialité

### 5.1 Stockage Sécurisé

- Données stockées localement via IndexedDB (mode standard)
- Fichiers JSON cryptés sur le serveur (mode centralisé)
- Hachage des mots de passe avec sel unique (PBKDF2)
- Isolation des données par utilisateur
- Backup régulier des données serveur

### 5.2 Authentification

- Validation des identifiants côté serveur
- Session maintenue via localStorage
- Déconnexion automatique en cas d'inactivité (à implémenter)
- Limitation des tentatives de connexion
- Journalisation des connexions

### 5.3 Accès aux Données

- Isolation des données par utilisateur
- Vérification des autorisations pour chaque opération API
- Logs des opérations sensibles
- Accès administrateur limité
- Protection contre l'injection SQL

## 6. Expérience Utilisateur

### 6.1 Guidage et Assistance

- Système d'astuces interactives pour les nouveaux utilisateurs
- Flèches indicatives pour guider vers les fonctionnalités clés
- Mémorisation des astuces déjà vues
- Option pour réinitialiser les astuces
- Tooltips informatifs sur les éléments complexes

### 6.2 Interface Responsive

- Adaptation automatique selon la taille de l'écran
- Vue en tableaux sur desktop
- Vue en cartes sur mobile
- Navigation bottom-bar sur mobile
- Optimisation des formulaires pour écrans tactiles

### 6.3 Feedback Visuel

- Indications de chargement
- Messages de confirmation et d'erreur
- Mise en évidence des données importantes (soldes, montants)
- Code couleur pour les revenus et dépenses
- Animations subtiles pour améliorer l'expérience

## 7. Contraintes et Limitations

### 7.1 Limitations Actuelles

- Catégories prédéfinies non personnalisables (à développer)
- Absence de synchronisation en temps réel
- Pas de système de budgétisation avancé (à développer)
- Exécution manuelle des transactions récurrentes
- Absence de tests automatisés complets

### 7.2 Compatibilité

- Navigateurs modernes avec support IndexedDB
- Optimisé pour Chrome, Firefox, Safari et Edge
- Node.js v22+ pour le serveur
- Compatibilité mobile prioritaire (iOS, Android)

## 8. Plan d'Évolution

### 8.1 Prochaines Fonctionnalités (v1.6)

- Implémentation de la pagination des transactions
- Correction du calcul des soldes dans les statistiques
- Ajout de l'exécution automatique des transactions récurrentes
- Mise en place de tests unitaires
- Ajout d'un système de budgétisation simple

### 8.2 Améliorations Futures (v2.0)

- Système de catégories personnalisables
- Amélioration du système d'export/import (formats CSV, PDF)
- Optimisation des requêtes à IndexedDB
- Gestion des devises étendue avec taux de change
- Application mobile native
- Système de notifications
- Intégration avec des services bancaires
- Mode hors-ligne amélioré

## 9. Installation et Déploiement

### 9.1 Prérequis

- Node.js v22+
- NPM ou Bun
- Navigateur moderne avec support IndexedDB
- Git pour le développement collaboratif

### 9.2 Installation Mode Standard

```bash
# Installation des dépendances
npm install

# Démarrage du serveur de développement
npm run dev
```

### 9.3 Installation Mode Centralisé

```bash
# Lancer le script automatique
start_with_server.bat

# Ou manuellement
npm run build
npm run server
```

L'application sera accessible sur http://localhost:3001

### 9.4 Déploiement

Instructions pour le déploiement sur:
- Serveur dédié
- Services cloud (AWS, Azure, Vercel)
- Docker (configuration à venir)

## 10. Contribution et Open Source

### 10.1 Licence

Ce projet est distribué sous licence MIT, permettant:
- Usage commercial
- Modification
- Distribution
- Usage privé

### 10.2 Contributions

Les contributions sont soumises aux guidelines du projet:
- Code de conduite
- Standards de codage
- Processus de review des Pull Requests
- Documentation des contributions

## 11. Conclusion

M Bourse est une application web complète de gestion financière personnelle offrant un suivi détaillé des finances, une visualisation claire des dépenses et des prévisions budgétaires. Son architecture flexible permet un usage local ou centralisé, répondant aux besoins variés des utilisateurs. L'application continue d'évoluer avec des améliorations régulières pour enrichir ses fonctionnalités et optimiser ses performances.

La nouvelle vision de M Bourse inclut une ouverture à la communauté open source pour enrichir l'application et la rendre plus robuste, tout en maintenant un haut niveau de sécurité et de confidentialité des données utilisateurs.
