import { QueryClient } from '@tanstack/react-query';
import db from './db';
import { migrateBalanceAdjustments } from './repairDB';

/**
 * Force la récupération des ajustements de solde depuis les données serveur
 * @param serverData Les données récupérées du serveur
 */
export async function syncBalanceAdjustments(serverData: any): Promise<void> {
  if (!serverData || !serverData.balanceAdjustments || !Array.isArray(serverData.balanceAdjustments)) {
    console.log('Aucun ajustement de solde à synchroniser');
    return;
  }

  console.log(`Synchronisation de ${serverData.balanceAdjustments.length} ajustements de solde...`);

  try {
    // Essayer d'utiliser l'API normale d'abord
    try {
      // Supprimer d'abord tous les ajustements existants pour éviter les doublons
      const allAccounts = await db.accounts.getAll();
      
      for (const account of allAccounts) {
        if (account.id) {
          const adjustments = await db.balanceAdjustments.getAllByAccount(account.id);
          
          for (const adjustment of adjustments) {
            if (adjustment && adjustment.id) {
              await db.balanceAdjustments.deleteAdjustment(adjustment.accountId, adjustment.yearMonth);
              console.log(`Suppression de l'ajustement existant pour ${adjustment.yearMonth}, compte ${adjustment.accountId}`);
            }
          }
        }
      }

      // Recréer les ajustements à partir des données du serveur
      for (const adjustment of serverData.balanceAdjustments) {
        await db.balanceAdjustments.setAdjustment({
          accountId: adjustment.accountId,
          yearMonth: adjustment.yearMonth,
          adjustedBalance: adjustment.adjustedBalance,
          note: adjustment.note || ''
        });
        console.log(`Ajustement de solde importé pour ${adjustment.yearMonth}, compte ${adjustment.accountId}`);
      }
    } catch (error) {
      // En cas d'erreur, utiliser la méthode de migration de secours
      console.error('Erreur lors de la synchronisation des ajustements de solde via l\'API normale:', error);
      console.log('Tentative de migration des ajustements de solde via la méthode de secours...');
      await migrateBalanceAdjustments(serverData);
    }
  } catch (error) {
    console.error('Erreur lors de la synchronisation des ajustements de solde:', error);
  }
}

/**
 * Invalide toutes les requêtes React Query pour forcer le recalcul des données
 * @param queryClient Instance de QueryClient React Query
 * @param forceReload Si true, force un rechargement de la page après l'invalidation
 */
export function invalidateAllQueries(queryClient: QueryClient, forceReload: boolean = false): void {
  try {
    console.log('Invalidation des requêtes après synchronisation...');
    
    // Invalider TOUTES les requêtes sans spécifier de clé pour être sûr que tout est recalculé
    queryClient.invalidateQueries();
    
    // En plus de l'invalidation générale, on va forcer le rechargement des données importantes
    // avec resetQueries qui est plus agressif que invalidateQueries
    queryClient.resetQueries({ queryKey: ['accounts'] });
    queryClient.resetQueries({ queryKey: ['transactions'] });
    queryClient.resetQueries({ queryKey: ['recurringTransactions'] });
    queryClient.resetQueries({ queryKey: ['historicalBalances'] });
    queryClient.resetQueries({ queryKey: ['statisticsData'] });
    queryClient.resetQueries({ queryKey: ['balanceAdjustments'] });
    queryClient.resetQueries({ queryKey: ['forecastBalance'] });
    queryClient.resetQueries({ queryKey: ['monthlyTransactions'] });
    queryClient.resetQueries({ queryKey: ['allTransactions'] });
    
    // Puis déclencher un prefetching pour précharger les données importantes
    setTimeout(() => {
      queryClient.prefetchQuery({ queryKey: ['accounts'] });
      queryClient.prefetchQuery({ queryKey: ['transactions'] });
      queryClient.prefetchQuery({ queryKey: ['recurringTransactions'] });
      queryClient.prefetchQuery({ queryKey: ['historicalBalances'] });
      queryClient.prefetchQuery({ queryKey: ['statisticsData'] });
      queryClient.prefetchQuery({ queryKey: ['balanceAdjustments'] });
      queryClient.prefetchQuery({ queryKey: ['forecastBalance'] });
      queryClient.prefetchQuery({ queryKey: ['monthlyTransactions'] });
      queryClient.prefetchQuery({ queryKey: ['allTransactions'] });
    }, 500);
    
    // Forcer un rechargement de la page si demandé
    if (forceReload) {
      console.log('Rechargement de l\'application après synchronisation forcée...');
      setTimeout(() => {
        window.location.reload();
      }, 1000); // Délai de 1 seconde pour permettre l'affichage des notifications
    }
  } catch (error) {
    console.error('Erreur lors de l\'invalidation des requêtes:', error);
  }
}
