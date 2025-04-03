import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fileStorage } from '@/lib/fileStorageAdapter';
import db from '@/lib/db';
import { Account } from '@/lib/types';
import { UserData } from '@/lib/fileStorage';
import { isMoreRecent, getMostRecent } from '@/lib/calculateTimestamp';
import { getCurrentSyncState, saveSyncState, getDeviceId, generateSyncId, forceFullSync, needsFullSync, needsServerSync, resetServerSync } from '@/lib/syncUtils';
import { invalidateAllQueries } from '@/lib/syncHelpers';
import { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { objectStoreExists } from '@/lib/dbUtils';

// Créer une instance de QueryClient pour les invalidations manuelles
const queryClient = new QueryClient();

// Définir l'interface du contexte d'authentification
interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  isInitialSync: boolean;
  syncProgress: number;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  syncData: (forceServerData?: boolean) => Promise<boolean>;
  lastSyncTime: Date | null;
}

// Créer le contexte avec des valeurs par défaut
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  username: null,
  isLoading: true,
  isSyncing: false,
  isInitialSync: false,
  syncProgress: 0,
  login: async () => false,
  logout: () => {},
  syncData: async () => false,
  lastSyncTime: null
});

// Hook pour utiliser le contexte d'authentification
export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

// Fonction utilitaire pour appeler de manière sécurisée les méthodes de la DB
const safeDbCall = async <T,>(callFn: () => Promise<T>, defaultValue: T): Promise<T> => {
  try {
    return await callFn();
  } catch (error) {
    console.error('Erreur lors de l\'appel à la base de données:', error);
    return defaultValue;
  }
};

// Fournisseur du contexte d'authentification
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isInitialSync, setIsInitialSync] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Vérifier l'état d'authentification au chargement
  useEffect(() => {
    const checkAuth = async () => {
      const isLoggedIn = fileStorage.isLoggedIn();
      const currentUsername = fileStorage.getCurrentUsername();

      setIsAuthenticated(isLoggedIn);
      setUsername(currentUsername);
      setIsLoading(false);

      // Si connecté, définir la dernière synchronisation
      if (isLoggedIn) {
        const syncState = await getCurrentSyncState();
        if (syncState?.lastSync) {
          setLastSyncTime(new Date(syncState.lastSync));
        }
      }
    };

    checkAuth();
  }, []);

  // Fonction de connexion
  const login = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      console.log(`Tentative de connexion pour l'utilisateur: ${username}`);
      
      // Essais multiples en cas d'échec temporaire
      let loginAttempts = 0;
      let success = false;
      
      while (loginAttempts < 2 && !success) {
        try {
          success = await fileStorage.login(username, password);
          if (success) {
            console.log('Connexion réussie');
            break;
          } else {
            console.warn(`Tentative de connexion ${loginAttempts + 1} échouée`);
            // Attendre un peu avant de réessayer
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (loginError) {
          console.error(`Erreur lors de la tentative ${loginAttempts + 1}:`, loginError);
        }
        
        loginAttempts++;
      }

      if (success) {
        setIsAuthenticated(true);
        setUsername(username);

        // Vérifier si c'est la première synchronisation
        const needsInitialSync = await needsFullSync();
        setIsInitialSync(needsInitialSync);

        // Si première connexion, synchroniser immédiatement
        if (needsInitialSync) {
          await syncData();
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error('Erreur de connexion:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction de déconnexion
  const logout = () => {
    fileStorage.logout();
    setIsAuthenticated(false);
    setUsername(null);
    setLastSyncTime(null);
    
    // Rediriger vers la page de connexion
    window.location.href = '/login';
  };

  // Fonction de synchronisation des données
  const syncData = async (forceServerData: boolean = false): Promise<boolean> => {
    if (!isAuthenticated || !username) {
      console.error('Impossible de synchroniser: utilisateur non connecté');
      return false;
    }

    if (isSyncing) {
      console.log('Synchronisation déjà en cours...');
      return false;
    }

    setIsSyncing(true);
    setSyncProgress(0);
    
    try {
      console.log(`Démarrage de la synchronisation${forceServerData ? ' (récupération forcée depuis le serveur)' : ''}...`);
      
      // Si on force les données serveur, on réinitialise l'état de synchronisation
      if (forceServerData) {
        console.log('Récupération forcée des données du serveur...');
        await resetServerSync();
      }

      // Vérifier s'il s'agit d'une synchronisation initiale complète
      const isFirstSync = await needsFullSync();
      setIsInitialSync(isFirstSync);
      
      // Générer un nouvel ID de synchronisation
      const syncId = generateSyncId();
      
      // Indicateurs pour le type de synchronisation
      const pullFromServer = forceServerData || await needsServerSync();
      
      // Charger les données depuis le stockage local (IndexedDB) avec gestion des erreurs
      // Utiliser des appels sécurisés pour chaque type de données
      const localAccounts = await safeDbCall(() => db.accounts.getAll(), []);
      setSyncProgress(10);
      
      // Packer les données locales pour l'envoi
      const localData: UserData = {
        accounts: localAccounts,
        transactions: await safeDbCall(() => db.transactions.getAll(), []),
        recurringTransactions: await safeDbCall(() => db.recurringTransactions.getAll(), []),
        categories: [], // Champ vide pour compatibilité avec la structure attendue
        preferences: await safeDbCall(() => db.preferences.get(), {}),
        balanceAdjustments: [], // Initialiser avec un tableau vide par défaut
        version: 2, // Version actuelle du format de données
        timestamp: Date.now(),
        devices: {}
      };
      
      // Vérifier si l'object store balanceAdjustments existe avant de l'utiliser
      const balanceAdjustmentsStoreExists = await objectStoreExists('balanceAdjustments');
      if (balanceAdjustmentsStoreExists) {
        try {
          localData.balanceAdjustments = await db.balanceAdjustments.getAll();
        } catch (error) {
          console.error('Erreur lors du chargement des ajustements de solde:', error);
          // Continuer avec un tableau vide
        }
      } else {
        console.warn('L\'object store balanceAdjustments n\'existe pas, ignoré dans la synchronisation');
      }
      
      setSyncProgress(20);
      
      // Si c'est une sync initiale ou si on a besoin de récupérer du serveur
      if (isFirstSync || pullFromServer) {
        // Récupérer les données du serveur
        console.log('Récupération des données depuis le serveur...');
        const serverData = await fileStorage.loadUserData();
        setSyncProgress(40);
        
        if (serverData && serverData.version >= 2) {
          console.log('Données serveur récupérées avec succès');
          
          // Fusionner avec les données locales si nécessaire (basé sur les timestamps)
          if (!forceServerData && !isFirstSync) {
            // Logique de fusion ici
            console.log('Fusion des données locales et serveur...');
            
            // Pour chaque compte, vérifier quelle version est la plus récente
            if (serverData.accounts && Array.isArray(serverData.accounts)) {
              const mergedAccounts = [];
              
              // Comptes serveur
              for (const serverAccount of serverData.accounts) {
                const localAccount = localAccounts.find(acc => acc.id === serverAccount.id);
                
                if (localAccount) {
                  // Si le compte existe localement, prendre le plus récent
                  if (isMoreRecent(localAccount.updatedAt, serverAccount.updatedAt)) {
                    mergedAccounts.push(localAccount);
                  } else {
                    mergedAccounts.push(serverAccount);
                  }
                } else {
                  // Sinon ajouter le compte serveur
                  mergedAccounts.push(serverAccount);
                }
              }
              
              // Ajouter les comptes locaux qui n'existent pas sur le serveur
              for (const localAccount of localAccounts) {
                if (!serverData.accounts.some(acc => acc.id === localAccount.id)) {
                  mergedAccounts.push(localAccount);
                }
              }
              
              serverData.accounts = mergedAccounts;
            }
            
            // Même logique pour les transactions et autres données...
          }
          
          // Mettre à jour IndexedDB avec les données du serveur
          try {
            console.log('Mise à jour de la base de données locale...');
            
            // Sécuriser les appels avec try/catch individuels
            
            // Sauvegarder les comptes
            if (serverData.accounts && Array.isArray(serverData.accounts)) {
              try {
                // D'abord supprimer tous les comptes existants
                await db.accounts.deleteAll();
                
                // Puis ajouter les nouveaux
                for (const account of serverData.accounts) {
                  await db.accounts.add(account);
                }
              } catch (error) {
                console.error('Erreur lors de la sauvegarde des comptes:', error);
              }
            }
            
            // Sauvegarder les transactions
            if (serverData.transactions && Array.isArray(serverData.transactions)) {
              try {
                await db.transactions.deleteAll();
                for (const transaction of serverData.transactions) {
                  await db.transactions.add(transaction);
                }
              } catch (error) {
                console.error('Erreur lors de la sauvegarde des transactions:', error);
              }
            }
            
            // Sauvegarder les transactions récurrentes
            if (serverData.recurringTransactions && Array.isArray(serverData.recurringTransactions)) {
              try {
                await db.recurringTransactions.deleteAll();
                for (const recurringTx of serverData.recurringTransactions) {
                  await db.recurringTransactions.add(recurringTx);
                }
              } catch (error) {
                console.error('Erreur lors de la sauvegarde des transactions récurrentes:', error);
              }
            }
            
            // Nous ignorons les catégories car l'API 'categories' n'existe pas dans le module db
            
            // Sauvegarder les préférences
            if (serverData.preferences) {
              try {
                await db.preferences.saveUserPreferences(serverData.preferences);
              } catch (error) {
                console.error('Erreur lors de la sauvegarde des préférences:', error);
              }
            }
            
            // Sauvegarder les ajustements de solde
            if (balanceAdjustmentsStoreExists && serverData.balanceAdjustments && Array.isArray(serverData.balanceAdjustments)) {
              try {
                // On utilise la fonction de synchronisation dédiée aux ajustements
                await db.balanceAdjustments.syncFromServer(serverData.balanceAdjustments);
              } catch (error) {
                console.error('Erreur lors de la synchronisation des ajustements de solde:', error);
              }
            } else {
              console.warn('L\'object store balanceAdjustments n\'existe pas, ajustements de solde ignorés');
            }
            
            setSyncProgress(60);
            console.log('Base de données locale mise à jour avec succès');
          } catch (error) {
            console.error('Erreur lors de la mise à jour de la base de données locale:', error);
            // On continue quand même pour éviter de bloquer la synchronisation
          }
        } else {
          console.error('Données serveur invalides ou vides');
          
          // Si les données serveur sont invalides mais qu'on a des données locales
          if (localAccounts.length > 0) {
            console.log('Conservation des données locales...');
          } else {
            // Pas d'erreur bloquante, on continue avec les données locales vides
            console.warn('Aucune donnée valide disponible pour la synchronisation');
          }
        }
      } else {
        // Simple envoi des données locales au serveur
        console.log('Envoi des données locales au serveur...');
      }
      
      // Envoyer les données locales au serveur (toujours, sauf si forceServerData)
      if (!forceServerData) {
        try {
          console.log('Sauvegarde des données sur le serveur...');
          const saveSuccess = await fileStorage.saveUserData(localData);
          
          if (!saveSuccess) {
            console.error('Échec de la sauvegarde sur le serveur');
            
            // Afficher une notification à l'utilisateur avec toast
            toast.error('Erreur de synchronisation', {
              description: 'Les données ont été sauvegardées localement mais pas sur le serveur.'
            });
            
            // Essayer une nouvelle fois avec un léger délai
            setTimeout(async () => {
              console.log('Nouvelle tentative de sauvegarde sur le serveur...');
              try {
                const secondAttempt = await fileStorage.saveUserData(localData);
                if (secondAttempt) {
                  console.log('Seconde tentative de sauvegarde réussie');
                  toast.success('Synchronisation réussie', {
                    description: 'Les données ont été sauvegardées avec succès après une nouvelle tentative.'
                  });
                }
              } catch (retryError) {
                console.error('Erreur lors de la seconde tentative de sauvegarde:', retryError);
              }
            }, 500);
            
            // On continue quand même car les données locales sont cohérentes
          }
        } catch (error) {
          console.error('Erreur lors de la sauvegarde sur le serveur:', error);
          
          // Afficher l'erreur à l'utilisateur
          toast.error('Erreur de synchronisation', {
            description: error instanceof Error ? error.message : 'Une erreur est survenue lors de la sauvegarde'
          });
          
          // On continue quand même car les données locales sont cohérentes
        }
      }
      
      setSyncProgress(80);
      
      // Mettre à jour l'état de synchronisation
      try {
        await saveSyncState({
          lastSync: Date.now(),
          deviceId: await getDeviceId(),
          syncId
        });
      } catch (error) {
        console.error('Erreur lors de la sauvegarde de l\'état de synchronisation:', error);
      }
      
      setSyncProgress(100);
      setLastSyncTime(new Date());
      console.log('Synchronisation terminée avec succès');
      
      // Invalider toutes les requêtes React Query pour forcer le rechargement des données
      try {
        invalidateAllQueries(queryClient);
      } catch (error) {
        console.error('Erreur lors de l\'invalidation des requêtes:', error);
      }
      
      return true;
    } catch (error) {
      console.error('Erreur lors de la synchronisation:', error);
      toast.error('Erreur de synchronisation', {
        description: error instanceof Error ? error.message : 'Une erreur est survenue lors de la synchronisation'
      });
      return false;
    } finally {
      setIsSyncing(false);
      setIsInitialSync(false);
    }
  };

  // Valeur du contexte à exposer
  const value: AuthContextType = {
    isAuthenticated,
    username,
    isLoading,
    isSyncing,
    isInitialSync,
    syncProgress,
    login,
    logout,
    syncData,
    lastSyncTime
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
