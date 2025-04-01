import { useState, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAccountFilter } from '@/contexts/AccountFilterContext';
import { useQuery } from '@tanstack/react-query';
import db from '@/lib/db';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PeriodSelector, PeriodOption, TimeframeOption } from '@/components/statistics/PeriodSelector';
import { ChartTypeSelector, ChartType } from '@/components/statistics/ChartTypeSelector';
import { BalanceEvolutionChart } from '@/components/statistics/BalanceEvolutionChart';
import { MaBourseForecastChart } from '@/components/statistics/MaBourseForecastChart';
import { CategoryBreakdownChart } from '@/components/statistics/CategoryBreakdownChart';
import { TransactionSearch } from '@/components/transactions/TransactionSearch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const Statistics = () => {
  const [period, setPeriod] = useState<PeriodOption>("3months");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [timeframe, setTimeframe] = useState<TimeframeOption>("future");
  const { selectedAccount, setSelectedAccount } = useAccountFilter();
  const queryClient = useQueryClient();
  const componentDidMount = useRef(false);
  
  // Récupérer la liste des comptes
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      return db.accounts.getAll();
    },
  });
  
  // Obtenir le paramètre 'month' de l'URL si présent
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const monthParam = params.get('month');
    if (monthParam) return monthParam;
    
    // Par défaut, utiliser le mois actuel
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  // Format du mois sélectionné pour le prévisionnel
  const selectedMonth = useMemo(() => {
    if (timeframe === "future") {
      return currentMonth;
    } else {
      return currentMonth;
    }
  }, [timeframe, currentMonth]);
  
  // Écouter les changements de mois financier
  useEffect(() => {
    const handleFinancialMonthChange = (event: CustomEvent) => {
      console.log('Statistiques: Changement de mois financier détecté', event.detail);
      setCurrentMonth(event.detail.month);
    };
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'financialMonthModeToggled') {
        console.log('Statistiques: Basculement du mode mois financier détecté');
        
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
  
  // Effect pour mettre à jour le titre de la page avec le compte sélectionné
  useEffect(() => {
    const updatePageTitle = async () => {
      if (selectedAccount !== "all") {
        try {
          const account = await db.accounts.getById(selectedAccount as number);
          if (account) {
            document.title = `Statistiques - ${account.name} | Budget App`;
          }
        } catch (error) {
          console.error("Erreur lors de la récupération du compte:", error);
        }
      } else {
        document.title = "Statistiques | Budget App";
      }
    };
    
    updatePageTitle();
  }, [selectedAccount]);
  
  // Force le rafraîchissement des données statistiques après synchronisation
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'lastSyncTime' && !localStorage.getItem('statsRefreshing')) {
        console.log('Synchronisation détectée dans Statistics, rafraîchissement des données...');
        
        // Marquer que nous sommes en train de rafraîchir pour éviter les boucles
        localStorage.setItem('statsRefreshing', 'true');
        
        // Rafraîchir les données
        queryClient.invalidateQueries({ queryKey: ['historicalBalances'] });
        queryClient.invalidateQueries({ queryKey: ['forecastBalance'] });
        queryClient.invalidateQueries({ queryKey: ['statisticsData'] });
        
        // Nettoyer le marqueur après un délai
        setTimeout(() => {
          localStorage.removeItem('statsRefreshing');
        }, 2000);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Premier rendu
    if (!componentDidMount.current && !localStorage.getItem('statsRefreshing')) {
      componentDidMount.current = true;
      localStorage.setItem('statsRefreshing', 'true');
      
      // Force un rafraîchissement après le premier rendu
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['historicalBalances'] });
        queryClient.invalidateQueries({ queryKey: ['forecastBalance'] });
        queryClient.invalidateQueries({ queryKey: ['statisticsData'] });
        
        setTimeout(() => {
          localStorage.removeItem('statsRefreshing');
        }, 1000);
      }, 500);
    }
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [queryClient]);

  return (
    <MainLayout accountFilter={selectedAccount} selectedMonth={selectedMonth}>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <h1 className="text-2xl font-bold">Statistiques</h1>
            
            {/* Filtre par compte déplacé ici */}
            <div className="flex items-center">
              <span className="mr-2 font-semibold text-primary">Compte :</span>
              <Select 
                value={selectedAccount === "all" ? "all" : selectedAccount.toString()} 
                onValueChange={(value) => {
                  setSelectedAccount(value === "all" ? "all" : parseInt(value));
                }}
              >
                <SelectTrigger className="w-[230px] border-2 border-primary font-medium">
                  <SelectValue placeholder="Tous les comptes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center justify-between w-full">
                      <span>Tous les comptes</span>
                      {selectedAccount === "all" && (
                        <Badge variant="outline" className="ml-2 bg-primary text-primary-foreground">actif</Badge>
                      )}
                    </div>
                  </SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id!.toString()}>
                      <div className="flex items-center justify-between w-full">
                        <span>{account.name}</span>
                        {selectedAccount === account.id && (
                          <Badge variant="outline" className="ml-2 bg-primary text-primary-foreground">actif</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <PeriodSelector 
              value={period} 
              onChange={setPeriod} 
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
            />
            <ChartTypeSelector value={chartType} onChange={setChartType} />
          </div>
        </div>

        {timeframe === "past" ? (
          <>
            <BalanceEvolutionChart period={period} chartType={chartType} accountFilter={selectedAccount} />
            <CategoryBreakdownChart period={period} accountFilter={selectedAccount} />
          </>
        ) : (
          <MaBourseForecastChart period={period} chartType={chartType} accountFilter={selectedAccount} />
        )}

        <TransactionSearch 
          period={period} 
          accountFilter={selectedAccount} 
          timeframe={timeframe} 
        />
      </div>
    </MainLayout>
  );
};

export default Statistics;
