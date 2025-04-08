/**
 * Composant AccountingJournal - Affichage du journal comptable
 * 
 * Fonctionnalités clés:
 * - Déduplication automatique des entrées lors de l'affichage (sans modification de la base de données)
 * - Fonction manuelle de nettoyage des doublons en base de données
 * - Support des modes calendaire et financier pour l'affichage des mois
 * - Filtrage par compte
 */
import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from "sonner";
import { useToast } from "@/components/ui/use-toast";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import db from '@/lib/db';
import { JournalEntry, JournalEntryName } from '@/lib/types';
import { accountingJournalService } from '@/lib/accountingJournalService';
import { useAccountFilter } from "@/contexts/AccountFilterContext";
import { useFinancialMonth } from "@/contexts/FinancialMonthContext";
import { Download, CalendarRange } from 'lucide-react';

interface AccountingJournalProps {
  yearMonth?: string;
}

export function AccountingJournal({ yearMonth }: AccountingJournalProps) {
  // Utiliser la date actuelle si aucun mois n'est fourni
  const defaultYearMonth = yearMonth || format(new Date(), 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultYearMonth);
  const { selectedAccount } = useAccountFilter();
  const { toast: showToast } = useToast();
  
  // Accéder au contexte de mois financier
  const { 
    isFinancialMonthEnabled, 
    financialMonthStartDay,
    getFinancialMonthRange 
  } = useFinancialMonth();
  
  // Calculer la plage de dates effective pour le mois sélectionné
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date; name: string }>(() => {
    // Créer une date médiane pour le mois (15 du mois)
    const medianDate = new Date(`${selectedMonth}-15`);
    return getFinancialMonthRange(medianDate);
  });
  
  // Mettre à jour la plage de dates lorsque le mois sélectionné ou le mode change
  useEffect(() => {
    // Créer une date médiane pour le mois (15 du mois)
    const medianDate = new Date(`${selectedMonth}-15`);
    const newRange = getFinancialMonthRange(medianDate);
    setDateRange(newRange);
    
    console.log(`Plage de dates mise à jour pour ${selectedMonth}:`, {
      mode: isFinancialMonthEnabled ? "Financier" : "Calendaire",
      startDay: isFinancialMonthEnabled ? financialMonthStartDay : 1,
      start: format(newRange.start, 'dd/MM/yyyy'),
      end: format(newRange.end, 'dd/MM/yyyy'),
      name: newRange.name
    });
  }, [selectedMonth, isFinancialMonthEnabled, financialMonthStartDay, getFinancialMonthRange]);
  
  // Initialisation du queryClient pour les invalidations de cache
  const queryClient = useQueryClient();
  
  // Fonction pour éliminer les doublons du journal (suppression physique en base de données)
  const handleCleanupDuplicates = async () => {
    try {
      const { removeJournalDuplicatesForMonth } = await import('@/lib/repairDB');
      const removedCount = await removeJournalDuplicatesForMonth(selectedMonth);

      await refetch();

      if (removedCount > 0) {
        toast.success(`${removedCount} doublons supprimés définitivement de la base.`);
      } else {
        toast.info('Aucun doublon trouvé dans la base.');
      }
    } catch (error) {
      console.error('Erreur lors de la suppression des doublons:', error);
      toast.error('Erreur lors de la suppression des doublons. Consultez la console pour plus de détails.');
    }
  };

  // Fonction pour régénérer COMPLÈTEMENT le journal
  const handleRegenerateJournal = async () => {
    try {
      // Utiliser la fonction toast de sonner directement pour des messages simples
      toast("Régénération COMPLÈTE du journal en cours (cela peut prendre un moment)...");
      
      // Appeler la méthode du service qui efface tout et régénère
      await accountingJournalService.generateCompleteJournal(); // Correction du nom de la méthode
      
      // Rafraîchir les données affichées
      await refetch();
      
      // Notification de succès
      toast.success("Journal comptable régénéré avec succès !");
    } catch (error) {
      console.error('Erreur lors de la régénération du journal:', error);
      
      // Notification d'erreur
      toast.error("Erreur lors de la régénération du journal. Consultez la console pour plus de détails.");
    }
  };

  // Récupérer les entrées du journal pour la plage de dates définie par le mode (calendaire/financier)
  const { data: journalEntries = [], isLoading, refetch } = useQuery({
    queryKey: ['accountingJournal', selectedMonth, selectedAccount, isFinancialMonthEnabled, dateRange],
    queryFn: async () => {
      console.log('Fetching journal entries for', selectedMonth, 'account', selectedAccount);
      let entries;
      
      if (isFinancialMonthEnabled) {
        // En mode financier, récupérer selon la plage de dates calculée
        entries = await db.accountingJournal.getByDateRange(dateRange.start, dateRange.end);
      } else {
        // En mode calendaire, récupérer par mois (méthode existante)
        entries = await db.accountingJournal.getByMonth(selectedMonth);
      }
      
      // Filtrer par compte si un compte est sélectionné
      if (selectedAccount !== 'all') {
        // Montrer les entrées du compte sélectionné ET les soldes initiaux globaux
        return entries.filter(entry =>
          entry.accountId === Number(selectedAccount) ||
          (entry.name === 'INITIAL_BALANCE' && (entry.accountId === null || entry.accountId === undefined))
        );
      }
      
      // Si "tous les comptes" est sélectionné, montrer toutes les entrées
      return entries;
    },
    staleTime: 1000 * 30, // 30 secondes
    refetchInterval: 1000 * 60, // Rafraîchir toutes les minutes
  });
  
  // Récupérer tous les comptes pour afficher leur nom
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      return db.accounts.getAll();
    },
  });
  
  // Générer une liste de mois après avoir récupéré les comptes
  const monthOptions = useMemo(() => {
    const months = [];
    const currentDate = new Date();
    
    // Par défaut, générer des mois de -24 à +12 si pas de comptes
    if (!accounts || accounts.length === 0) {
      for (let i = -24; i <= 12; i++) {
        const date = new Date(currentDate);
        date.setMonth(currentDate.getMonth() + i);
        const value = format(date, 'yyyy-MM');
        const label = format(date, 'MMMM yyyy', { locale: fr });
        months.push({ value, label, disabled: false });
      }
      return months;
    }
    
    // Déterminer la date du plus ancien compte sélectionné
    let oldestAccountDate = new Date();
    
    if (selectedAccount === 'all') {
      // Si tous les comptes sont sélectionnés, trouver le plus ancien
      const existingAccounts = accounts.filter(account => !account.isArchived);
      if (existingAccounts.length > 0) {
        oldestAccountDate = existingAccounts.reduce((oldest, account) => {
          const creationDate = new Date(account.createdAt);
          return creationDate < oldest ? creationDate : oldest;
        }, new Date());
      }
    } else {
      // Si un compte spécifique est sélectionné, utiliser sa date de création
      const selectedAccountObj = accounts.find(acc => acc.id === selectedAccount);
      if (selectedAccountObj) {
        oldestAccountDate = new Date(selectedAccountObj.createdAt);
      }
    }
    
    // Calculer le nombre de mois depuis la création du compte le plus ancien
    // Mais limiter à 48 mois (4 ans) en arrière maximum pour éviter une liste trop longue
    const monthsSinceOldestAccount = Math.min(
      48,
      ((currentDate.getFullYear() - oldestAccountDate.getFullYear()) * 12) + 
      (currentDate.getMonth() - oldestAccountDate.getMonth())
    );
    
    // Générer les mois depuis la création du compte le plus ancien jusqu'à 12 mois dans le futur
    for (let i = -monthsSinceOldestAccount; i <= 12; i++) {
      const date = new Date(currentDate);
      date.setMonth(currentDate.getMonth() + i);
      const value = format(date, 'yyyy-MM');
      const label = format(date, 'MMMM yyyy', { locale: fr });
      
      // Déterminer si ce mois est avant la création du compte
      const isBeforeAccountCreation = date < oldestAccountDate;
      
      months.push({ 
        value, 
        label,
        disabled: isBeforeAccountCreation // Désactiver si le mois est avant la création du compte
      });
    }
    
    return months;
  }, [accounts, selectedAccount]); // Dépendances correctes
  
  // Mettre à jour les entrées lors du changement de mois ou de compte
  useEffect(() => {
    refetch();
  }, [selectedMonth, selectedAccount, refetch]);
  
  // S'assurer que le mois sélectionné est valide au chargement du composant
  useEffect(() => {
    // Ne rien faire si monthOptions n'est pas encore défini ou si la liste est vide
    if (!monthOptions || monthOptions.length === 0) return;
    
    const isCurrentMonthDisabled = monthOptions.find(opt => opt.value === selectedMonth)?.disabled;
    
    if (isCurrentMonthDisabled) {
      // Si le mois actuel est invalide, sélectionner le premier mois valide
      const firstValidMonth = monthOptions.find(opt => !opt.disabled)?.value;
      if (firstValidMonth && firstValidMonth !== selectedMonth) {
        console.log(`Correction automatique: mois ${selectedMonth} invalide, sélection de ${firstValidMonth}`);
        setSelectedMonth(firstValidMonth);
        
        toast.info("Le mois affiché a été ajusté pour correspondre à la date de création du compte.");
      }
    }
  }, [monthOptions, selectedMonth]);
  
  // Fonction pour générer un export CSV du journal
  const handleExportCsv = async () => {
    try {
      const headers = ['Date', 'Catégorie', 'Description', 'Compte', 'Montant'];
      const rows = sortedEntries.map(entry => [
        new Date(entry.date).toLocaleDateString('fr-FR'),
        entry.category,
        entry.name,
        entry.accountId ? getAccountName(entry.accountId) : 'Global',
        entry.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
      ]);

      const csvArray = [
        headers.join(';'),
        ...rows.map(row => row.join(';'))
      ];

      const csvContent = '\uFEFF' + csvArray.join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `journal_${selectedMonth}_${selectedAccount !== 'all' ? 'compte_' + selectedAccount : 'tous_comptes'}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Erreur lors de l\'export CSV:', error);
    }
  };
  
  // Fonction pour obtenir le nom du compte
  const getAccountName = (accountId?: number) => {
    if (!accountId) return 'Tous les comptes';
    const account = accounts.find(acc => acc.id === accountId);
    return account ? account.name : `Compte #${accountId}`;
  };
  
  // Fonction pour formater les montants avec la couleur appropriée
  const formatAmount = (amount: number) => {
    const formattedAmount = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
    
    return {
      value: formattedAmount,
      className: amount < 0 ? 'text-red-600' : amount > 0 ? 'text-green-600' : '',
    };
  };
  
  // Fonction utilitaire de déduplication des entrées du journal (en mémoire)
  const removeDuplicateEntries = (entries: JournalEntry[]): JournalEntry[] => {
    // Créer un Map pour les entrées uniques
    const uniqueEntries = new Map<string, JournalEntry>();
    
    // Parcourir toutes les entrées
    for (const entry of entries) {
      // Créer une clé unique basée sur les propriétés de l'entrée
      const entryDate = new Date(entry.date);
      const dateStr = `${entryDate.getFullYear()}-${entryDate.getMonth() + 1}-${entryDate.getDate()}`;
      const key = `${dateStr}_${entry.category}_${entry.name}_${entry.amount}_${entry.accountId || 'global'}`;
      
      // Stratégie de résolution des doublons: 
      // Privilégier les entrées avec ID (déjà enregistrées en base) 
      // ou remplacer si la nouvelle entrée a un ID et l'ancienne non
      if (!uniqueEntries.has(key) || (entry.id && (!uniqueEntries.get(key)?.id))) {
        uniqueEntries.set(key, entry);
      }
    }
    
    // Retourner les entrées uniques sous forme de tableau
    return Array.from(uniqueEntries.values());
  };
  
  // Appliquer la déduplication
  const dedupedEntries = useMemo(() => removeDuplicateEntries(journalEntries), [journalEntries]);

  // Trier les entrées : Solde initial en premier, puis par date croissante
  const sortedEntries = useMemo(() => {
    return [...dedupedEntries].sort((a, b) => {
      if (a.name === 'INITIAL_BALANCE' && b.name !== 'INITIAL_BALANCE') return -1;
      if (b.name === 'INITIAL_BALANCE' && a.name !== 'INITIAL_BALANCE') return 1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [dedupedEntries]);
  
  // Fonction pour déterminer si une entrée est en en-tête ou résumé
  const isHeaderOrSummary = (entry: JournalEntry) => {
    return entry.name === JournalEntryName.INITIAL_BALANCE ||
           entry.name === JournalEntryName.MONTHLY_INCOME_TOTAL ||
           entry.name === JournalEntryName.MONTHLY_EXPENSE_TOTAL ||
           entry.name === JournalEntryName.MONTHLY_BALANCE ||
           entry.name === JournalEntryName.EXPECTED_BALANCE ||
           entry.name === JournalEntryName.ADJUSTED_BALANCE;
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle>Journal Comptable</CardTitle>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex flex-col md:flex-row md:items-center md:space-x-4">
              <div className="font-semibold">
                {selectedAccount !== 'all' 
                  ? `Compte: ${getAccountName(selectedAccount as number)}`
                  : 'Tous les comptes'}
              </div>
              <div className="font-semibold text-lg text-green-700 dark:text-green-400">
                {(() => {
                  const soldePrev = sortedEntries.find(e => e.name === 'Solde Prévu Fin de Mois');
                  return soldePrev
                    ? soldePrev.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
                    : '';
                })()}
              </div>
            </div>
            <div className="flex items-center text-sm mt-1">
              <CalendarRange className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              {isFinancialMonthEnabled ? (
                <span className="text-primary font-medium">
                  Période financière: {format(dateRange.start, 'dd/MM/yyyy')} au {format(dateRange.end, 'dd/MM/yyyy')}
                  <span className="ml-1 text-xs text-muted-foreground">(mois du {financialMonthStartDay})</span>
                </span>
              ) : (
                <span className="text-primary font-medium">
                  Période calendaire: {format(dateRange.start, 'dd/MM/yyyy')} au {format(dateRange.end, 'dd/MM/yyyy')}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <Select
            value={selectedMonth}
            onValueChange={(value) => {
              // Vérifier si le mois sélectionné n'est pas désactivé
              const isDisabled = monthOptions.find(opt => opt.value === value)?.disabled;
              if (!isDisabled) {
                setSelectedMonth(value);
              } else {
                // Si le mois est désactivé, prendre le premier mois valide
                const firstValidMonth = monthOptions.find(opt => !opt.disabled)?.value;
                if (firstValidMonth) {
                  setSelectedMonth(firstValidMonth);
                  toast.error("Le mois sélectionné est antérieur à la création du compte. Un mois valide a été sélectionné automatiquement.");
                }
              }
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sélectionner un mois" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(month => (
                <SelectItem 
                  key={month.value} 
                  value={month.value} 
                  disabled={month.disabled}
                >
                  {month.label}
                  {month.disabled && <span className="ml-2 text-muted-foreground text-xs">(invalide)</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            onClick={handleCleanupDuplicates} 
            className="mr-2 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-950/30 dark:hover:bg-yellow-950/50"
            title="Supprime physiquement les doublons de la base de données. Noter que les doublons sont déjà masqués automatiquement dans l'affichage."
          >
            Nettoyer la base (doublons)
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleRegenerateJournal} 
            className="mr-2 bg-orange-100 hover:bg-orange-200 dark:bg-orange-950/30 dark:hover:bg-orange-950/50"
          >
            Regénérer le journal
          </Button>
          
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">Chargement du journal comptable...</div>
        ) : sortedEntries.length === 0 ? (
          <div className="text-center py-8">
            <div>Aucune entrée dans le journal pour cette période.</div>
            <Button
              variant="outline"
              className="mt-4"
              onClick={async () => {
                try {
                  console.log(`Génération du journal pour le mois ${selectedMonth}...`);
                  // Utiliser la même fonction que pour la régénération
                  await handleRegenerateJournal();
                  alert(`Journal généré avec succès pour ${selectedMonth}`);
                } catch (error) {
                  console.error('Erreur lors de la génération du journal:', error);
                  alert('Erreur lors de la génération du journal. Consultez la console pour plus de détails.');
                }
              }}
            >
              Générer le journal pour ce mois
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableCaption>
                Journal comptable - 
                {isFinancialMonthEnabled 
                  ? ` Période financière ${format(dateRange.start, 'dd/MM')} au ${format(dateRange.end, 'dd/MM/yyyy')}`
                  : ` Période calendaire ${format(dateRange.start, 'dd/MM')} au ${format(dateRange.end, 'dd/MM/yyyy')}`
                }
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Compte</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Afficher directement les entrées triées sans regroupement par mois */}
                {sortedEntries.map((entry, index) => {
                  const formattedAmount = formatAmount(entry.amount);
                  const isSpecial = isHeaderOrSummary(entry);
                  
                  return (
                    <TableRow 
                      key={entry.id || index}
                      className={`
                        ${isSpecial ? 'font-semibold bg-muted/20' : ''}
                        ${entry.name === JournalEntryName.INITIAL_BALANCE ? 'bg-blue-50 dark:bg-blue-950/30' : ''}
                        ${entry.name === JournalEntryName.EXPECTED_BALANCE ? 'bg-amber-50 dark:bg-amber-950/30' : ''}
                        ${entry.name === JournalEntryName.ADJUSTED_BALANCE ? 'bg-green-50 dark:bg-green-950/30' : ''}
                        ${entry.name === JournalEntryName.MONTHLY_BALANCE ? 'bg-purple-50 dark:bg-purple-950/30' : ''}
                        hover:bg-muted/50
                      `}
                    >
                      <TableCell>
                        {format(new Date(entry.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        {entry.category}
                      </TableCell>
                      <TableCell>
                        {entry.name}
                      </TableCell>
                      <TableCell>
                        {entry.accountId ? getAccountName(entry.accountId) : 'Global'}
                      </TableCell>
                      <TableCell className={`text-right ${formattedAmount.className}`}>
                        {formattedAmount.value}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            <div className="mt-4 flex justify-end">
              <Button onClick={handleExportCsv} className="bg-primary mr-2">
                <Download className="h-4 w-4 mr-2" />
                Exporter CSV
              </Button>
              <Button onClick={async () => {
                try {
                  const months = [];
                  const currentDate = new Date(`${selectedMonth}-01`);
                  for (let i = 0; i < 6; i++) {
                    const date = new Date(currentDate);
                    date.setMonth(currentDate.getMonth() + i);
                    months.push(format(date, 'yyyy-MM'));
                  }

                  const allEntries = [];
                  for (const month of months) {
                    const entries = await db.accountingJournal.getByMonth(month);
                    const filtered = entries.filter(entry => {
                      if (selectedAccount !== 'all') {
                        return entry.accountId === Number(selectedAccount) ||
                          (entry.name === 'INITIAL_BALANCE' && (entry.accountId === null || entry.accountId === undefined));
                      }
                      return true;
                    });
                    allEntries.push(...filtered);
                  }

                  // Trier toutes les entrées par date
                  allEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                  const headers = ['Date', 'Catégorie', 'Description', 'Compte', 'Montant'];
                  const rows = allEntries.map(entry => [
                    new Date(entry.date).toLocaleDateString('fr-FR'),
                    entry.category,
                    entry.name,
                    entry.accountId ? getAccountName(entry.accountId) : 'Global',
                    entry.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
                  ]);

                  const csvArray = [
                    headers.join(';'),
                    ...rows.map(row => row.join(';'))
                  ];

                  const csvContent = '\uFEFF' + csvArray.join('\n');

                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.setAttribute('href', url);
                  link.setAttribute('download', `journal_6mois_${selectedAccount !== 'all' ? 'compte_' + selectedAccount : 'tous_comptes'}.csv`);
                  link.style.visibility = 'hidden';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                } catch (error) {
                  console.error('Erreur lors de l\'export CSV 6 mois:', error);
                }
              }} className="bg-primary">
                <Download className="h-4 w-4 mr-2" />
                Télécharger le journal (6 mois) au format CSV
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
