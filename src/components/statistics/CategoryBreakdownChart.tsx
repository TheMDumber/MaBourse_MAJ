import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PeriodOption } from './PeriodSelector';
import db from '@/lib/db';
import { TransactionType } from '@/lib/types';

interface CategoryBreakdownChartProps {
  period: PeriodOption;
  accountFilter?: number | "all";
}

export function CategoryBreakdownChart({ period, accountFilter = "all" }: CategoryBreakdownChartProps) {
  // Convertir la période en nombre de mois
  const monthsToDisplay = parseInt(period.replace('months', ''));
  
  // Calculer les dates de début et de fin
  const endDate = endOfMonth(new Date());
  const startDate = startOfMonth(subMonths(endDate, monthsToDisplay - 1));
  
  // Récupérer les comptes pour l'affichage du nom du compte filtré
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      return db.accounts.getAll();
    },
  });
  
  // Récupérer toutes les transactions de la période
  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', startDate, endDate],
    queryFn: async () => {
      return db.transactions.getByDateRange(startDate, endDate);
    },
  });
  
  // Filtrer et regrouper les transactions par catégorie en fonction du compte sélectionné
  const { expensesByCategory, incomesByCategory } = useMemo(() => {
    // Filtrer par compte si nécessaire
    const filteredTransactions = accountFilter === "all"
      ? transactions
      : transactions.filter(tx => 
          tx.accountId === accountFilter || 
          (tx.type === TransactionType.TRANSFER && tx.toAccountId === accountFilter)
        );
    
    // Grouper les dépenses par catégorie
    const expenses = filteredTransactions
      .filter(tx => tx.type === TransactionType.EXPENSE)
      .reduce((acc, tx) => {
        const category = tx.category || "Non catégorisé";
        if (!acc[category]) acc[category] = 0;
        acc[category] += tx.amount;
        return acc;
      }, {} as Record<string, number>);
    
    // Grouper les revenus par catégorie
    const incomes = filteredTransactions
      .filter(tx => tx.type === TransactionType.INCOME)
      .reduce((acc, tx) => {
        const category = tx.category || "Non catégorisé";
        if (!acc[category]) acc[category] = 0;
        acc[category] += tx.amount;
        return acc;
      }, {} as Record<string, number>);
    
    return { 
      expensesByCategory: expenses, 
      incomesByCategory: incomes 
    };
  }, [transactions, accountFilter]);
  
  // Convertir les données pour le graphique
  const expensesData = Object.entries(expensesByCategory).map(([name, value]) => ({
    name,
    value,
  }));
  
  const incomesData = Object.entries(incomesByCategory).map(([name, value]) => ({
    name,
    value,
  }));
  
  // Couleurs pour les graphiques
  const COLORS_EXPENSES = ['#ff7300', '#ffa64d', '#ffcc99', '#ff9966', '#ff8533'];
  const COLORS_INCOMES = ['#82ca9d', '#a3d9b1', '#c4e8c6', '#e5f7da', '#b3e6cc'];
  
  // Formate le montant avec la devise
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };
  
  // Calculer les totaux
  const totalExpenses = Object.values(expensesByCategory).reduce((sum, value) => sum + value, 0);
  const totalIncomes = Object.values(incomesByCategory).reduce((sum, value) => sum + value, 0);
  
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      // Traduction du nom de la catégorie
      const translatedName = 
        payload[0].name === "fixed" ? "Fixes" :
        payload[0].name === "recurring" ? "Courantes" :
        payload[0].name === "exceptional" ? "Exceptionnelles" :
        payload[0].name;
        
      return (
        <div className="p-2 bg-white border rounded shadow">
          <p className="font-medium">{translatedName}</p>
          <p>{formatAmount(payload[0].value)}</p>
          <p>({(payload[0].value / (payload[0].payload.type === 'expense' ? totalExpenses : totalIncomes) * 100).toFixed(1)}%)</p>
        </div>
      );
    }
    
    return null;
  };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <CardTitle>Répartition des dépenses</CardTitle>
            {accountFilter !== "all" && accounts.length > 0 && (
              <Badge variant="outline" className="ml-2 bg-primary/10 text-primary">
                {accounts.find(a => a.id === accountFilter)?.name || "Compte sélectionné"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {totalExpenses === 0 ? (
            <p className="text-center py-4 text-muted-foreground">
              Aucune dépense pour cette période.
            </p>
          ) : (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expensesData.map(item => ({ ...item, type: 'expense' }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => {
                        const translatedName = 
                          name === "fixed" ? "Fixes" :
                          name === "recurring" ? "Courantes" :
                          name === "exceptional" ? "Exceptionnelles" :
                          name;
                        return `${translatedName} (${(percent * 100).toFixed(0)}%)`;
                      }}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {expensesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS_EXPENSES[index % COLORS_EXPENSES.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 1000 }} />
                    <Legend formatter={(value) => {
                      // Traduire les catégories si nécessaire
                      if (value === "Non catégorisé") return "Non catégorisé";
                      if (value === "fixed") return "Fixes";
                      if (value === "recurring") return "Courantes";
                      if (value === "exceptional") return "Exceptionnelles";
                      return value;
                    }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4">
                <p className="font-bold text-right">Total: {formatAmount(totalExpenses)}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <CardTitle>Répartition des revenus</CardTitle>
            {accountFilter !== "all" && accounts.length > 0 && (
              <Badge variant="outline" className="ml-2 bg-primary/10 text-primary">
                {accounts.find(a => a.id === accountFilter)?.name || "Compte sélectionné"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {totalIncomes === 0 ? (
            <p className="text-center py-4 text-muted-foreground">
              Aucun revenu pour cette période.
            </p>
          ) : (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={incomesData.map(item => ({ ...item, type: 'income' }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => {
                        const translatedName = 
                          name === "fixed" ? "Fixes" :
                          name === "recurring" ? "Courantes" :
                          name === "exceptional" ? "Exceptionnelles" :
                          name;
                        return `${translatedName} (${(percent * 100).toFixed(0)}%)`;
                      }}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {incomesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS_INCOMES[index % COLORS_INCOMES.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 1000 }} />
                    <Legend formatter={(value) => {
                      // Traduire les catégories si nécessaire
                      if (value === "Non catégorisé") return "Non catégorisé";
                      if (value === "fixed") return "Fixes";
                      if (value === "recurring") return "Courantes";
                      if (value === "exceptional") return "Exceptionnelles";
                      return value;
                    }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4">
                <p className="font-bold text-right">Total: {formatAmount(totalIncomes)}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
