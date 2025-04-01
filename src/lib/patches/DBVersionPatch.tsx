import React, { useEffect, useState } from 'react';
import { fixDBVersion, getCurrentDBVersion, deleteDatabase } from '../versionFix';
import { toast } from 'sonner';

/**
 * Composant de patch pour gérer les problèmes de version de base de données
 * Ce composant s'auto-exécute et corrige les problèmes de version détectés
 */
const DBVersionPatch: React.FC = () => {
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Vérifier et corriger le problème de version uniquement au premier chargement
    if (!hasChecked) {
      checkAndFixDBVersion();
      setHasChecked(true);
    }
  }, [hasChecked]);

  const checkAndFixDBVersion = async () => {
    try {
      // Vérifier si on a déjà traité ce problème
      if (sessionStorage.getItem('dbVersionFixed') === 'true') {
        console.log('Problème de version de base de données déjà corrigé');
        return;
      }

      // Vérifier la version de la base de données
      const currentVersion = await getCurrentDBVersion();
      console.log(`Version actuelle de la base de données IndexedDB: ${currentVersion}`);

      // Si la version est supérieure à 3, nous avons potentiellement le problème
      if (currentVersion > 3) {
        console.log(`Problème de version détecté: la base existe en version ${currentVersion} mais l'application utilise la version 3`);
        
        // Essayer de fixer la version sans supprimer la base
        const fixedVersion = await fixDBVersion();
        
        // Si la version corrigée est égale à la version actuelle, tout va bien
        if (fixedVersion === currentVersion) {
          console.log(`Version de base de données correctement ajustée à ${fixedVersion}`);
          sessionStorage.setItem('dbVersionFixed', 'true');
          
          // Afficher une notification
          toast.success('Compatibilité de base de données ajustée', {
            description: 'Un problème de version a été automatiquement corrigé',
            duration: 5000
          });
        } else {
          // Si la correction n'a pas fonctionné, suggérer une réinitialisation
          console.warn('Impossible d\'ajuster la version, une réinitialisation peut être nécessaire');
          
          // Afficher une notification avec une action
          toast.warning(
            'Problème de version de base de données', 
            {
              description: 'Voulez-vous réinitialiser la base de données pour résoudre ce problème?',
              duration: 20000,
              action: {
                label: 'Réinitialiser',
                onClick: async () => {
                  const deleted = await deleteDatabase();
                  if (deleted) {
                    toast.success('Base de données réinitialisée', {
                      description: 'Veuillez rafraîchir la page pour recréer la structure',
                      duration: 10000,
                      action: {
                        label: 'Rafraîchir',
                        onClick: () => window.location.reload()
                      }
                    });
                  } else {
                    toast.error('Échec de la réinitialisation', {
                      description: 'Utilisez l\'outil de diagnostic pour une réinitialisation manuelle'
                    });
                  }
                }
              }
            }
          );
        }
      } else {
        // Si la version est 3 ou moins, tout va bien
        console.log('Version de base de données correcte, aucune action nécessaire');
        sessionStorage.setItem('dbVersionFixed', 'true');
      }
    } catch (error) {
      console.error('Erreur lors de la vérification de la version de la base de données:', error);
    }
  };

  // Ce composant ne rend rien
  return null;
};

export default DBVersionPatch;
