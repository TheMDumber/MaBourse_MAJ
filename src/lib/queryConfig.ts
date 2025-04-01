import { QueryClient, DefaultOptions } from '@tanstack/react-query';
import { createQueryErrorHandler } from '@/hooks/useErrorHandler';

/**
 * Configuration par défaut pour React Query
 * Ces paramètres améliorent la performance en réduisant les requêtes inutiles
 */
export const queryConfig: DefaultOptions = {
  queries: {
    // Configuration générale
    staleTime: 5 * 60 * 1000, // 5 minutes - Considérer les données comme "stale" (périmées) après ce délai
    cacheTime: 60 * 60 * 1000, // 1 heure - Durée de conservation des données en cache après devenir inactives
    retry: 2, // Nombre de tentatives en cas d'erreur
    refetchOnWindowFocus: false, // Ne pas rafraîchir automatiquement quand la fenêtre reprend le focus
    refetchOnMount: 'stale', // Rafraîchir seulement si les données sont périmées lors du montage du composant
    
    // Utiliser le gestionnaire d'erreurs centralisé
    onError: createQueryErrorHandler({
      showToast: true,
      logToConsole: true
    }),
  },
  
  mutations: {
    // Configuration des mutations (opérations d'écriture)
    retry: 1, // Une seule tentative supplémentaire en cas d'échec
    onError: createQueryErrorHandler({
      showToast: true,
      logToConsole: true,
      severity: 'error'
    }),
  }
};

/**
 * Configuration spécifique pour les requêtes fréquentes ou en temps réel
 */
export const realtimeQueryConfig: DefaultOptions = {
  queries: {
    ...queryConfig.queries,
    staleTime: 1000, // 1 seconde - Données considérées comme périmées plus rapidement
    refetchInterval: 30 * 1000, // 30 secondes - Rafraîchissement périodique
    refetchOnWindowFocus: true, // Rafraîchir quand la fenêtre reprend le focus
  }
};

/**
 * Configuration pour les données qui changent rarement
 */
export const staticQueryConfig: DefaultOptions = {
  queries: {
    ...queryConfig.queries,
    staleTime: 24 * 60 * 60 * 1000, // 24 heures
    cacheTime: 30 * 24 * 60 * 60 * 1000, // 30 jours
    refetchOnMount: false, // Ne pas rafraîchir au montage
    refetchOnWindowFocus: false, // Ne pas rafraîchir quand la fenêtre reprend le focus
  }
};

/**
 * Configuration pour les données sensibles aux performances comme les listes longues
 */
export const performanceQueryConfig: DefaultOptions = {
  queries: {
    ...queryConfig.queries,
    keepPreviousData: true, // Garder les données précédentes pendant le chargement des nouvelles (utile pour la pagination)
    staleTime: 2 * 60 * 1000, // 2 minutes
  }
};

/**
 * Création d'un client React Query avec la configuration optimisée par défaut
 */
export const createOptimizedQueryClient = (): QueryClient => {
  return new QueryClient({
    defaultOptions: queryConfig
  });
};

/**
 * Instance globale du client React Query pour les mises à jour en dehors des composants React
 */
export const queryClient = new QueryClient({
  defaultOptions: queryConfig
});

/**
 * Clés de requête pour organiser le cache
 * Utiliser ces clés pour assurer la cohérence des invalidations
 */
export const queryKeys = {
  accounts: {
    all: ['accounts'] as const,
    byId: (id: number) => ['accounts', id] as const,
    balance: (id?: number) => ['accounts', 'balance', id] as const,
  },
  transactions: {
    all: ['transactions'] as const,
    paginated: (page: number, pageSize: number) => ['transactions', 'paginated', page, pageSize] as const,
    byAccount: (accountId: number) => ['transactions', 'account', accountId] as const,
    byDateRange: (startDate: Date, endDate: Date) => 
      ['transactions', 'dateRange', startDate.toISOString(), endDate.toISOString()] as const,
    byId: (id: number) => ['transactions', id] as const,
  },
  recurringTransactions: {
    all: ['recurringTransactions'] as const,
    byAccount: (accountId: number) => ['recurringTransactions', 'account', accountId] as const,
    byId: (id: number) => ['recurringTransactions', id] as const,
  },
  statistics: {
    balance: {
      history: (accountId?: number) => ['statistics', 'balance', 'history', accountId] as const,
      forecast: (accountId?: number, months?: number) => ['statistics', 'balance', 'forecast', accountId, months] as const,
    },
    categories: {
      expenses: (startDate: Date, endDate: Date) => 
        ['statistics', 'categories', 'expenses', startDate.toISOString(), endDate.toISOString()] as const,
      income: (startDate: Date, endDate: Date) => 
        ['statistics', 'categories', 'income', startDate.toISOString(), endDate.toISOString()] as const,
    },
    monthly: {
      summary: (year: number) => ['statistics', 'monthly', 'summary', year] as const,
    }
  },
  preferences: {
    all: ['preferences'] as const
  },
  balanceAdjustments: {
    byAccount: (accountId: number) => ['balanceAdjustments', 'account', accountId] as const,
    byAccountAndMonth: (accountId: number, yearMonth: string) => 
      ['balanceAdjustments', 'account', accountId, yearMonth] as const,
  }
};
