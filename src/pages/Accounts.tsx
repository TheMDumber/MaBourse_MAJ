
import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { AccountsList } from '@/components/accounts/AccountsList';
import { useQueryClient } from '@tanstack/react-query';

const Accounts = () => {
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const monthParam = params.get('month');
    if (monthParam) return monthParam;
    
    // Par défaut, utiliser le mois actuel
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  // Écouter les changements de mois financier
  useEffect(() => {
    const handleFinancialMonthChange = (event: CustomEvent) => {
      console.log('Comptes: Changement de mois financier détecté', event.detail);
      setCurrentMonth(event.detail.month);
    };
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'financialMonthModeToggled') {
        console.log('Comptes: Basculement du mode mois financier détecté');
        
        // La mise à jour du mois sera gérée par le MainLayout
        queryClient.invalidateQueries();
        
        // Récupérer le mois depuis l'URL
        const params = new URLSearchParams(window.location.search);
        const monthParam = params.get('month');
        if (monthParam) {
          setCurrentMonth(monthParam);
        }
      }
    };
    
    window.addEventListener('financialMonthChange', handleFinancialMonthChange as EventListener);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('financialMonthChange', handleFinancialMonthChange as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [queryClient]);

  // La vue "Tous les comptes" avec le bandeau d'information masqué
  return (
    <MainLayout selectedMonth={currentMonth} hideHeader={true}>
      <AccountsList />
    </MainLayout>
  );
};

export default Accounts;
