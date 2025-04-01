// Déclaration de propriété globale pour le suivi de la tentative de réparation
declare global {
  interface Window {
    hasAttemptedDBRepair?: boolean;
  }
}

import { openDB } from 'idb';
import { BalanceAdjustment } from './types';
import { checkDatabaseIntegrity } from './dbUtils';

// Nom de la base de données
const DB_NAME = 'ma-bourse';

/**
 * Supprimer une base de données IndexedDB de façon fiable avec gestion des erreurs
 */
async function deleteIndexedDBDatabase(dbName: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const deleteRequest = indexedDB.deleteDatabase(dbName);
    
    deleteRequest.onsuccess = () => {
      console.log(`Base de données '${dbName}' supprimée avec succès`);
      resolve(true);
    };
    
    deleteRequest.onerror = (event) => {
      console.error(`Erreur lors de la suppression de la base de données '${dbName}':`, event);
      reject(new Error(`Erreur lors de la suppression de la base de données: ${(event.target as any).error}`));
    };
    
    deleteRequest.onblocked = () => {
      console.warn(`La suppression de la base de données '${dbName}' est bloquée par une connexion active`);
      // Tenter de fermer toutes les connexions ouvertes
      try {
        const tempDbOpen = indexedDB.open(dbName);
        tempDbOpen.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          db.close();
          console.log(`Connexions à la base de données '${dbName}' fermées`);
          // Réessayer la suppression après un court délai
          setTimeout(() => {
            try {
              const secondDeleteRequest = indexedDB.deleteDatabase(dbName);
              secondDeleteRequest.onsuccess = () => resolve(true);
              secondDeleteRequest.onerror = (err) => reject(err);
            } catch (e) {
              reject(e);
            }
          }, 500);
        };
        tempDbOpen.onerror = (e) => {
          reject(e);
        };
      } catch (err) {
        console.error('Erreur lors de la fermeture des connexions:', err);
        reject(err);
      }
    };
  });
}

/**
 * Répare la structure de la base de données en vérifiant que tous les object stores nécessaires existent
 */
export async function repairDatabase(): Promise<boolean> {
  console.log('Démarrage de la réparation de la base de données...');
  
  // Variable pour éviter la recréation en boucle
  // Si on a déjà tenté une réparation durant cette session, ne pas réessayer
  if (window.hasAttemptedDBRepair) {
    console.log('Une tentative de réparation a déjà été effectuée durant cette session.');
    return false;
  }
  
  // Vérifier si nous devons forcer l'abandon de la réparation
  if (localStorage.getItem('forceSkipSync') === 'true') {
    console.log('Réparation abandonnée sur demande utilisateur.');
    localStorage.removeItem('forceSkipSync');
    return false;
  }
  
  try {
    // Marquer qu'on a tenté une réparation
    window.hasAttemptedDBRepair = true;
    
    // Nettoyer tous les marqueurs d'authentification pour éviter les boucles infinie
    localStorage.removeItem('isCheckingRedirect');
    localStorage.removeItem('isRedirecting');
    localStorage.removeItem('redirectAttemptCount');
    localStorage.removeItem('lastRedirectTime');
    localStorage.removeItem('lastAuthCheck');
    localStorage.removeItem('isSyncing');
    localStorage.removeItem('syncEventTriggered');
    localStorage.removeItem('isInitialSync');
    localStorage.removeItem('layoutRefreshing');
    localStorage.removeItem('statsRefreshing');
    
    // Essayer d'ouvrir la base pour vérifier son état
    try {
      // Récupérer la version actuelle de la base de données
      const db = await openDB(DB_NAME);
      const currentVersion = db.version;
      
      console.log(`Version actuelle de la base de données: ${currentVersion}`);
      
      db.close();
      
      // Vérifier l'intégrité de la base de données
      const integrity = await checkDatabaseIntegrity();
      
      // Si tous les stores requis sont présents, aucune réparation nécessaire
      if (integrity.isValid) {
        console.log('La structure de la base de données est correcte, aucune réparation nécessaire');
        return true;
      }
      
      // Journaliser les stores manquants
      console.warn(`Structure de la base de données incomplète. Stores manquants: ${integrity.missingStores.join(', ')}`);
    } catch (openError) {
      console.warn('Impossible d\'ouvrir la base de données, une réinitialisation complète est nécessaire:', openError);
    }
    
    console.warn('Tentative de réparation complète de la base de données...');
    
    // Supprimer complètement la base de données pour éviter des problèmes partiels
    try {
      await deleteIndexedDBDatabase(DB_NAME);
      console.log('Base de données supprimée pour réinitialisation complète');
    } catch (deleteError) {
      console.error('Erreur lors de la suppression de la base de données existante:', deleteError);
      // Continuer pour essayer de recréer la base malgré l'échec de suppression
    }
    
    // Attendre un court moment pour s'assurer que la suppression est bien terminée
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Recréer la base de données depuis zéro avec tous les stores nécessaires
    const newVersion = 3; // Garder la même version pour éviter des problèmes de compatibilité
    console.log(`Recréation de la base de données en version ${newVersion}...`);
    
    try {
      // Ouvrir avec la version correcte pour recréer tous les stores
      const upgradedDb = await openDB(DB_NAME, newVersion, {
        upgrade(db, oldVersion, newVersion) {
          console.log(`Initialisation de la base de données de la version ${oldVersion} vers ${newVersion}`);
          
          // 1. Créer le store des comptes
          if (!db.objectStoreNames.contains('accounts')) {
            const accountStore = db.createObjectStore('accounts', { 
              keyPath: 'id',
              autoIncrement: true
            });
            accountStore.createIndex('by-name', 'name');
            accountStore.createIndex('by-type', 'type');
            console.log('Object store "accounts" créé avec succès');
          }
          
          // 2. Créer le store des transactions
          if (!db.objectStoreNames.contains('transactions')) {
            const transactionStore = db.createObjectStore('transactions', { 
              keyPath: 'id',
              autoIncrement: true
            });
            transactionStore.createIndex('by-account', 'accountId');
            transactionStore.createIndex('by-date', 'date');
            transactionStore.createIndex('by-type', 'type');
            console.log('Object store "transactions" créé avec succès');
          }
          
          // 3. Créer le store des transactions récurrentes
          if (!db.objectStoreNames.contains('recurringTransactions')) {
            const recurringTransactionStore = db.createObjectStore('recurringTransactions', { 
              keyPath: 'id',
              autoIncrement: true
            });
            recurringTransactionStore.createIndex('by-account', 'accountId');
            recurringTransactionStore.createIndex('by-next-execution', 'nextExecution');
            console.log('Object store "recurringTransactions" créé avec succès');
          }
          
          // 4. Créer le store des préférences utilisateur
          if (!db.objectStoreNames.contains('userPreferences')) {
            const preferencesStore = db.createObjectStore('userPreferences', { 
              keyPath: 'id',
              autoIncrement: true
            });
            console.log('Object store "userPreferences" créé avec succès');
          }
          
          // 5. Créer le store des ajustements de solde
          if (!db.objectStoreNames.contains('balanceAdjustments')) {
            const adjustmentsStore = db.createObjectStore('balanceAdjustments', { 
              keyPath: 'id',
              autoIncrement: true
            });
            adjustmentsStore.createIndex('by-account-month', ['accountId', 'yearMonth'], { unique: true });
            console.log('Object store "balanceAdjustments" créé avec succès');
          }
        }
      });
      
      upgradedDb.close();
      console.log('Réparation de la base de données terminée avec succès');
      
      // Forcer la synchronisation depuis le serveur lors du prochain chargement
      localStorage.setItem('needsFullRecovery', 'true');
      localStorage.setItem('forceServerSync', 'true');
      
      return true;
    } catch (createError) {
      console.error('Erreur lors de la création de la base de données:', createError);
      
      // Comme la réparation a échoué, marquer l'utilisateur comme déconnecté
      localStorage.removeItem('userSession');
      localStorage.setItem('needsFullRecovery', 'true');
      
      throw new Error(`Erreur lors de la réinitialisation de la base de données: ${createError.message}`);
    }
  } catch (error) {
    console.error('Erreur lors de la réparation de la base de données:', error);
    
    // Si la réparation échoue, essayer de supprimer complètement la base de données
    try {
      await deleteIndexedDBDatabase(DB_NAME);
      console.log('Base de données réinitialisée avec succès.');
      // Forcer une récupération complète depuis le serveur
      localStorage.setItem('needsFullRecovery', 'true');
      localStorage.setItem('forceServerSync', 'true');
      
      // Déconnecter l'utilisateur pour éviter les boucles
      localStorage.removeItem('userSession');
      
      // Proposer un message d'erreur plus clair à l'utilisateur
      const errorMessage = 'La structure de la base de données a été réinitialisée suite à une erreur. Les données seront restaurées depuis le serveur après reconnexion.';
      console.warn(errorMessage);
      try {
        if (window.confirm(errorMessage + ' La page va être rechargée.')) {
          window.location.reload();
        }
      } catch (alertError) {
        // Certains navigateurs peuvent bloquer les alertes en arrière-plan
        console.error('Impossible d\'afficher le message d\'erreur:', alertError);
        window.location.reload();
      }
      
      return true;
    } catch (deleteError) {
      console.error('Erreur lors de la suppression de la base de données:', deleteError);
    }
    
    return false;
  }
}

/**
 * Migre les ajustements de solde depuis la version serveur vers la version locale
 */
export async function migrateBalanceAdjustments(serverData: any): Promise<void> {
  if (!serverData || !serverData.balanceAdjustments || !Array.isArray(serverData.balanceAdjustments)) {
    console.log('Aucun ajustement de solde à migrer');
    return;
  }
  
  try {
    // Ouvrir la base de données
    const db = await openDB(DB_NAME);
    
    // Vérifier si l'object store balanceAdjustments existe
    if (!db.objectStoreNames.contains('balanceAdjustments')) {
      console.error('L\'object store balanceAdjustments n\'existe pas dans la base de données');
      db.close();
      return;
    }
    
    // Créer une transaction pour les ajustements de solde
    const tx = db.transaction('balanceAdjustments', 'readwrite');
    const store = tx.objectStore('balanceAdjustments');
    
    // Migrer les ajustements
    for (const adjustment of serverData.balanceAdjustments) {
      const now = new Date();
      
      try {
        // Créer un nouvel ajustement
        const newAdjustment: BalanceAdjustment = {
          accountId: adjustment.accountId,
          yearMonth: adjustment.yearMonth,
          adjustedBalance: adjustment.adjustedBalance,
          note: adjustment.note || '',
          createdAt: now,
          updatedAt: now
        };
        
        await store.add(newAdjustment);
        console.log(`Ajustement migré pour ${adjustment.yearMonth}, compte ${adjustment.accountId}`);
      } catch (error) {
        console.error(`Erreur lors de la migration de l'ajustement pour ${adjustment.yearMonth}:`, error);
      }
    }
    
    // Terminer la transaction
    await tx.done;
    db.close();
    
    console.log('Migration des ajustements de solde terminée avec succès');
  } catch (error) {
    console.error('Erreur lors de la migration des ajustements de solde:', error);
  }
}
