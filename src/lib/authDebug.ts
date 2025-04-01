/**
 * Outil de diagnostic pour les problèmes d'authentification
 */

import { fileStorage } from './fileStorageAdapter';

// Structure pour stocker les informations de diagnostic
interface AuthDiagnostic {
  timestamp: Date;
  sessionExists: boolean;
  isLoggedIn: boolean;
  username: string | null;
  localStorage: Record<string, string | null>;
  userAgentInfo: string;
  networkInfo: {
    hostname: string;
    port: string;
    protocol: string;
    isRemoteNetwork: boolean;
  };
}

/**
 * Exécute un diagnostic complet sur l'état de l'authentification
 */
export function runAuthDiagnostic(): AuthDiagnostic {
  // Vérifier l'état actuel
  const sessionExists = localStorage.getItem('userSession') !== null;
  const isLoggedIn = fileStorage.isLoggedIn();
  const username = fileStorage.getCurrentUsername();
  
  // Récupérer tous les éléments de localStorage liés à l'authentification
  const localStorageKeys = [
    'userSession',
    'isRedirecting',
    'isCheckingRedirect',
    'redirectAttemptCount',
    'lastRedirectTime',
    'lastAuthCheck',
    'isSyncing',
    'syncEventTriggered',
    'isInitialSync',
    'layoutRefreshing',
    'statsRefreshing',
    'lastSyncTime',
    'needsFullRecovery',
    'forceServerSync',
    'balanceAdjustmentsStoreFixed',
    'needsFullSync',
    'deviceId',
    'syncState'
  ];
  
  const localStorageItems: Record<string, string | null> = {};
  localStorageKeys.forEach(key => {
    localStorageItems[key] = localStorage.getItem(key);
  });
  
  // Informations de réseau
  const isRemoteNetwork = window.location.hostname !== 'localhost' && 
                         window.location.hostname !== '127.0.0.1';
  
  return {
    timestamp: new Date(),
    sessionExists,
    isLoggedIn,
    username,
    localStorage: localStorageItems,
    userAgentInfo: navigator.userAgent,
    networkInfo: {
      hostname: window.location.hostname,
      port: window.location.port,
      protocol: window.location.protocol,
      isRemoteNetwork
    }
  };
}

/**
 * Répare les problèmes courants d'authentification
 */
export function repairAuthSession(): boolean {
  try {
    // 1. Vérifier si une session existe mais isLoggedIn est false
    const sessionExists = localStorage.getItem('userSession') !== null;
    const isLoggedIn = fileStorage.isLoggedIn();
    
    if (sessionExists && !isLoggedIn) {
      console.log('Incohérence détectée: session stockée mais fileStorage indique non connecté');
      
      // Tenter de restaurer la session
      try {
        const session = JSON.parse(localStorage.getItem('userSession') || '{}');
        if (session.username && session.password) {
          // Forcer une nouvelle connexion
          localStorage.removeItem('userSession');
          fileStorage.login(session.username, session.password);
          console.log('Session restaurée avec succès');
          return true;
        }
      } catch (error) {
        console.error('Erreur lors de la restauration de la session:', error);
      }
    }
    
    // 2. Nettoyer tous les marqueurs de redirection si bloqués
    const redirectionMarkers = [
      'isRedirecting',
      'isCheckingRedirect',
      'redirectAttemptCount',
      'lastRedirectTime',
      'lastAuthCheck'
    ];
    
    let markersCleared = false;
    redirectionMarkers.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        markersCleared = true;
      }
    });
    
    if (markersCleared) {
      console.log('Marqueurs de redirection nettoyés');
    }
    
    // 3. Nettoyer les marqueurs de synchronisation si bloqués
    const syncMarkers = [
      'isSyncing',
      'syncEventTriggered',
      'isInitialSync',
      'layoutRefreshing',
      'statsRefreshing'
    ];
    
    let syncMarkersCleared = false;
    syncMarkers.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        syncMarkersCleared = true;
      }
    });
    
    if (syncMarkersCleared) {
      console.log('Marqueurs de synchronisation nettoyés');
    }
    
    return markersCleared || syncMarkersCleared;
  } catch (error) {
    console.error('Erreur lors de la réparation de la session:', error);
    return false;
  }
}

/**
 * Réinitialise complètement la session (déconnexion forcée)
 */
export function resetAuthSession(): void {
  // 1. Supprimer tous les marqueurs
  const allKeys = [
    'userSession',
    'isRedirecting',
    'isCheckingRedirect',
    'redirectAttemptCount',
    'lastRedirectTime',
    'lastAuthCheck',
    'isSyncing',
    'syncEventTriggered',
    'isInitialSync',
    'layoutRefreshing',
    'statsRefreshing',
    'forceServerSync',
    'needsFullRecovery'
  ];
  
  allKeys.forEach(key => {
    localStorage.removeItem(key);
  });
  
  // 2. Réinitialiser l'adaptateur
  fileStorage.logout();
  
  console.log('Session d\'authentification réinitialisée avec succès');
}

/**
 * Vérifie s'il y a des incohérences dans l'état d'authentification
 */
export function detectAuthInconsistencies(): string[] {
  const issues: string[] = [];
  
  // 1. Vérifier si userSession existe mais fileStorage indique non connecté
  const sessionExists = localStorage.getItem('userSession') !== null;
  const isLoggedIn = fileStorage.isLoggedIn();
  
  if (sessionExists && !isLoggedIn) {
    issues.push('Incohérence: session stockée mais fileStorage indique non connecté');
  }
  
  if (!sessionExists && isLoggedIn) {
    issues.push('Incohérence: session non stockée mais fileStorage indique connecté');
  }
  
  // 2. Vérifier les marqueurs de redirection bloqués
  if (localStorage.getItem('isRedirecting') === 'true') {
    const lastRedirectTime = localStorage.getItem('lastRedirectTime');
    if (lastRedirectTime) {
      const timeSinceRedirect = Date.now() - parseInt(lastRedirectTime);
      if (timeSinceRedirect > 10000) { // 10 secondes
        issues.push('Marqueur de redirection bloqué depuis plus de 10 secondes');
      }
    } else {
      issues.push('Marqueur de redirection actif sans timestamp');
    }
  }
  
  // 3. Vérifier les marqueurs de synchronisation bloqués
  if (localStorage.getItem('isSyncing') === 'true') {
    const lastSyncTime = localStorage.getItem('lastSyncTime');
    if (lastSyncTime) {
      const timeSinceSync = Date.now() - parseInt(lastSyncTime);
      if (timeSinceSync > 30000) { // 30 secondes
        issues.push('Marqueur de synchronisation bloqué depuis plus de 30 secondes');
      }
    } else {
      issues.push('Marqueur de synchronisation actif sans timestamp');
    }
  }
  
  return issues;
}
