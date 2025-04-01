import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parse, isWithinInterval, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Search } from 'lucide-react';
import db from '@/lib/db';
import { Transaction, TransactionType } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PeriodOption } from '../statistics/PeriodSelector';

// Types pour les options de recherche
type SearchBy = "all" | "description" | "category" | "amount";

interface TransactionSearchProps {
  period: PeriodOption;
  accountFilter: number | "all";
  timeframe: "past" | "future";
}

export function TransactionSearch({ period, accountFilter, timeframe }: TransactionSearchProps) {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searchBy, setSearchBy] = useState<SearchBy>("all");
  const [searchResults, setSearchResults] = useState<Transaction[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Récupérer toutes les transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      return db.transactions.getAll();
    },
  });

  // Récupérer toutes les transactions récurrentes
  const { data: recurringTransactions = [] } = useQuery({
    queryKey: ['recurringTransactions'],
    queryFn: async () => {
      return db.recurringTransactions.getAll();
    },
  });
  
  // Récupérer les comptes pour afficher les noms des comptes
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      return db.accounts.getAll();
    },
  });

  // Récupérer toutes les suggestions uniques pour l'autocomplétion
  const searchSuggestions = useMemo(() => {
    const allDescriptions = new Set<string>();
    const allCategories = new Set<string>();
    
    // Ajouter toutes les descriptions et catégories des transactions
    transactions.forEach(tx => {
      allDescriptions.add(tx.description);
      if (tx.category) allCategories.add(tx.category);
    });
    
    // Ajouter les descriptions et catégories des transactions récurrentes
    recurringTransactions.forEach(tx => {
      allDescriptions.add(tx.description);
      if (tx.category) allCategories.add(tx.category);
    });
    
    // Convertir en tableaux et trier
    const descriptions = Array.from(allDescriptions).sort();
    const categories = Array.from(allCategories).sort();
    
    return {
      descriptions,
      categories,
      // Pour "all", nous utilisons toutes les valeurs possibles
      all: [...descriptions, ...categories, ...Array.from(transactions).map(tx => tx.amount.toString())]
    };
  }, [transactions, recurringTransactions]);

  // Déterminer les suggestions appropriées en fonction du critère de recherche
  const getCurrentSuggestions = useMemo(() => {
    switch (searchBy) {
      case "description":
        return searchSuggestions.descriptions;
      case "category":
        return searchSuggestions.categories;
      case "amount":
        return []; // Pas de suggestion pour les montants
      case "all":
      default:
        return searchSuggestions.all;
    }
  }, [searchBy, searchSuggestions]);

  // Calculer la période de recherche en fonction des paramètres
  const searchPeriod = useMemo(() => {
    const now = new Date();
    const months = parseInt(period.replace('months', ''));
    
    if (timeframe === 'past') {
      // Pour le passé, on cherche sur les X derniers mois
      const startDate = addMonths(now, -months);
      return {
        start: startDate,
        end: now
      };
    } else {
      // Pour le futur, on cherche sur les X prochains mois
      const endDate = addMonths(now, months);
      return {
        start: now,
        end: endDate
      };
    }
  }, [period, timeframe]);

  // Liste complète des transactions à rechercher (transactions existantes + projections des récurrentes)
  const allTransactionsToSearch = useMemo(() => {
    // Les transactions existantes dans la période
    const existingInPeriod = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return isWithinInterval(txDate, searchPeriod);
    });

    // Si on est en mode futur, ajouter les projections des transactions récurrentes
    let projectedRecurring: Transaction[] = [];
    
    if (timeframe === 'future') {
      // Pour chaque transaction récurrente, projeter les occurrences futures
      projectedRecurring = recurringTransactions.flatMap(rt => {
        const startDate = new Date(rt.startDate);
        const endDate = rt.endDate ? new Date(rt.endDate) : undefined;
        const nextExecution = new Date(rt.nextExecution);
        
        // Vérifier si la transaction récurrente est active pendant cette période
        if (endDate && endDate < searchPeriod.start) {
          return []; // Déjà terminée
        }
        
        if (startDate > searchPeriod.end) {
          return []; // Commence après notre période
        }
        
        // Générer les occurrences en fonction de la fréquence
        const projections: Transaction[] = [];
        let currentDate = new Date(nextExecution);
        
        while (currentDate <= searchPeriod.end) {
          if (currentDate >= searchPeriod.start) {
            // Ajouter cette occurrence à nos projections
            projections.push({
              id: -1, // ID temporaire négatif pour les projections
              accountId: rt.accountId,
              toAccountId: rt.toAccountId,
              amount: rt.amount,
              type: rt.type,
              category: rt.category,
              description: rt.description + " (récurrente)",
              date: new Date(currentDate),
              isRecurring: true,
              recurringId: rt.id,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
          
          // Avancer à la prochaine occurrence
          switch (rt.frequency) {
            case 'daily':
              currentDate.setDate(currentDate.getDate() + 1);
              break;
            case 'weekly':
              currentDate.setDate(currentDate.getDate() + 7);
              break;
            case 'biweekly':
              currentDate.setDate(currentDate.getDate() + 14);
              break;
            case 'monthly':
              currentDate.setMonth(currentDate.getMonth() + 1);
              break;
            case 'quarterly':
              currentDate.setMonth(currentDate.getMonth() + 3);
              break;
            case 'yearly':
              currentDate.setFullYear(currentDate.getFullYear() + 1);
              break;
            default:
              currentDate.setMonth(currentDate.getMonth() + 1); // Défaut: mensuel
          }
        }
        
        return projections;
      });
    }
    
    // Combiner les transactions existantes et les projections
    return [...existingInPeriod, ...projectedRecurring];
  }, [transactions, recurringTransactions, searchPeriod, timeframe]);
  
  // Filtrer les transactions par compte si nécessaire
  const filteredByAccount = useMemo(() => {
    if (accountFilter === "all") {
      return allTransactionsToSearch;
    }
    
    return allTransactionsToSearch.filter(tx => 
      tx.accountId === accountFilter || 
      (tx.type === TransactionType.TRANSFER && tx.toAccountId === accountFilter)
    );
  }, [allTransactionsToSearch, accountFilter]);

  // Fonction pour effectuer la recherche
  const handleSearch = () => {
    if (!searchTerm.trim() && searchBy !== "all") {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    
    // Si aucun terme de recherche n'est fourni, montrer toutes les transactions
    if (!searchTerm.trim()) {
      setSearchResults(filteredByAccount);
      setIsSearching(false);
      return;
    }
    
    // Recherche en fonction du critère sélectionné
    const results = filteredByAccount.filter(tx => {
      switch (searchBy) {
        case "description":
          return tx.description.toLowerCase().includes(searchTerm.toLowerCase());
        case "category":
          return tx.category?.toLowerCase().includes(searchTerm.toLowerCase());
        case "amount":
          try {
            const searchAmount = Number(searchTerm.replace(',', '.'));
            return !isNaN(searchAmount) && tx.amount === searchAmount;
          } catch {
            return false;
          }
        case "all":
        default:
          return (
            tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (tx.category && tx.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
            tx.amount.toString().includes(searchTerm.replace(',', '.'))
          );
      }
    });
    
    setSearchResults(results);
    setIsSearching(false);
  };

  // Effectuer une recherche initiale dès que la période ou le compte change
  useEffect(() => {
    // Recherche initiale sans terme de recherche (toutes les transactions)
    if (searchTerm === "") {
      setSearchResults(filteredByAccount);
    } else {
      // Relancer la recherche en cours
      handleSearch();
    }
  }, [filteredByAccount]);

  // Formater les montants avec devise
  const formatAmount = (amount: number, type: TransactionType) => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
    
    if (type === TransactionType.EXPENSE) {
      return <span className="text-red-500">-{formatted}</span>;
    } else if (type === TransactionType.INCOME) {
      return <span className="text-green-500">{formatted}</span>;
    } else {
      return <span className="text-blue-500">{formatted}</span>;
    }
  };

  // Obtenir le nom du compte par ID
  const getAccountName = (id?: number) => {
    if (!id) return "N/A";
    const account = accounts.find(a => a.id === id);
    return account ? account.name : "N/A";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span>Recherche de transactions</span>
            {searchResults.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {searchResults.length} transaction{searchResults.length > 1 ? 's' : ''} trouvée{searchResults.length > 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
          <Badge variant="outline">
            {timeframe === 'past' ? 'Historique' : 'Projections'} sur {period.replace('months', '')} mois
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-1 relative">
            <AutocompleteInput
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={setSearchTerm}
              suggestions={getCurrentSuggestions}
              className="pr-10"
              onKeyUp={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Search className="absolute right-3 top-2.5 h-5 w-5 text-muted-foreground" />
          </div>
          <Select 
            value={searchBy} 
            onValueChange={(value) => setSearchBy(value as SearchBy)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Rechercher par" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les champs</SelectItem>
              <SelectItem value="description">Description</SelectItem>
              <SelectItem value="category">Catégorie</SelectItem>
              <SelectItem value="amount">Montant</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleSearch} disabled={isSearching}>
            Rechercher
          </Button>
        </div>

        {searchResults.length > 0 && (
          <div className="mb-4 p-4 border rounded-md bg-muted/30 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Total des transactions</h3>
              <p className="text-sm text-muted-foreground">Somme des montants pour {searchResults.length} transaction{searchResults.length > 1 ? 's' : ''}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">
                {(() => {
                  // Calcul du total (revenus - dépenses) avec prise en compte des transferts
                  const total = searchResults.reduce((sum, tx) => {
                    if (tx.type === TransactionType.INCOME || 
                       (tx.type === TransactionType.TRANSFER && tx.toAccountId === accountFilter)) {
                      return sum + tx.amount;
                    } else if (tx.type === TransactionType.EXPENSE || 
                              (tx.type === TransactionType.TRANSFER && tx.accountId === accountFilter)) {
                      return sum - tx.amount;
                    }
                    return sum;
                  }, 0);
                  
                  // Formatage avec couleur selon le signe
                  const formatted = new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: 'EUR'
                  }).format(Math.abs(total));
                  
                  if (total > 0) {
                    return <span className="text-green-500">+{formatted}</span>;
                  } else if (total < 0) {
                    return <span className="text-red-500">-{formatted}</span>;
                  } else {
                    return <span>{formatted}</span>;
                  }
                })()}
              </p>
            </div>
          </div>
        )}
        
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Compte</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchResults.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    {searchTerm ? 'Aucune transaction trouvée' : 'Entrez un terme de recherche pour trouver des transactions'}
                  </TableCell>
                </TableRow>
              ) : (
                searchResults
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((tx, index) => (
                    <TableRow key={`${tx.id}-${index}`}>
                      <TableCell>
                        {format(new Date(tx.date), 'dd/MM/yyyy')}
                        {tx.isRecurring && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            récurrente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{tx.description}</TableCell>
                      <TableCell>{tx.category || 'Non catégorisé'}</TableCell>
                      <TableCell>
                        {tx.type === TransactionType.TRANSFER ? (
                          <>
                            {getAccountName(tx.accountId)} → {getAccountName(tx.toAccountId)}
                          </>
                        ) : (
                          getAccountName(tx.accountId)
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatAmount(tx.amount, tx.type)}
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
