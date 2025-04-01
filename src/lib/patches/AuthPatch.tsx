import React, { useEffect } from 'react';

/**
 * Composant de patch pour les problèmes d'authentification en boucle
 * À injecter dans l'application
 */
export const AuthPatch: React.FC = () => {
  useEffect(() => {
    // 1. Désactiver les détections de boucle potentielles
    const isRemoteNetwork = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    
    // 2. Nettoyer les drapeaux problématiques
    localStorage.removeItem('isRedirecting');
    localStorage.removeItem('isCheckingRedirect');
    localStorage.removeItem('redirectAttemptCount');
    localStorage.removeItem('lastRedirectTime');
    localStorage.removeItem('isSyncing');
    localStorage.removeItem('syncEventTriggered');
    localStorage.removeItem('rebootCount');
    localStorage.removeItem('lastRebootTime');
    
    // 3. Définir un drapeau pour éviter les rechargements automatiques
    sessionStorage.setItem('patchApplied', 'true');
    
    // 4. Détecter les redirection automatiques problématiques
    const isAutoRedirect = sessionStorage.getItem('autoRedirect') === 'true';
    if (isAutoRedirect) {
      console.log('Détection d\'une redirection automatique précédente, blocage activé');
      sessionStorage.removeItem('autoRedirect');
      
      // Au lieu de remplacer window.location.reload, on utilise une approche plus sûre
      // en plaçant un drapeau qui sera vérifié avant toute tentative de redirection
      window.preventAutoRedirect = true;
    }
    
    // 5. Marquer pour la prochaine page
    sessionStorage.setItem('autoRedirect', 'true');
    
    return () => {
      // Nettoyage supplémentaire au démontage
    };
  }, []);

  // Ce composant ne rend rien
  return null;
};

// Ajouter la propriété preventAutoRedirect au window global
declare global {
  interface Window {
    preventAutoRedirect?: boolean;
  }
}

export default AuthPatch;
