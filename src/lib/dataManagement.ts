
import db, { initDB } from './db';
import { Account, Transaction, RecurringTransaction, UserPreferences } from './types';

/**
 * Fonctions de gestion des données de l'application
 */

// Exporter les données de l'application sous forme de JSON
// Cette fonction s'assure de capturer l'état actuel complet de l'application, incluant les soldes prévisionnels
export async function exportData(accountId?: number): Promise<string> {
  await initDB();
  
  // Récupérer toutes les données actuelles de l'application
  let accounts = await db.accounts.getAll();
  let transactions = await db.transactions.getAll();
  let recurringTransactions = await db.recurringTransactions.getAll();
  const preferences = await db.preferences.get();
  
  // Récupérer également les ajustements de solde et autres données éventuelles
  let balanceAdjustments = await db.balanceAdjustments.getAll();
  
  // Si un compte spécifique est demandé, filtrer les données pour ce compte uniquement
  if (accountId) {
    // Filtrer le compte spécifié
    const account = await db.accounts.getById(accountId);
    accounts = account ? [account] : [];
    
    // Filtrer les transactions liées à ce compte
    transactions = transactions.filter(t => t.accountId === accountId || t.toAccountId === accountId);
    
    // Filtrer les transactions récurrentes liées à ce compte
    recurringTransactions = recurringTransactions.filter(t => t.accountId === accountId || t.toAccountId === accountId);
    
    // Filtrer les ajustements de solde liés à ce compte
    balanceAdjustments = balanceAdjustments.filter(a => a.accountId === accountId);
  }
  
  // S'assurer que les soldes prévisionnels sont inclus exactement tels qu'ils apparaissent dans l'UI
  // Actuellement ils sont stockés soit dans des propriétés de comptes, soit dans un store dédié
  // Récupérer les éventuelles modifications de l'interface non encore enregistrées
  const forecastBalances = {};
  
  // Créer un objet contenant les données filtrées
  const data = {
    accounts,
    transactions,
    recurringTransactions,
    balanceAdjustments,
    forecastBalances,
    preferences: accountId ? undefined : preferences, // N'inclure les préférences que pour une exportation complète
    exportDate: new Date(),
    partialExport: accountId ? true : false // Indiquer s'il s'agit d'une exportation partielle
  };
  
  // Convertir l'objet en JSON
  return JSON.stringify(data, null, 2);
}

// Structure des données exportées
interface ExportedData {
  accounts: Account[];
  transactions: Transaction[];
  recurringTransactions: RecurringTransaction[];
  balanceAdjustments?: any[];
  forecastBalances?: Record<string, any>;
  preferences?: UserPreferences;
  exportDate: string;
  partialExport?: boolean;
}

// Options d'importation
export interface ImportOptions {
  targetAccountId?: number; // ID du compte à écraser (si mode = 'overwrite')
  mode: 'create' | 'overwrite' | 'merge'; // Mode d'importation
  clearExisting?: boolean; // Effacer toutes les données existantes (pour importation complète)
}

// Importer des données depuis un JSON
// Le paramètre updateUI permet d'indiquer si cette fonction doit explicitement invalider le cache de l'UI
export async function importData(jsonData: string, options?: ImportOptions, updateUI: boolean = true): Promise<boolean> {
  try {
    await initDB();
    
    // Parser le JSON
    const data = JSON.parse(jsonData) as ExportedData;
    
    // Vérifier que les données sont valides
    if (!data.accounts || !data.transactions || !data.recurringTransactions) {
      throw new Error("Format de données invalide");
    }
    
    // Définir les options par défaut si non fournies
    const importOptions: ImportOptions = options || {
      mode: 'merge',
      clearExisting: !data.partialExport // Si c'est une exportation complète, on efface par défaut
    };
    
    // Import complet - on efface toutes les données existantes si demandé
    if (importOptions.clearExisting) {
      await clearAllData();
    }
    
    // Gestion des comptes selon le mode d'importation
    if (data.partialExport && importOptions.mode === 'overwrite' && importOptions.targetAccountId) {
      // Mode écrasement d'un compte spécifique
      const targetAccount = await db.accounts.getById(importOptions.targetAccountId);
      
      if (!targetAccount) {
        throw new Error("Le compte cible n'existe pas");
      }
      
      // Supprimer les transactions et transactions récurrentes du compte cible
      const accountTransactions = await db.transactions.getByAccount(importOptions.targetAccountId);
      for (const transaction of accountTransactions) {
        await db.transactions.delete(transaction.id!);
      }
      
      // Supprimer les transactions où ce compte est destination
      const allTransactions = await db.transactions.getAll();
      for (const transaction of allTransactions) {
        if (transaction.toAccountId === importOptions.targetAccountId) {
          await db.transactions.delete(transaction.id!);
        }
      }
      
      // Supprimer les transactions récurrentes
      const allRecurringTransactions = await db.recurringTransactions.getAll();
      for (const transaction of allRecurringTransactions) {
        if (transaction.accountId === importOptions.targetAccountId || transaction.toAccountId === importOptions.targetAccountId) {
          await db.recurringTransactions.delete(transaction.id!);
        }
      }
      
      // Supprimer les ajustements de solde associés au compte
      if (db.balanceAdjustments) {
        const allAdjustments = await db.balanceAdjustments.getAll();
        for (const adjustment of allAdjustments) {
          if (adjustment.accountId === importOptions.targetAccountId) {
            await db.balanceAdjustments.delete(adjustment.id!);
          }
        }
      }
      
      // Mettre à jour le compte avec les informations importées
      if (data.accounts.length > 0) {
        const importedAccount = data.accounts[0];
        const { id, ...accountData } = importedAccount;
        
        await db.accounts.update(importOptions.targetAccountId, {
          ...accountData,
          createdAt: targetAccount.createdAt, // Garder la date de création d'origine
          updatedAt: new Date()
        });
      }
    } else {
      // Mode création ou fusion - créer/mettre à jour les comptes importés
      for (const account of data.accounts) {
        const { id, createdAt, updatedAt, ...accountData } = account;
        
        // Vérifier si un compte du même nom existe déjà
        const existingAccounts = await db.accounts.getAll();
        const matchingAccount = existingAccounts.find(a => a.name === account.name);
        
        if (matchingAccount && importOptions.mode === 'merge') {
          // En mode fusion, on met à jour le compte existant
          await db.accounts.update(matchingAccount.id!, {
            ...accountData,
            updatedAt: new Date()
          });
        } else {
          // Sinon, on crée un nouveau compte
          await db.accounts.create({
            ...accountData,
            createdAt: new Date(createdAt),
            updatedAt: new Date(updatedAt)
          });
        }
      }
    }
    
    // Déterminer les ID des comptes après import/mise à jour
    const allAccounts = await db.accounts.getAll();
    const accountMap = new Map<number, number>(); // Correspondance ancien ID -> nouvel ID
    
    // Établir la correspondance des IDs en se basant sur les noms
    for (const importedAccount of data.accounts) {
      const matchingAccount = allAccounts.find(a => a.name === importedAccount.name);
      if (matchingAccount && importedAccount.id) {
        accountMap.set(importedAccount.id, matchingAccount.id!);
      }
    }
    
    // Importer les transactions
    for (const transaction of data.transactions) {
      const { id, createdAt, updatedAt, date, ...transactionData } = transaction;
      
      // Remapper les IDs des comptes si nécessaire
      const mappedAccountId = accountMap.get(transaction.accountId) || transaction.accountId;
      const mappedToAccountId = transaction.toAccountId ? (accountMap.get(transaction.toAccountId) || transaction.toAccountId) : undefined;
      
      // Créer la transaction avec les bons IDs de compte
      await db.transactions.create({
        ...transactionData,
        accountId: mappedAccountId,
        toAccountId: mappedToAccountId,
        date: new Date(date),
        createdAt: new Date(createdAt),
        updatedAt: new Date(updatedAt)
      });
    }
    
    // Importer les transactions récurrentes
    for (const recurringTransaction of data.recurringTransactions) {
      const { id, createdAt, updatedAt, startDate, endDate, nextExecution, lastExecuted, ...recurringData } = recurringTransaction;
      
      // Remapper les IDs des comptes si nécessaire
      const mappedAccountId = accountMap.get(recurringTransaction.accountId) || recurringTransaction.accountId;
      const mappedToAccountId = recurringTransaction.toAccountId ? (accountMap.get(recurringTransaction.toAccountId) || recurringTransaction.toAccountId) : undefined;
      
      // Créer la transaction récurrente avec les bons IDs de compte
      await db.recurringTransactions.create({
        ...recurringData,
        accountId: mappedAccountId,
        toAccountId: mappedToAccountId,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined,
        nextExecution: new Date(nextExecution),
        lastExecuted: lastExecuted ? new Date(lastExecuted) : undefined,
        createdAt: new Date(createdAt),
        updatedAt: new Date(updatedAt)
      });
    }
    
    // Importer les ajustements de solde si présents
    if (data.balanceAdjustments && data.balanceAdjustments.length > 0 && db.balanceAdjustments) {
      for (const adjustment of data.balanceAdjustments) {
        try {
          const { id, createdAt, updatedAt, date, ...adjustmentData } = adjustment;
          
          // Remapper l'ID du compte si nécessaire
          const mappedAccountId = accountMap.get(adjustment.accountId) || adjustment.accountId;
          
          // Au lieu d'utiliser create qui échoue à cause de la contrainte d'unicité,
          // on va d'abord vérifier si un ajustement existe déjà pour ce compte/mois
          const existing = await db.balanceAdjustments.getByAccountAndMonth(mappedAccountId, adjustment.yearMonth);
          
          if (existing) {
            // Si un ajustement existe déjà, on le supprime d'abord
            await db.balanceAdjustments.deleteAdjustment(mappedAccountId, adjustment.yearMonth);
          }
          
          // Puis on crée un nouvel ajustement
          await db.balanceAdjustments.setAdjustment({
            ...adjustmentData,
            accountId: mappedAccountId,
            date: new Date(date),
            // Les champs createdAt et updatedAt sont gérés par setAdjustment
          });
        } catch (error) {
          console.warn(`Erreur lors de l'importation d'un ajustement de solde:`, error);
          // Continuer malgré l'erreur pour ne pas bloquer l'importation complète
        }
      }
    }
    
    // Importer les soldes prévisionnels si présents
    if (data.forecastBalances && Object.keys(data.forecastBalances).length > 0) {
      // Selon l'implémentation, sauvegarder dans la structure appropriée
      // Exemple: si les soldes prévisionnels sont stockés dans les préférences utilisateur
      const currentPrefs = await db.preferences.get();
      if (currentPrefs && currentPrefs.id) {
        await db.preferences.update(currentPrefs.id, {
          ...currentPrefs,
          forecastBalances: data.forecastBalances,
          updatedAt: new Date()
        });
      }
    }
    
    // Importer les préférences si présentes (uniquement pour import complet)
    if (data.preferences && !data.partialExport) {
      const { id, createdAt, updatedAt, ...preferencesData } = data.preferences;
      
      // Récupérer les préférences actuelles
      const currentPrefs = await db.preferences.get();
      
      if (currentPrefs && currentPrefs.id) {
        // Mettre à jour les préférences existantes avec l'ID correct
        await db.preferences.update(currentPrefs.id, {
          ...preferencesData,
          updatedAt: new Date()
        });
      } else {
        // Si aucune préférence n'existe, les créer (cas très rare)
        console.log('Aucune préférence existante, création de nouvelles préférences...');
        
        // Utiliser les valeurs par défaut
        const defaultPreferences = {
          defaultCurrency: 'EUR',
          theme: 'light',
          dateFormat: 'dd/MM/yyyy',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...preferencesData
        };
        
        // Créer de nouvelles préférences
        const prefsDB = await initDB();
        await prefsDB.add('userPreferences', defaultPreferences);
      }
    }
    
    // Si demandé, mettre à jour explicitement l'UI en invalidant le cache
    if (updateUI) {
      // On utilise import dynamique pour éviter les références circulaires
      try {
        const { queryClient } = await import('@/lib/queryConfig');
        if (queryClient) {
          console.log('Invalidation des requêtes après importation...');
          
          // Utiliser resetQueries qui est plus efficace que invalidateQueries
          // pour forcer un remontage complet des composants
          queryClient.resetQueries({ queryKey: ['accounts'] });
          queryClient.resetQueries({ queryKey: ['transactions'] });
          queryClient.resetQueries({ queryKey: ['recurringTransactions'] });
          queryClient.resetQueries({ queryKey: ['balanceAdjustments'] }); 
          queryClient.resetQueries({ queryKey: ['forecastBalance'] });
          queryClient.resetQueries({ queryKey: ['historicalBalances'] });
          queryClient.resetQueries({ queryKey: ['statistics'] });
          
          console.log('Invalidation des requêtes terminée');
        }
      } catch (e) {
        console.error('Erreur lors de la mise à jour de l\'UI:', e);
      }
    }
    
    return true;
  } catch (error) {
    console.error("Erreur lors de l'importation des données:", error);
    return false;
  }
}

// Supprimer toutes les données de l'application
export async function clearAllData(): Promise<void> {
  const db = await initDB();
  
  // Supprimer toutes les transactions
  const transactions = await db.getAll('transactions');
  for (const transaction of transactions) {
    await db.delete('transactions', transaction.id!);
  }
  
  // Supprimer toutes les transactions récurrentes
  const recurringTransactions = await db.getAll('recurringTransactions');
  for (const transaction of recurringTransactions) {
    await db.delete('recurringTransactions', transaction.id!);
  }
  
  // Supprimer tous les comptes
  const accounts = await db.getAll('accounts');
  for (const account of accounts) {
    await db.delete('accounts', account.id!);
  }
  
  // Réinitialiser les préférences
  // Note: On ne supprime pas les préférences, on les réinitialise
  const preferences = await db.getAll('userPreferences');
  if (preferences.length > 0) {
    const pref = preferences[0];
    await db.put('userPreferences', {
      ...pref,
      updatedAt: new Date()
    });
  }
}

// Réinitialiser complètement l'application (local + serveur)
export async function resetAllData(username: string, password: string): Promise<boolean> {
  try {
    // 0. Vérifier d'abord que le mot de passe est correct avant d'effectuer toute opération
    const { fileStorage } = await import('@/lib/fileStorageAdapter');
    
    if (username && password) {
      // Vérifier d'abord que les identifiants sont valides en tentant une connexion
      const isValidCredentials = await fileStorage.login(username, password);
      
      if (!isValidCredentials) {
        console.error('Mot de passe incorrect pour la réinitialisation des données');
        return false; // Arrêter la réinitialisation si le mot de passe est incorrect
      }
      
      // 1. Effacer les données locales seulement si les identifiants sont valides
      await clearAllData();
      
      // Créer des données vides
      const emptyData = {
        accounts: [],
        transactions: [],
        recurringTransactions: [],
        preferences: await db.preferences.get(),
        lastSyncTime: new Date()
      };
      
      // Envoyer les données vides au serveur
      await fileStorage.saveUserData(emptyData);
      console.log('Données serveur effacées avec succès');
      
      return true;
    } else {
      console.error('Nom d\'utilisateur ou mot de passe manquant');
      return false;
    }
  } catch (error) {
    console.error("Erreur lors de la réinitialisation complète:", error);
    return false;
  }
}

// Nettoyer les anciennes opérations (supprimer les transactions antérieures à une date)
export async function cleanOldTransactions(monthsToKeep: number): Promise<number> {
  try {
    await initDB();
    
    // Calculer la date limite
    const limitDate = new Date();
    limitDate.setMonth(limitDate.getMonth() - monthsToKeep);
    limitDate.setHours(0, 0, 0, 0);
    
    // Récupérer toutes les transactions
    const allTransactions = await db.transactions.getAll();
    
    // Filtrer les transactions antérieures à la date limite
    const oldTransactions = allTransactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      return transactionDate < limitDate;
    });
    
    // Supprimer les transactions
    for (const transaction of oldTransactions) {
      await db.transactions.delete(transaction.id!);
    }
    
    return oldTransactions.length;
  } catch (error) {
    console.error("Erreur lors du nettoyage des anciennes transactions:", error);
    return 0;
  }
}

// Télécharger un fichier
export function downloadFile(content: string, filename: string, contentType: string): void {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  
  URL.revokeObjectURL(url);
}
