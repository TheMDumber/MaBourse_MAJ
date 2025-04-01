import React, { createContext, useState, useContext, useCallback, ReactNode, useMemo } from 'react';

type AccountFilterContextType = {
  selectedAccount: number | "all";
  setSelectedAccount: (accountId: number | "all") => void;
};

const AccountFilterContext = createContext<AccountFilterContextType | undefined>(undefined);

export function AccountFilterProvider({ children }: { children: ReactNode }) {
  const [selectedAccount, setSelectedAccount] = useState<number | "all">("all");

  // Version optimisée qui évite les rendus inutiles
  const handleSetSelectedAccount = useCallback((accountId: number | "all") => {
    setSelectedAccount(prevAccount => {
      // Éviter les mises à jour si la valeur ne change pas réellement
      if (prevAccount === accountId) return prevAccount;
      return accountId;
    });
  }, []);

  // Mémoriser la valeur du contexte pour éviter les rendus inutiles des enfants
  const contextValue = useMemo(() => ({
    selectedAccount,
    setSelectedAccount: handleSetSelectedAccount,
  }), [selectedAccount, handleSetSelectedAccount]);

  return (
    <AccountFilterContext.Provider value={contextValue}>
      {children}
    </AccountFilterContext.Provider>
  );
}

export function useAccountFilter() {
  const context = useContext(AccountFilterContext);
  if (context === undefined) {
    throw new Error('useAccountFilter must be used within an AccountFilterProvider');
  }
  return context;
}
