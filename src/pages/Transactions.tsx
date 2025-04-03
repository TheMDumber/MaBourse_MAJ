import { useState, useEffect, useCallback } from 'react';
import { getCachedBalance } from '../../cache';
import { useAccountFilter } from '@/contexts/AccountFilterContext';
import { calculate_monthly_balances } from '../../functions/balance_calculator';
import { useQuery } from '@tanstack/react-query';
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
  
  // Requête pour récupérer le solde du journal
  const { data: journalBalanceData, isLoading: isLoadingJournalBalance } = useQuery({
    queryKey: ['journalBalance', currentMonth, selectedAccount],
    queryFn: async () => {
      try {
        // Récupérer le solde initial ou ajusté à partir du journal comptable
        const accountId = selectedAccount !== "all" ? selectedAccount as number : undefined;
        
        // Utiliser la méthode du service qui priorise le solde ajusté puis prévu
        const { accountingJournalService } = await import('@/lib/accountingJournalService');
        return await accountingJournalService.getCurrentMonthBalance(currentMonth, accountId);
      } catch (error) {
        console.error('Erreur lors de la récupération du solde du journal:', error);
        return { amount: 0, source: 'erreur' };
      }
    },
    staleTime: 1 * 60 * 1000 // 1 minute (pour être plus réactif)
  });
  
  // Extraire les valeurs pour faciliter l'utilisation
  const journalBalance = journalBalanceData?.amount;
  const balanceSource = journalBalanceData?.source;
  
  // Fonction pour rafraîchir les données après une modification
  const refreshData = () => {
    // Rafraîchir les transactions et les soldes
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['recurringTransactions'] });
    queryClient.invalidateQueries({ queryKey: ['forecastBalance'] });
    queryClient.invalidateQueries({ queryKey: ['journalBalance'] });
    // Rafraîchir également le journal comptable car il est impliqué dans le calcul du solde prévu
    queryClient.invalidateQueries({ queryKey: ['accountingJournal'] });

    // --- Bloc d'appel pour le calcul de solde avec vraies données ---
    console.log("[Debug] Preparing to call calculate_monthly_balances with actual data");
    
    // Récupérer toutes les transactions
    db.transactions.getAll().then(transactions => {
      // Formater les transactions pour qu'elles correspondent à la structure attendue
      const formattedTransactions = transactions.map(tx => ({
        date: new Date(tx.date),
        amount: tx.amount,
        type: tx.type,
        accountId: tx.accountId,
        toAccountId: tx.toAccountId
      }));
      
      // Récupérer la date de création du compte depuis localStorage
      const accountCreationMonth = localStorage.getItem('minSelectableMonth') || localStorage.getItem('accountCreationMonth');
      const accountCreationDate = accountCreationMonth 
        ? new Date(`${accountCreationMonth}-01T00:00:00`) 
        : new Date('2020-01-01'); // Date par défaut si non disponible
      
      // Récupérer les préférences utilisateur pour le mode mois et le jour financier
      db.preferences.get().then(prefs => {
        const monthMode = prefs.useFinancialMonth ? 'financial' : 'calendar';
        const financialDay = prefs.financialMonthStartDay || 1;
        
        // Récupérer le solde initial du compte si un compte spécifique est sélectionné
        let initialBalance = 0;
        
        const getInitialBalance = async () => {
          if (selectedAccount !== "all") {
            try {
              const account = await db.accounts.getById(selectedAccount as number);
              if (account) {
                initialBalance = account.initialBalance;
              }
            } catch (error) {
              console.error("Erreur lors de la récupération du compte:", error);
            }
          } else {
            // Pour tous les comptes, cumuler les soldes initiaux
            const accounts = await db.accounts.getAll();
            initialBalance = accounts.reduce((sum, acc) => sum + acc.initialBalance, 0);
          }
          
          // Définir la date de fin comme un an après aujourd'hui
          const endDate = new Date();
          endDate.setFullYear(endDate.getFullYear() + 1);
          
          console.log(`Calling calculate_monthly_balances with real data:
            - Transactions: ${formattedTransactions.length} transactions
            - Account Creation: ${accountCreationDate.toISOString()}
            - Initial Balance: ${initialBalance}
            - Month Mode: ${monthMode}
            - Financial Day: ${financialDay}
            - End Date: ${endDate.toISOString()}
            - Selected Account: ${selectedAccount}
          `);
          
          // Appel à la fonction avec les vraies données
          const calculatedBalances = calculate_monthly_balances(
            formattedTransactions,
            accountCreationDate,
            initialBalance,
            monthMode as 'calendar' | 'financial',
            financialDay,
            endDate,
            selectedAccount !== "all" ? selectedAccount as number : undefined
          );
          
          console.log("[Debug] Calculated balances:", calculatedBalances);
          
          // Utiliser les résultats pour afficher le solde du mois sélectionné
          const currentMonthBalance = calculatedBalances[currentMonth];
          if (currentMonthBalance !== undefined) {
            console.log(`Solde calculé pour ${currentMonth}: ${currentMonthBalance}`);
            // TODO: Afficher ce solde dans l'interface
            // localStorage.setItem('cachedBalance_' + currentMonth, currentMonthBalance.toString());
          } else {
            console.log(`Aucun solde calculé pour ${currentMonth}`);
          }
        };
        
        getInitialBalance();
      }).catch(error => {
        console.error("Erreur lors de la récupération des préférences:", error);
      });
    }).catch(error => {
      console.error("Erreur lors de la récupération des transactions:", error);
    });
    // --- Fin du bloc d'appel ---
  };

  // Initialiser la fonction de changement de mois
  useEffect(() => {
    const handleMonthChange = (month: string) => {
      console.log('Mois changé dans Transactions.tsx:', month);
      
      // Sauvegarder le mois dans localStorage pour persistance
      localStorage.setItem('selectedMonth', month);
      
      setCurrentMonth(month);
      
      // Rafraîchir immédiatement les soldes lorsque le mois change
      queryClient.invalidateQueries({ queryKey: ['journalBalance'] });
      queryClient.invalidateQueries({ queryKey: ['forecastBalance'] });
      
      // Pour s'assurer que le journal est bien généré pour ce mois
      setTimeout(async () => {
        try {
          const accountId = selectedAccount !== "all" ? selectedAccount as number : undefined;
          
          // Vérifier si le journal contient des entrées pour ce mois
          const entries = await db.accountingJournal.getByMonth(month);
          
          // Si le journal est vide pour ce mois, proposer de le générer
          if (entries.length === 0) {
            console.log(`Aucune entrée de journal trouvée pour ${month}, proposition de génération`);
            if (confirm(`Aucune entrée de journal n'existe pour ${month}. Voulez-vous générer le journal pour ce mois?`)) {
              try {
                const { accountingJournalService } = await import('@/lib/accountingJournalService');
                await accountingJournalService.generateJournalForMonth(month);
                
                // Rafraîchir toutes les données qui dépendent du journal
                queryClient.invalidateQueries({ queryKey: ['journalBalance'] });
                queryClient.invalidateQueries({ queryKey: ['forecastBalance'] });
                queryClient.invalidateQueries({ queryKey: ['accountingJournal'] });
                
                alert(`Journal généré avec succès pour ${month}`);
              } catch (error) {
                console.error('Erreur lors de la génération du journal:', error);
                alert('Erreur lors de la génération du journal');
              }
            }
          }
        } catch (error) {
          console.error('Erreur lors de la vérification du journal:', error);
        }
      }, 500);
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
      // @ts-ignore
      window['accountCreationMonth'] = minSelectableMonth; // Pour compatibilité
      
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
    <MainLayout 
      accountFilter={selectedAccount} 
      selectedMonth={currentMonth}
      // Passer les données du solde au MainLayout pour affichage correct
      journalBalance={journalBalance}
      balanceSource={balanceSource}
    >
      <h1 className="text-2xl font-bold mb-4">
        <span>Transactions</span>
      </h1>
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
