import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  TooltipProps,
} from 'recharts';
import { format, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import { PeriodOption } from './PeriodSelector';
import { ChartType } from './ChartTypeSelector';
import db from '@/lib/db';
import { TransactionType, RecurringTransaction } from '@/lib/types';

interface MaBourseForecastChartProps {
  period: PeriodOption;
  chartType: ChartType;
  accountFilter: number | "all";
}

export function MaBourseForecastChart({ period, chartType, accountFilter }: MaBourseForecastChartProps) {
  // Convertir la période en nombre de mois
  const monthsToDisplay = period === "1month" ? 1 : parseInt(period.replace('months', ''));
  
  // Vérifier si le mode mois financier est activé
  const { data: financialMonthsEnabled } = useQuery({
    queryKey: ['isFinancialMonthEnabled'],
    queryFn: async () => {
      const { isFinancialMonthEnabled } = await import('@/lib/financialMonthUtils');
      return isFinancialMonthEnabled();
    },
  });
  
  // Récupérer les périodes financières futures (en commençant par le mois actuel)
  const { data: financialMonths, isLoading: isLoadingFinancialMonths } = useQuery({
    queryKey: ['financialMonthsForecast', financialMonthsEnabled, monthsToDisplay],
    queryFn: async () => {
      if (!financialMonthsEnabled) return null;
      
      const { generateFutureFinancialMonths } = await import('@/lib/financialMonthUtils');
      const periods = await generateFutureFinancialMonths(new Date(), monthsToDisplay);
      
      console.log("Périodes financières générées pour le prévisionnel:", 
        periods.map(p => `${format(p.start, 'dd/MM/yyyy')} au ${format(p.end, 'dd/MM/yyyy')} (${p.name})`));
      
      return periods;
    },
    enabled: !!financialMonthsEnabled,
  });
  
  // Calculer les dates de début et de fin pour les prévisions
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(addMonths(startOfMonth(new Date()), monthsToDisplay - 1)));
  
  // Mettre à jour les dates de début et de fin en fonction du mode de mois financier
  useEffect(() => {
    if (financialMonthsEnabled && financialMonths && financialMonths.length > 0) {
      // Utiliser le mois financier ACTUEL comme point de départ (premier élément du tableau)
      const firstPeriod = financialMonths[0];
      setStartDate(firstPeriod.start);
      
      // La fin est la fin du dernier mois financier généré
      // S'assurer que nous avons bien monthsToDisplay mois (pas monthsToDisplay-1)
      const lastIndex = Math.min(monthsToDisplay - 1, financialMonths.length - 1);
      const lastPeriod = financialMonths[lastIndex];
      setEndDate(lastPeriod.end);
      
      console.log(`Mode mois financier: prévision du ${format(firstPeriod.start, 'dd/MM/yyyy')} au ${format(lastPeriod.end, 'dd/MM/yyyy')}`);
    } else {
      // Mode calendaire standard - commencer par le mois ACTUEL et non le mois suivant
      const newStartDate = startOfMonth(new Date());
      const newEndDate = endOfMonth(addMonths(newStartDate, monthsToDisplay - 1));
      setStartDate(newStartDate);
      setEndDate(newEndDate);
      
      console.log(`Mode calendaire: prévision du ${format(newStartDate, 'dd/MM/yyyy')} au ${format(newEndDate, 'dd/MM/yyyy')}`);
    }
  }, [financialMonthsEnabled, financialMonths, monthsToDisplay]);
  
  // Récupérer les comptes pour avoir les soldes initiaux
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      return db.accounts.getAll();
    },
  });
  
  // Récupérer les transactions récurrentes
  const { data: recurringTransactions = [] } = useQuery({
    queryKey: ['recurringTransactions'],
    queryFn: async () => {
      return db.recurringTransactions.getAll();
    },
  });
  
  // Récupérer les transactions existantes pour la période future (déjà planifiées)
  const { data: futureTransactions = [] } = useQuery({
    queryKey: ['futureTransactions', startDate, endDate],
    queryFn: async () => {
      return db.transactions.getByDateRange(startDate, endDate);
    },
  });
  
  // Récupérer les ajustements de solde pour indiquer quels mois ont été ajustés
  const { data: accountAdjustments = [] } = useQuery({
    queryKey: ['allAccountsAdjustments'],
    queryFn: async () => {
      if (accountFilter !== "all") return [];
      // Récupérer les ajustements pour tous les comptes
      const allAdjustments = [];
      for (const account of accounts) {
        if (account.id) {
          const adjustments = await db.balanceAdjustments.getAllByAccount(account.id);
          allAdjustments.push(...adjustments);
        }
      }
      return allAdjustments;
    },
    enabled: accountFilter === "all" && accounts.length > 0,
  });
  
  // Récupérer les ajustements de solde pour le compte sélectionné
  const { data: balanceAdjustments = [] } = useQuery({
    queryKey: ['balanceAdjustments', accountFilter],
    queryFn: async () => {
      if (accountFilter === "all") return [];
      return db.balanceAdjustments.getAllByAccount(accountFilter as number);
    },
    enabled: accountFilter !== "all",
  });
  
  // Générer les données prévisionnelles pour le graphique
  const forecastData = useMemo(() => {
    if (!accounts.length || (financialMonthsEnabled && !financialMonths)) {
      return [];
    }
    
    // Si un filtre de compte est actif, prendre uniquement le solde initial de ce compte
    // Sinon, prendre le solde initial de tous les comptes
    const initialBalance = accountFilter === "all" 
      ? accounts.reduce((sum, account) => sum + account.initialBalance, 0)
      : (accounts.find(acc => acc.id === accountFilter)?.initialBalance || 0);
    
    console.log(`Solde initial de base: ${initialBalance}€`);
    
    // Générer les dates des mois à prévoir (en tenant compte du mode mois financier)
    let months = [];
    if (financialMonthsEnabled && financialMonths) {
      // Mode mois financier
      console.log("Utilisation des périodes financières précalculées pour le graphique prévisionnel");
      
      months = financialMonths.map(fm => {
        // Créer un nom de mois plus clair avec les dates complètes
        const formattedStart = format(fm.start, 'dd MMM', { locale: fr });
        const formattedEnd = format(fm.end, 'dd MMM yyyy', { locale: fr });
        const displayName = `${formattedStart} - ${formattedEnd}`;
        
        return {
          month: format(fm.start, 'yyyy-MM'),
          monthName: displayName,
          startOfMonth: fm.start,
          endOfMonth: fm.end,
          isFinancialMonth: true,
          financialMonthName: fm.name,
          // Ajouter un champ spécifique pour l'affichage dans les bulles
          tooltipName: displayName
        };
      });
    } else {
      // Mode calendaire standard
      console.log("Génération des mois calendaires pour le graphique prévisionnel");
      months = Array.from({ length: monthsToDisplay }, (_, i) => {
        const date = addMonths(startDate, i);
        const monthName = format(date, 'MMM yyyy', { locale: fr });
        return {
          month: format(date, 'yyyy-MM'),
          monthName: monthName,
          startOfMonth: startOfMonth(date),
          endOfMonth: endOfMonth(date),
          isFinancialMonth: false,
          financialMonthName: null,
          tooltipName: monthName
        };
      });
    }
    
    // Filtrer les transactions récurrentes par compte si nécessaire
    const filteredRecurringTransactions = accountFilter === "all" 
      ? recurringTransactions 
      : recurringTransactions.filter(rt => 
          rt.accountId === accountFilter || 
          (rt.type === TransactionType.TRANSFER && rt.toAccountId === accountFilter)
        );
    
    // Mapper les transactions récurrentes aux mois futurs
    const futureRecurringTransactions = months.flatMap(({ month, startOfMonth, endOfMonth }) => {
      return filteredRecurringTransactions.flatMap((rt: RecurringTransaction) => {
        // Vérifier si la transaction récurrente est active pendant cette période
        if (rt.endDate && new Date(rt.endDate) < startOfMonth) {
          return []; // Transaction récurrente terminée avant ce mois
        }
        
        if (new Date(rt.startDate) > endOfMonth) {
          return []; // Transaction récurrente commence après ce mois
        }
        
        // Créer une transaction prévisionnelle basée sur la récurrence
        return [{
          id: `forecast-${rt.id}-${month}`,
          accountId: rt.accountId,
          toAccountId: rt.toAccountId,
          amount: rt.amount,
          type: rt.type,
          category: rt.category,
          description: rt.description,
          date: new Date(startOfMonth.getTime() + Math.random() * (endOfMonth.getTime() - startOfMonth.getTime())),
          isRecurring: true,
          recurringId: rt.id,
        }];
      });
    });
    
    // Combiner les transactions futures existantes avec les prévisionnelles
    const allFutureTransactions = [...futureTransactions, ...futureRecurringTransactions];
    
    // Calculer les prévisions mois par mois
    let cumulativeBalance = initialBalance;
    console.log(`Solde cumulatif initial: ${cumulativeBalance}€`);
    
    // IMPORTANT: Vérifier d'abord s'il y a un ajustement pour le premier mois
    // IMPORTANT: Vérifier s'il y a des ajustements à appliquer et les préparer pour traitement
    const adjustmentByMonth = {};
    if (accountFilter !== "all" && balanceAdjustments.length > 0) {
      balanceAdjustments.forEach(adj => {
        adjustmentByMonth[adj.yearMonth] = adj.adjustedBalance;
        console.log(`Ajustement trouvé pour ${adj.yearMonth}: ${adj.adjustedBalance}€`);
      });
    }
    
    const results = months.map(({ month, monthName, startOfMonth, endOfMonth, tooltipName }, index) => {
      console.log(`Calcul pour le mois: ${monthName} [${month}], balance cumulative avant calcul: ${cumulativeBalance}€`);
      
      // Filtrer les transactions du mois
      let monthTransactions = allFutureTransactions.filter(
        (t) => new Date(t.date) >= startOfMonth && new Date(t.date) <= endOfMonth
      );
      
      // Filtrer par compte si nécessaire
      if (accountFilter !== "all") {
        monthTransactions = monthTransactions.filter(t => 
          t.accountId === accountFilter || 
          (t.type === TransactionType.TRANSFER && t.toAccountId === accountFilter)
        );
      }
      
      // Calculer les revenus, dépenses et transferts du mois
      const incomes = monthTransactions
        .filter((t) => t.type === TransactionType.INCOME || 
                   (t.type === TransactionType.TRANSFER && t.toAccountId === accountFilter))
        .reduce((sum, t) => sum + t.amount, 0);
      
      const expenses = monthTransactions
        .filter((t) => t.type === TransactionType.EXPENSE || 
                   (t.type === TransactionType.TRANSFER && t.accountId === accountFilter))
        .reduce((sum, t) => sum + t.amount, 0);
      
      // Calculer la différence directement
      const difference = incomes - expenses;
      
      // Mettre à jour le solde initial et final
      const initialMonthBalance = cumulativeBalance;
      
      // Calculer d'abord le solde final régulier (sans ajustement)
      let finalBalance = initialMonthBalance + difference;
      
      // Vérifier s'il y a un ajustement pour ce mois spécifique
      const hasAdjustment = accountFilter !== "all" && month in adjustmentByMonth;
      
      // Vérifier également les ajustements sur tous les comptes
      let hasAllAccountsAdjustment = false;
      if (accountFilter === "all") {
        const monthAdjustments = accountAdjustments.filter(adj => adj.yearMonth === month);
        hasAllAccountsAdjustment = monthAdjustments.length > 0;
      }
      
      console.log(`  Mois ${monthName}: Solde initial=${initialMonthBalance}€, revenus=${incomes}€, dépenses=${expenses}€, solde calculé=${finalBalance}€, ajustement=${hasAdjustment ? 'oui' : 'non'}`);
      
      if (hasAdjustment) {
        // Remplacer le solde final par l'ajustement UNIQUEMENT pour le mois actuel
        finalBalance = adjustmentByMonth[month];
        console.log(`  -> Solde ajusté: ${finalBalance}€ (au lieu de ${initialMonthBalance + difference}€)`);
      } else if (accountFilter === "all" && hasAllAccountsAdjustment) {
        // Réinitialiser le solde final
        finalBalance = 0;
        
        // Pour chaque compte, ajouter son solde final (ajusté ou calculé)
        const monthAdjustments = accountAdjustments.filter(adj => adj.yearMonth === month);
        
        for (const account of accounts) {
          if (!account.id) continue;
          
          // Trouver l'ajustement pour ce compte, s'il existe
          const accAdjustment = monthAdjustments.find(adj => adj.accountId === account.id);
          
          if (accAdjustment) {
            // Utiliser directement le solde ajusté
            finalBalance += accAdjustment.adjustedBalance;
          } else {
            // Calculer le solde prévisionnel pour ce compte
            // Trouver les transactions pour ce compte et ce mois
            const accountTransactions = allFutureTransactions.filter(
              t => (new Date(t.date) >= startOfMonth && new Date(t.date) <= endOfMonth) && 
                  (t.accountId === account.id || 
                  (t.type === TransactionType.TRANSFER && t.toAccountId === account.id))
            );
            
            // Calculer revenus et dépenses pour ce compte
            const accIncomes = accountTransactions
              .filter((t) => t.type === TransactionType.INCOME || 
                         (t.type === TransactionType.TRANSFER && t.toAccountId === account.id))
              .reduce((sum, t) => sum + t.amount, 0);
            
            const accExpenses = accountTransactions
              .filter((t) => t.type === TransactionType.EXPENSE || 
                         (t.type === TransactionType.TRANSFER && t.accountId === account.id))
              .reduce((sum, t) => sum + t.amount, 0);
            
            // Calculer le solde final pour ce compte
            const accBalance = account.initialBalance + accIncomes - accExpenses;
            finalBalance += accBalance;
          }
        }
      } else {
        console.log(`  -> Solde calculé: ${finalBalance}€`);
      }
      
      // IMPORTANT: Mettre à jour le solde cumulatif pour le mois suivant
      // 1. Si nous sommes au m+0, utiliser l'ajustement si disponible (propager aux mois suivants)
      // 2. Pour tous les autres mois, utiliser toujours le calcul normal (initial + revenus - dépenses)
      if (index === 0) {
        if (hasAdjustment) {
          // Pour le premier mois avec ajustement, utiliser le solde ajusté comme point de départ du mois suivant
          cumulativeBalance = adjustmentByMonth[month];
          console.log(`  -> Premier mois: Mise à jour du solde cumulatif avec l'ajustement: ${cumulativeBalance}€ pour le mois suivant`);
        } else {
          // Pour le premier mois sans ajustement, utiliser le solde initial + différence comme point de départ
          // C'est la correction du bug: s'assurer que le solde initial du compte est utilisé comme base pour le premier mois
          cumulativeBalance = initialBalance + difference;
          console.log(`  -> Premier mois: Utilisation du solde initial (${initialBalance}€) + différence (${difference}€) = ${cumulativeBalance}€ pour le mois suivant`);
        }
      } else {
        // Pour tous les autres mois, calculer normalement
        cumulativeBalance = initialMonthBalance + difference; // Calcul NORMAL
        console.log(`  -> Mise à jour du solde cumulatif avec calcul normal: ${cumulativeBalance}€ pour le mois suivant`);
      }
      
      // Déterminer si le mois a été ajusté (soit pour un compte spécifique, soit pour tous les comptes)
      const isAdjusted = hasAdjustment || (accountFilter === "all" && hasAllAccountsAdjustment);
      
      // Arrondir tous les montants à 2 chiffres après la virgule
      return {
        month,
        name: monthName,
        tooltipName: tooltipName || monthName, // Assurer que tooltipName est présent
        soldeInitial: Number(initialMonthBalance.toFixed(2)),
        revenus: Number(incomes.toFixed(2)),
        depenses: Number(expenses.toFixed(2)),
        difference: Number(difference.toFixed(2)),
        soldeFinal: Number(finalBalance.toFixed(2)),
        isAdjusted
      };
    });
    
    // Log des résultats finaux pour débogage
    console.log("Données du graphique prévisionnel calculées:", 
      results.map((r, i) => 
        `${i+1}. ${r.name}${r.tooltipName ? ` (tooltip: ${r.tooltipName})` : ''}: ` +
        `Solde initial=${r.soldeInitial}€, Solde final=${r.soldeFinal}€${r.isAdjusted ? ' (ajusté)' : ''}`
      ));
    
    return results;
  }, [accounts, recurringTransactions, futureTransactions, monthsToDisplay, startDate, accountFilter, balanceAdjustments, accountAdjustments, financialMonthsEnabled, financialMonths]);
  
  // Formateur de nombres pour l'infobulle
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };
  
  // Personnalisation de l'infobulle
  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      // Vérifier si ce mois a un solde ajusté manuellement
      const dataPoint = forecastData.find(d => d.name === label);
      const isAdjusted = dataPoint?.isAdjusted;
      const tooltipLabel = dataPoint?.tooltipName || label; // Utiliser le nom de tooltip spécifique
      
      return (
        <div className="bg-background border border-border p-3 rounded shadow-md">
          <p className="font-bold text-lg mb-2">{tooltipLabel}</p>
          {payload.map((entry, index) => {
            const isBalanceField = entry.name === "Solde Initial" || entry.name === "Solde Final";
            return (
              <p 
                key={`item-${index}`} 
                style={{ color: entry.color }}
                className={`${isBalanceField ? 'text-base font-semibold my-1' : 'text-sm'}`}
              >
                {entry.name}: {formatNumber(entry.value as number)}
                {isBalanceField && entry.name === "Solde Final" && isAdjusted && (
                  <span className="ml-2 text-xs bg-primary/10 text-primary px-1 py-0.5 rounded">
                    ajusté
                  </span>
                )}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };
  
  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return (
          <LineChart data={forecastData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              angle={-15} 
              textAnchor="end" 
              height={70}
              interval={0} // Afficher toutes les étiquettes
            />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line type="monotone" dataKey="soldeInitial" name="Solde Initial" stroke="#8884d8" />
            <Line type="monotone" dataKey="revenus" name="Revenus" stroke="#82ca9d" />
            <Line type="monotone" dataKey="depenses" name="Dépenses" stroke="#ff7300" />
            <Line type="monotone" dataKey="difference" name="Différence" stroke="#ff00ff" />
            <Line 
              type="monotone" 
              dataKey="soldeFinal" 
              name="Solde Final" 
              stroke="#0088fe" 
              activeDot={{ r: 8 }}
              dot={(props) => {
                // Ajouter un marqueur différent pour les soldes ajustés
                const isAdjusted = forecastData[props.index]?.isAdjusted;
                if (isAdjusted) {
                  return (
                    <svg 
                      x={props.cx - 6} 
                      y={props.cy - 6} 
                      width={12} 
                      height={12} 
                      fill="#0088fe"
                      viewBox="0 0 24 24"
                    >
                      <circle cx="12" cy="12" r="10" stroke="#0088fe" strokeWidth="2" fill="white" />
                      <path d="M8 12l3 3 5-7" stroke="#0088fe" strokeWidth="2" fill="none" />
                    </svg>
                  );
                }
                return <circle cx={props.cx} cy={props.cy} r={4} fill="#0088fe" />;
              }}
            />
          </LineChart>
        );
      case 'bar':
      case 'bar3d':
        return (
          <BarChart data={forecastData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              angle={-15} 
              textAnchor="end" 
              height={70}
              interval={0} // Afficher toutes les étiquettes
            />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="soldeInitial" name="Solde Initial" fill="#8884d8" />
            <Bar dataKey="revenus" name="Revenus" fill="#82ca9d" />
            <Bar dataKey="depenses" name="Dépenses" fill="#ff7300" />
            <Bar dataKey="difference" name="Différence" fill="#ff00ff" />
            <Bar 
              dataKey="soldeFinal" 
              name="Solde Final" 
              fill="#0088fe"
              // Bars avec un pattern ou bordure différente pour les ajustements
              shape={(props) => {
                const { tooltipPayload, tooltipPosition, dataKey, isAdjusted: propIsAdjusted, soldeInitial, soldeFinal, tooltipName, ...rectProps } = props as any;
                const isAdjusted = forecastData[props.index]?.isAdjusted;
                
                // Pour éviter l'erreur de hauteur négative
                let height = Math.abs(rectProps.height || 0);
                let y = rectProps.y;
                
                // Si la valeur est trop petite, utiliser une hauteur minimum
                if (height < 0.1) height = 0.1;
                
                // Ajuster la position Y selon que la valeur est positive ou négative
                if (rectProps.height < 0) {
                  y = rectProps.y - height;
                }
                
                return (
                  <rect
                    {...rectProps}
                    y={y}
                    height={height}
                    stroke={isAdjusted ? "#fff" : "none"}
                    strokeWidth={isAdjusted ? 2 : 0}
                    strokeDasharray={isAdjusted ? "5,2" : "0"}
                    fill={rectProps.fill}
                  />
                );
              }}
            />
          </BarChart>
        );
      default:
        return null;
    }
  };
  
  // Compter le nombre de mois avec des ajustements
  const adjustedMonthsCount = forecastData.filter(d => d.isAdjusted).length;
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center">
          <CardTitle>Évolution du solde</CardTitle>
          {accountFilter !== "all" && accounts.length > 0 && (
            <Badge variant="outline" className="ml-2 bg-primary/10 text-primary">
              {accounts.find(a => a.id === accountFilter)?.name || "Compte sélectionné"}
            </Badge>
          )}
          {adjustedMonthsCount > 0 && (
            <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-800 flex items-center">
              <Info className="h-3 w-3 mr-1" />
              {adjustedMonthsCount} {adjustedMonthsCount > 1 ? 'mois ajustés' : 'mois ajusté'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4">
          Visualisez l'évolution de votre solde sur {monthsToDisplay} mois, en tenant compte de vos revenus, dépenses et transferts.
          {adjustedMonthsCount > 0 && (
            <span className="block mt-1 text-sm">
              Les soldes ajustés manuellement sont marqués différemment sur le graphique.
            </span>
          )}
        </p>
        <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
        {financialMonthsEnabled && isLoadingFinancialMonths ? (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Chargement des données...</p>
            </div>
          ) : (
            renderChart()
          )}
        </ResponsiveContainer>
      </div>
        
        {financialMonthsEnabled && (
          <div className="text-xs text-muted-foreground mt-2">
            En mode "mois financier", les prévisions tiennent compte de vos périodes financières personnalisées.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
