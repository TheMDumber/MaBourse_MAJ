import { openDB } from 'idb';
import { UserPreferences, Currency, Theme } from './types';
import { toast } from 'sonner';
import { logRepairEvent } from './dbRepairLogger';

// Nom de la base de données
const DB_NAME = 'ma-bourse';
const CURRENT_VERSION = 3;

/**
 * Répare spécifiquement le store balanceAdjustments manquant
 * Cette fonction effectue une réparation ciblée sans supprimer les données existantes
 */
export async function fixBalanceAdjustmentsStore(): Promise<boolean> {
  console.log('Début de la réparation ciblée du store balanceAdjustments...');
  logRepairEvent('repair', 'balanceAdjustments', 'success', 'Début de la réparation ciblée');
  
  try {
    // 1. D'abord, vérifier quelle version de la base de données est actuellement en place
    let currentVersion = 0;
    
    try {
      const tempDb = await openDB(DB_NAME);
      currentVersion = tempDb.version;
      tempDb.close();
      console.log(`Version actuelle de la base de données: ${currentVersion}`);
    } catch (openError) {
      console.error('Erreur lors de l\'ouverture de la base de données:', openError);
      return false;
    }
    
    // 2. Si la version est déjà égale ou supérieure à CURRENT_VERSION, 
    // augmenter la version pour forcer une mise à niveau
    const targetVersion = currentVersion >= CURRENT_VERSION ? currentVersion + 1 : CURRENT_VERSION;
    
    console.log(`Mise à niveau de la base de données vers la version ${targetVersion}...`);
    
    // 3. Ouvrir la base de données avec la nouvelle version pour déclencher l'upgrade
    const db = await openDB(DB_NAME, targetVersion, {
      upgrade(db, oldVersion, newVersion) {
        console.log(`Mise à niveau de la base de données de la version ${oldVersion} vers ${newVersion}`);
        
        // Vérifier si le store balanceAdjustments existe déjà
        if (!db.objectStoreNames.contains('balanceAdjustments')) {
          // Créer le store des ajustements de solde
          const adjustmentsStore = db.createObjectStore('balanceAdjustments', { 
            keyPath: 'id',
            autoIncrement: true
          });
          
          // Ajouter un index qui servira pour les requêtes par compte et mois
          adjustmentsStore.createIndex('by-account-month', ['accountId', 'yearMonth'], { unique: true });
          
          console.log('Store balanceAdjustments créé avec succès');
        } else {
          console.log('Store balanceAdjustments existe déjà');
        }
        
        // Vérifier et réparer les autres stores si nécessaire, mais sans supprimer les données existantes
        
        // Vérifier les comptes
        if (!db.objectStoreNames.contains('accounts')) {
          const accountStore = db.createObjectStore('accounts', { 
            keyPath: 'id',
            autoIncrement: true
          });
          accountStore.createIndex('by-name', 'name');
          accountStore.createIndex('by-type', 'type');
          console.log('Store accounts créé avec succès');
        }
        
        // Vérifier les transactions
        if (!db.objectStoreNames.contains('transactions')) {
          const transactionStore = db.createObjectStore('transactions', { 
            keyPath: 'id',
            autoIncrement: true
          });
          transactionStore.createIndex('by-account', 'accountId');
          transactionStore.createIndex('by-date', 'date');
          transactionStore.createIndex('by-type', 'type');
          console.log('Store transactions créé avec succès');
        }
        
        // Vérifier les transactions récurrentes
        if (!db.objectStoreNames.contains('recurringTransactions')) {
          const recurringTransactionStore = db.createObjectStore('recurringTransactions', { 
            keyPath: 'id',
            autoIncrement: true
          });
          recurringTransactionStore.createIndex('by-account', 'accountId');
          recurringTransactionStore.createIndex('by-next-execution', 'nextExecution');
          console.log('Store recurringTransactions créé avec succès');
        }
        
        // Vérifier les préférences utilisateur
        if (!db.objectStoreNames.contains('userPreferences')) {
          const preferencesStore = db.createObjectStore('userPreferences', { 
            keyPath: 'id',
            autoIncrement: true
          });
          
          // Créer des préférences par défaut si le store est nouvellement créé
          const defaultPreferences: UserPreferences = {
            defaultCurrency: Currency.EUR,
            theme: Theme.LIGHT,
            dateFormat: 'dd/MM/yyyy',
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          // Ajouter les préférences par défaut directement dans la transaction de mise à niveau
          // plutôt que créer une nouvelle transaction
          preferencesStore.add(defaultPreferences);
          
          console.log('Store userPreferences créé avec succès');
        }
      }
    });
    
    // 4. Vérifier que le store a bien été créé
    if (db.objectStoreNames.contains('balanceAdjustments')) {
      db.close();
      console.log('Réparation du store balanceAdjustments terminée avec succès');
      
      // Définir un flag indiquant que la réparation a été effectuée
      localStorage.setItem('balanceAdjustmentsStoreFixed', 'true');
      
      // Informer l'utilisateur du succès de la réparation
      toast.success("Base de données réparée", {
        description: "Le problème de structure de la base de données a été corrigé.",
        duration: 5000
      });
      
      logRepairEvent('repair', 'balanceAdjustments', 'success', 'Store balanceAdjustments créé avec succès');
      
      return true;
    } else {
      db.close();
      console.error('Le store balanceAdjustments n\'a pas pu être créé');
      logRepairEvent('repair', 'balanceAdjustments', 'failure', 'Impossible de créer le store balanceAdjustments');
      return false;
    }
  } catch (error) {
    console.error('Erreur lors de la réparation du store balanceAdjustments:', error);
    logRepairEvent('error', 'balanceAdjustments', 'failure', 'Exception lors de la réparation', error);
    return false;
  }
}

/**
 * Vérifie si le store balanceAdjustments est présent et tente de le réparer si nécessaire
 */
export async function checkAndFixBalanceAdjustments(): Promise<boolean> {
  try {
    // Vérifier si on a déjà essayé de réparer ce store dans cette session
    if (localStorage.getItem('balanceAdjustmentsStoreFixed') === 'true') {
      console.log('Le store balanceAdjustments a déjà été réparé dans cette session');
      return true;
    }
    
    // Ouvrir la base de données pour vérifier si le store existe
    const db = await openDB(DB_NAME);
    
    if (db.objectStoreNames.contains('balanceAdjustments')) {
      console.log('Le store balanceAdjustments existe déjà');
      db.close();
      return true;
    }
    
    // Le store n'existe pas, il faut le réparer
    db.close();
    console.warn('Le store balanceAdjustments est manquant, tentative de réparation...');
    
    return await fixBalanceAdjustmentsStore();
  } catch (error) {
    console.error('Erreur lors de la vérification du store balanceAdjustments:', error);
    
    // Tenter quand même la réparation en cas d'erreur
    try {
      return await fixBalanceAdjustmentsStore();
    } catch (repairError) {
      console.error('Échec de la réparation du store balanceAdjustments:', repairError);
      return false;
    }
  }
}
