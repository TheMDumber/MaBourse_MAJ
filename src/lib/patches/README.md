# Corrections des erreurs de version dans l'application

## Problèmes identifiés

1. **Erreur de version IndexedDB**
   - Message d'erreur: `VersionError: The requested version (2) is less than the existing version (3).`
   - Localisation: App.tsx, AuthContext.tsx, useTheme.tsx, MainLayout.tsx
   - Cause: Le code tente d'ouvrir une base de données IndexedDB avec la version 2, mais elle existe déjà avec la version 3 dans le navigateur.

2. **Référence non définie à db**
   - Message d'erreur: `ReferenceError: db is not defined at queryFn (MainLayout.tsx:56:9)`
   - Cause: La variable db est utilisée avant d'être importée/initialisée

## Solutions à implémenter

1. **Mise à jour du schéma de la base de données (db.ts)**
   - Corriger la version de la base de données de 2 à 3
   - Ajouter la migration de la version 2 à la version 3
   - Assurer la compatibilité descendante pour les utilisateurs existants

2. **Correction des références non définies**
   - Ajouter l'import manquant de db dans MainLayout.tsx
   - Assurer que l'initialisation de la base de données est terminée avant de l'utiliser

## Étapes de mise en œuvre

1. Mettre à jour db.ts avec la nouvelle version et migration
2. Corriger les imports dans MainLayout.tsx
3. Tester la mise à jour et vérifier que les erreurs sont résolues
