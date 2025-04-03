import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Account, Transaction, RecurringTransaction, UserPreferences, Currency, Theme, TransactionType, BalanceAdjustment, JournalEntry } from './types';
import { objectStoreExists, withFallback } from './dbUtils';
import { getDBVersion, fixDBVersion } from './versionFix';

// Import de repairDatabase (déclaré mais non implémenté ici pour éviter une référence circulaire)
declare function repairDatabase(): Promise<boolean>;

// Définition du schéma de la base de données IndexedDB
interface BudgetAppDB extends DBSchema {
  accounts: {
    key: number;
    value: Account;
    indexes: {
      'by-name': string;
      'by-type': string;
    };
  };
  transactions: {
    key: number;
    value: Transaction;
    indexes: {
      'by-account': number;
      'by-date': Date;
      'by-type': string;
    };
  };
  recurringTransactions: {
    key: number;
    value: RecurringTransaction;
    indexes: {
      'by-account': number;
      'by-next-execution': Date;
    };
  };
  userPreferences: {
    key: number;
    value: UserPreferences;
  };
  balanceAdjustments: {
    key: number;
    value: BalanceAdjustment;
    indexes: {
      'by-account-month': [number, string]; // [accountId, yearMonth]
    };
  };
  accountingJournal: {
    key: number;
    value: JournalEntry;
    indexes: {
      'yearMonth': string;
      'date': Date;
      'accountId': number;
      'transactionId': number;
      'isCalculated': boolean;
    };
  };
}

// Nom et version de la base de données
const DB_NAME = 'ma-bourse';
let DB_VERSION = 4; // Mis à jour à la version 4 pour le journal comptable

// Instance de la base de données
let db: IDBPDatabase<BudgetAppDB>;

// Initialisation de la base de données
export async function initDB(): Promise<IDBPDatabase<BudgetAppDB>> {
  if (db) return db;

  try {
    // Vérifier et corriger la version de la base de données si nécessaire
    const fixedVersion = await fixDBVersion();
    DB_VERSION = Math.max(fixedVersion, 4); // On s'assure d'au moins avoir la v4
    console.log(`Initialisation de la base de données avec la version: ${DB_VERSION}`);
    
    // Détecter mode réseau
    const isRemoteNetwork = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    
    // Délai plus long en mode réseau pour permettre à IndexedDB de s'initialiser
    if (isRemoteNetwork) {
      console.log('Initialisation de la base de données en mode réseau, délai supplémentaire');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    db = await openDB<BudgetAppDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`Migration de la base de données de la version ${oldVersion} vers la version ${newVersion}`);
        
        // Création des object stores et des index
        
        // Mise à jour de la version 0 à 1
        if (oldVersion < 1) {
          console.log('Création des tables de base (v1)...');
          // Store pour les comptes
          const accountStore = db.createObjectStore('accounts', { 
            keyPath: 'id',
            autoIncrement: true
          });
          accountStore.createIndex('by-name', 'name');
          accountStore.createIndex('by-type', 'type');

          // Store pour les transactions
          const transactionStore = db.createObjectStore('transactions', { 
            keyPath: 'id',
            autoIncrement: true
          });
          transactionStore.createIndex('by-account', 'accountId');
          transactionStore.createIndex('by-date', 'date');
          transactionStore.createIndex('by-type', 'type');
          // Nouveaux index composites pour optimiser les requêtes fréquentes
          transactionStore.createIndex('by-account-date', ['accountId', 'date']);
          transactionStore.createIndex('by-account-type', ['accountId', 'type']);
          transactionStore.createIndex('by-type-date', ['type', 'date']);

          // Store pour les transactions récurrentes
          const recurringTransactionStore = db.createObjectStore('recurringTransactions', { 
            keyPath: 'id',
            autoIncrement: true
          });
          recurringTransactionStore.createIndex('by-account', 'accountId');
          recurringTransactionStore.createIndex('by-next-execution', 'nextExecution');

          // Store pour les préférences utilisateur
          const preferencesStore = db.createObjectStore('userPreferences', { 
            keyPath: 'id',
            autoIncrement: true
          });

          // Création des préférences par défaut
          const defaultPreferences: UserPreferences = {
            defaultCurrency: Currency.EUR,
            theme: Theme.LIGHT,
            dateFormat: 'dd/MM/yyyy',
            // Paramètres du mois financier par défaut
            useFinancialMonth: false,
            financialMonthStartDay: 1,
            financialMonthAccountId: undefined,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          preferencesStore.add(defaultPreferences);
        }
        
        // Mise à jour de la version 1 à 2
        if (oldVersion < 2 && oldVersion > 0) {
          console.log('Mise à jour de la base de données vers la version 2...');
          
          // Création du store pour les ajustements de solde
          if (!db.objectStoreNames.contains('balanceAdjustments')) {
            const adjustmentsStore = db.createObjectStore('balanceAdjustments', { 
              keyPath: 'id',
              autoIncrement: true
            });
            adjustmentsStore.createIndex('by-account-month', ['accountId', 'yearMonth'], { unique: true });
            console.log('Table balanceAdjustments créée avec succès');
          }
        }
        
        // Mise à jour de la version 2 à 3
        if (oldVersion < 3 && oldVersion > 0) {
          console.log('Mise à jour de la base de données vers la version 3...');
          
          // Si une mise à jour a été faite de la version 2 à 3, nous ne voulons pas recréer
          // les tables, mais simplement indiquer que nous supportons maintenant la version 3
          
          // C'est une migration vide qui sert uniquement à mettre à jour le numéro de version
          // pour éviter les erreurs "requested version is less than existing version"
          
          // Note: Si des changements réels sont nécessaires pour la v3, les ajouter ici
        }
        
        // Mise à jour de la version 3 à 4 (pour le journal comptable)
        if (oldVersion < 4) {
          console.log('Mise à jour de la base de données vers la version 4 - Ajout du journal comptable...');
          
          // Création du store pour le journal comptable
          if (!db.objectStoreNames.contains('accountingJournal')) {
            const journalStore = db.createObjectStore('accountingJournal', { 
              keyPath: 'id',
              autoIncrement: true
            });
            journalStore.createIndex('yearMonth', 'yearMonth');
            journalStore.createIndex('date', 'date');
            journalStore.createIndex('accountId', 'accountId');
            journalStore.createIndex('transactionId', 'transactionId');
            journalStore.createIndex('isCalculated', 'isCalculated');
            console.log('Table accountingJournal créée avec succès');
          }
        }
      }
    });

    console.log('IndexedDB initialized successfully with version', DB_VERSION);
    return db;
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de la base de données IndexedDB:', error);
    
    // Mode réseau: forcer la déconnexion pour éviter les boucles
    const isRemoteNetwork = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    if (isRemoteNetwork) {
      console.error('Erreur critique d\'initialisation en mode réseau, effacement de la session');
      localStorage.removeItem('userSession');
      // Nettoyer tous les marqueurs
      localStorage.removeItem('isSyncing');
      localStorage.removeItem('syncEventTriggered');
      localStorage.removeItem('isInitialSync');
      localStorage.removeItem('isRedirecting');
      localStorage.removeItem('isCheckingRedirect');
      localStorage.removeItem('lastAuthCheck');
      localStorage.setItem('needsFullRecovery', 'true');
    }
    
    throw error;
  }
}

// Mettre à jour les noms des comptes existants pour qu'ils aient une majuscule
export async function capitalizeExistingAccountNames() {
  await initDB();
  console.log('Mise à jour des noms de comptes existants...');
  
  // Récupérer tous les comptes existants
  const accounts = await db.getAll('accounts');
  
  // Parcourir tous les comptes et mettre à jour ceux qui n'ont pas de majuscule
  for (const account of accounts) {
    if (account.name && account.name.length > 0) {
      const firstChar = account.name.charAt(0);
      
      if (firstChar !== firstChar.toUpperCase()) {
        // Le nom n'a pas de majuscule, on le met à jour
        const capitalizedName = firstChar.toUpperCase() + account.name.slice(1);
        console.log(`Mise à jour du nom de compte: ${account.name} -> ${capitalizedName}`);
        
        // Mettre à jour le compte
        await db.put('accounts', {
          ...account,
          name: capitalizedName,
          updatedAt: new Date()
        });
      }
    }
  }
  
  console.log('Mise à jour des noms de comptes terminée');
  return true;
}

// API de gestion des comptes
export const accountsAPI = {
  // Récupérer tous les comptes
  async getAll(): Promise<Account[]> {
    await initDB();
    const accounts = await db.getAll('accounts');
    
    // Vérification et déduplication des comptes basée sur l'ID 
    // pour prévenir les doublons potentiels lors de synchronisations
    const uniqueAccounts = Array.from(
      new Map(accounts.map(account => [account.id, account])).values()
    );
    
    // Log pour le débogage si des doublons sont détectés
    if (accounts.length !== uniqueAccounts.length) {
      console.warn(`Doublons détectés dans getAll(): ${accounts.length} entrées -> ${uniqueAccounts.length} uniques`);
    }
    
    return uniqueAccounts;
  },

  // Vérifier si un compte avec ce nom existe déjà
  async checkNameExists(name: string, excludeId?: number): Promise<boolean> {
    await initDB();
    const accounts = await this.getAll();
    return accounts.some(account => 
      account.name.toLowerCase() === name.toLowerCase() && 
      (!excludeId || account.id !== excludeId)
    );
  },

  // Récupérer un compte par son ID
  async getById(id: number): Promise<Account | undefined> {
    await initDB();
    return db.get('accounts', id);
  },

  // Créer un nouveau compte
  async create(account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    await initDB();
    const now = new Date();
    
    // TODO: Assurer la validation et la prévention des doublons côté backend.
    // Les vérifications côté client empêchent l'affichage de doublons,
    // mais l'API doit garantir l'unicité des comptes dans la base de données.
    // Cette protection côté client pourrait être contournée dans certains scénarios 
    // comme des requêtes API directes ou des synchronisations simultanées.
    
    // Mettre la première lettre du nom en majuscule
    const capitalizedName = account.name.charAt(0).toUpperCase() + account.name.slice(1);
    
    // Vérifier à nouveau si un compte avec ce nom existe déjà
    // Cette double vérification est nécessaire car l'interface utilisateur 
    // pourrait ne pas avoir détecté le doublon en cas de synchronisation simultanée
    const nameExists = await this.checkNameExists(capitalizedName);
    if (nameExists) {
      console.warn(`Tentative d'ajout d'un compte avec un nom déjà existant: ${capitalizedName}`);
      throw new Error(`Un compte avec le nom '${capitalizedName}' existe déjà`);
    }
    
    // Vérifier également les potentiels doublons lors de la synchronisation
    // où des comptes pourraient avoir des noms différents mais représenter la même entité
    const allAccounts = await this.getAll();
    // On pourrait implémenter une logique plus sophistiquée ici si nécessaire,
    // par exemple basée sur une similarité de nom (ex: "Compte Courant" vs "compte courant")
    
    const newAccount: Account = {
      ...account,
      name: capitalizedName,
      createdAt: now,
      updatedAt: now
    };
    
    // Ajouter le compte à la base de données
    const id = await db.add('accounts', newAccount);
    
    console.log(`Nouveau compte créé: ${capitalizedName} (ID: ${id})`);
    return id;
  },

  // Mettre à jour un compte existant
  async update(id: number, account: Partial<Account>): Promise<number> {
    await initDB();
    const existingAccount = await db.get('accounts', id);
    if (!existingAccount) {
      throw new Error(`Account with ID ${id} not found`);
    }
    
    // Si le nom est modifié, mettre la première lettre en majuscule
    if (account.name) {
      account.name = account.name.charAt(0).toUpperCase() + account.name.slice(1);
    }
    
    const updatedAccount: Account = {
      ...existingAccount,
      ...account,
      updatedAt: new Date()
    };
    
    await db.put('accounts', updatedAccount);
    return id;
  },

  // Supprimer un compte et toutes ses données associées
  async delete(id: number): Promise<void> {
    await initDB();

    // 1. Supprimer toutes les transactions liées au compte
    const transactionsByAccount = await db.getAllFromIndex('transactions', 'by-account', id);
    for (const transaction of transactionsByAccount) {
      await db.delete('transactions', transaction.id);
    }

    // 2. Supprimer également les transactions où ce compte est le destinataire d'un transfert
    const allTransactions = await db.getAll('transactions');
    for (const transaction of allTransactions) {
      if (transaction.toAccountId === id) {
        await db.delete('transactions', transaction.id);
      }
    }

    // 3. Supprimer toutes les transactions récurrentes liées au compte
    const recurringTransactions = await db.getAllFromIndex('recurringTransactions', 'by-account', id);
    for (const recurringTransaction of recurringTransactions) {
      await db.delete('recurringTransactions', recurringTransaction.id);
    }

    // 4. Supprimer les transactions récurrentes où ce compte est le destinataire
    const allRecurringTransactions = await db.getAll('recurringTransactions');
    for (const recurringTransaction of allRecurringTransactions) {
      if (recurringTransaction.toAccountId === id) {
        await db.delete('recurringTransactions', recurringTransaction.id);
      }
    }
    
    // 5. Supprimer tous les ajustements de solde pour ce compte
    const allAdjustments = await db.getAll('balanceAdjustments');
    for (const adjustment of allAdjustments) {
      if (adjustment.accountId === id) {
        await db.delete('balanceAdjustments', adjustment.id);
      }
    }
    
    // 6. Supprimer toutes les entrées du journal comptable pour ce compte
    try {
      const journalEntries = await db.getAll('accountingJournal');
      for (const entry of journalEntries) {
        if (entry.accountId === id) {
          await db.delete('accountingJournal', entry.id);
        }
      }
    } catch (error) {
      console.error('Erreur lors de la suppression des entrées du journal comptable:', error);
    }

    // 7. Finalement, supprimer le compte lui-même
    await db.delete('accounts', id);
  },

  // Archiver un compte
  async archive(id: number): Promise<number> {
    return this.update(id, { isArchived: true });
  },

  // Restaurer un compte archivé
  async restore(id: number): Promise<number> {
    return this.update(id, { isArchived: false });
  },
};

// API de gestion des transactions
export const transactionsAPI = {
  // Récupérer toutes les transactions
  async getAll(): Promise<Transaction[]> {
    await initDB();
    return db.getAll('transactions');
  },

  // Récupérer les transactions avec pagination
  async getAllPaginated(page: number = 1, pageSize: number = 20): Promise<{transactions: Transaction[], total: number}> {
    await initDB();
    const allTransactions = await db.getAll('transactions');
    const total = allTransactions.length;
    
    // Calculer l'index de début et de fin pour la pagination
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    // Extraire les transactions pour la page demandée
    const paginatedTransactions = allTransactions.slice(startIndex, endIndex);
    
    return {
      transactions: paginatedTransactions,
      total
    };
  },

  // Récupérer les transactions pour un compte spécifique
  async getByAccount(accountId: number): Promise<Transaction[]> {
    await initDB();
    const index = db.transaction('transactions').store.index('by-account');
    return index.getAll(accountId);
  },

  // Récupérer les transactions pour un compte spécifique avec pagination
  async getByAccountPaginated(accountId: number, page: number = 1, pageSize: number = 20): Promise<{transactions: Transaction[], total: number}> {
    await initDB();
    const index = db.transaction('transactions').store.index('by-account');
    const transactions = await index.getAll(accountId);
    const total = transactions.length;
    
    // Calculer l'index de début et de fin pour la pagination
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    // Extraire les transactions pour la page demandée
    const paginatedTransactions = transactions.slice(startIndex, endIndex);
    
    return {
      transactions: paginatedTransactions,
      total
    };
  },

  // Récupérer les transactions pour une période spécifique
  async getByDateRange(startDate: Date, endDate: Date): Promise<Transaction[]> {
    await initDB();
    try {
      // Utiliser l'index by-date pour une recherche optimisée
      const transactions: Transaction[] = [];
      const index = db.transaction('transactions', 'readonly').store.index('by-date');
      
      // Utiliser un curseur IDBKeyRange pour filtrer les dates
      let cursor = await index.openCursor(IDBKeyRange.bound(startDate, endDate));
      
      while (cursor) {
        transactions.push(cursor.value);
        cursor = await cursor.continue();
      }
      
      return transactions;
    } catch (error) {
      console.error('Erreur lors de la récupération des transactions par plage de dates:', error);
      
      // Fallback à la méthode moins optimisée en cas d'erreur
      const allTransactions = await this.getAll();
      return allTransactions.filter(transaction => {
        const transactionDate = new Date(transaction.date);
        return transactionDate >= startDate && transactionDate <= endDate;
      });
    }
  },

  // Récupérer les transactions pour une période spécifique avec pagination
  async getByDateRangePaginated(startDate: Date, endDate: Date, page: number = 1, pageSize: number = 20): Promise<{transactions: Transaction[], total: number}> {
    await initDB();
    try {
      // Utiliser l'index by-date pour une recherche optimisée
      const index = db.transaction('transactions', 'readonly').store.index('by-date');
      
      // D'abord compter le nombre total de transactions correspondantes
      let count = 0;
      let cursor = await index.openCursor(IDBKeyRange.bound(startDate, endDate));
      
      while (cursor) {
        count++;
        cursor = await cursor.continue();
      }
      
      // Calculer l'index de début pour la pagination
      const startIndex = (page - 1) * pageSize;
      
      // Si la page demandée est supérieure au nombre total de pages, retourner une page vide
      if (startIndex >= count) {
        return {
          transactions: [],
          total: count
        };
      }
      
      // Récupérer seulement les transactions pour la page demandée
      const transactions: Transaction[] = [];
      
      cursor = await index.openCursor(IDBKeyRange.bound(startDate, endDate));
      
      // Avancer le curseur jusqu'à l'index de début
      let currentIndex = 0;
      while (cursor && currentIndex < startIndex) {
        cursor = await cursor.continue();
        currentIndex++;
      }
      
      // Récupérer les éléments pour la page demandée
      while (cursor && transactions.length < pageSize) {
        transactions.push(cursor.value);
        cursor = await cursor.continue();
      }
      
      return {
        transactions,
        total: count
      };
    } catch (error) {
      console.error('Erreur lors de la récupération paginée des transactions par plage de dates:', error);
      
      // Fallback à la méthode moins optimisée en cas d'erreur
      const allTransactions = await this.getAll();
      const filteredTransactions = allTransactions.filter(transaction => {
        const transactionDate = new Date(transaction.date);
        return transactionDate >= startDate && transactionDate <= endDate;
      });
      
      const total = filteredTransactions.length;
      
      // Calculer l'index de début et de fin pour la pagination
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      
      // Extraire les transactions pour la page demandée
      const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);
      
      return {
        transactions: paginatedTransactions,
        total
      };
    }
  },

  // Créer une nouvelle transaction
  async create(transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    await initDB();
    const now = new Date();
    const newTransaction: Transaction = {
      ...transaction,
      createdAt: now,
      updatedAt: now
    };
    return db.add('transactions', newTransaction);
  },

  // Mettre à jour une transaction
  async update(id: number, transaction: Partial<Transaction>): Promise<number> {
    await initDB();
    try {
      // Vérifier que la transaction existe
      const existingTransaction = await db.get('transactions', id);
      if (!existingTransaction) {
        console.warn(`Transaction with ID ${id} not found`);
        throw new Error(`Transaction with ID ${id} not found`);
      }

      // Assurons-nous de conserver des champs stables pour éviter des doublons
      const updatedTransaction: Transaction = {
        ...existingTransaction,
        ...transaction,
        id: existingTransaction.id, // Forcer à conserver le même ID
        updatedAt: new Date()
      };
      
      // Supprimer explicitement l'ancien enregistrement pour éviter les doublons
      await db.delete('transactions', id);
      
      // Puis ajouter la version mise à jour
      await db.put('transactions', updatedTransaction);

      console.log(`Transaction with ID ${id} successfully updated`);
      return id;
    } catch (error) {
      console.error(`Error updating transaction with ID ${id}:`, error);
      throw error;
    }
  },

  // Supprimer une transaction
  async delete(id: number): Promise<void> {
    await initDB();
    await db.delete('transactions', id);
  },

  // Récupérer les transactions groupées par catégorie pour une période
  async getGroupedByCategory(startDate: Date, endDate: Date, type?: TransactionType): Promise<Record<string, number>> {
    const transactions = await this.getByDateRange(startDate, endDate);
    
    // Filtrer par type si spécifié
    const filteredTransactions = type 
      ? transactions.filter(t => t.type === type)
      : transactions;
    
    // Grouper par catégorie
    return filteredTransactions.reduce((acc, transaction) => {
      const category = transaction.category || 'Non catégorisé';
      if (!acc[category]) {
        acc[category] = 0;
      }
      acc[category] += transaction.amount;
      return acc;
    }, {} as Record<string, number>);
  },
};

// API de gestion des transactions récurrentes
export const recurringTransactionsAPI = {
  // Récupérer toutes les transactions récurrentes
  async getAll(): Promise<RecurringTransaction[]> {
    await initDB();
    return db.getAll('recurringTransactions');
  },

  // Créer une nouvelle transaction récurrente
  async create(transaction: Omit<RecurringTransaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    await initDB();
    const now = new Date();
    const newTransaction: RecurringTransaction = {
      ...transaction,
      createdAt: now,
      updatedAt: now
    };
    return db.add('recurringTransactions', newTransaction);
  },

  // Mettre à jour une transaction récurrente
  async update(id: number, transaction: Partial<RecurringTransaction>): Promise<number> {
    await initDB();
    const existingTransaction = await db.get('recurringTransactions', id);
    if (!existingTransaction) {
      throw new Error(`Recurring transaction with ID ${id} not found`);
    }
    
    const updatedTransaction: RecurringTransaction = {
      ...existingTransaction,
      ...transaction,
      updatedAt: new Date()
    };
    
    await db.put('recurringTransactions', updatedTransaction);
    return id;
  },

  // Supprimer une transaction récurrente
  async delete(id: number): Promise<void> {
    await initDB();
    await db.delete('recurringTransactions', id);
  },
};

// API de gestion des préférences utilisateur
export const preferencesAPI = {
  // Récupérer les préférences
  async get(): Promise<UserPreferences> {
    await initDB();
    // On récupère la première entrée (il n'y en a qu'une)
    const allPrefs = await db.getAll('userPreferences');
    return allPrefs[0];
  },

  // Mettre à jour les préférences
  async update(preferences: Partial<UserPreferences>): Promise<number> {
    await initDB();
    const allPrefs = await db.getAll('userPreferences');
    const existingPrefs = allPrefs[0];
    
    if (!existingPrefs) {
      throw new Error('User preferences not found');
    }
    
    const updatedPrefs: UserPreferences = {
      ...existingPrefs,
      ...preferences,
      updatedAt: new Date()
    };
    
    await db.put('userPreferences', updatedPrefs);
    return existingPrefs.id!;
  },
};

// API de gestion des ajustements de solde
export const balanceAdjustmentsAPI = {
  // Récupérer tous les ajustements
  async getAll(): Promise<BalanceAdjustment[]> {
    await initDB();
    
    // Vérifier d'abord si l'object store existe
    const storeExists = await objectStoreExists('balanceAdjustments');
    if (!storeExists) {
      console.warn('L\'object store balanceAdjustments n\'existe pas lors de la récupération de tous les ajustements');
      return []; // Retourner un tableau vide si l'object store n'existe pas
    }
    
    try {
      return await db.getAll('balanceAdjustments');
    } catch (error) {
      console.error('Erreur lors de la récupération de tous les ajustements:', error);
      return [];
    }
  },

  // Récupérer un ajustement pour un compte et un mois spécifique
  async getByAccountAndMonth(accountId: number, yearMonth: string): Promise<BalanceAdjustment | null> {
    await initDB();
    
    // Vérifier d'abord si l'object store existe
    const storeExists = await objectStoreExists('balanceAdjustments');
    if (!storeExists) {
      console.warn('L\'object store balanceAdjustments n\'existe pas dans la base de données');
      return null; // Retourner null au lieu de undefined
    }
    
    try {
      const index = db.transaction('balanceAdjustments').store.index('by-account-month');
      const adjustment = await index.get([accountId, yearMonth]);
      return adjustment || null; // Retourner null si undefined ou falsy
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'ajustement:', error);
      return null; // Retourner null en cas d'erreur
    }
  },

  // Créer un nouvel ajustement de solde
  async create(adjustment: Omit<BalanceAdjustment, 'id'>): Promise<number> {
    await initDB();
    
    // Vérifier d'abord si l'object store existe
    const storeExists = await objectStoreExists('balanceAdjustments');
    if (!storeExists) {
      console.warn('L\'object store balanceAdjustments n\'existe pas lors de la création d\'un ajustement');
      throw new Error('L\'object store balanceAdjustments n\'existe pas');
    }
    
    try {
      return await db.add('balanceAdjustments', adjustment);
    } catch (error) {
      console.error('Erreur lors de la création d\'un ajustement de solde:', error);
      throw error;
    }
  },

  // Créer ou mettre à jour un ajustement
  async setAdjustment(adjustment: Omit<BalanceAdjustment, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    await initDB();
    
    // Vérifier d'abord si l'object store existe
    const storeExists = await objectStoreExists('balanceAdjustments');
    if (!storeExists) {
      console.warn('L\'object store balanceAdjustments n\'existe pas - tentative de réparation');
      try {
        await repairDatabase();
      } catch (error) {
        console.error('Impossible de réparer la base de données:', error);
        throw new Error('Impossible d\'ajouter un ajustement: base de données non réparable');
      }
    }
    
    const now = new Date();
    
    // Vérifier si un ajustement existe déjà pour ce compte/mois
    try {
      const existing = await this.getByAccountAndMonth(adjustment.accountId, adjustment.yearMonth);
      
      if (existing) {
        // Mettre à jour l'existant
        const updatedAdjustment: BalanceAdjustment = {
          ...existing,
          adjustedBalance: adjustment.adjustedBalance,
          note: adjustment.note,
          updatedAt: now
        };
        await db.put('balanceAdjustments', updatedAdjustment);
        return existing.id!;
      } else {
        // Créer un nouvel ajustement
        const newAdjustment: BalanceAdjustment = {
          ...adjustment,
          createdAt: now,
          updatedAt: now
        };
        return db.add('balanceAdjustments', newAdjustment);
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajustement du solde:', error);
      throw error;
    }
  },

  // Supprimer un ajustement
  async deleteAdjustment(accountId: number, yearMonth: string): Promise<void> {
    await initDB();
    
    // Vérifier d'abord si l'object store existe
    const storeExists = await objectStoreExists('balanceAdjustments');
    if (!storeExists) {
      console.warn('L\'object store balanceAdjustments n\'existe pas lors de la suppression');
      return; // Rien à supprimer si l'object store n'existe pas
    }
    
    try {
      const existing = await this.getByAccountAndMonth(accountId, yearMonth);
      if (existing && existing.id) {
        await db.delete('balanceAdjustments', existing.id);
      }
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'ajustement:', error);
      throw error;
    }
  },

  // Récupérer tous les ajustements pour un compte
  async getAllByAccount(accountId: number): Promise<BalanceAdjustment[]> {
    await initDB();
    
    // Vérifier d'abord si l'object store existe
    const storeExists = await objectStoreExists('balanceAdjustments');
    if (!storeExists) {
      console.warn('L\'object store balanceAdjustments n\'existe pas lors de la récupération d\'ajustements');
      return []; // Retourner un tableau vide si l'object store n'existe pas
    }
    
    try {
      const allAdjustments = await db.getAll('balanceAdjustments');
      return allAdjustments.filter(adj => adj.accountId === accountId);
    } catch (error) {
      console.error('Erreur lors de la récupération des ajustements:', error);
      return [];
    }
  }
};

// API pour le journal comptable
export const accountingJournalAPI = {
  // Ajouter une entrée au journal
  async add(entry: Omit<JournalEntry, 'id'>): Promise<number> {
    await initDB();
    return db.add('accountingJournal', entry);
  },
  
  // Récupérer toutes les entrées du journal
  async getAll(): Promise<JournalEntry[]> {
    await initDB();
    return db.getAll('accountingJournal');
  },
  
  // Récupérer les entrées du journal pour un mois spécifique
  async getByMonth(yearMonth: string): Promise<JournalEntry[]> {
    await initDB();
    try {
      const index = db.transaction('accountingJournal').store.index('yearMonth');
      return await index.getAll(yearMonth);
    } catch (error) {
      console.error(`Erreur lors de la récupération des entrées du journal pour le mois ${yearMonth}:`, error);
      return [];
    }
  },
  
  // Récupérer les entrées du journal pour une plage de dates spécifique
  async getByDateRange(startDate: Date, endDate: Date): Promise<JournalEntry[]> {
    await initDB();
    try {
      console.log(`Récupération des entrées du journal entre ${startDate.toISOString()} et ${endDate.toISOString()}`);
      
      // Utiliser l'index 'date' pour une recherche optimisée
      const entries: JournalEntry[] = [];
      const index = db.transaction('accountingJournal', 'readonly').store.index('date');
      
      // Utiliser un curseur IDBKeyRange pour filtrer les dates
      let cursor = await index.openCursor(IDBKeyRange.bound(startDate, endDate));
      
      while (cursor) {
        entries.push(cursor.value);
        cursor = await cursor.continue();
      }
      
      console.log(`${entries.length} entrées trouvées dans la plage de dates`);
      return entries;
    } catch (error) {
      console.error(`Erreur lors de la récupération des entrées du journal entre ${startDate.toISOString()} et ${endDate.toISOString()}:`, error);
      
      // Fallback: utiliser toutes les entrées et filtrer manuellement par date
      console.log("Tentative de récupération avec fallback (filtrage manuel par date)");
      try {
        const allEntries = await this.getAll();
        const filteredEntries = allEntries.filter(entry => {
          const entryDate = new Date(entry.date);
          return entryDate >= startDate && entryDate <= endDate;
        });
        
        console.log(`${filteredEntries.length} entrées trouvées par filtrage manuel`);
        return filteredEntries;
      } catch (fallbackError) {
        console.error("Échec du fallback:", fallbackError);
        return [];
      }
    }
  },
  
  // Récupérer les entrées du journal pour un compte spécifique
  async getByAccount(accountId: number): Promise<JournalEntry[]> {
    await initDB();
    try {
      const index = db.transaction('accountingJournal').store.index('accountId');
      return await index.getAll(accountId);
    } catch (error) {
      console.error(`Erreur lors de la récupération des entrées du journal pour le compte ${accountId}:`, error);
      return [];
    }
  },
  
  // Récupérer les entrées du journal pour une transaction spécifique
  async getEntriesByTransactionId(transactionId: number): Promise<JournalEntry[]> {
    await initDB();
    try {
      const index = db.transaction('accountingJournal').store.index('transactionId');
      return await index.getAll(transactionId);
    } catch (error) {
      console.error(`Erreur lors de la récupération des entrées du journal pour la transaction ${transactionId}:`, error);
      return [];
    }
  },
  
  // Supprimer toutes les entrées du journal pour une transaction spécifique
  async deleteByTransactionId(transactionId: number): Promise<void> {
    await initDB();
    try {
      const entries = await this.getEntriesByTransactionId(transactionId);
      
      if (entries.length === 0) {
        return;
      }
      
      const tx = db.transaction('accountingJournal', 'readwrite');
      const store = tx.objectStore('accountingJournal');
      
      for (const entry of entries) {
        await store.delete(entry.id!);
      }
    } catch (error) {
      console.error(`Erreur lors de la suppression des entrées du journal pour la transaction ${transactionId}:`, error);
    }
  },
  
  // Supprimer une entrée du journal par son ID
  async delete(id: number): Promise<void> {
    await initDB();
    try {
      await db.delete('accountingJournal', id);
    } catch (error) {
      console.error(`Erreur lors de la suppression de l'entrée du journal ${id}:`, error);
    }
  },
  
  // Supprimer toutes les entrées du journal pour un mois spécifique
  async deleteAllEntriesForMonth(yearMonth: string): Promise<void> {
    await initDB();
    try {
      const entries = await this.getByMonth(yearMonth);
      
      if (entries.length === 0) {
        return;
      }
      
      console.log(`Suppression de ${entries.length} entrées pour le mois ${yearMonth}`);
      
      const tx = db.transaction('accountingJournal', 'readwrite');
      const store = tx.objectStore('accountingJournal');
      
      for (const entry of entries) {
        await store.delete(entry.id!);
      }
    } catch (error) {
      console.error(`Erreur lors de la suppression des entrées du journal pour le mois ${yearMonth}:`, error);
    }
  },
  
  // Supprimer toutes les entrées calculées du journal pour un mois spécifique
  async deleteCalculatedEntriesForMonth(yearMonth: string): Promise<void> {
    await initDB();
    try {
      const entries = await this.getByMonth(yearMonth);
      const calculatedEntries = entries.filter(entry => entry.isCalculated);
      
      if (calculatedEntries.length === 0) {
        return;
      }
      
      const tx = db.transaction('accountingJournal', 'readwrite');
      const store = tx.objectStore('accountingJournal');
      
      for (const entry of calculatedEntries) {
        await store.delete(entry.id!);
      }
    } catch (error) {
      console.error(`Erreur lors de la suppression des entrées calculées du journal pour le mois ${yearMonth}:`, error);
    }
  },
  
  // Obtenir le nombre d'entrées pour un mois spécifique
  async getCountByMonth(yearMonth: string): Promise<number> {
    await initDB();
    try {
      const entries = await this.getByMonth(yearMonth);
      return entries.length;
    } catch (error) {
      console.error(`Erreur lors du comptage des entrées du journal pour le mois ${yearMonth}:`, error);
      return 0;
    }
  },
  
  // Récupérer le solde final pour un mois et un compte spécifiques
  async getFinalBalanceForMonth(yearMonth: string, accountId?: number): Promise<number | null> {
    await initDB();
    try {
      const entries = await this.getByMonth(yearMonth);
      
      // Si un compte spécifique est demandé, chercher le solde pour ce compte
      if (accountId !== undefined) {
        const filteredEntries = entries.filter(e => e.accountId === accountId);
        
        // Rechercher d'abord un solde ajusté
        const adjustedEntry = filteredEntries.find(e => 
          e.name === 'Solde AJUSTÉ Fin de Mois');
        
        if (adjustedEntry) {
          console.log(`Solde ajusté trouvé pour ${yearMonth}, compte #${accountId}: ${adjustedEntry.amount}`);
          return adjustedEntry.amount;
        }
        
        // Sinon, rechercher un solde prévu
        const expectedEntry = filteredEntries.find(e => 
          e.name === 'Solde Prévu Fin de Mois');
        
        if (expectedEntry) {
          console.log(`Solde prévu trouvé pour ${yearMonth}, compte #${accountId}: ${expectedEntry.amount}`);
          return expectedEntry.amount;
        }
        
        // Enfin, si aucun solde final n'est trouvé, utiliser le solde initial
        const initialEntry = filteredEntries.find(e => 
          e.name === 'Solde Initial');
        
        if (initialEntry) {
          console.log(`Solde initial trouvé pour ${yearMonth}, compte #${accountId}: ${initialEntry.amount}`);
          return initialEntry.amount;
        }
      } else {
        // Si on demande le solde pour "tous les comptes", calculer la somme des soldes de tous les comptes
        // D'abord, récupérer tous les comptes disponibles
        const accounts = await db.getAll('accounts');
        
        let totalBalance = 0;
        
        for (const account of accounts) {
          const accountEntries = entries.filter(e => e.accountId === account.id);
          
          // Priorité 1: Solde ajusté
          const adjustedEntry = accountEntries.find(e => e.name === 'Solde AJUSTÉ Fin de Mois');
          if (adjustedEntry) {
            totalBalance += adjustedEntry.amount;
            continue;
          }
          
          // Priorité 2: Solde prévu
          const expectedEntry = accountEntries.find(e => e.name === 'Solde Prévu Fin de Mois');
          if (expectedEntry) {
            totalBalance += expectedEntry.amount;
            continue;
          }
          
          // Priorité 3: En dernier recours, utiliser le solde initial si disponible
          const initialEntry = accountEntries.find(e => e.name === 'Solde Initial');
          if (initialEntry) {
            totalBalance += initialEntry.amount;
          }
        }
        
        console.log(`Solde total calculé pour tous les comptes, ${yearMonth}: ${totalBalance}`);
        return totalBalance;
      }
      
      console.log(`Aucun solde trouvé pour ${yearMonth}, compte #${accountId}`);
      return null;
    } catch (error) {
      console.error(`Erreur lors de la récupération du solde final pour le mois ${yearMonth}:`, error);
      return null;
    }
  },
  
  // Exporter le journal comptable au format CSV pour un mois spécifique
  async exportMonthToCSV(yearMonth: string, accountId?: number): Promise<string> {
    await initDB();
    try {
      const entries = await this.getByMonth(yearMonth);
      
      // Filtrer par compte si spécifié
      const filteredEntries = accountId 
        ? entries.filter(e => e.accountId === accountId || !e.accountId)
        : entries;
      
      // Trier les entrées par date
      filteredEntries.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });
      
      // Créer l'en-tête du CSV
      let csv = 'Date de la transaction,Catégorie,Nom,Montant\n';
      
      // Ajouter une ligne d'en-tête pour le mois
      csv += `"--------- ${yearMonth.replace('-', '/')} ---------",,,,\n`;
      
      // Ajouter les données
      for (const entry of filteredEntries) {
        const date = new Date(entry.date).toLocaleDateString('fr-FR');
        const category = entry.category.replace(/"/g, '""');
        const name = entry.name.replace(/"/g, '""');
        const amount = entry.amount.toFixed(2) + '€';
        
        csv += `"${date}","${category}","${name}","${amount}"\n`;
      }
      
      return csv;
    } catch (error) {
      console.error(`Erreur lors de l'exportation du journal pour le mois ${yearMonth}:`, error);
      return '';
    }
  }
};

// Fonction utilitaire pour nettoyer les données orphelines
export async function cleanOrphanedData() {
  await initDB();
  console.log('Nettoyage des données orphelines...');
  
  // Récupérer tous les comptes existants
  const accounts = await db.getAll('accounts');
  const accountIds = accounts.map(account => account.id);
  
  // 1. Nettoyer les transactions orphelines (source)
  const allTransactions = await db.getAll('transactions');
  for (const transaction of allTransactions) {
    if (!accountIds.includes(transaction.accountId)) {
      console.log(`Suppression de la transaction orpheline ${transaction.id}`);
      await db.delete('transactions', transaction.id);
    }
  }
  
  // 2. Nettoyer les transactions orphelines (destination pour les transferts)
  const remainingTransactions = await db.getAll('transactions');
  for (const transaction of remainingTransactions) {
    if (transaction.toAccountId && !accountIds.includes(transaction.toAccountId)) {
      console.log(`Suppression de la transaction de transfert orpheline ${transaction.id}`);
      await db.delete('transactions', transaction.id);
    }
  }
  
  // 3. Nettoyer les transactions récurrentes orphelines (source)
  const allRecurringTransactions = await db.getAll('recurringTransactions');
  for (const transaction of allRecurringTransactions) {
    if (!accountIds.includes(transaction.accountId)) {
      console.log(`Suppression de la transaction récurrente orpheline ${transaction.id}`);
      await db.delete('recurringTransactions', transaction.id);
    }
  }
  
  // 4. Nettoyer les transactions récurrentes orphelines (destination pour les transferts)
  const remainingRecurringTransactions = await db.getAll('recurringTransactions');
  for (const transaction of remainingRecurringTransactions) {
    if (transaction.toAccountId && !accountIds.includes(transaction.toAccountId)) {
      console.log(`Suppression de la transaction récurrente de transfert orpheline ${transaction.id}`);
      await db.delete('recurringTransactions', transaction.id);
    }
  }
  
  // 5. Nettoyer les ajustements de solde orphelins
  try {
    // Vérifier d'abord si l'object store balanceAdjustments existe
    if (db.objectStoreNames.contains('balanceAdjustments')) {
      const allAdjustments = await db.getAll('balanceAdjustments');
      for (const adjustment of allAdjustments) {
        if (!accountIds.includes(adjustment.accountId)) {
          console.log(`Suppression de l'ajustement de solde orphelin ${adjustment.id}`);
          await db.delete('balanceAdjustments', adjustment.id);
        }
      }
    } else {
      console.log('L\'object store balanceAdjustments n\'existe pas, création en cours...');
      // On ne peut pas créer un store ici, il faudra le faire lors de la réparation de la base
      localStorage.setItem('needsFullRecovery', 'true');
    }
  } catch (error) {
    console.error('Erreur lors du nettoyage des ajustements de solde:', error);
  }
  
  // 6. Nettoyer les entrées du journal comptable orphelines
  try {
    // Vérifier d'abord si l'object store accountingJournal existe
    if (db.objectStoreNames.contains('accountingJournal')) {
      const allEntries = await db.getAll('accountingJournal');
      for (const entry of allEntries) {
        if (entry.accountId && !accountIds.includes(entry.accountId)) {
          console.log(`Suppression de l'entrée de journal orpheline ${entry.id}`);
          await db.delete('accountingJournal', entry.id);
        }
      }
    }
  } catch (error) {
    console.error('Erreur lors du nettoyage des entrées du journal comptable:', error);
  }
  
  console.log('Nettoyage terminé');
  return true;
}

// Exporter l'instance de base de données
export default {
  init: initDB,
  accounts: accountsAPI,
  transactions: transactionsAPI,
  recurringTransactions: recurringTransactionsAPI,
  preferences: preferencesAPI,
  balanceAdjustments: balanceAdjustmentsAPI,
  accountingJournal: accountingJournalAPI,
  cleanOrphanedData: cleanOrphanedData,
  capitalizeExistingAccountNames: capitalizeExistingAccountNames
};
