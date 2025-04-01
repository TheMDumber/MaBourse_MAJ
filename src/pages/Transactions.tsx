import { useState, useEffect, useCallback } from 'react';
import { useAccountFilter } from '@/contexts/AccountFilterContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { TransactionsList } from '@/components/transactions/TransactionsList';
import { RecurringTransactionsList } from '@/components/transactions/RecurringTransactionsList';
import { CategoryStats } from '@/components/transactions/CategoryStats';
import { TransactionType } from '@/lib/types';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import db from '@/lib/db';

const Transactions = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<TransactionType>(TransactionType.EXPENSE);
  const { selectedAccount, setSelectedAccount } = useAccountFilter();
  
  // Utiliser localStorage pour persister le mois sélectionné
  const getInitialMonth = (): string => {
    const savedMonth = localStorage.getItem('selectedMonth');
    return savedMonth || format(new Date(), "yyyy-MM");
  };
  
  const [currentMonth, setCurrentMonth] = useState<string>(getInitialMonth());
  const [onMonthChangeCallback, setOnMonthChangeCallback] = useState<((month: string) => void) | null>(null);
  const queryClient = useQueryClient();
  
  // Fonction pour rafraîchir les données après une modification
  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['recurringTransactions'] });
    // Rafraîchir également le solde prévisionnel
    queryClient.invalidateQueries({ queryKey: ['forecastBalance'] });
  };

  // Initialiser la fonction de changement de mois
  useEffect(() => {
    const handleMonthChange = (month: string) => {
      console.log('Mois changé dans Transactions.tsx:', month);
      
      // Sauvegarder le mois dans localStorage pour persistance
      localStorage.setItem('selectedMonth', month);
      
      setCurrentMonth(month);
      
      // Rafraîchir le solde prévisionnel lorsque le mois change
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['forecastBalance'] });
      }, 100);
    };
    
    setOnMonthChangeCallback(() => handleMonthChange);
    
    // Écouter les changements de mode mois financier
    const handleFinancialMonthToggle = (e: StorageEvent) => {
      if (e.key === 'financialMonthModeToggled') {
        console.log('Transactions.tsx - Basculement du mode mois financier détecté');
        // La mise à jour du mois sera gérée par le composant TransactionsList
      }
    };
    
    window.addEventListener('storage', handleFinancialMonthToggle);
    
    return () => {
      window.removeEventListener('storage', handleFinancialMonthToggle);
    };
  }, [queryClient]);
  
  // Effect pour mettre à jour le titre de la page avec le compte sélectionné
  useEffect(() => {
    const updatePageTitle = async () => {
      if (selectedAccount !== "all") {
        try {
          const account = await db.accounts.getById(selectedAccount as number);
          if (account) {
            document.title = `Transactions - ${account.name} | Budget App`;
          }
        } catch (error) {
          console.error("Erreur lors de la récupération du compte:", error);
        }
      } else {
        document.title = "Transactions | Budget App";
      }
    };
    
    updatePageTitle();
  }, [selectedAccount]);

  // Effet pour vérifier que les données essentielles sont bien disponibles
  useEffect(() => {
    // Récupérer le premier mois sélectionnable depuis localStorage (stocké lors du chargement des données utilisateur)
    const minSelectableMonth = localStorage.getItem('minSelectableMonth') || localStorage.getItem('accountCreationMonth');
    console.log('Page des transactions - Premier mois sélectionnable disponible:', minSelectableMonth);
    
    // Exposer le premier mois sélectionnable comme variable globale pour d'éventuels scripts externes
    if (minSelectableMonth) {
      // @ts-ignore
      window.minSelectableMonth = minSelectableMonth;
      window.accountCreationMonth = minSelectableMonth; // Pour compatibilité
      
      // Ajouter également comme attribut data sur le body pour les scripts qui utilisent cette méthode
      document.body.setAttribute('data-min-selectable-month', minSelectableMonth);
      document.body.setAttribute('data-creation-month', minSelectableMonth); // Pour compatibilité
    }
    
    // Au lieu d'utiliser un script injecté, nous allons configurer le sélecteur directement
    // Cette approche est plus fiable et évite les problèmes de syntaxe
    
    const configureMonthPicker = () => {
      const monthPicker = document.getElementById('month-picker') as HTMLInputElement;
      if (!monthPicker) {
        console.error("L'élément #month-picker n'a pas été trouvé.");
        return;
      }
      
      // Utiliser mars 2025 comme valeur par défaut si aucune autre n'est disponible
      const minMonth = minSelectableMonth || "2025-03";
      
      // Définir l'attribut 'min'
      monthPicker.setAttribute('min', minMonth);
      monthPicker.min = minMonth;
      
      // Ajouter un style visuel
      monthPicker.style.backgroundColor = "#f8f9fa";
      monthPicker.style.border = "2px solid #007bff";
      
      console.log('Date minimale de sélection définie sur :', minMonth);
      
      // Valider au changement
      monthPicker.addEventListener('change', function() {
        if (this.value && this.value < minMonth) {
          console.warn('Tentative de sélection d\'un mois non autorisé:', this.value);
          this.value = minMonth; // Forcer à revenir au minimum autorisé
        }
      });
    };
    
    // Exécuter la configuration immédiatement puis après un délai
    setTimeout(configureMonthPicker, 100);
    setTimeout(configureMonthPicker, 500);
    
    // Lorsque le DOM est chargé
    document.addEventListener('DOMContentLoaded', configureMonthPicker);
    
    // Nettoyer les gestionnaires d'événements quand le composant est démonté
    return () => {
      document.removeEventListener('DOMContentLoaded', configureMonthPicker);
    };
  }, []);

  const handleAddTransaction = () => {
    setTransactionType(TransactionType.EXPENSE);
    setIsFormOpen(true);
  };

  const handleAddIncome = () => {
    setTransactionType(TransactionType.INCOME);
    setIsFormOpen(true);
  };

  const handleAddExpense = () => {
    setTransactionType(TransactionType.EXPENSE);
    setIsFormOpen(true);
  };

  const handleAddTransfer = () => {
    setTransactionType(TransactionType.TRANSFER);
    setIsFormOpen(true);
  };

  // Memoize setSelectedAccount pour éviter trop de re-rendus
  const memoizedSetSelectedAccount = useCallback((value: number | "all") => {
    if (value !== selectedAccount) {
      setSelectedAccount(value);
    }
  }, [selectedAccount, setSelectedAccount]);

  return (
    <MainLayout accountFilter={selectedAccount} selectedMonth={currentMonth}>
      <div className="space-y-6">
        <TransactionsList 
          onAddTransaction={handleAddTransaction}
          onAddIncome={handleAddIncome}
          onAddExpense={handleAddExpense}
          onAddTransfer={handleAddTransfer}
          onAccountFilterChange={memoizedSetSelectedAccount}
          onTransactionUpdated={refreshData}
          onMonthChange={onMonthChangeCallback}
          initialAccountFilter={selectedAccount} // Passer la valeur du contexte en tant que prop
          key={`transactions-list-${selectedAccount}`} // Forcer un nouveau montage quand le compte change
        />
        
        <RecurringTransactionsList accountId={selectedAccount !== "all" ? selectedAccount as number : undefined} />
        
        <CategoryStats accountFilter={selectedAccount} />
      </div>

      <TransactionForm
        open={isFormOpen}
        defaultType={transactionType}
        onClose={() => setIsFormOpen(false)}
        onSuccess={refreshData}
      />
    </MainLayout>
  );
};

export default Transactions;
