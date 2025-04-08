import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { getCachedBalance } from "../../../cache";
import { useQueryClient } from "@tanstack/react-query";
import { useDeviceContext } from "@/contexts/DeviceContext";
import { useFinancialMonth } from "@/contexts/FinancialMonthContext";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, Filter, SortDesc, SortAsc, Plus, Pencil, ChevronLeft, ChevronRight, Loader2, FileDown } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

import db from "@/lib/db";
import { Transaction, TransactionType, ExpenseCategory } from "@/lib/types";
import { TransactionForm } from "./TransactionForm";
import { TransactionEditForm } from "./TransactionEditForm";
import { cn } from "@/lib/utils";

type SortField = "date" | "amount" | "description";
type SortDirection = "asc" | "desc";

// Configuration de la pagination
interface PaginationConfig {
  pageSize: number; 
  currentPage: number;
  totalItems: number;
  totalPages: number;
}

interface TransactionsListProps {
  onAddTransaction?: () => void;
  onAddIncome?: () => void;
  onAddExpense?: () => void;
  onAddTransfer?: () => void;
  onAccountFilterChange?: (value: number | "all") => void;
  onEditTransaction?: (transaction: Transaction) => void;
  onTransactionUpdated?: () => void;
  onMonthChange?: ((month: string) => void) | null;
  // Important : Utiliser la propriété initialAccountFilter comme source unique de vérité
  initialAccountFilter?: number | "all";
}

export function TransactionsList({
  onAddTransaction,
  onAddIncome,
  onAddExpense,
  onAddTransfer,
  onAccountFilterChange,
  onEditTransaction,
  onTransactionUpdated,
  onMonthChange,
  // Utiliser la valeur par défaut "all" si non spécifiée
  initialAccountFilter = "all"
}: TransactionsListProps) {
  const { toast } = useToast(); // Récupérer la fonction toast
  
  // États locaux
  const [filter, setFilter] = useState<string>(""); // Maintenu pour compatibilité, mais désactivé dans l'interface
  const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "all">("all");
  const [renderKey, setRenderKey] = useState(0);
  const { currentMonth, setCurrentMonth } = useFinancialMonth();
  const [pagination, setPagination] = useState<PaginationConfig>({
    pageSize: 15,
    currentPage: 1,
    totalItems: 0,
    totalPages: 1
  });
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>("amount");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  
  const { isMobile } = useDeviceContext();
  const queryClient = useQueryClient();
  
  // Référence pour les valeurs précédentes
  const prevFiltersRef = useRef({
    accountFilter: initialAccountFilter,
    typeFilter,
    categoryFilter,
    currentMonth
  });

  // Forcer la mise à jour lorsque les filtres clés changent
  useEffect(() => {
    const currentFilters = {
      accountFilter: initialAccountFilter,
      typeFilter,
      categoryFilter,
      currentMonth
    };
    
    // Comparer avec les valeurs précédentes pour éviter les mises à jour inutiles
    if (JSON.stringify(prevFiltersRef.current) !== JSON.stringify(currentFilters)) {
      console.log('Filtres changés, forcer le rendu');
      setRenderKey(prev => prev + 1);
      prevFiltersRef.current = currentFilters;
    }
  }, [initialAccountFilter, typeFilter, categoryFilter, currentMonth]);

  // Fonction pour traiter les changements de filtre de compte
  const handleAccountFilterChange = useCallback((value: number | "all") => {
    // Ne rien faire si la valeur n'a pas changé
    if (value === initialAccountFilter) return;
    
    // Propager le changement vers le parent seulement
    if (onAccountFilterChange) {
      console.log('Propager le changement de filtre de compte:', value);
      onAccountFilterChange(value);
    }
  }, [initialAccountFilter, onAccountFilterChange]);
  
  // Fonction pour exporter les transactions filtrées en CSV
  const exportToCSV = () => {
    try {
      // Vérifier si nous avons des transactions à exporter
      if (filteredTransactions.length === 0) {
        toast({
          title: "Export impossible",
          description: "Aucune transaction à exporter. Veuillez modifier vos filtres.",
          variant: "destructive"
        });
        return;
      }
      
      // Créer l'en-tête du CSV
      const headers = [
        "Date", 
        "Type", 
        "Description", 
        "Montant", 
        "Compte Source", 
        "Compte Destination", 
        "Catégorie"
      ];
      
      // Créer les lignes de données (toutes les transactions filtrées, pas seulement la page courante)
      const csvData = filteredTransactions.map(tx => {
        // Obtenir le nom du compte source
        const sourceAccount = accounts.find(acc => acc.id === tx.accountId);
        const sourceAccountName = sourceAccount ? sourceAccount.name : "Compte inconnu";
        
        // Obtenir le nom du compte destination (pour les transferts)
        let destinationAccountName = "";
        if (tx.type === TransactionType.TRANSFER && tx.toAccountId) {
          const destAccount = accounts.find(acc => acc.id === tx.toAccountId);
          destinationAccountName = destAccount ? destAccount.name : "Compte inconnu";
        }
        
        // Formater la date (format: DD/MM/YYYY)
        const formattedDate = format(new Date(tx.date), "dd/MM/yyyy");
        
        // Obtenir le type de transaction en français
        let transactionType = "";
        switch (tx.type) {
          case TransactionType.INCOME:
            transactionType = "Revenu";
            break;
          case TransactionType.EXPENSE:
            transactionType = "Dépense";
            break;
          case TransactionType.TRANSFER:
            transactionType = "Transfert";
            break;
        }
        
        // Obtenir la catégorie en français
        let category = "";
        if (tx.category) {
          switch (tx.category) {
            case ExpenseCategory.FIXED:
              category = "Fixe";
              break;
            case ExpenseCategory.RECURRING:
              category = "Courante";
              break;
            case ExpenseCategory.EXCEPTIONAL:
              category = "Exceptionnelle";
              break;
            default:
              category = tx.category;
          }
        }
        
        // Retourner la ligne de données
        return [
          formattedDate,
          transactionType,
          tx.description,
          tx.amount.toString().replace('.', ','), // Format français avec virgule
          sourceAccountName,
          destinationAccountName,
          category
        ];
      });
      
      // Ajouter l'en-tête au début
      csvData.unshift(headers);
      
      // Convertir les données en format CSV (RFC 4180)
      let csvContent = "";
      csvData.forEach(row => {
        // Échapper les champs contenant des virgules, guillemets ou sauts de ligne
        const processedRow = row.map(field => {
          // Si le champ contient des caractères spéciaux, l'entourer de guillemets
          if (field.includes(',') || field.includes('"') || field.includes('\n')) {
            // Échapper les guillemets en les doublant
            return `"${field.replace(/"/g, '""')}"`;
          }
          return field;
        });
        csvContent += processedRow.join(';') + '\n'; // Utiliser ; comme séparateur (format français)
      });
      
      // Créer un Blob avec les données CSV et l'encodage UTF-8 (pour les accents)
      const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
      
      // Créer une URL pour le blob
      const url = window.URL.createObjectURL(blob);
      
      // Créer un lien de téléchargement et le déclencher
      const link = document.createElement('a');
      link.setAttribute('href', url);
      
      // Générer un nom de fichier avec la date actuelle et les filtres appliqués
      let fileName = 'transactions';
      
      // Ajouter le filtre de compte au nom du fichier si applicable
      if (initialAccountFilter !== 'all') {
        const accountName = accounts.find(acc => acc.id === initialAccountFilter)?.name;
        if (accountName) {
          fileName += `_${accountName.replace(/\s+/g, '_')}`;
        }
      }
      
      // Ajouter le mois au nom du fichier
      fileName += `_${currentMonth}`;
      
      // Ajouter le filtre de type au nom du fichier si applicable
      if (typeFilter !== 'all') {
        fileName += `_${typeFilter}`;
      }
      
      // Finaliser le nom du fichier avec l'extension .csv
      fileName += '.csv';
      
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      
      // Nettoyer
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log(`CSV exporté avec succès: ${fileName}`);
      
      // Afficher une notification de succès
      toast({
        title: "Export réussi",
        description: `Les transactions ont été exportées dans "${fileName}"`,
        variant: "default"
      });
    } catch (error) {
      console.error('Erreur lors de l\'export CSV:', error);
      toast({
        title: "Erreur d'export",
        description: "Une erreur est survenue lors de l'export. Veuillez réessayer.",
        variant: "destructive"
      });
    }
  };

  // Gestion des transactions
  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction({...transaction});
    setIsEditFormOpen(true);
    if (onEditTransaction) {
      onEditTransaction(transaction);
    }
  };

  const handleCloseEditForm = () => {
    setIsEditFormOpen(false);
    setEditingTransaction(null);
  };

  const handleTransactionUpdated = () => {
    handleCloseEditForm();
    if (onTransactionUpdated) {
      onTransactionUpdated();
    }
  };

  // Requête pour savoir si les mois financiers sont activés
  const { data: financialMonthsEnabled = false } = useQuery({
    queryKey: ['isFinancialMonthEnabled'],
    queryFn: async () => {
      const { isFinancialMonthEnabled } = await import('@/lib/financialMonthUtils');
      return isFinancialMonthEnabled();
    },
    staleTime: 0
  });

  // Requête pour récupérer toutes les transactions du mois
  const { data: allMonthTransactions = [], isLoading, refetch: refetchTransactions } = useQuery({
    queryKey: ["allMonthTransactions", currentMonth, financialMonthsEnabled],
    queryFn: async () => {
      console.log(`Chargement des transactions pour ${currentMonth}`);
      const [year, month] = currentMonth.split("-").map(Number);
      
      let firstDayOfMonth, lastDayOfMonth;
      
      if (financialMonthsEnabled) {
        const { getFinancialMonthRange } = await import('@/lib/financialMonthUtils');
        const date = new Date(year, month - 1, 15);
        const { start, end } = await getFinancialMonthRange(date);
        firstDayOfMonth = start;
        lastDayOfMonth = end;
      } else {
        firstDayOfMonth = new Date(year, month - 1, 1);
        lastDayOfMonth = new Date(year, month, 0);
      }
      
      return db.transactions.getByDateRange(firstDayOfMonth, lastDayOfMonth);
    },
    staleTime: 0
  });

  // Requête pour récupérer les comptes
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      return db.accounts.getAll();
    }
  });
  
  // Requête pour obtenir le mois à afficher en fonction des dates financières
  const { data: effectiveDisplayMonth, isLoading: isLoadingDisplayMonth } = useQuery({
    queryKey: ['effectiveDisplayMonth', financialMonthsEnabled, currentMonth],
    queryFn: async () => {
      if (!financialMonthsEnabled) {
        // En mode calendaire, le mois affiché est le même que celui sélectionné
        console.log(`Mode calendaire: le mois affiché est ${currentMonth}`);
        return currentMonth;
      }
      
      try {
        // En mode financier, obtenir les dates du mois financier
        const { yearMonthToFinancialMonthRange, getEffectiveDisplayMonth } = await import('@/lib/financialMonthUtils');
        const { start, end, name } = await yearMonthToFinancialMonthRange(currentMonth);
        
        // Extraire le mois/année effectif à partir de la date de fin
        const effectiveMonth = getEffectiveDisplayMonth(end);
        console.log(`Mode financier: Période ${format(start, 'dd/MM/yyyy')} au ${format(end, 'dd/MM/yyyy')}`);
        console.log(`Mois sélectionné: ${currentMonth}, Mois calculé: ${effectiveMonth}`);
        return effectiveMonth;
      } catch (error) {
        console.error("Erreur lors de la détermination du mois à afficher:", error);
        return currentMonth; // Fallback au mois actuel en cas d'erreur
      }
    },
    enabled: !!currentMonth,
    staleTime: 0 // Toujours recalculer car dépend de la configuration du mois financier
  });

  // Requête pour obtenir toutes les transactions pour la liste des mois
  const { data: allTransactions = [] } = useQuery({
    queryKey: ["allTransactions"],
    queryFn: async () => {
      return db.transactions.getAll();
    },
    staleTime: 0
  });

  // S'assurer que le mois effectif est utilisé au chargement initial
  useEffect(() => {
    if (effectiveDisplayMonth && effectiveDisplayMonth !== currentMonth && financialMonthsEnabled) {
      console.log(`Mise à jour du mois à l'initialisation: ${currentMonth} -> ${effectiveDisplayMonth}`);
      
      // Mettre à jour le mois actuel
      setCurrentMonth(effectiveDisplayMonth);
      
      // Notifier le parent du changement de mois
      if (onMonthChange) {
        onMonthChange(effectiveDisplayMonth);
      }
      
      // Rafraîchir les données
      queryClient.invalidateQueries({ queryKey: ['forecastBalance'] });
    }
  }, [effectiveDisplayMonth, currentMonth, financialMonthsEnabled, onMonthChange, setCurrentMonth, queryClient]);

  // Écouteur pour détecter les changements de mois financier
  useEffect(() => {
    const handleFinancialMonthChange = (e: StorageEvent) => {
      if (e.key === 'financialMonthChanged' || e.key === 'financialMonthStartDayChanged') {
        console.log('Changement détecté dans les paramètres du mois financier');
        queryClient.invalidateQueries({ queryKey: ['isFinancialMonthEnabled'] });
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['effectiveDisplayMonth'] });
        refetchTransactions();
      }
      
      // Détecter le basculement en mode mois financier
      if (e.key === 'financialMonthModeToggled') {
        console.log('Basculement en mode mois financier détecté dans TransactionsList');
        
        // Vérifier et mettre à jour le mois financier
        const updateCurrentMonthIfNeeded = async () => {
          try {
            // Vérifier si le mode mois financier est activé
            const { isFinancialMonthEnabled, getFinancialMonthRange } = await import('@/lib/financialMonthUtils');
            const isEnabled = await isFinancialMonthEnabled();
            
            if (!isEnabled) return;
            
            // Obtenir la date actuelle
            const today = new Date();
            
            // Obtenir le mois financier actuel basé sur la date du jour
            const currentFinancialMonth = await getFinancialMonthRange(today);
            
            // Extraire le mois et l'année du nom du mois financier
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
            
            console.log(`TransactionsList - Mois financier actuel: ${financialMonthYearMonth}, mois calendaire: ${currentCalendarYearMonth}, mois sélectionné: ${currentMonth}`);
            
            // Toujours mettre à jour le mois si on bascule en mode mois financier
            // et que le mois financier est différent du mois actuellement sélectionné
            if (financialMonthYearMonth !== currentMonth) {
              console.log(`TransactionsList - Mise à jour du mois actuel: ${currentMonth} -> ${financialMonthYearMonth}`);
              
              // Mettre à jour le mois actuel
              setCurrentMonth(financialMonthYearMonth);
              
              // Notifier le parent du changement de mois
              if (onMonthChange) {
                onMonthChange(financialMonthYearMonth);
              }
              
              // Forcer la mise à jour du rendu pour rafraîchir la liste des mois
              setRenderKey(prev => prev + 1);
              
              // Charger les nouvelles transactions pour ce mois
              queryClient.invalidateQueries({ queryKey: ['allMonthTransactions'] });
              queryClient.invalidateQueries({ queryKey: ['monthlyTransactions'] });
              
              // Rafraîchir la liste des transactions avec un court délai
              // pour permettre à l'interface de se mettre à jour
              setTimeout(() => {
                refetchTransactions();
              }, 300);
            }
          } catch (error) {
            console.error('Erreur lors de la mise à jour du mois financier dans TransactionsList:', error);
          }
        };
        
        // Appeler la fonction avec un léger délai pour s'assurer que les autres changements sont appliqués
        setTimeout(updateCurrentMonthIfNeeded, 500);
      }
    };
    
    window.addEventListener('storage', handleFinancialMonthChange);
    
    // Vérifier si nous avons un événement financialMonthModeToggled récent
    const financialModeToggled = localStorage.getItem('financialMonthModeToggled');
    if (financialModeToggled) {
      const toggleTime = parseInt(financialModeToggled);
      const now = Date.now();
      // Si l'événement est récent (moins de 5 secondes)
      if (now - toggleTime < 5000) {
        // Simuler l'événement de stockage
        handleFinancialMonthChange({ key: 'financialMonthModeToggled' } as StorageEvent);
      }
    }
    
    return () => window.removeEventListener('storage', handleFinancialMonthChange);
  }, [queryClient, refetchTransactions, currentMonth, onMonthChange]);

  // Référence pour suivre si la mise à jour de mois a été déclenchée
  const monthUpdateRef = useRef(false);
  
  // Référence à l'élément input month
  const monthPickerRef = useRef<HTMLInputElement>(null);

  // Obtenir le premier mois sélectionnable depuis le contexte FinancialMonth
  const { minSelectableMonth, accountCreationMonth } = useFinancialMonth();
  
  // Fonction pour configurer manuellement le sélecteur de mois
  const setupMonthPickerConstraint = useCallback(() => {
    // Forcer la définition de l'attribut min sur l'élément
    setTimeout(() => {
      const monthPicker = document.getElementById('month-picker') as HTMLInputElement;
      if (monthPicker) {
        const minDate = minSelectableMonth || accountCreationMonth || "2025-03";
        console.log(`Configuration manuelle du sélecteur de mois - min=${minDate}`);
        
        // Appliquer la contrainte et le style
        monthPicker.setAttribute('min', minDate);
        monthPicker.min = minDate;
        monthPicker.style.border = "2px solid #007bff";
        
        // Vérifier aussi la valeur actuelle
        if (monthPicker.value && monthPicker.value < minDate) {
          console.log(`Correction de la valeur actuelle: ${monthPicker.value} -> ${minDate}`);
          monthPicker.value = minDate;
          setCurrentMonth(minDate);
          if (onMonthChange) onMonthChange(minDate);
        }
      }
    }, 100);
  }, [minSelectableMonth, accountCreationMonth, setCurrentMonth, onMonthChange]);
  
  // Appeler cette fonction après chaque rendu
  useEffect(() => {
    setupMonthPickerConstraint();
    // Répéter plusieurs fois pour s'assurer que ça fonctionne
    const timeouts = [
      setTimeout(setupMonthPickerConstraint, 200),
      setTimeout(setupMonthPickerConstraint, 500),
      setTimeout(setupMonthPickerConstraint, 1000)
    ];
    
    return () => {
      timeouts.forEach(t => clearTimeout(t));
    };
  }, [setupMonthPickerConstraint]);

  // Effet pour initialiser et contrôler le sélecteur de mois
  useEffect(() => {
    // Récupère l'élément input de type mois après le rendu
    const monthPicker = document.getElementById('month-picker');
    
    // Déterminer le premier mois sélectionnable (utiliser minSelectableMonth ou accountCreationMonth ou hardcoder mars 2025)
    const firstSelectableMonth = minSelectableMonth || accountCreationMonth || "2025-03";
    
    console.log(`Initialisation du sélecteur de mois - Premier mois sélectionnable: ${firstSelectableMonth}`);
    
    // Si l'élément existe
    if (monthPicker) {
      // Définit explicitement l'attribut min du sélecteur (la date de création du compte)
      monthPicker.setAttribute('min', firstSelectableMonth);
      
      // Forcer l'application de la restriction en modifiant directement le DOM
      monthPicker.min = firstSelectableMonth;
      
      // Ajouter du style pour rendre visible la restriction
      monthPicker.style.backgroundColor = "#f8f9fa";
      monthPicker.style.border = "1px solid #dee2e6";
      
      // Définir la valeur maximale au mois courant
      const today = new Date();
      const currentMonthStr = format(today, "yyyy-MM");
      
      // Vérifier que la valeur actuelle respecte les contraintes
      const currentValue = monthPicker.value;
      if (currentValue && currentValue < firstSelectableMonth) {
        console.log(`Valeur actuelle (${currentValue}) antérieure au mois minimal autorisé (${firstSelectableMonth}). Ajustement...`);
        // Si la valeur actuelle est antérieure à la date min, réinitialiser à la date min
        setCurrentMonth(firstSelectableMonth);
        if (onMonthChange) {
          onMonthChange(firstSelectableMonth);
        }
      }
      
      // Ajouter un gestionnaire d'événement pour le changement de mois
      // C'est redondant avec le gestionnaire React, mais demandé dans les instructions
      monthPicker.addEventListener('change', function(e) {
        const newValue = (e.target as HTMLInputElement).value;
        console.log('Nouveau mois sélectionné via le gestionnaire DOM:', newValue);
        
        // Appeler les fonctions de mise à jour par précaution
        setCurrentMonth(newValue);
        if (onMonthChange) {
          onMonthChange(newValue);
        }
        
        // Invalider les requêtes pour forcer le rechargement des données
        queryClient.invalidateQueries({ queryKey: ['forecastBalance'] });
        queryClient.invalidateQueries({ queryKey: ['effectiveDisplayMonth'] });
        queryClient.invalidateQueries({ queryKey: ['allMonthTransactions'] });
      });
      
      console.log(`Sélecteur de mois initialisé: min=${firstSelectableMonth}, max=${currentMonthStr}, valeur actuelle=${currentValue || currentMonth}`);
    } else {
      if (!monthPicker) console.warn("L'élément #month-picker n'a pas été trouvé.");
      if (!firstSelectableMonth) console.warn("Le premier mois sélectionnable n'est pas disponible.");
    }
    
    // Nettoyer le gestionnaire d'événement lors du démontage du composant
    return () => {
      const monthPicker = document.getElementById('month-picker');
      if (monthPicker) {
        monthPicker.removeEventListener('change', () => {});
      }
    };
  }, [minSelectableMonth, accountCreationMonth, currentMonth, onMonthChange, setCurrentMonth, queryClient]);
    
  // Déterminer les mois disponibles
  const months = useMemo(() => {
    const uniqueMonths = new Set<string>();
    
    // Ajouter les mois des transactions existantes
    allTransactions.forEach((tx) => {
      const month = format(new Date(tx.date), "yyyy-MM");
      uniqueMonths.add(month);
    });
    
    // Ajouter toujours le mois actuel (calendaire)
    const currentCalendarMonth = format(new Date(), "yyyy-MM");
    uniqueMonths.add(currentCalendarMonth);
    
    // Ajouter le mois sauvegardé s'il existe et n'est pas déjà dans la liste
    const savedMonth = localStorage.getItem('selectedMonth');
    if (savedMonth) {
      uniqueMonths.add(savedMonth);
    }
    
    // Si le mode mois financier est activé, ajouter également le mois financier actuel
    if (financialMonthsEnabled) {
      // Cette partie sera exécutée de manière asynchrone
      const addFinancialMonth = async () => {
        try {
          const { getFinancialMonthRange } = await import('@/lib/financialMonthUtils');
          const today = new Date();
          const currentFinancialMonth = await getFinancialMonthRange(today);
          
          // Extraire le mois et l'année du nom du mois financier
          const [monthName, yearStr] = currentFinancialMonth.name.split(' ');
          
          // Convertir le nom du mois en numéro de mois (0-11)
          const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                           'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
          const monthIndex = monthNames.findIndex(m => 
            m.toLowerCase() === monthName.toLowerCase());
          
          if (monthIndex !== -1 && yearStr) {
            // Créer le format YYYY-MM pour le mois financier
            const year = parseInt(yearStr);
            const monthNum = monthIndex + 1; // Convertir de 0-11 à 1-12
            const financialMonthYearMonth = `${year}-${monthNum.toString().padStart(2, '0')}`;
            
            // Ajouter ce mois à la liste s'il n'est pas déjà présent
            if (!uniqueMonths.has(financialMonthYearMonth)) {
              uniqueMonths.add(financialMonthYearMonth);
              // Forcer un rafraîchissement de l'UI
              setRenderKey(prev => prev + 1);
            }
          }
        } catch (error) {
          console.error("Erreur lors de l'ajout du mois financier:", error);
        }
      };
      
      // Exécuter de manière asynchrone
      addFinancialMonth();
    }
    
    // Déterminer le premier mois sélectionnable (minSelectableMonth ou fallback accountCreationMonth)
    const firstSelectableMonth = minSelectableMonth || accountCreationMonth;
    
    // Filtrer les mois pour ne pas montrer ceux antérieurs au mois de création du compte
    const filteredMonths = Array.from(uniqueMonths).filter(month => {
      if (!firstSelectableMonth) {
        return true; // Si pas de contrainte minimale, tout autoriser
      }
      return month >= firstSelectableMonth; // Comparer les chaînes YYYY-MM
    });
    
    const sortedMonths = filteredMonths.sort().reverse();
    
    // S'assurer qu'il y a toujours au moins un mois dans la liste
    if (sortedMonths.length === 0) {
      sortedMonths.push(format(new Date(), "yyyy-MM"));
    }
    
    // Si le mois actuel n'est pas dans la liste, ajouter et sélectionner le premier mois disponible
    if (!monthUpdateRef.current && sortedMonths.length > 0 && !sortedMonths.includes(currentMonth)) {
      monthUpdateRef.current = true;
      // Utiliser requestAnimationFrame pour éviter les rendus synchrones
      requestAnimationFrame(() => {
        setCurrentMonth(sortedMonths[0]);
      });
    }
    
    console.log(`Mois filtrés basés sur le premier mois sélectionnable (${firstSelectableMonth})`, sortedMonths);
    return sortedMonths;
  }, [allTransactions, currentMonth, financialMonthsEnabled, minSelectableMonth, accountCreationMonth, setRenderKey]);

  // Filtrer les transactions
  const filteredTransactions = useMemo(() => {
    const result = allMonthTransactions.filter((tx) => {
      // Filtre de recherche (désactivé dans l'interface, toujours vrai)
      const matchesSearchFilter = true; // Le champ de recherche a été supprimé, donc pas de filtrage par texte
      
      let matches = false;
      
      // Filtre de type et de compte
      if (typeFilter === "all") {
        if (initialAccountFilter === "all") {
          matches = true;
        } else {
          matches = tx.accountId === initialAccountFilter || (tx.type === TransactionType.TRANSFER && tx.toAccountId === initialAccountFilter);
        }
      } else if (typeFilter === TransactionType.INCOME) {
        if (initialAccountFilter === "all") {
          matches = tx.type === TransactionType.INCOME;
        } else {
          matches = (tx.type === TransactionType.INCOME && tx.accountId === initialAccountFilter) || 
                   (tx.type === TransactionType.TRANSFER && tx.toAccountId === initialAccountFilter);
        }
      } else if (typeFilter === TransactionType.EXPENSE) {
        const matchesCategoryFilter = categoryFilter === "all" || tx.category === categoryFilter;
        
        if (initialAccountFilter === "all") {
          matches = tx.type === TransactionType.EXPENSE && matchesCategoryFilter;
        } else {
          matches = ((tx.type === TransactionType.EXPENSE && tx.accountId === initialAccountFilter) || 
                    (tx.type === TransactionType.TRANSFER && tx.accountId === initialAccountFilter)) &&
                    (tx.type === TransactionType.TRANSFER || matchesCategoryFilter);
        }
      } else if (typeFilter === TransactionType.TRANSFER) {
        // Filtre spécifique pour les transferts
        if (initialAccountFilter === "all") {
          matches = tx.type === TransactionType.TRANSFER;
        } else {
          matches = tx.type === TransactionType.TRANSFER && 
                   (tx.accountId === initialAccountFilter || tx.toAccountId === initialAccountFilter);
        }
      }
      
      return matches && matchesSearchFilter;
    });
    
    // Ne pas mettre à jour la pagination ici, mais juste retourner le résultat
    return result;
  }, [allMonthTransactions, typeFilter, categoryFilter, initialAccountFilter]);
  
  // Effet pour mettre à jour la pagination lorsque les filtres changent
  useEffect(() => {
    const totalItems = filteredTransactions.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pagination.pageSize));
    
    setPagination(prev => ({
      ...prev,
      totalItems: totalItems,
      totalPages: totalPages,
      // Si la page actuelle est supérieure au nouveau nombre total de pages, revenir à une page valide
      currentPage: Math.min(prev.currentPage, totalPages) || 1
    }));
  }, [filteredTransactions, pagination.pageSize]);

  // Requête pour récupérer le solde du journal
  const { data: journalBalance, isLoading: isLoadingJournalBalance } = useQuery({
    queryKey: ['journalBalance', currentMonth, initialAccountFilter],
    queryFn: async () => {
      try {
        // Récupérer le solde ajusté ou prévu à partir du journal comptable
        const accountId = initialAccountFilter !== "all" ? initialAccountFilter as number : undefined;
        return await db.accountingJournal.getFinalBalanceForMonth(currentMonth, accountId);
      } catch (error) {
        console.error('Erreur lors de la récupération du solde du journal:', error);
        return null;
      }
    },
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Requête pour les transactions mensuelles pour les statistiques
  const { data: monthlyTransactions = [] } = useQuery({
    queryKey: ["monthlyTransactions", currentMonth, financialMonthsEnabled],
    queryFn: async () => {
      const [year, month] = currentMonth.split("-").map(Number);
      
      let firstDayOfMonth, lastDayOfMonth;
      
      if (financialMonthsEnabled) {
        const { getFinancialMonthRange } = await import('@/lib/financialMonthUtils');
        const date = new Date(year, month - 1, 15);
        const { start, end } = await getFinancialMonthRange(date);
        firstDayOfMonth = start;
        lastDayOfMonth = end;
      } else {
        firstDayOfMonth = new Date(year, month - 1, 1);
        lastDayOfMonth = new Date(year, month, 0);
      }
      
      return db.transactions.getByDateRange(firstDayOfMonth, lastDayOfMonth);
    },
    staleTime: 0
  });

  // Calculer les totaux par catégorie
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {
      [ExpenseCategory.FIXED]: 0,
      [ExpenseCategory.RECURRING]: 0,
      [ExpenseCategory.EXCEPTIONAL]: 0,
      incomes: 0,
      expenses: 0,
      balance: 0,
    };
    
    monthlyTransactions.forEach((tx) => {
      const matchesAccountFilter = initialAccountFilter === "all" || 
                                  tx.accountId === initialAccountFilter || 
                                  (tx.type === TransactionType.TRANSFER && tx.toAccountId === initialAccountFilter);
      
      if (matchesAccountFilter) {
        if (tx.type === TransactionType.INCOME || (tx.type === TransactionType.TRANSFER && tx.toAccountId === initialAccountFilter)) {
          totals.incomes += tx.amount;
          totals.balance += tx.amount;
        } else if (tx.type === TransactionType.EXPENSE || (tx.type === TransactionType.TRANSFER && tx.accountId === initialAccountFilter)) {
          totals.expenses += tx.amount;
          totals.balance -= tx.amount;
          
          if (tx.category) {
            totals[tx.category] = (totals[tx.category] || 0) + tx.amount;
          }
        }
      }
    });
    
    return totals;
  }, [monthlyTransactions, initialAccountFilter]);

  // Trier les transactions filtrées
  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      let compareResult = 0;
      
      if (sortField === "date") {
        compareResult = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortField === "amount") {
        compareResult = a.amount - b.amount;
      } else if (sortField === "description") {
        compareResult = a.description.localeCompare(b.description);
      }
      
      return sortDirection === "asc" ? compareResult : -compareResult;
    });
  }, [filteredTransactions, sortField, sortDirection]);
  
  // Paginer les transactions triées
  const paginatedTransactions = useMemo(() => {
    const startIndex = (pagination.currentPage - 1) * pagination.pageSize;
    const endIndex = startIndex + pagination.pageSize;
    return sortedTransactions.slice(startIndex, endIndex);
  }, [sortedTransactions, pagination.currentPage, pagination.pageSize]);

  // Compter les types de transactions
  const transactionCounts = useMemo(() => {
    // Filtrer d'abord les transactions pertinentes pour le compte sélectionné
    const relevantTransactions = monthlyTransactions.filter(tx => {
      if (initialAccountFilter === "all") {
        return true; // Toutes les transactions sont pertinentes
      } else {
        // Pour un compte spécifique, inclure seulement les transactions impliquant ce compte
        return tx.accountId === initialAccountFilter || 
               (tx.type === TransactionType.TRANSFER && tx.toAccountId === initialAccountFilter);
      }
    });
    
    // Compter le nombre total de transactions (sans filtre de type)
    const totalCount = relevantTransactions.length;
    
    // Compter spécifiquement les revenus
    const incomeCount = relevantTransactions.filter(tx => {
      if (tx.type === TransactionType.INCOME) {
        return true;
      }
      
      // Pour un compte spécifique, compter les transferts entrants comme des revenus
      if (initialAccountFilter !== "all" && 
          tx.type === TransactionType.TRANSFER && 
          tx.toAccountId === initialAccountFilter) {
        return true;
      }
      
      return false;
    }).length;
    
    // Compter spécifiquement les dépenses
    const expenseCount = relevantTransactions.filter(tx => {
      if (tx.type === TransactionType.EXPENSE) {
        return true;
      }
      
      // Pour un compte spécifique, compter les transferts sortants comme des dépenses
      if (initialAccountFilter !== "all" && 
          tx.type === TransactionType.TRANSFER && 
          tx.accountId === initialAccountFilter) {
        return true;
      }
      
      return false;
    }).length;
    
    // Compter spécifiquement les transferts
    const transferCount = relevantTransactions.filter(tx => {
      return tx.type === TransactionType.TRANSFER;
    }).length;
    
    return {
      all: totalCount,
      income: incomeCount,
      expense: expenseCount,
      transfer: transferCount
    };
  }, [monthlyTransactions, initialAccountFilter]);

  // Fonctions utilitaires
  const getAccountName = (accountId: number) => {
    const account = accounts.find((acc) => acc.id === accountId);
    return account ? account.name : "Compte inconnu";
  };

  const getTransactionIcon = (type: TransactionType, transaction?: Transaction) => {
    switch (type) {
      case TransactionType.INCOME:
        return <ArrowUpCircle className="w-4 h-4 text-green-500" />;
      case TransactionType.EXPENSE:
        return <ArrowDownCircle className="w-4 h-4 text-red-500" />;
      case TransactionType.TRANSFER:
        if (transaction && initialAccountFilter !== "all") {
          if (transaction.accountId === initialAccountFilter) {
            return <ArrowDownCircle className="w-4 h-4 text-red-500" />;
          } else if (transaction.toAccountId === initialAccountFilter) {
            return <ArrowUpCircle className="w-4 h-4 text-green-500" />;
          }
        }
        return <ArrowLeftRight className="w-4 h-4 text-blue-500" />;
    }
  };

  const getCategoryBadge = (category?: string) => {
    if (!category) return null;
    
    const colors: Record<string, string> = {
      [ExpenseCategory.FIXED]: "bg-indigo-500 hover:bg-indigo-600",
      [ExpenseCategory.RECURRING]: "bg-amber-500 hover:bg-amber-600",
      [ExpenseCategory.EXCEPTIONAL]: "bg-purple-500 hover:bg-purple-600",
    };
    
    const labels: Record<string, string> = {
      [ExpenseCategory.FIXED]: "Fixe",
      [ExpenseCategory.RECURRING]: "Courante",
      [ExpenseCategory.EXCEPTIONAL]: "Exceptionnelle",
    };
    
    return (
      <Badge className={colors[category] || "bg-gray-500"}>
        {labels[category] || category}
      </Badge>
    );
  };

  const formatAmount = (amount: number, type: TransactionType, transaction?: Transaction) => {
    if (type === TransactionType.TRANSFER && transaction && initialAccountFilter !== "all") {
      if (transaction.accountId === initialAccountFilter) {
        return `- ${new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: "EUR",
        }).format(amount)}`;
      } else if (transaction.toAccountId === initialAccountFilter) {
        return new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: "EUR",
        }).format(amount);
      }
    }
    
    const formatted = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
    
    return type === TransactionType.EXPENSE ? `- ${formatted}` : formatted;
  };

  const getAmountColor = (type: TransactionType, transaction?: Transaction) => {
    if (type === TransactionType.TRANSFER && transaction && initialAccountFilter !== "all") {
      if (transaction.accountId === initialAccountFilter) {
        return "text-red-600 dark:text-red-400";
      } else if (transaction.toAccountId === initialAccountFilter) {
        return "text-green-600 dark:text-green-400";
      }
    }
    
    switch (type) {
      case TransactionType.INCOME:
        return "text-green-600 dark:text-green-400";
      case TransactionType.EXPENSE:
        return "text-red-600 dark:text-red-400";
      case TransactionType.TRANSFER:
        return "text-blue-600 dark:text-blue-400";
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* En-tête et filtres */}
        {isLoading && (
          <div className="flex justify-center items-center py-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-lg">Chargement des transactions...</span>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div>
              <h2 className="text-2xl font-bold">Transactions</h2>
              <p className="text-muted-foreground">
                Gérez vos revenus et dépenses
              </p>
            </div>
            
            {/* Filtre par compte */}
            <div className="flex items-center">
              <span className="mr-2 font-semibold text-primary">Compte :</span>
              <Select 
                key={`account-select-header-${renderKey}`} 
                value={initialAccountFilter === "all" ? "all" : initialAccountFilter.toString()} 
                onValueChange={(value) => {
                  const newFilter = value === "all" ? "all" : parseInt(value);
                  handleAccountFilterChange(newFilter);
                }}
              >
                <SelectTrigger className="w-[230px] border-2 border-primary font-medium">
                  <SelectValue placeholder="Tous les comptes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center justify-between w-full">
                      <span>Tous les comptes</span>
                      {initialAccountFilter === "all" && (
                        <Badge variant="outline" className="ml-2 bg-primary text-primary-foreground">actif</Badge>
                      )}
                    </div>
                  </SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id!.toString()}>
                      <div className="flex items-center justify-between w-full">
                        <span>{account.name}</span>
                        {initialAccountFilter === account.id && (
                          <Badge variant="outline" className="ml-2 bg-primary text-primary-foreground">actif</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {/* Boutons d'ajout */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="sm:w-[140px]" disabled={!accounts || accounts.length === 0}>
                  <Plus className="mr-2 h-4 w-4" /> Ajouter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onAddIncome}>
                  <ArrowUpCircle className="w-4 h-4 text-green-500 mr-2" />
                  Revenu
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onAddExpense}>
                  <ArrowDownCircle className="w-4 h-4 text-red-500 mr-2" />
                  Dépense
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onAddTransfer} disabled={!accounts || accounts.length < 2}>
                  <ArrowLeftRight className="w-4 h-4 text-blue-500 mr-2" />
                  Transfert
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Ajout d'un log de débogage pour suivre les valeurs utilisées */}
            {console.log(`Rendu du input month - currentMonth: ${currentMonth}, effectiveDisplayMonth: ${effectiveDisplayMonth}, mode: ${financialMonthsEnabled ? 'financier' : 'calendaire'}, minSelectableMonth: ${minSelectableMonth}, accountCreationMonth: ${accountCreationMonth}`)}
            
            <div className="relative w-full sm:w-[180px]">
              <Input
                ref={monthPickerRef}
                type="month"
                id="month-picker"
                name="selected_month"
                value={currentMonth}
                min={minSelectableMonth || accountCreationMonth || "2025-03"}
                style={{ border: "2px solid #007bff" }}
                onChange={(e) => {
                  const newValue = e.target.value;
                  if (!newValue) return;
                  
                  // Vérifier explicitement que la valeur est postérieure ou égale à mars 2025
                  const minMonth = minSelectableMonth || accountCreationMonth || "2025-03";
                  if (newValue < minMonth) {
                    console.log(`Mois sélectionné (${newValue}) est antérieur au minimum autorisé (${minMonth}). Sélection rejetée.`);
                    
                    // Restaurer la valeur précédente ou utiliser le minimum
                    const correctedValue = currentMonth >= minMonth ? currentMonth : minMonth;
                    e.target.value = correctedValue;
                    
                    // Afficher un message d'erreur
                    toast({
                      title: "Sélection non autorisée",
                      description: `Vous ne pouvez pas sélectionner un mois antérieur à ${minMonth}`,
                      variant: "destructive"
                    });
                    
                    return;
                  }
                  
                  console.log(`Changement de mois sélectionné: ${currentMonth} -> ${newValue}`);
                  setCurrentMonth(newValue);
                  queryClient.invalidateQueries({ queryKey: ['forecastBalance'] });
                  queryClient.invalidateQueries({ queryKey: ['effectiveDisplayMonth'] });
                  
                  if (onMonthChange) {
                    onMonthChange(newValue);
                  }
                  
                  setPagination(prev => ({ ...prev, currentPage: 1 }));
                }}
                className="w-full"
              />
              {financialMonthsEnabled && effectiveDisplayMonth && effectiveDisplayMonth !== currentMonth && (
                <div className="absolute -bottom-5 left-0 text-xs text-primary">
                  Mois financier: {format(new Date(`${effectiveDisplayMonth}-01`), "MMMM yyyy", { locale: fr })}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Résumé du mois */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3" key={`summary-${renderKey}`}>
          <Card key={`revenue-${renderKey}-${initialAccountFilter}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Revenus</CardTitle>
              <CardDescription>Total des revenus {initialAccountFilter === "all" ? "du mois" : "du compte"}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {new Intl.NumberFormat("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                }).format(categoryTotals.incomes)}
              </p>
            </CardContent>
          </Card>
          
          <Card key={`expenses-${renderKey}-${initialAccountFilter}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Dépenses</CardTitle>
              <CardDescription>Total des dépenses {initialAccountFilter === "all" ? "du mois" : "du compte"}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {new Intl.NumberFormat("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                }).format(categoryTotals.expenses)}
              </p>
            </CardContent>
          </Card>
          
          <Card key={`balance-${renderKey}-${initialAccountFilter}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Balance</CardTitle>
              <CardDescription>Différence revenus - dépenses {initialAccountFilter !== "all" && "du compte"}</CardDescription>
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  "text-2xl font-bold",
                  categoryTotals.balance >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                )}
              >
                {new Intl.NumberFormat("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                }).format(categoryTotals.balance)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Détail des dépenses par catégorie */}
        <Card className="bg-muted/40" key={`category-expenses-${renderKey}`}>
          <CardHeader>
            <CardTitle>Dépenses par catégorie</CardTitle>
            <CardDescription>
              Répartition de vos dépenses {initialAccountFilter !== "all" ? "pour ce compte" : ""} pour {financialMonthsEnabled 
                ? format(new Date(`${currentMonth}-01`), "MMMM yyyy", { locale: fr }) + (financialMonthsEnabled ? " (mois financier)" : "")
                : format(new Date(`${currentMonth}-01`), "MMMM yyyy", { locale: fr })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between bg-background p-3 rounded-lg" key={`fixed-${renderKey}-${initialAccountFilter}`}>
                <div className="flex items-center gap-2">
                  <Badge className="bg-indigo-500">Fixe</Badge>
                  <span>Dépenses fixes</span>
                </div>
                <span className="font-semibold">
                  {new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  }).format(categoryTotals[ExpenseCategory.FIXED])}
                </span>
              </div>
              
              <div className="flex items-center justify-between bg-background p-3 rounded-lg" key={`recurring-${renderKey}-${initialAccountFilter}`}>
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500">Courante</Badge>
                  <span>Dépenses courantes</span>
                </div>
                <span className="font-semibold">
                  {new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  }).format(categoryTotals[ExpenseCategory.RECURRING])}
                </span>
              </div>
              
              <div className="flex items-center justify-between bg-background p-3 rounded-lg" key={`exceptional-${renderKey}-${initialAccountFilter}`}>
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-500">Exceptionnelle</Badge>
                  <span>Dépenses exceptionnelles</span>
                </div>
                <span className="font-semibold">
                  {new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  }).format(categoryTotals[ExpenseCategory.EXCEPTIONAL])}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liste des transactions avec filtres et tri */}
        <Tabs defaultValue="all" className="w-full" onValueChange={(value) => setTypeFilter(value as TransactionType | "all")}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex flex-col w-full md:w-auto">
              <TabsList className="w-full md:w-auto">
                <TabsTrigger value="all" className="relative">
                  Tout
                  <Badge variant="outline" className="ml-2">
                    {transactionCounts.all}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value={TransactionType.INCOME} className="relative">
                  Revenus
                  <Badge variant="outline" className="ml-2">
                    {transactionCounts.income}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value={TransactionType.EXPENSE} className="relative">
                  Dépenses
                  <Badge variant="outline" className="ml-2">
                    {transactionCounts.expense}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value={TransactionType.TRANSFER} className="relative">
                  Transferts
                  <Badge variant="outline" className="ml-2">
                    {transactionCounts.transfer}
                  </Badge>
                </TabsTrigger>
              </TabsList>
              
              {pagination.totalPages > 1 && (
                <div className="text-xs text-muted-foreground mt-1 text-center">
                  Les compteurs affichent le total pour le mois. {pagination.totalItems > pagination.pageSize && 
                    `Affichage de ${Math.min(pagination.totalItems, pagination.pageSize)} sur ${pagination.totalItems} transactions.`}
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              
              {/* Filtre par catégorie (uniquement pour les dépenses) */}
              {typeFilter === TransactionType.EXPENSE && (
                <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as ExpenseCategory | "all")}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value={ExpenseCategory.FIXED}>Fixes</SelectItem>
                    <SelectItem value={ExpenseCategory.RECURRING}>Courantes</SelectItem>
                    <SelectItem value={ExpenseCategory.EXCEPTIONAL}>Exceptionnelles</SelectItem>
                  </SelectContent>
                </Select>
              )}
              
              {/* Bouton Exporter en CSV */}
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportToCSV}
                className="mr-2"
              >
                <FileDown className="h-4 w-4 mr-2" /> Exporter CSV
              </Button>
              
              {/* Menu de tri */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Trier
                    {sortDirection === "asc" ? (
                      <SortAsc className="h-4 w-4 ml-2" />
                    ) : (
                      <SortDesc className="h-4 w-4 ml-2" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortField("date")}>
                    Date {sortField === "date" && "✓"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortField("amount")}>
                    Montant {sortField === "amount" && "✓"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortField("description")}>
                    Description {sortField === "description" && "✓"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      setSortDirection(
                        sortDirection === "asc" ? "desc" : "asc"
                      )
                    }
                  >
                    {sortDirection === "asc" ? "Descendant" : "Ascendant"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {isMobile ? (
                // Version mobile: liste de cartes au lieu d'un tableau
                <div className="space-y-3 p-3">
                  {allMonthTransactions.length === 0 ? (
                    <div className="text-center py-4 text-sm">
                      Aucune transaction n'a été enregistrée. Créez votre première transaction en cliquant sur "Ajouter".
                    </div>
                  ) : filteredTransactions.length === 0 ? (
                    <div className="text-center py-4 text-sm">
                      {pagination.totalItems > 0 ? 
                        <div>
                          <p>Aucune transaction ne correspond aux filtres sélectionnés.</p>
                          {pagination.totalPages > 1 && (
                            <p className="text-primary mt-2">
                              Il y a {pagination.totalItems} transactions au total. Essayez de changer de page ou de modifier vos filtres.
                            </p>
                          )}
                        </div> :
                        "Aucune transaction pour ce mois avec les filtres sélectionnés."
                      }
                    </div>
                  ) : (
                    paginatedTransactions.map((transaction) => (
                      <div 
                        key={transaction.id} 
                        className="bg-card border border-border rounded-lg p-3 shadow-sm"
                        onClick={() => handleEditTransaction(transaction)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            {getTransactionIcon(transaction.type, transaction)}
                            <span className="font-medium">
                              {format(new Date(transaction.date), "dd MMM", { locale: fr, })}
                            </span>
                          </div>
                          <div
                            className={cn(
                              "font-medium text-right",
                              getAmountColor(transaction.type, transaction)
                            )}
                          >
                            {formatAmount(transaction.amount, transaction.type, transaction)}
                          </div>
                        </div>
                        
                        <div className="text-sm mb-1 font-medium">{transaction.description}</div>
                        
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <div>
                            {transaction.type === TransactionType.TRANSFER ? (
                              <div>
                                <span>De: {getAccountName(transaction.accountId)}</span>
                                <br />
                                <span>Vers: {transaction.toAccountId && getAccountName(transaction.toAccountId)}</span>
                              </div>
                            ) : (
                              <span>{getAccountName(transaction.accountId)}</span>
                            )}
                          </div>
                          <div>
                            {transaction.type === TransactionType.EXPENSE && getCategoryBadge(transaction.category)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                // Version bureau: tableau standard
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Compte</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allMonthTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">
                        Aucune transaction n'a été enregistrée. Créez votre première transaction en cliquant sur "Ajouter".
                      </TableCell>
                    </TableRow>
                  ) : filteredTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">
                        {pagination.totalItems > 0 ? 
                          <div>
                            <p>Aucune transaction ne correspond aux filtres sélectionnés.</p>
                            {pagination.totalPages > 1 && (
                              <p className="text-sm text-primary mt-2">
                                Il y a {pagination.totalItems} transactions au total. Essayez de changer de page ou de modifier vos filtres.
                              </p>
                            )}
                          </div> :
                          "Aucune transaction pour ce mois avec les filtres sélectionnés."
                        }
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {getTransactionIcon(transaction.type, transaction)}
                            <span>
                              {format(new Date(transaction.date), "dd MMM yyyy", {
                                locale: fr,
                              })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {transaction.description}
                        </TableCell>
                        <TableCell>
                          {transaction.type === TransactionType.TRANSFER ? (
                            <div className="flex flex-col text-xs">
                              <span>De: {getAccountName(transaction.accountId)}</span>
                              <span>
                                Vers: {transaction.toAccountId && getAccountName(transaction.toAccountId)}
                              </span>
                            </div>
                          ) : (
                            getAccountName(transaction.accountId)
                          )}
                        </TableCell>
                        <TableCell>
                          {transaction.type === TransactionType.EXPENSE && getCategoryBadge(transaction.category)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-medium",
                            getAmountColor(transaction.type, transaction)
                          )}
                        >
                          <div className="flex items-center justify-end gap-2">
                            {formatAmount(transaction.amount, transaction.type, transaction)}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 ml-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditTransaction(transaction);
                              }}
                              title="Modifier la transaction"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              )}
            </CardContent>
            
            {/* Contrôles de pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-between items-center p-4 border-t bg-muted/30">
                <div className="text-sm font-medium">
                  <span className="text-primary">Page {pagination.currentPage}/{pagination.totalPages} : </span>
                  Affichage de {((pagination.currentPage - 1) * pagination.pageSize) + 1}-
                  {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems)} sur {pagination.totalItems} transactions
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                    disabled={pagination.currentPage === 1}
                    className={pagination.currentPage > 1 ? "bg-primary/10" : ""}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1">Précédent</span>
                  </Button>
                  
                  <div className="flex items-center">
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      // Afficher 5 pages maximum centrées sur la page courante
                      let pageNum = pagination.currentPage;
                      
                      if (pagination.totalPages <= 5) {
                        // Si 5 pages ou moins, afficher toutes les pages
                        pageNum = i + 1;
                      } else if (pagination.currentPage <= 3) {
                        // Si on est près du début, afficher les 5 premières pages
                        pageNum = i + 1;
                      } else if (pagination.currentPage >= pagination.totalPages - 2) {
                        // Si on est près de la fin, afficher les 5 dernières pages
                        pageNum = pagination.totalPages - 4 + i;
                      } else {
                        // Sinon, centrer sur la page courante
                        pageNum = pagination.currentPage - 2 + i;
                      }
                      
                      return (
                        <Button 
                          key={`page-${pageNum}`}
                          variant={pagination.currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          className="w-9 h-9"
                          onClick={() => setPagination(prev => ({ ...prev, currentPage: pageNum }))}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.min(prev.totalPages, prev.currentPage + 1) }))}
                    disabled={pagination.currentPage === pagination.totalPages}
                    className={pagination.currentPage < pagination.totalPages ? "bg-primary/10" : ""}
                  >
                    <span className="hidden sm:inline mr-1">Suivant</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                
                <Select
                  value={pagination.pageSize.toString()}
                  onValueChange={(value) => {
                    const newPageSize = Number(value);
                    setPagination(prev => ({
                      ...prev,
                      pageSize: newPageSize,
                      currentPage: 1, // Revenir à la première page quand on change la taille
                      totalPages: Math.ceil(prev.totalItems / newPageSize)
                    }));
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Par page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 par page</SelectItem>
                    <SelectItem value="10">10 par page</SelectItem>
                    <SelectItem value="20">20 par page</SelectItem>
                    <SelectItem value="50">50 par page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </Card>
        </Tabs>
      </div>
      
      {/* Formulaire d'édition de transaction */}
      {editingTransaction && isEditFormOpen && (
        <TransactionEditForm
          open={isEditFormOpen}
          transaction={editingTransaction}
          onClose={handleCloseEditForm}
          onSuccess={handleTransactionUpdated}
          onDelete={handleTransactionUpdated}
        />
      )}
    </>
  );
}
