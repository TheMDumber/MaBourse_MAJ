import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { detectAuthInconsistencies, repairAuthSession } from '@/lib/authDebug';
import { toast } from 'sonner';

/**
 * Ce composant agit comme un patch pour améliorer la stabilité de l'authentification
 * Il s'exécute automatiquement et tente de résoudre les problèmes d'authentification courants
 */
const AuthStabilityPatch: React.FC = () => {
  const { isAuthenticated, isLoading, syncData } = useAuth();

  // Exécuter une vérification de stabilité périodiquement
  useEffect(() => {
    // Vérifier si la session a des incohérences
    const checkAndRepair = () => {
      // Ne pas vérifier pendant le chargement initial
      if (isLoading) return;

      // Détecter les problèmes
      const issues = detectAuthInconsistencies();

      // Si des problèmes sont détectés, essayer de les réparer
      if (issues.length > 0) {
        console.warn('Problèmes d\'authentification détectés par le patch de stabilité:', issues);
        
        // Tenter une réparation silencieuse
        const wasRepaired = repairAuthSession();
        
        if (wasRepaired) {
          console.log('Session réparée avec succès par le patch de stabilité');
          
          // Si l'utilisateur est censé être authentifié mais ne l'est pas
          if (localStorage.getItem('userSession') && !isAuthenticated) {
            console.log('État d\'authentification récupéré, forçage d\'une mise à jour...');
            
            // Notifier l'utilisateur discrètement
            toast.success('Connexion restaurée', {
              description: 'Votre session a été récupérée automatiquement',
              duration: 3000
            });
            
            // Recharger la page après un court délai
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        }
      }
    };

    // Exécuter la vérification immédiatement
    checkAndRepair();

    // Puis configurer une vérification périodique (toutes les 30 secondes)
    const intervalId = setInterval(checkAndRepair, 30000);

    // Nettoyer l'intervalle lors du démontage
    return () => clearInterval(intervalId);
  }, [isAuthenticated, isLoading]);

  // Configurer un gestionnaire d'événements pour l'état de connexion
  useEffect(() => {
    const handleOnline = () => {
      console.log('Connexion internet rétablie, vérification de l\'authentification...');
      
      // Si l'utilisateur est censé être authentifié
      if (localStorage.getItem('userSession')) {
        // Déclencher une synchronisation des données
        if (isAuthenticated) {
          toast.info('Connexion internet rétablie', {
            description: 'Synchronisation des données...',
            duration: 3000
          });
          
          // Utiliser un délai pour permettre au navigateur de se stabiliser
          setTimeout(() => {
            syncData();
          }, 2000);
        } else {
          // Si la session existe mais l'utilisateur n'est pas authentifié,
          // forcer un rechargement pour restaurer l'état
          toast.info('Connexion internet rétablie', {
            description: 'Restauration de la session...',
            duration: 3000
          });
          
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      }
    };

    // Écouter les événements de connexion
    window.addEventListener('online', handleOnline);

    // Nettoyer l'écouteur lors du démontage
    return () => window.removeEventListener('online', handleOnline);
  }, [isAuthenticated, syncData]);

  return null; // Ce composant ne rend rien
};

export default AuthStabilityPatch;
