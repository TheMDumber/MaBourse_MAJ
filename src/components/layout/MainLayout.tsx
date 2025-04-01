import { useState, useEffect, ReactNode } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomNavigation } from './BottomNavigation';
import db, { initDB } from '@/lib/db'; // Ajout de l'import correct de db
import { AppTips } from '@/components/tips/AppTips';
import { useLocation } from 'react-router-dom';
import { useDeviceContext } from '@/contexts/DeviceContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TransactionType } from '@/lib/types';

interface MainLayoutProps {
  children: ReactNode;
  accountFilter?: number | "all";
  selectedMonth?: string; // Format YYYY-MM
  hideHeader?: boolean; // Nouvelle prop pour masquer le bandeau d'information
}

export const MainLayout = ({ children, accountFilter = "all", selectedMonth, hideHeader = false }: MainLayoutProps) => {
  const { theme, changeTheme, isLoading: themeLoading } = useTheme();
  const [dbInitialized, setDbInitialized] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const { isMobile } = useDeviceContext();
  const [monthlyIncomes, setMonthlyIncomes] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [projectedBalance, setProjectedBalance] = useState(0);

  const location = useLocation();
  const queryClient = useQueryClient(); // Obtenir l'instance de queryClient

  // Initialisation de la base de données
  useEffect(() => {
    const initialize = async () => {
      try {
        await initDB();
        setDbInitialized(true);
      } catch (error) {
        console.error('Erreur lors de l\'initialisation de la base de données:', error);
      }
    };

    initialize();

    // Fermer la navigation mobile quand on change de page
    return () => {
      setIsMobileNavOpen(false);
    };
  }, []);
  
  // Récupérer les données financières pour l'affichage mobile
  const { data: transactions } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      try {
        // S'assurer que db est bien initialisé avant de l'utiliser
        if (!dbInitialized) {
          await initDB(); // Initialiser explicitement si nécessaire
        }
        return await db.transactions.getAll();
      } catch (error) {
        console.error('Erreur lors de la récupération des transactions:', error);
        return [];
      }
    },
    enabled: dbInitialized, // Exécuter la requête uniquement si la base de données est initialisée
    staleTime: 1000 * 60 * 5, // 5 minutes
    cacheTime: 1000 * 60 * 30, // 30 minutes
  });
  
  // Utiliser les mois financiers si activés
  const { data: financialMonthsEnabled } = useQuery({
    queryKey: ['isFinancialMonthEnabled'],
    queryFn: async () => {
      // Importer dynamiquement pour éviter les références circulaires
      const { isFinancialMonthEnabled } = await import('@/lib/financialMonthUtils');
      return isFinancialMonthEnabled();
    },
    staleTime: 0, // Ne pas mettre en cache cette valeur pour que les changements soient immédiatement reflétés
  });
  
  // Récupérer les dates du mois financier si activé
  const { data: financialDates } = useQuery({
    queryKey: ['financialDates', selectedMonth, financialMonthsEnabled],
    queryFn: async () => {
      if (!financialMonthsEnabled) return null;
      
      const yearMonth = selectedMonth || format(new Date(), "yyyy-MM");
      const [year, month] = yearMonth.split('-').map(Number);
      const date = new Date(year, month - 1, 15); // Date médiane du mois
      
      const { getFinancialMonthRange } = await import('@/lib/financialMonthUtils');
      return getFinancialMonthRange(date);
    },
    enabled: !!financialMonthsEnabled,
    staleTime: 0, // Ne pas mettre en cache ce calcul
  });

  // Calculer le solde prévisionnel du compte ou de tous les comptes pour le mois sélectionné
  const { data: forecastData, refetch: refetchForecast } = useQuery({
    queryKey: ['forecastBalance', accountFilter, selectedMonth, financialMonthsEnabled, financialDates],
    queryFn: async () => {
      console.log('Calcul du solde prévisionnel pour:', accountFilter, selectedMonth);
      const yearMonth = selectedMonth || format(new Date(), "yyyy-MM");
      
      // S'assurer que db est bien initialisé avant de l'utiliser
      if (!dbInitialized) {
        await initDB(); // Initialiser explicitement si nécessaire
      }
      
      // Utiliser la fonction utilitaire de calcul du solde
      try {
        // Récupérer tous les comptes pour avoir les soldes initiaux
        const accounts = await db.accounts.getAll();
        
        // Obtenir les dates du mois financier si nécessaire
        let effectiveMonthData = {
          yearMonth: yearMonth,
          start: null as Date | null,
          end: null as Date | null
        };
        
        if (financialMonthsEnabled && financialDates) {
          console.log(`Utilisation du mois financier '${financialDates.name}' du ${format(financialDates.start, 'dd/MM/yyyy')} au ${format(financialDates.end, 'dd/MM/yyyy')}`);
          effectiveMonthData = {
            // Garder le yearMonth d'origine et passer uniquement les dates du mois financier
            yearMonth: yearMonth,
            start: financialDates.start,
            end: financialDates.end
          };
        }
        
        if (accountFilter === "all") {
          // Pour "Tous les comptes", nous devons calculer le solde en tenant compte des ajustements
          let totalBalance = 0;
          
          // Pour chaque compte, obtenir son solde prévisionnel (avec ajustements s'il y en a)
          for (const account of accounts) {
            if (!account.id) continue;
            
            const { getForecastBalance } = await import('@/lib/calculateBalance');
            const accountForecast = await getForecastBalance(
              account.id, 
              effectiveMonthData.yearMonth,
              financialMonthsEnabled ? {
                start: effectiveMonthData.start,
                end: effectiveMonthData.end
              } : undefined
            );
            totalBalance += accountForecast.balance;
          }
          
          // Récupérer également les revenus et dépenses globaux pour l'affichage
          const { getForecastBalance } = await import('@/lib/calculateBalance');
          const globalForecast = await getForecastBalance(
            "all", 
            effectiveMonthData.yearMonth,
            financialMonthsEnabled ? {
              start: effectiveMonthData.start,
              end: effectiveMonthData.end
            } : undefined
          );
          
          return { 
            balance: totalBalance, 
            income: globalForecast.income, 
            expense: globalForecast.expense 
          };
        } else {
          // Pour un compte spécifique, utiliser le calcul standard
          const { getForecastBalance } = await import('@/lib/calculateBalance');
          return getForecastBalance(
            accountFilter, 
            effectiveMonthData.yearMonth,
            financialMonthsEnabled ? {
              start: effectiveMonthData.start,
              end: effectiveMonthData.end
            } : undefined
          );
        }
      } catch (error) {
        console.error('Erreur lors du calcul du solde prévisionnel:', error);
        return { balance: 0, income: 0, expense: 0 };
      }
    },
    enabled: dbInitialized && (financialMonthsEnabled ? !!financialDates : true), // Exécuter la requête uniquement si la base de données est initialisée et les données financières sont disponibles
    staleTime: 0, // Pas de mise en cache pour ce calcul important
    cacheTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: true, // Recharger quand la fenêtre reprend le focus
    refetchOnMount: true, // Recharger à chaque montée du composant
  });
  
  // Mettre à jour le solde prévisionnel quand les données de prévision changent
  useEffect(() => {
    if (forecastData) {
      // Log pour déboguer le problème du solde prévisionnel
      console.log('Données prévisionnelles reçues:', {
        mode: financialMonthsEnabled ? 'Mois financier' : 'Mois calendaire',
        accountFilter,
        selectedMonth,
        balance: forecastData.balance,
        income: forecastData.income,
        expense: forecastData.expense,
        financialDates: financialDates ? {
          start: financialDates.start.toISOString().slice(0, 10),
          end: financialDates.end.toISOString().slice(0, 10),
          name: financialDates.name
        } : null
      });
      
      // Arrondir le montant à deux décimales pour éviter les fluctuations d'affichage
      const roundedBalance = Math.round(forecastData.balance * 100) / 100;
      setProjectedBalance(roundedBalance);
    } else {
      console.log('Aucune donnée prévisionnelle reçue, mode:', financialMonthsEnabled ? 'Mois financier' : 'Mois calendaire');
    }
  }, [forecastData, financialMonthsEnabled, financialDates, accountFilter, selectedMonth]);
  
  // Forcer la mise à jour du prévisionnel lors de changements significatifs
  useEffect(() => {
    console.log('Déclenchement de la mise à jour du solde prévisionnel');
    
    // Forcer une invalidation de la requête
    queryClient.invalidateQueries({ queryKey: ['forecastBalance'] });
    
    // Utiliser un id pour débuter le refreshForecast afin d'éviter les recalculs fréquents
    let refreshId: NodeJS.Timeout | null = null;
    
    if (selectedMonth || accountFilter) {
      // Délai court pour éviter les rafraîchissements simultanés
      refreshId = setTimeout(() => {
        refetchForecast();
        console.log('Solde prévisionnel recalculé');
      }, 100);
    }
    
    return () => {
      if (refreshId) clearTimeout(refreshId);
    };
  }, [selectedMonth, accountFilter, queryClient, refetchForecast]);
  
  // Ajouter un effet pour forcer le rafraîchissement après une synchronisation
  useEffect(() => {
    // S'abonner aux changements du localStorage pour détecter une synchronisation
    const handleStorageChange = (e: StorageEvent) => {
      // Vérifier si nous sommes déjà en train de synchroniser pour éviter les boucles
      if (e.key === 'lastSyncTime' && !localStorage.getItem('layoutRefreshing')) {
        console.log('Synchronisation détectée, rafraîchissement des données...');
        
        // Marquer que nous sommes en train de rafraîchir
        localStorage.setItem('layoutRefreshing', 'true');
        
        // Effectuer une seule requete de rafraîchissement
        refetchForecast().then(() => {
          // Après un délai, supprimer le marqueur
          setTimeout(() => {
            localStorage.removeItem('layoutRefreshing');
          }, 1000);
        });
      }
      
      // Détecter les changements de configuration du mois financier
      if (e.key === 'financialMonthChanged' || e.key === 'financialMonthStartDayChanged') {
        console.log('Changement détecté dans les paramètres du mois financier, mise à jour...');
        
        // Invalider les requêtes liées aux mois financiers
        queryClient.invalidateQueries({ queryKey: ['isFinancialMonthEnabled'] });
        queryClient.invalidateQueries({ queryKey: ['financialDates'] });
        queryClient.invalidateQueries({ queryKey: ['forecastBalance'] });
        
        // Forcer un rafraîchissement
        refetchForecast();
      }
      
      // Détecter le basculement en mode mois financier
      if (e.key === 'financialMonthModeToggled') {
        console.log('Basculement en mode mois financier détecté, vérification du mois actuel...');
        
        // Cette fonction sera appelée pour vérifier et ajuster le mois actuel
        const checkAndUpdateCurrentMonth = async () => {
          try {
            // Vérifier si le mode mois financier est activé
            const { isFinancialMonthEnabled, getFinancialMonthRange } = await import('@/lib/financialMonthUtils');
            const isEnabled = await isFinancialMonthEnabled();
            
            if (!isEnabled) return; // Ne rien faire si le mode n'est pas activé
            
            // Obtenir la date actuelle
            const today = new Date();
            
            // Obtenir le mois financier actuel basé sur la date du jour
            const currentFinancialMonth = await getFinancialMonthRange(today);
            
            // Extraire le mois et l'année du nom du mois financier
            // Le nom est au format "Mois AAAA" (ex: "Avril 2025")
            const [monthName, yearStr] = currentFinancialMonth.name.split(' ');
            
            // Convertir le nom du mois en numéro de mois (0-11)
            const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                               'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
            const monthIndex = monthNames.findIndex(m => 
              m.toLowerCase() === monthName.toLowerCase());
            
            if (monthIndex === -1 || !yearStr) {
              console.error('Format de nom de mois financier non reconnu:', currentFinancialMonth.name);
              return;
            }
            
            // Créer le format YYYY-MM pour le mois financier
            const year = parseInt(yearStr);
            const monthNum = monthIndex + 1; // Convertir de 0-11 à 1-12
            const financialMonthYearMonth = `${year}-${monthNum.toString().padStart(2, '0')}`;
            
            // Obtenir le mois calendaire actuel
            const currentCalendarYearMonth = format(today, 'yyyy-MM');
            
            console.log(`Mois financier actuel: ${financialMonthYearMonth}, mois calendaire: ${currentCalendarYearMonth}`);
            
            // Si le mois financier est différent du mois calendaire actuel,
            // alors mettre à jour l'URL, quelle que soit la page sur laquelle on se trouve
            if (financialMonthYearMonth !== currentCalendarYearMonth) {
              console.log(`Mise à jour de l'affichage pour montrer le mois financier: ${financialMonthYearMonth}`);
              
              // Éviter les rechargements multiples
              if (localStorage.getItem('preventFinancialMonthRedirect')) {
                console.log('Évitement d\'une redirection en boucle');
                return;
              }
              
              // Marqueur pour éviter les redirections multiples
              localStorage.setItem('preventFinancialMonthRedirect', 'true');
              
              // Construire la nouvelle URL avec le mois financier
              const url = new URL(window.location.href);
              const searchParams = new URLSearchParams(url.search);
              
              // Vérifier si nous avons déjà le bon mois dans l'URL
              if (searchParams.get('month') === financialMonthYearMonth) {
                console.log('Le mois financier est déjà défini dans l\'URL, pas besoin de redirection');
                
                // Nettoyer le marqueur après un court délai
                setTimeout(() => {
                  localStorage.removeItem('preventFinancialMonthRedirect');
                }, 2000);
                
                return;
              }
              
              searchParams.set('month', financialMonthYearMonth);
              url.search = searchParams.toString();
              
              console.log(`Redirection unique vers le mois financier: ${financialMonthYearMonth}`);
              
              // Naviguer vers la nouvelle URL sans rechargement
              window.history.pushState({}, '', url.toString());
              
              // Forcer la mise à jour des données sans recharger la page pour toutes les rubriques
              queryClient.invalidateQueries(); // Invalider toutes les requêtes pour rafraîchir l'application entière
              refetchForecast();
              
              // Émettre un événement personnalisé pour informer les autres composants du changement
              const financialMonthChangeEvent = new CustomEvent('financialMonthChange', {
                detail: { month: financialMonthYearMonth }
              });
              window.dispatchEvent(financialMonthChangeEvent);
              
              // Déclencher un événement "storage" simulé pour notifier les autres onglets/fenêtres
              localStorage.setItem('financialMonthChanged', Date.now().toString());
              
              // Nettoyer le marqueur après un certain délai
              setTimeout(() => {
                localStorage.removeItem('preventFinancialMonthRedirect');
              }, 2000);
            }
          } catch (error) {
            console.error('Erreur lors de la mise à jour du mois financier:', error);
          }
        };
        
        // Appeler la fonction avec un léger délai pour s'assurer que les autres changements sont appliqués
        setTimeout(checkAndUpdateCurrentMonth, 500);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Vérifier si nous avons un événement financialMonthModeToggled récent
    // qui pourrait avoir été manqué pendant l'initialisation
    const financialModeToggled = localStorage.getItem('financialMonthModeToggled');
    if (financialModeToggled) {
      const toggleTime = parseInt(financialModeToggled);
      const now = Date.now();
      // Si l'événement est récent (moins de 5 secondes)
      if (now - toggleTime < 5000) {
        // Simuler l'événement de stockage
        handleStorageChange({ key: 'financialMonthModeToggled' } as StorageEvent);
      }
    }
    
    // Forcer un rafraîchissement au premier montage également
    // mais seulement si ce n'est pas déjà fait
    if (!localStorage.getItem('layoutRefreshing')) {
      setTimeout(() => {
        refetchForecast();
      }, 1000);
    }
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [refetchForecast, queryClient, selectedMonth]);
  
  // Pour éviter que la synchronisation ne déclenche un recalcul du prévisionnel
  // seulement après une action explicite de l'utilisateur
  const [lastUserInteraction, setLastUserInteraction] = useState(Date.now());
  
  useEffect(() => {
    // Gérer les événements utilisateur pour savoir quand recalculer
    const handleUserInteraction = () => {
      // Mettre à jour le timestamp de dernière interaction
      setLastUserInteraction(Date.now());
    };
    
    window.addEventListener('click', handleUserInteraction);
    window.addEventListener('keydown', handleUserInteraction);
    window.addEventListener('touchstart', handleUserInteraction);
    
    return () => {
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);
  
  // Récupérer les données des revenus et dépenses pour la carte de solde
  useEffect(() => {
    if (transactions) {
      // Filtrer les transactions par mois et compte
      const currentMonth = selectedMonth || format(new Date(), "yyyy-MM");
      const [year, month] = currentMonth.split("-").map(Number);
      
      let incomes = 0;
      let expenses = 0;
      
      transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        const isInSelectedMonth = 
          txDate.getFullYear() === year && 
          txDate.getMonth() === month - 1;
        
        // Vérifier si la transaction correspond au filtre de compte
        const matchesAccount = accountFilter === "all" || 
                            tx.accountId === accountFilter || 
                            (tx.type === TransactionType.TRANSFER && tx.toAccountId === accountFilter);
        
        if (isInSelectedMonth && matchesAccount) {
          if (tx.type === TransactionType.INCOME || 
              (tx.type === TransactionType.TRANSFER && tx.toAccountId === accountFilter)) {
            incomes += tx.amount;
          } else if (tx.type === TransactionType.EXPENSE || 
                  (tx.type === TransactionType.TRANSFER && tx.accountId === accountFilter)) {
            expenses += tx.amount;
          }
        }
      });
      
      setMonthlyIncomes(incomes);
      setMonthlyExpenses(expenses);
    }
  }, [transactions, selectedMonth, accountFilter]);

  // Affichage pendant le chargement
  if (themeLoading || !dbInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-primary/50 rounded-full mb-4"></div>
          <div className="text-primary/70">Chargement 💰...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar pour desktop */}
        <div className="hidden md:flex h-screen">
          <Sidebar theme={theme} changeTheme={changeTheme} />
        </div>
        
        {/* Contenu principal */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {!hideHeader && (
            <TopBar 
              theme={theme} 
              changeTheme={changeTheme} 
              toggleSidebar={() => setIsMobileNavOpen(!isMobileNavOpen)}
              accountFilter={accountFilter}
              selectedMonth={selectedMonth}
            />
          )}
          
          {/* Sidebar mobile (panneau latéral) */}
          {isMobileNavOpen && (
            <div className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm modal-backdrop">
              <div className="h-full w-4/5 max-w-xs bg-white dark:bg-gray-900 border-r border-border animate-slide-in-left">
                <Sidebar 
                  theme={theme} 
                  changeTheme={changeTheme} 
                  closeMobileNav={() => setIsMobileNavOpen(false)} 
                />
              </div>
              <div 
                className="absolute inset-0 z-[-1]"
                onClick={() => setIsMobileNavOpen(false)}
              ></div>
            </div>
          )}
          
          {/* Contenu de la page avec padding pour la barre de navigation sur mobile */}
          <main 
            className={`flex-1 overflow-auto p-3 md:p-6 ${isMobile ? 'bottom-nav-padding' : ''}`}
            style={{ fontSize: isMobile ? '16px' : 'inherit' }}
          >
            {/* En-tête de carte pour mobile avec solde */}
            {isMobile && (
              <div className="card p-4 mb-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl shadow-lg">
                <div className="text-center text-sm font-semibold mb-1">
                  {financialMonthsEnabled && financialDates 
                    ? financialDates.name.toUpperCase()
                    : (selectedMonth 
                        ? format(new Date(`${selectedMonth}-01`), "MMMM yyyy", { locale: fr }).toUpperCase() 
                        : format(new Date(), "MMMM yyyy", { locale: fr }).toUpperCase())}
                </div>
                <div className="text-3xl font-bold text-center mb-3">
                  {new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  }).format(projectedBalance)}
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xs opacity-80">Revenus</div>
                    <div className="text-sm font-semibold">
                      +{new Intl.NumberFormat("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                      }).format(monthlyIncomes || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs opacity-80 text-center">Balance</div>
                    <div className="text-sm font-semibold text-center">
                      {monthlyIncomes - monthlyExpenses >= 0 ? "+" : ""}
                      {new Intl.NumberFormat("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                      }).format(monthlyIncomes - monthlyExpenses)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs opacity-80 text-right">Dépenses</div>
                    <div className="text-sm font-semibold text-right">
                      -{new Intl.NumberFormat("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                      }).format(monthlyExpenses || 0)}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {children}
          </main>
          
          {/* Bottom Navigation pour mobile */}
          {isMobile && <BottomNavigation />}
          
          {/* Système d'astuces (caché sur mobile pour économiser l'espace) */}
          {!isMobile && <AppTips currentPage={location.pathname} />}
          
          {/* Footer avec copyright et version (uniquement sur desktop) */}
          {!isMobile && (
            <footer className="p-3 md:p-4 flex justify-between items-center text-xs md:text-sm text-muted-foreground border-t border-border">
              <div>© {new Date().getFullYear()} @TheDumber</div>
              <div>Version 1.0</div>
            </footer>
          )}
        </div>
      </div>
    </div>
  );
};
