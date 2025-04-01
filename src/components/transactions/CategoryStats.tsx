import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TransactionType } from "@/lib/types";
import db from "@/lib/db";

interface CategoryStatsProps {
  accountFilter?: number | "all";
}

export function CategoryStats({ accountFilter = "all" }: CategoryStatsProps) {
  const [period, setPeriod] = useState<string>("thisMonth");
  
  // Fonction pour traduire les noms de catégories
  const translateCategoryName = (name: string): string => {
    switch (name) {
      case "fixed": return "Fixes";
      case "recurring": return "Courantes";
      case "exceptional": return "Exceptionnelles";
      case "Non catégorisé": return "Non catégorisé";
      default: return name;
    }
  };
  
  // Récupérer la liste des comptes
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      return db.accounts.getAll();
    },
  });
  
  // Calculer les dates de début et de fin en fonction de la période
  const now = new Date();
  let startDate: Date;
  let endDate: Date = new Date();
  
  switch (period) {
    case "thisMonth":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case "lastMonth":
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case "thisYear":
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
      break;
    case "next6Months":
      startDate = new Date(); // À partir d'aujourd'hui
      endDate = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate()); // 6 mois à partir d'aujourd'hui
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }
  
  // Récupérer toutes les transactions dans la période
  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", startDate, endDate],
    queryFn: async () => {
      return db.transactions.getByDateRange(startDate, endDate);
    },
  });
  
  // Récupérer les transactions récurrentes si on affiche les 6 mois à venir
  const { data: recurringTransactions = [] } = useQuery({
    queryKey: ["recurringTransactions"],
    queryFn: async () => {
      return db.recurringTransactions.getAll();
    },
    enabled: period === "next6Months"
  });
  
  // Convertir les transactions récurrentes en transactions prévisionnelles
  const projectedTransactions = useMemo(() => {
    if (period !== "next6Months") return [];
    
    const result = [];
    
    for (const recurringTx of recurringTransactions) {
      // Ne prendre que les dépenses pour ce graphique
      if (recurringTx.type !== TransactionType.EXPENSE) continue;
      
      // Filtrer par compte si nécessaire
      if (accountFilter !== "all" && recurringTx.accountId !== accountFilter) continue;
      
      const frequency = recurringTx.frequency;
      let currentDate = new Date(recurringTx.nextExecution);
      
      // Générer les transactions futures sur les 6 prochains mois
      while (currentDate <= endDate) {
        if (currentDate >= startDate) {
          result.push({
            ...recurringTx,
            date: new Date(currentDate),
            category: recurringTx.category || "recurring" // Par défaut en "courantes" si pas de catégorie
          });
        }
        
        // Avancer à la prochaine occurrence selon la fréquence
        switch (frequency) {
          case "daily":
            currentDate = new Date(currentDate.setDate(currentDate.getDate() + 1));
            break;
          case "weekly":
            currentDate = new Date(currentDate.setDate(currentDate.getDate() + 7));
            break;
          case "biweekly":
            currentDate = new Date(currentDate.setDate(currentDate.getDate() + 14));
            break;
          case "monthly":
            currentDate = new Date(currentDate.setMonth(currentDate.getMonth() + 1));
            break;
          case "quarterly":
            currentDate = new Date(currentDate.setMonth(currentDate.getMonth() + 3));
            break;
          case "yearly":
            currentDate = new Date(currentDate.setFullYear(currentDate.getFullYear() + 1));
            break;
          default:
            currentDate = new Date(currentDate.setMonth(currentDate.getMonth() + 1));
        }
      }
    }
    
    return result;
  }, [recurringTransactions, startDate, endDate, period, accountFilter]);
  
  // Filtrer les transactions par compte si nécessaire et calculer les dépenses par catégorie
  const expensesByCategory = useMemo(() => {
    // Filtrer par compte si nécessaire
    const filteredTransactions = transactions.filter(tx => 
      tx.type === TransactionType.EXPENSE && 
      (accountFilter === "all" || tx.accountId === accountFilter)
    );
    
    // Ajouter les transactions prévisionnelles si on affiche les 6 mois à venir
    const allTransactions = period === "next6Months" 
      ? [...filteredTransactions, ...projectedTransactions]
      : filteredTransactions;
    
    // Grouper par catégorie
    return allTransactions.reduce((acc, tx) => {
      const category = tx.category || "Non catégorisé";
      if (!acc[category]) {
        acc[category] = 0;
      }
      acc[category] += tx.amount;
      return acc;
    }, {} as Record<string, number>);
  }, [transactions, accountFilter]);
  
  // Convertir les données pour le graphique
  const chartData = Object.entries(expensesByCategory).map(([name, value]) => ({
    name,
    value,
  }));
  
  // Couleurs pour le graphique
  const COLORS = ['#fc8181', '#f6ad55', '#68d391', '#63b3ed', '#b794f4'];
  
  // Formate le montant avec la devise
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };
  
  // Calculer le total des dépenses
  const totalExpenses = Object.values(expensesByCategory).reduce(
    (sum, value) => sum + value,
    0
  );
  
  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center">
          <CardTitle>Dépenses par catégorie</CardTitle>
          {accountFilter !== "all" && accounts.length > 0 && (
            <Badge variant="outline" className="ml-2 bg-primary/10 text-primary">
              {accounts.find(a => a.id === accountFilter)?.name || "Compte sélectionné"}
            </Badge>
          )}
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Période" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="thisMonth">Ce mois-ci</SelectItem>
            <SelectItem value="lastMonth">Mois dernier</SelectItem>
            <SelectItem value="thisYear">Cette année</SelectItem>
            <SelectItem value="next6Months">6 mois à venir</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {totalExpenses === 0 ? (
          <p className="text-center py-4 text-muted-foreground">
            Aucune dépense pour cette période.
          </p>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${translateCategoryName(name)} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Legend 
                  formatter={(value) => translateCategoryName(value)} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-4 space-y-2">
          {chartData.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
            <div className="flex items-center">
            <div
            className="w-4 h-4 rounded-full mr-2"
            style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span>{translateCategoryName(item.name)}</span>
            </div>
            <span>{formatAmount(item.value)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="font-bold">Total</span>
            <span className="font-bold">{formatAmount(totalExpenses)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
