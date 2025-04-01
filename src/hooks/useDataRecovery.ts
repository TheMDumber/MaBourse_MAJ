import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import db from '@/lib/db';

export function useDataRecovery() {
  const [needsRecovery, setNeedsRecovery] = useState<boolean>(false);
  const { isAuthenticated, isLoading } = useAuth();
  
  useEffect(() => {
    // Vérifier si une récupération est nécessaire uniquement si l'utilisateur est authentifié
    // et que le chargement initial est terminé
    const checkForEmptyDatabase = async () => {
      if (isAuthenticated && !isLoading) {
        try {
          // Vérifier si la base de données locale contient des données
          const accounts = await db.accounts.getAll();
          
          // Si aucun compte n'est trouvé, proposer la récupération
          if (accounts.length === 0) {
            // Vérifier si l'alerte a déjà été affichée récemment
            const lastAlert = localStorage.getItem('dataRecoveryAlertShown');
            const now = Date.now();
            
            // Ne montrer l'alerte qu'une fois toutes les 24h pour éviter de spammer l'utilisateur
            if (!lastAlert || (now - parseInt(lastAlert)) > 24 * 60 * 60 * 1000) {
              setNeedsRecovery(true);
              localStorage.setItem('dataRecoveryAlertShown', now.toString());
            }
          }
        } catch (error) {
          console.error('Erreur lors de la vérification de la base de données:', error);
        }
      }
    };
    
    checkForEmptyDatabase();
  }, [isAuthenticated, isLoading]);
  
  const resetRecoveryState = () => {
    setNeedsRecovery(false);
  };
  
  return {
    needsRecovery,
    resetRecoveryState
  };
}
