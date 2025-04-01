// Mise à jour du fichier db.ts pour corriger l'erreur de version
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Account, Transaction, RecurringTransaction, UserPreferences, Currency, Theme, TransactionType, BalanceAdjustment } from '../types';

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
}

// Nom et version de la base de données
const DB_NAME = 'ma-bourse';
const DB_VERSION = 3; // Version mise à jour à 3 pour correspondre à la version existante

// Instance de la base de données
let db: IDBPDatabase<BudgetAppDB>;

// Initialisation de la base de données
export async function initDB(): Promise<IDBPDatabase<BudgetAppDB>> {
  if (db) return db;

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
    }
  });

  console.log('IndexedDB initialized successfully with version', DB_VERSION);
  return db;
}

// Rest of the file remains the same...
// (Copy the remaining functions from db.ts)

