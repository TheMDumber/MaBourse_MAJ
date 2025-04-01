# Amélioration de la gestion des comptes - Élimination des doublons

Ce document détaille les modifications apportées pour résoudre le problème d'affichage temporaire de doublons dans la liste des comptes.

## Problème identifié

L'application affichait parfois temporairement des doublons dans la liste des comptes lors des synchronisations ou des rafraîchissements, ce qui pouvait créer une confusion pour l'utilisateur.

## Solution implémentée

Nous avons mis en place trois niveaux de protection contre les doublons :

### 1. Niveau API de base de données

Modification de la méthode `accountsAPI.getAll()` dans `db.ts` :
```typescript
async getAll(): Promise<Account[]> {
  await initDB();
  const accounts = await db.getAll('accounts');
  
  // Vérification et déduplication des comptes basée sur l'ID
  const uniqueAccounts = Array.from(
    new Map(accounts.map(account => [account.id, account])).values()
  );
  
  // Log pour le débogage si des doublons sont détectés
  if (accounts.length !== uniqueAccounts.length) {
    console.warn(`Doublons détectés dans getAll(): ${accounts.length} entrées -> ${uniqueAccounts.length} uniques`);
  }
  
  return uniqueAccounts;
}
```

Cette modification assure que toutes les fonctions appelant `accountsAPI.getAll()` recevront une liste sans doublons.

### 2. Niveau composant AccountsList

Modification de la fonction `loadAccounts()` dans `AccountsList.tsx` :
```typescript
const loadAccounts = async () => {
  try {
    setIsLoading(true);
    const data = await accountsAPI.getAll();
    
    // Éliminer les doublons basés sur l'ID avant de mettre à jour l'état
    const uniqueAccounts = Array.from(
      new Map(data.map(account => [account.id, account])).values()
    );
    
    // Tri des comptes par nom pour une meilleure expérience utilisateur
    uniqueAccounts.sort((a, b) => a.name.localeCompare(b.name));
    
    console.log(`Comptes chargés: ${data.length}, après déduplication: ${uniqueAccounts.length}`);
    
    // Remplacer complètement l'état avec les comptes uniques
    setAccounts(uniqueAccounts);
  } catch (error) {
    // Gestion des erreurs...
  } finally {
    setIsLoading(false);
  }
}
```

Cette modification garantit que l'état local du composant ne contiendra jamais de doublons, même si l'API en retourne.

### 3. Niveau React Query

Ajout d'un sélecteur aux requêtes React Query dans `TopBar.tsx` :
```typescript
const { data: accounts = [] } = useQuery({
  queryKey: ["accounts"],
  queryFn: async () => {
    return db.accounts.getAll();
  },
  // Ajouter un sélecteur qui garantit qu'aucun doublon ne soit présent dans les résultats
  select: (data) => {
    const uniqueAccounts = Array.from(
      new Map(data.map(account => [account.id, account])).values()
    );
    
    if (data.length !== uniqueAccounts.length) {
      console.warn(`Doublons détectés après useQuery: ${data.length} -> ${uniqueAccounts.length}`);
    }
    
    return uniqueAccounts;
  },
});
```

Cette modification assure que les composants utilisant React Query pour récupérer les comptes ne verront jamais de doublons.

## Bénéfices

- Élimination complète des doublons visuels lors des synchronisations
- Amélioration de la cohérence des données affichées
- Meilleure expérience utilisateur
- Facilité de débogage grâce aux logs d'avertissement si des doublons sont détectés

## Note technique

Le problème n'était pas lié à `React.StrictMode` (qui n'est pas utilisé dans l'application), mais plutôt à la gestion asynchrone des données et aux invalidations multiples des requêtes lors des synchronisations.
