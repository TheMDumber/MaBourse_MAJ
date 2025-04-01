# Guide de contribution à M Bourse

Merci de votre intérêt pour contribuer à M Bourse ! Ce document fournit des lignes directrices pour contribuer au projet.

## Table des matières

- [Code de conduite](#code-de-conduite)
- [Comment puis-je contribuer ?](#comment-puis-je-contribuer)
  - [Signaler des bugs](#signaler-des-bugs)
  - [Suggérer des améliorations](#suggérer-des-améliorations)
  - [Contribuer au code](#contribuer-au-code)
- [Style de code](#style-de-code)
- [Process de développement](#process-de-développement)
  - [Branches](#branches)
  - [Commits](#commits)
  - [Pull Requests](#pull-requests)
- [Configuration du développement](#configuration-du-développement)

## Code de conduite

Ce projet et tous ses participants sont régis par un code de conduite qui favorise un environnement ouvert et accueillant. En participant, vous êtes censé respecter ce code.

## Comment puis-je contribuer ?

### Signaler des bugs

Si vous découvrez un bug, veuillez créer une issue sur GitHub en utilisant le modèle de bug. Avant de créer un nouveau rapport, vérifiez que le problème n'a pas déjà été signalé.

**Informations importantes à inclure** :
- Description claire et concise du bug
- Étapes pour reproduire le problème
- Comportement attendu vs comportement observé
- Captures d'écran si applicable
- Informations sur votre environnement (navigateur, OS, etc.)

### Suggérer des améliorations

Pour suggérer une amélioration, créez une issue en utilisant le modèle de fonctionnalité. Décrivez clairement la fonctionnalité souhaitée et expliquez pourquoi elle serait utile au projet.

### Contribuer au code

1. Assurez-vous qu'une issue existe pour la fonctionnalité ou le bug sur lequel vous souhaitez travailler
2. Fork le dépôt et créez une branche à partir de `develop`
3. Implémentez vos modifications
4. Assurez-vous que les tests passent (si disponibles)
5. Soumettez une Pull Request vers la branche `develop`

## Style de code

Nous utilisons ESLint pour maintenir un style de code cohérent. Avant de soumettre votre code, exécutez `npm run lint` pour vérifier les problèmes de style.

### Règles générales

- Utilisez TypeScript pour tout le code nouveau
- Préférez les fonctions composants React avec les Hooks
- Utilisez les composants shadcn/ui quand c'est possible
- Suivez les principes de nommage BEM pour le CSS personnalisé
- Les composants doivent être petits et avoir une responsabilité unique
- Documentez les fonctions complexes avec des commentaires

## Process de développement

### Branches

- `main` : Code de production stable
- `develop` : Branche de développement principale
- `feature/nom-fonctionnalité` : Pour les nouvelles fonctionnalités
- `bugfix/nom-bug` : Pour les corrections de bugs
- `hotfix/nom-problème` : Pour les correctifs urgents en production

### Commits

Suivez le format de message de commit conventionnel :
```
type(scope): description courte

Description détaillée si nécessaire
```

Types courants :
- `feat` : Nouvelle fonctionnalité
- `fix` : Correction de bug
- `docs` : Changements dans la documentation
- `style` : Formatting, missing semi colons, etc.
- `refactor` : Refactorisation du code
- `test` : Ajout ou correction de tests
- `chore` : Tâches de maintenance

### Pull Requests

- Créez une PR vers la branche `develop`
- Liez la PR à l'issue correspondante
- Incluez une description claire de vos changements
- Attendez la revue de code avant de merger

## Configuration du développement

### Installation

```bash
# Cloner le dépôt
git clone https://github.com/votre-username/M-Bourse.git
cd M-Bourse

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

### Structure du projet

Familiarisez-vous avec la [structure du projet](README.md#structure-du-projet) avant de commencer à contribuer.

### Tests

Nous encourageons l'écriture de tests pour tout nouveau code :

```bash
# Exécuter les tests
npm run test

# Exécuter les tests en mode watch
npm run test:watch
```

---

Merci de contribuer à M Bourse ! Votre aide est précieuse pour améliorer l'application.
