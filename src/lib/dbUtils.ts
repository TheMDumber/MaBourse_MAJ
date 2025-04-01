/**
 * Utilitaires pour travailler avec IndexedDB de manière plus sécurisée
 */

// Nom de la base de données
const DB_NAME = 'ma-bourse';

/**
 * Vérifie si un object store existe dans la base de données
 * @param storeName Nom de l'object store à vérifier
 * @returns true si l'object store existe, false sinon
 */
export async function objectStoreExists(storeName: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Vérifier d'abord si la base de données existe
      const getDatabases = indexedDB.databases ? indexedDB.databases() : Promise.resolve([]);
      getDatabases.then((databases) => {
        const dbExists = databases.some(db => db.name === DB_NAME);
        if (!dbExists) {
          console.warn(`La base de données ${DB_NAME} n'existe pas.`);
          resolve(false);
          return;
        }
        
        // Ouvrir la base de données sans spécifier de version pour obtenir la version actuelle
        const openRequest = indexedDB.open(DB_NAME);
        
        openRequest.onsuccess = (event) => {
          try {
            const db = (event.target as IDBOpenDBRequest).result;
            const exists = db.objectStoreNames.contains(storeName);
            db.close();
            resolve(exists);
          } catch (innerError) {
            console.error(`Erreur lors de la vérification de l'object store ${storeName}:`, innerError);
            resolve(false);
          }
        };
        
        openRequest.onerror = (event) => {
          console.error(`Erreur lors de l'ouverture de la base de données:`, event);
          resolve(false);
        };
      }).catch((error) => {
        console.error('Erreur lors de la liste des bases de données:', error);
        resolve(false);
      });
    } catch (error) {
      console.error(`Exception lors de la vérification de l'existence de l'object store ${storeName}:`, error);
      resolve(false);
    }
  });
}

/**
 * Récupère une valeur par défaut si l'accès à la base de données échoue
 * @param asyncOperation Fonction asynchrone à exécuter
 * @param defaultValue Valeur par défaut à retourner en cas d'erreur
 * @returns Le résultat de l'opération asynchrone ou la valeur par défaut en cas d'erreur
 */
export async function withFallback<T>(asyncOperation: () => Promise<T>, defaultValue: T): Promise<T> {
  try {
    return await asyncOperation();
  } catch (error) {
    console.error('Erreur lors de l\'opération avec fallback:', error);
    return defaultValue;
  }
}

/**
 * Vérifie l'intégrité de la base de données
 * @returns Un objet avec le statut et les stores manquants le cas échéant
 */
export async function checkDatabaseIntegrity(): Promise<{isValid: boolean, missingStores: string[]}> {
  return new Promise((resolve) => {
    try {
      // Liste des stores requis
      const requiredStores = ['accounts', 'transactions', 'recurringTransactions', 'userPreferences', 'balanceAdjustments'];
      
      // Ouvrir la base de données 
      const openRequest = indexedDB.open(DB_NAME);
      
      openRequest.onsuccess = (event) => {
        try {
          const db = (event.target as IDBOpenDBRequest).result;
          const missingStores = requiredStores.filter(store => !db.objectStoreNames.contains(store));
          
          db.close();
          
          resolve({
            isValid: missingStores.length === 0,
            missingStores
          });
        } catch (innerError) {
          console.error('Erreur lors de la vérification des object stores:', innerError);
          resolve({
            isValid: false,
            missingStores: requiredStores
          });
        }
      };
      
      openRequest.onerror = () => {
        console.error('Erreur lors de l\'ouverture de la base de données pour vérification');
        resolve({
          isValid: false,
          missingStores: requiredStores
        });
      };
    } catch (error) {
      console.error('Exception lors de la vérification de l\'intégrité de la base de données:', error);
      resolve({
        isValid: false,
        missingStores: ['accounts', 'transactions', 'recurringTransactions', 'userPreferences', 'balanceAdjustments']
      });
    }
  });
}
