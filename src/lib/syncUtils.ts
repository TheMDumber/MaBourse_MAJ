/**
 * Utilitaires pour la synchronisation multi-appareils
 * Assure la cohérence des données entre différents appareils
 */

// Générer un identifiant unique pour une session de synchronisation
export function generateSyncId(): string {
  // Générer un identifiant unique composé de timestamp + nombre aléatoire
  return `sync_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// Structure de l'état de synchronisation
export interface SyncState {
  syncId: string;              // Identifiant unique de synchronisation
  lastSyncTime: Date;          // Dernière synchronisation réussie
  deviceId: string;            // Identifiant unique de l'appareil
  forceLocalData?: boolean;    // Force l'utilisation des données locales (override serveur)
}

// Obtenir l'identifiant unique de l'appareil (généré une seule fois)
export function getDeviceId(): string {
  const storedDeviceId = localStorage.getItem('deviceId');
  
  if (storedDeviceId) {
    return storedDeviceId;
  }
  
  // Générer un nouvel ID pour cet appareil s'il n'en a pas encore
  const timestamp = Date.now().toString();
  const randomPart = Math.random().toString(36).substring(2, 10);
  const newDeviceId = `device_${timestamp}_${randomPart}`;
  localStorage.setItem('deviceId', newDeviceId);
  return newDeviceId;
}

// Obtenir l'état de synchronisation actuel
export function getCurrentSyncState(): SyncState | null {
  const storedState = localStorage.getItem('syncState');
  
  if (storedState) {
    try {
      const parsedState = JSON.parse(storedState);
      return {
        ...parsedState,
        lastSyncTime: new Date(parsedState.lastSyncTime)
      };
    } catch (error) {
      console.error('Erreur lors de la lecture de l\'état de synchronisation:', error);
      return null;
    }
  }
  
  return null;
}

// Enregistrer l'état de synchronisation
export function saveSyncState(state: SyncState): void {
  localStorage.setItem('syncState', JSON.stringify(state));
}

// Forcer une synchronisation complète en prioritisant les données locales
export function forceFullSync(): void {
  try {
    // Générer un nouvel ID de synchronisation pour forcer le remplacement des données serveur
    const newSyncState: SyncState = {
      syncId: generateSyncId(),  // Nouveau synchId pour indiquer une nouvelle priorité
      lastSyncTime: new Date(),  // Date actuelle pour s'assurer que les données locales sont considérées comme plus récentes
      deviceId: getDeviceId(),    // Conserve l'ID de cet appareil 
      forceLocalData: true        // Spécifie explicitement de prioriser les données locales
    };
    
    // Sauvegarder le nouvel état
    saveSyncState(newSyncState);
    
    console.log('Synchronisation forcée activée: les données locales seront envoyées au serveur lors de la prochaine synchronisation');
  } catch (error) {
    console.error('Erreur lors de la configuration de la synchronisation forcée:', error);
  }
}

// Vérifier si une synchronisation complète est nécessaire
// (par exemple, lors de la première utilisation ou après une erreur)
export function needsFullSync(): boolean {
  return getCurrentSyncState() === null;
}

// Forcer une synchronisation serveur vers locale (priorité aux données du serveur)
export function forceServerSync(): void {
  try {
    // Enregistrer un état indiquant que les données du serveur doivent être prioritaires
    localStorage.setItem('forceServerSync', 'true');
    
    console.log('Synchronisation forcée serveur vers locale activée: les données du serveur vont remplacer les données locales');
  } catch (error) {
    console.error('Erreur lors de la configuration de la synchronisation forcée serveur vers locale:', error);
  }
}

// Vérifier si une synchronisation serveur vers locale a été demandée
export function needsServerSync(): boolean {
  return localStorage.getItem('forceServerSync') === 'true';
}

// Réinitialiser l'état de synchronisation serveur vers locale
export function resetServerSync(): void {
  localStorage.removeItem('forceServerSync');
}
