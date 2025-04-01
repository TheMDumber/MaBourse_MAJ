/**
 * Correctif pour gérer le problème de conflit de version de base de données IndexedDB
 * Ce module résout spécifiquement l'erreur:
 * "VersionError: The requested version (3) is less than the existing version (4)"
 */

// Fonction pour obtenir la version actuelle de la base de données
export async function getCurrentDBVersion(): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open('ma-bourse');
      
      // En cas de succès, nous obtenons la version actuelle
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const version = db.version;
        db.close();
        resolve(version);
      };
      
      // En cas d'erreur, nous retournons la version par défaut
      request.onerror = () => {
        console.error('Erreur lors de la récupération de la version de la base de données');
        resolve(3); // Version par défaut
      };
    } catch (error) {
      console.error('Exception lors de la vérification de la version:', error);
      resolve(3); // Version par défaut en cas d'exception
    }
  });
}

// Fonction pour supprimer complètement la base de données
export function deleteDatabase(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Suppression de la base de données
      const deleteRequest = indexedDB.deleteDatabase('ma-bourse');
      
      deleteRequest.onsuccess = () => {
        console.log('Base de données supprimée avec succès');
        resolve(true);
      };
      
      deleteRequest.onerror = (event) => {
        console.error('Erreur lors de la suppression de la base de données:', event);
        resolve(false);
      };
      
      deleteRequest.onblocked = () => {
        console.warn('La suppression de la base de données est bloquée');
        // Essayer de forcer la fermeture des connexions ouvertes
        try {
          const openRequest = indexedDB.open('ma-bourse');
          openRequest.onsuccess = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            db.close();
            // Réessayer après la fermeture
            setTimeout(() => {
              const secondDeleteRequest = indexedDB.deleteDatabase('ma-bourse');
              secondDeleteRequest.onsuccess = () => resolve(true);
              secondDeleteRequest.onerror = () => resolve(false);
            }, 100);
          };
        } catch (error) {
          console.error('Erreur lors de la fermeture des connexions:', error);
          resolve(false);
        }
      };
    } catch (error) {
      console.error('Exception lors de la suppression de la base de données:', error);
      resolve(false);
    }
  });
}

// Fonction pour définir globalement la version correcte à utiliser
export async function fixDBVersion(): Promise<number> {
  try {
    // Obtenir la version actuelle
    const currentVersion = await getCurrentDBVersion();
    console.log(`Version actuelle de la base de données: ${currentVersion}`);
    
    // Si la version actuelle est supérieure à 3, définir une variable globale
    if (currentVersion > 3) {
      // Stocker en session storage pour pouvoir y accéder depuis d'autres modules
      sessionStorage.setItem('dbVersion', currentVersion.toString());
      console.log(`Version de base de données fixée à ${currentVersion}`);
      return currentVersion;
    }
    
    // Si la version est 3 ou moins, utiliser la version par défaut
    console.log('Version de base de données standard (3) utilisée');
    sessionStorage.removeItem('dbVersion');
    return 3;
  } catch (error) {
    console.error('Erreur lors de la correction de la version:', error);
    return 3; // Version par défaut en cas d'erreur
  }
}

// Fonction pour obtenir la version à utiliser lors de l'ouverture de la base
export function getDBVersion(): number {
  const storedVersion = sessionStorage.getItem('dbVersion');
  if (storedVersion) {
    return parseInt(storedVersion);
  }
  return 3; // Version par défaut
}
