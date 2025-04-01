# Protection contre les doublons lors de l'ajout de comptes

Ce document détaille les modifications apportées pour garantir qu'un compte ne puisse jamais être ajouté en double dans l'application Ma Bourse, que ce soit par création manuelle, importation ou synchronisation.

## Problématique

Plusieurs scénarios pouvaient conduire à l'ajout de comptes en double :

1. **Synchronisation entre appareils** : Lors de la fusion des données locales et distantes
2. **Création manuelle** : Un utilisateur pourrait créer un compte avec un nom très similaire à un compte existant
3. **Invalidation des requêtes React Query** : Pouvant provoquer un affichage temporaire de doublons

## Solutions implémentées

### 1. Amélioration de la fonction de création de compte

Dans `db.ts`, la fonction `create` a été modifiée pour inclure une vérification supplémentaire :

```typescript
async create(account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  await initDB();
  const now = new Date();
  
  // Mettre la première lettre du nom en majuscule
  const capitalizedName = account.name.charAt(0).toUpperCase() + account.name.slice(1);
  
  // Vérifier à nouveau si un compte avec ce nom existe déjà
  const nameExists = await this.checkNameExists(capitalizedName);
  if (nameExists) {
    console.warn(`Tentative d'ajout d'un compte avec un nom déjà existant: ${capitalizedName}`);
    throw new Error(`Un compte avec le nom '${capitalizedName}' existe déjà`);
  }
  
  // ... reste du code ...
}
```

### 2. Renforcement de la synchronisation dans AuthContext

Dans `AuthContext.tsx`, la logique de synchronisation a été améliorée pour éviter les doublons :

- Utilisation d'un Map pour suivre les comptes déjà présents par nom normalisé
- Vérification insensible à la casse pour détecter les similitudes de noms
- Triple vérification avant l'ajout d'un nouveau compte
- Journalisation des opérations avec statistiques

```typescript
// Créer un Map pour les comptes locaux avec le nom normalisé comme clé
const localAccountsMap = new Map<string, Account>();
for (const account of localAccounts) {
  if (account.name) {
    localAccountsMap.set(account.name.toLowerCase(), account);
  }
}

// Statistiques pour le rapport de synchronisation
let newAccountsCount = 0;
let updatedAccountsCount = 0;
let skippedAccountsCount = 0;

// ... puis lors du traitement ...
// Vérification supplémentaire pour détecter les noms similaires
const similarNameAccount = localAccounts.find(a => 
  a.name && a.name.toLowerCase() === normalizedName
);

if (similarNameAccount) {
  console.warn(`Compte serveur ignoré: nom similaire déjà existant "${serverAccount.name}" vs "${similarNameAccount.name}"`);
  skippedAccountsCount++;
  continue;
}
```

### 3. Création d'un module dédié à la validation des comptes

Un nouveau fichier `accountValidator.ts` a été créé pour centraliser toute la logique de validation :

- Fonction `accountNameExists` : Vérifie l'existence d'un nom de compte (insensible à la casse)
- Fonction `normalizeAccountName` : Normalise les noms de comptes pour réduire les variations mineures
- Fonction `removeDuplicateAccounts` : Garantit l'unicité des comptes dans une liste
- Fonction `getUniqueAccountName` : Génère un nom unique en ajoutant un numéro si nécessaire

### Bénéfices

Cette triple protection assure que :

1. **Aucun compte en double** ne peut être ajouté, quelle que soit la méthode d'ajout
2. Les noms de comptes sont **normalisés** pour une meilleure cohérence
3. Les **faux positifs** sont minimisés tout en gardant une protection stricte
4. Les erreurs sont correctement **journalisées** pour faciliter le débogage

## Considérations supplémentaires

- Les modifications respectent la logique existante de l'application
- Le code est robuste face aux erreurs et inclut une gestion appropriée des exceptions
- Les performances sont préservées grâce à l'utilisation de structures de données optimisées (Map)
