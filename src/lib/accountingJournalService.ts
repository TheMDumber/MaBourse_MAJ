import db from './db';
import { 
  Transaction, 
  TransactionType, 
  Account, 
  JournalEntry, 
  JournalCategory, 
  JournalEntryName 
} from './types';
import { format, getYear, getMonth, getDaysInMonth, addDays, subDays, isAfter, parseISO } from 'date-fns';
import { getCachedBalance, setCachedBalance, clearCache } from '../../cache';

export class AccountingJournalService {
  /**
   * Calcule le format 'yyyy-MM' du mois précédent en fonction du mode de mois
   */
  private getPreviousMonth(year: number, month: number, isFinancialMonth: boolean, financialMonthStartDay: number): string {
    // Calcul du premier jour du mois précédent
    let previousMonthYear = year;
    let previousMonth = month - 1;
    
    if (previousMonth === 0) { // Si on était en janvier (mois 1)
      previousMonth = 12; // Décembre
      previousMonthYear -= 1; // Année précédente
    }
    
    // Formater le mois précédent au format 'yyyy-MM'
    return `${previousMonthYear}-${previousMonth.toString().padStart(2, '0')}`;
  }

  /**
   * Régénère complètement le journal pour un mois spécifique
   * Cette méthode supprime toutes les entrées existantes et recrée le journal complet
   */
  public async regenerateJournalForMonth(yearMonth: string): Promise<void> {
    console.log(`Régénération complète du journal pour le mois ${yearMonth}`);
    
    // Récupérer les données nécessaires
    const accounts = await db.accounts.getAll();
    const allTransactions = await db.transactions.getAll();
    
    // Supprimer TOUTES les entrées existantes pour ce mois
    await db.accountingJournal.deleteAllEntriesForMonth(yearMonth);
    
        // Pour chaque compte, générer son journal du mois
        for (const account of accounts) {
          // Fournir les arguments optionnels manquants
          await this.generateJournalForAccountAndMonth(account, yearMonth, allTransactions, false, 1); 
        }
        
        // Générer un journal consolidé pour tous les comptes
        await this.generateConsolidatedJournalForMonth(yearMonth, accounts, allTransactions, false, 1);
    
    console.log(`Journal pour le mois ${yearMonth} régénéré avec succès`);
  }
  
  /**
   * Supprime toutes les entrées du journal pour un mois spécifique
   */
  private async clearAllEntriesForMonth(yearMonth: string): Promise<void> {
    try {
      const entries = await db.accountingJournal.getByMonth(yearMonth);
      
      if (entries.length === 0) {
        return;
      }
      
      console.log(`Suppression de ${entries.length} entrées pour le mois ${yearMonth}`);
      
      for (const entry of entries) {
        await db.accountingJournal.delete(entry.id!);
      }
    } catch (error) {
      console.error(`Erreur lors de la suppression des entrées du journal pour le mois ${yearMonth}:`, error);
    }
  }
  
  /**
   * Supprime une entrée spécifique du journal pour éviter les doublons
   * Utilisé pour supprimer les soldes initiaux existants avant d'en générer de nouveaux
   */
  private async deleteSpecificEntry(yearMonth: string, accountId: number | undefined, entryName: string): Promise<void> {
    try {
      const entries = await db.accountingJournal.getByMonth(yearMonth);
      
      // Trouver les entrées correspondant aux critères
      let matchingEntries = entries.filter(entry => entry.name === entryName && entry.yearMonth === yearMonth);
      if (accountId !== undefined) {
        matchingEntries = matchingEntries.filter(entry => entry.accountId === accountId);
      }
      
      if (matchingEntries.length > 0) {
        console.log(`Suppression de ${matchingEntries.length} entrées de type "${entryName}" pour ${accountId ? `le compte #${accountId}` : 'consolidation'} - Mois ${yearMonth}`);
        
        // Supprimer chaque entrée trouvée
        for (const entry of matchingEntries) {
          await db.accountingJournal.delete(entry.id!);
        }
      }
    } catch (error) {
      console.error(`Erreur lors de la suppression des entrées spécifiques: ${error}`);
    }
  }

  /**
   * Génère le journal comptable complet à partir des transactions et des comptes
   * Cette méthode assure une couverture temporelle complète du journal,
   * depuis la création du compte le plus ancien jusqu'à la date actuelle,
   * plus 12 mois de prévision.
   */
  public async generateCompleteJournal(): Promise<void> {
    console.log('Génération du journal comptable complet...');
    
    // Récupérer toutes les transactions et tous les comptes
    const transactions = await db.transactions.getAll();
    const accounts = await db.accounts.getAll();
    
    // Trier les transactions par date
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Déterminer la plage de dates à traiter
    const startDate = this.getEarliestDate(accounts, transactions);
    
    // Déterminer la date de fin pour inclure 12 mois de prévision à partir du mois actuel
    const currentDate = new Date();
    const endDate = new Date(currentDate);
    endDate.setFullYear(currentDate.getFullYear() + 1); // +12 mois de prévision
    
    console.log(`Génération du journal depuis ${format(startDate, 'dd/MM/yyyy')} jusqu'à ${format(endDate, 'dd/MM/yyyy')} (incluant 12 mois de prévision)`);
    
    // Parcourir mois par mois et générer le journal
    let currentMonthDate = new Date(startDate);
    const months = [];
    
    while (currentMonthDate <= endDate) {
      const yearMonth = format(currentMonthDate, 'yyyy-MM');
      months.push(yearMonth);
      
      // Passer au mois suivant
      currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
    }
    
    // Utiliser la méthode de génération pour plusieurs mois
    console.log(`Génération du journal pour ${months.length} mois, de ${months[0]} à ${months[months.length - 1]}...`);
    await this.generateJournalForMultipleMonths(months);
    
    console.log('Journal comptable généré avec succès pour toute la période historique et prévisionnelle.');
    
    // Sauvegarder l'état du journal dans le cache pour optimiser les futures générations
    await this.saveJournalState();
  }
  
  /**
   * Génère le journal pour un mois spécifique
   */
  public async generateJournalForMonth(yearMonth: string, 
                                      accounts?: Account[], 
                                      allTransactions?: Transaction[]): Promise<void> {
    console.log(`Génération du journal pour le mois ${yearMonth}`);
    
    // Récupérer les comptes et transactions si non fournis
    if (!accounts) accounts = await db.accounts.getAll();
    if (!allTransactions) allTransactions = await db.transactions.getAll();
    
    // Récupérer les préférences utilisateur pour le mode de mois et le jour financier
    const prefs = await db.preferences.get();
    const isFinancialMonth = prefs.useFinancialMonth;
    const financialMonthStartDay = prefs.financialMonthStartDay || 1;
    
    console.log(`Mode de mois: ${isFinancialMonth ? 'financier' : 'calendaire'}, Jour de début: ${financialMonthStartDay}`);
    
    // Supprimer toutes les entrées existantes pour ce mois pour éviter les doublons
    await this.clearAllEntriesForMonth(yearMonth);
    
    // Pour chaque compte, générer son journal du mois
    for (const account of accounts) {
      await this.generateJournalForAccountAndMonth(account, yearMonth, allTransactions, isFinancialMonth, financialMonthStartDay);
    }
    
    // Optionnel: générer un journal consolidé pour tous les comptes
    await this.generateConsolidatedJournalForMonth(yearMonth, accounts, allTransactions, isFinancialMonth, financialMonthStartDay);
  }
  
  /**
   * Génère un journal consolidé pour tous les comptes pour un mois spécifique
   */
  private async generateConsolidatedJournalForMonth(
    yearMonth: string, 
    accounts: Account[], 
    allTransactions: Transaction[],
    isFinancialMonth: boolean = false,
    financialMonthStartDay: number = 1
  ): Promise<void> {
    console.log(`Génération du journal consolidé pour le mois ${yearMonth}`);
    
    const [year, month] = yearMonth.split('-').map(Number);
    
    // Déterminer les dates du mois en fonction du mode calendaire ou financier
    let currentMonthStart, nextMonthStart;
    
    if (isFinancialMonth) {
      // Mois financier - commence le jour configuré
      currentMonthStart = new Date(year, month - 1, financialMonthStartDay);
      nextMonthStart = new Date(year, month, financialMonthStartDay);
    } else {
      // Mois calendaire - commence le 1er du mois
      currentMonthStart = new Date(year, month - 1, 1);
      nextMonthStart = new Date(year, month, 1);
    }
    
    // Le dernier jour du mois est la veille du premier jour du mois suivant
    const lastDayOfMonth = subDays(nextMonthStart, 1);
    
    // Supprimer spécifiquement le solde initial consolidé existant
    await this.deleteSpecificEntry(yearMonth, undefined, JournalEntryName.INITIAL_BALANCE);
    
    // 1. Trouver le solde initial consolidé (somme des soldes initiaux de tous les comptes)
    let initialConsolidatedBalance = 0;
    
    // Calculer correctement le mois précédent en fonction du mode de mois
    let previousMonth;
    if (isFinancialMonth) {
      // En mode mois financier, prendre le mois précédent avec le même jour de début
      const prevMonthDate = new Date(year, month - 2, financialMonthStartDay);
      previousMonth = format(prevMonthDate, 'yyyy-MM');
    } else {
      // En mode mois calendaire, simplement prendre le mois précédent
      previousMonth = `${month === 1 ? year - 1 : year}-${month === 1 ? '12' : String(month - 1).padStart(2, '0')}`;
    }
    
    console.log(`Recherche du solde final consolidé pour le mois précédent: ${previousMonth}`);
    
    // Rechercher d'abord les soldes ajustés ou prévus du mois précédent
    try {
      const previousMonthEntries = await db.accountingJournal.getByMonth(previousMonth);
      console.log(`Nombre d'entrées trouvées pour ${previousMonth}: ${previousMonthEntries.length}`);
      
      // Trouver d'abord le solde ajusté consolidé
      const adjustedConsolidatedEntry = previousMonthEntries.find(e => 
        !e.accountId && e.name === JournalEntryName.ADJUSTED_BALANCE);
      
      // Puis le solde prévu consolidé
      const expectedConsolidatedEntry = previousMonthEntries.find(e => 
        !e.accountId && e.name === JournalEntryName.EXPECTED_BALANCE);
      
      if (adjustedConsolidatedEntry) {
        initialConsolidatedBalance = adjustedConsolidatedEntry.amount;
        console.log(`Solde initial consolidé basé sur l'ajustement du mois précédent (${previousMonth}): ${initialConsolidatedBalance}`);
      } else if (expectedConsolidatedEntry) {
        initialConsolidatedBalance = expectedConsolidatedEntry.amount;
        console.log(`Solde initial consolidé basé sur le solde prévu du mois précédent (${previousMonth}): ${initialConsolidatedBalance}`);
      } else {
        console.log(`Aucun solde final consolidé trouvé pour ${previousMonth}, calcul à partir des comptes individuels`);
        // Si pas de solde consolidé, additionner les soldes individuels des comptes
        for (const account of accounts) {
          // Chercher d'abord le solde ajusté pour ce compte
          const adjustedAccountEntry = previousMonthEntries.find(e => 
            e.accountId === account.id && e.name === JournalEntryName.ADJUSTED_BALANCE);
          
          // Puis le solde prévu pour ce compte
          const expectedAccountEntry = previousMonthEntries.find(e => 
            e.accountId === account.id && e.name === JournalEntryName.EXPECTED_BALANCE);
          
          if (adjustedAccountEntry) {
            initialConsolidatedBalance += adjustedAccountEntry.amount;
            console.log(`Ajout du solde ajusté du compte #${account.id}: ${adjustedAccountEntry.amount}`);
          } else if (expectedAccountEntry) {
            initialConsolidatedBalance += expectedAccountEntry.amount;
            console.log(`Ajout du solde prévu du compte #${account.id}: ${expectedAccountEntry.amount}`);
          } else if (new Date(account.createdAt) < currentMonthStart) {
            // Si le compte existait déjà mais n'a pas d'entrée, calculer son solde
            const calculatedBalance = this.calculateBalanceAtDate(account, allTransactions, currentMonthStart);
            initialConsolidatedBalance += calculatedBalance;
            console.log(`Ajout du solde calculé du compte #${account.id}: ${calculatedBalance}`);
          }
        }
      }
    } catch (error) {
      console.error(`Erreur lors de la récupération des soldes du mois précédent: ${error}`);
      
      // Fallback: utiliser les soldes initiaux des comptes + transactions antérieures
      for (const account of accounts) {
        if (new Date(account.createdAt) < currentMonthStart) {
          initialConsolidatedBalance += this.calculateBalanceAtDate(account, allTransactions, currentMonthStart);
        }
      }
    }
    
    // 2. Ajouter systématiquement l'entrée de solde initial consolidé
    const initialBalanceEntry: JournalEntry = {
      date: currentMonthStart, // Premier jour du mois
      category: JournalCategory.BALANCE,
      name: JournalEntryName.INITIAL_BALANCE,
      amount: initialConsolidatedBalance,
      isCalculated: true,
      yearMonth,
      accountId: undefined // Pas de compte spécifique car consolidé
    };
    
    await db.accountingJournal.add(initialBalanceEntry);
    
    // 3. Filtrer les transactions du mois (tous comptes confondus)
    const monthTransactions = allTransactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= currentMonthStart && txDate < nextMonthStart;
    });
    
    // 4. Ajouter chaque transaction au journal consolidé
    for (const tx of monthTransactions) {
      // Pour le journal consolidé, on ne s'intéresse pas aux transferts entre comptes
      // car ils s'annulent à l'échelle globale
      if (tx.type === TransactionType.TRANSFER) {
        continue;
      }
      
      // Déterminer la catégorie en fonction du type de transaction
      let category: string;
      let amount: number;
      
      if (tx.type === TransactionType.INCOME) {
        category = JournalCategory.INCOME;
        amount = tx.amount; // Positif pour les revenus
      } else if (tx.type === TransactionType.EXPENSE) {
        // Sous-catégoriser les dépenses si possible
        if (tx.category?.includes('Fixe')) {
          category = JournalCategory.FIXED_EXPENSE;
        } else if (tx.category?.includes('Exceptionnelle')) {
          category = JournalCategory.EXCEPTIONAL_EXPENSE;
        } else {
          category = JournalCategory.CURRENT_EXPENSE;
        }
        amount = -tx.amount; // Négatif pour les dépenses
      } else {
        // Ne devrait pas arriver car on filtre les transferts
        continue;
      }
      
      const journalEntry: JournalEntry = {
        date: new Date(tx.date),
        category,
        name: tx.description,
        amount,
        isCalculated: false,
        yearMonth,
        transactionId: tx.id
      };
      
      await db.accountingJournal.add(journalEntry);
    }
    
    // 5. Calculer les résumés mensuels consolidés
    const journalEntries = await db.accountingJournal.getByMonth(yearMonth);
    const consolidatedEntries = journalEntries.filter(e => !e.accountId && !e.isCalculated);
    
    // Total des revenus
    const incomeTotal = consolidatedEntries
      .filter(e => e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0);
    
    const incomeTotalEntry: JournalEntry = {
      date: lastDayOfMonth, // Dernier jour du mois
      category: JournalCategory.SUMMARY,
      name: JournalEntryName.MONTHLY_INCOME_TOTAL,
      amount: incomeTotal,
      isCalculated: true,
      yearMonth
    };
    
    await db.accountingJournal.add(incomeTotalEntry);
    
    // Total des dépenses
    const expenseTotal = consolidatedEntries
      .filter(e => e.amount < 0)
      .reduce((sum, e) => sum + e.amount, 0);
    
    const expenseTotalEntry: JournalEntry = {
      date: lastDayOfMonth, // Dernier jour du mois
      category: JournalCategory.SUMMARY,
      name: JournalEntryName.MONTHLY_EXPENSE_TOTAL,
      amount: expenseTotal, // Déjà négatif
      isCalculated: true,
      yearMonth
    };
    
    await db.accountingJournal.add(expenseTotalEntry);
    
    // Balance du mois
    const monthlyBalance = incomeTotal + expenseTotal; // expenseTotal est déjà négatif
    
    const monthlyBalanceEntry: JournalEntry = {
      date: lastDayOfMonth, // Dernier jour du mois
      category: JournalCategory.SUMMARY,
      name: JournalEntryName.MONTHLY_BALANCE,
      amount: monthlyBalance,
      isCalculated: true,
      yearMonth
    };
    
    await db.accountingJournal.add(monthlyBalanceEntry);
    
    // 6. Calculer le solde prévu
    const expectedBalance = initialConsolidatedBalance + monthlyBalance;
    
    const expectedBalanceEntry: JournalEntry = {
      date: lastDayOfMonth, // Dernier jour du mois (veille du 1er jour du mois m+1)
      category: JournalCategory.BALANCE,
      name: JournalEntryName.EXPECTED_BALANCE,
      amount: expectedBalance,
      isCalculated: true,
      yearMonth
    };
    
    await db.accountingJournal.add(expectedBalanceEntry);
    
    console.log(`Journal consolidé généré pour le mois ${yearMonth}`);
  }
  
  /**
   * Génère le journal pour un compte et un mois spécifiques
   */
  private async generateJournalForAccountAndMonth(account: Account, 
                                                yearMonth: string,
                                                allTransactions: Transaction[],
                                                isFinancialMonth: boolean = false,
                                                financialMonthStartDay: number = 1): Promise<void> {
    console.log(`Génération du journal pour le compte #${account.id} (${account.name}) - Mois ${yearMonth}`);
    
    const [year, month] = yearMonth.split('-').map(Number);
    
    // Déterminer les dates du mois en fonction du mode calendaire ou financier
    let currentMonthStart, nextMonthStart;
    
    if (isFinancialMonth) {
      // Mois financier - commence le jour configuré
      currentMonthStart = new Date(year, month - 1, financialMonthStartDay);
      nextMonthStart = new Date(year, month, financialMonthStartDay);
    } else {
      // Mois calendaire - commence le 1er du mois
      currentMonthStart = new Date(year, month - 1, 1);
      nextMonthStart = new Date(year, month, 1);
    }
    
    // Le dernier jour du mois est la veille du premier jour du mois suivant
    const lastDayOfMonth = subDays(nextMonthStart, 1);

    // Supprimer spécifiquement le solde initial existant pour ce compte et ce mois
    // afin d'éviter la duplication du solde initial
    await this.deleteSpecificEntry(yearMonth, account.id, JournalEntryName.INITIAL_BALANCE);
    
    // 1. Trouver le solde initial du mois
    let initialBalance = 0;
    
    // Si c'est le tout premier mois du compte, ajouter une entrée de création de compte
    if (new Date(account.createdAt) <= currentMonthStart) {
      if (new Date(account.createdAt).getFullYear() === year && 
          new Date(account.createdAt).getMonth() === month - 1) {
        // Ajouter l'entrée de création du compte
        const accountCreationEntry: JournalEntry = {
          date: new Date(account.createdAt),
          category: JournalCategory.BALANCE,
          name: "Création du compte",
          amount: account.initialBalance,
          isCalculated: false,
          yearMonth,
          accountId: account.id
        };
        await db.accountingJournal.add(accountCreationEntry);
        
        initialBalance = account.initialBalance;
        console.log(`Premier mois du compte, ajout de l'entrée de création et utilisation du solde initial: ${initialBalance}`);
      } else {
        // Sinon, chercher le solde ajusté ou prévu du mois précédent
        // Calculer correctement le mois précédent en fonction du mode de mois
        let previousMonth;
        if (isFinancialMonth) {
          // En mode mois financier, prendre le mois précédent avec le même jour de début
          const prevMonthDate = new Date(year, month - 2, financialMonthStartDay);
          previousMonth = format(prevMonthDate, 'yyyy-MM');
        } else {
          // En mode mois calendaire, simplement prendre le mois précédent
          previousMonth = `${month === 1 ? year - 1 : year}-${month === 1 ? '12' : String(month - 1).padStart(2, '0')}`;
        }
        
        console.log(`Recherche du solde final pour le mois précédent: ${previousMonth}`);
        
        try {
          const previousMonthEntries = await db.accountingJournal.getByMonth(previousMonth);
          console.log(`Nombre d'entrées trouvées pour ${previousMonth}: ${previousMonthEntries.length}`);
          
          // Filtrer pour ne garder que les entrées du compte spécifique
          const accountEntries = previousMonthEntries.filter(e => e.accountId === account.id);
          console.log(`Entrées pour le compte #${account.id}: ${accountEntries.length}`);
          
          // Chercher d'abord le solde ajusté (prioritaire)
          const adjustedBalanceEntry = accountEntries.find(e => 
            e.name === JournalEntryName.ADJUSTED_BALANCE);
          
          // Puis le solde prévu
          const expectedBalanceEntry = accountEntries.find(e => 
            e.name === JournalEntryName.EXPECTED_BALANCE);
          
          if (adjustedBalanceEntry) {
            initialBalance = adjustedBalanceEntry.amount;
            console.log(`Solde initial basé sur l'ajustement du mois précédent (${previousMonth}): ${initialBalance}`);
          } else if (expectedBalanceEntry) {
            initialBalance = expectedBalanceEntry.amount;
            console.log(`Solde initial basé sur le solde prévu du mois précédent (${previousMonth}): ${initialBalance}`);
          } else {
            // Fallback: calculer directement depuis les transactions
            initialBalance = this.calculateBalanceAtDate(account, allTransactions, currentMonthStart);
            console.log(`Aucun solde final trouvé pour ${previousMonth}, solde calculé depuis les transactions: ${initialBalance}`);
          }
        } catch (error) {
          console.error(`Erreur lors de la recherche du solde initial: ${error}`);
          // Fallback: calculer directement depuis les transactions
          initialBalance = this.calculateBalanceAtDate(account, allTransactions, currentMonthStart);
          console.log(`Solde initial calculé depuis les transactions (après erreur): ${initialBalance}`);
        }
      }
    }
    
  // 2. Ajouter l'entrée de création de compte si c'est le premier mois
  if (new Date(account.createdAt).getFullYear() === year && 
      new Date(account.createdAt).getMonth() === month - 1) {
    const accountCreationEntry: JournalEntry = {
      date: new Date(account.createdAt),
      category: JournalCategory.BALANCE,
      name: "Création du compte",
      amount: account.initialBalance,
      isCalculated: false,
      yearMonth,
      accountId: account.id
    };
    await db.accountingJournal.add(accountCreationEntry);
  }

  // 3. Ajouter systématiquement l'entrée de solde initial
  const initialBalanceEntry: JournalEntry = {
    date: currentMonthStart, // Premier jour du mois (calendaire ou financier)
    category: JournalCategory.BALANCE,
    name: JournalEntryName.INITIAL_BALANCE,
    amount: initialBalance,
    isCalculated: true,
    yearMonth,
    accountId: account.id
  };
  
  await db.accountingJournal.add(initialBalanceEntry);
    
    // 3. Filtrer les transactions du mois pour ce compte
    const accountTransactions = allTransactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= currentMonthStart && 
             txDate < nextMonthStart && 
             (tx.accountId === account.id || tx.toAccountId === account.id);
    });

    // Trier les transactions par date croissante
    accountTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    console.log(`${accountTransactions.length} transactions trouvées pour ce compte et ce mois`);

    // 4. Ajouter chaque transaction au journal
    for (const tx of accountTransactions) {
      const isSource = tx.accountId === account.id;
      const isDestination = tx.toAccountId === account.id;

      let category: string;
      let amount: number;

      if (tx.type === TransactionType.INCOME && isSource) {
        category = JournalCategory.INCOME;
        amount = tx.amount;
      } else if (tx.type === TransactionType.EXPENSE && isSource) {
        if (tx.category?.includes('Fixe')) {
          category = JournalCategory.FIXED_EXPENSE;
        } else if (tx.category?.includes('Exceptionnelle')) {
          category = JournalCategory.EXCEPTIONAL_EXPENSE;
        } else {
          category = JournalCategory.CURRENT_EXPENSE;
        }
        amount = -tx.amount;
      } else if (tx.type === TransactionType.TRANSFER) {
        if (isSource) {
          category = JournalCategory.CURRENT_EXPENSE;
          amount = -tx.amount;
        } else if (isDestination) {
          category = JournalCategory.INCOME;
          amount = tx.amount;
        } else {
          continue;
        }
      } else {
        continue;
      }

      const journalEntry: JournalEntry = {
        date: new Date(tx.date),
        category,
        name: tx.description,
        amount,
        isCalculated: false,
        yearMonth,
        accountId: account.id,
        transactionId: tx.id
      };

      await db.accountingJournal.add(journalEntry);
    }

    // 5. Calculer les totaux
    const journalEntries = await db.accountingJournal.getByMonth(yearMonth);

    // Supprimer toutes les anciennes entrées de résumé pour ce compte et ce mois
    const summaries = ['Total Revenus du Mois', 'Total Dépenses du Mois', 'Balance du Mois'];
    for (const summaryName of summaries) {
      await this.deleteSpecificEntry(yearMonth, account.id, summaryName);
    }

    // Filtrer uniquement les transactions réelles du compte courant
    const filteredEntries = journalEntries.filter(e =>
      e.accountId === account.id &&
      !e.isCalculated &&
      e.name !== 'Solde Initial' &&
      e.name !== 'Total Revenus du Mois' &&
      e.name !== 'Total Dépenses du Mois' &&
      e.name !== 'Balance du Mois' &&
      e.name !== 'Solde Prévu Fin de Mois' &&
      e.name !== 'Solde AJUSTÉ Fin de Mois'
    );

    const incomeTotal = filteredEntries
      .filter(e => e.amount > 0 && e.category !== 'Dépenses Exceptionnelles')
      .reduce((sum, e) => sum + e.amount, 0);

    const expenseTotal = filteredEntries
      .filter(e => e.amount < 0)
      .reduce((sum, e) => sum + e.amount, 0);

    const monthlyBalance = incomeTotal + expenseTotal;

    // Bloc résumé mensuel
    const incomeTotalEntry: JournalEntry = {
      date: lastDayOfMonth,
      category: JournalCategory.SUMMARY,
      name: JournalEntryName.MONTHLY_INCOME_TOTAL,
      amount: incomeTotal,
      isCalculated: true,
      yearMonth,
      accountId: account.id
    };
    await db.accountingJournal.add(incomeTotalEntry);

    const expenseTotalEntry: JournalEntry = {
      date: lastDayOfMonth,
      category: JournalCategory.SUMMARY,
      name: JournalEntryName.MONTHLY_EXPENSE_TOTAL,
      amount: expenseTotal,
      isCalculated: true,
      yearMonth,
      accountId: account.id
    };
    await db.accountingJournal.add(expenseTotalEntry);

    const monthlyBalanceEntry: JournalEntry = {
      date: lastDayOfMonth,
      category: JournalCategory.SUMMARY,
      name: JournalEntryName.MONTHLY_BALANCE,
      amount: monthlyBalance,
      isCalculated: true,
      yearMonth,
      accountId: account.id
    };
    await db.accountingJournal.add(monthlyBalanceEntry);

    // 6. Solde prévu fin de mois
    const expectedBalance = initialBalance + monthlyBalance;

    const expectedBalanceEntry: JournalEntry = {
      date: lastDayOfMonth,
      category: JournalCategory.BALANCE,
      name: JournalEntryName.EXPECTED_BALANCE,
      amount: expectedBalance,
      isCalculated: true,
      yearMonth,
      accountId: account.id
    };
    await db.accountingJournal.add(expectedBalanceEntry);

    // 7. Solde ajusté fin de mois (si existe)
    try {
      const balanceAdjustment = await db.balanceAdjustments.getByAccountAndMonth(account.id, yearMonth);

      if (balanceAdjustment) {
        const adjustedBalanceDate = addDays(lastDayOfMonth, 1);

        const adjustedBalanceEntry: JournalEntry = {
          date: adjustedBalanceDate,
          category: JournalCategory.BALANCE,
          name: JournalEntryName.ADJUSTED_BALANCE,
          amount: balanceAdjustment.adjustedBalance,
          isCalculated: true,
          yearMonth,
          accountId: account.id
        };

        await db.accountingJournal.add(adjustedBalanceEntry);
        console.log(`Ajustement de solde ajouté: ${balanceAdjustment.adjustedBalance}`);
      }
    } catch (error) {
      console.error(`Erreur lors de la recherche d'ajustement de solde: ${error}`);
    }

    console.log(`Journal généré pour le compte #${account.id} (${account.name}) - Mois ${yearMonth}`);
  }
  
  /**
   * Calcule le solde à une date donnée en utilisant uniquement les transactions
   * Cette méthode est utilisée comme fallback quand aucun solde n'est disponible dans le journal
   */
  private calculateBalanceAtDate(account: Account, 
                                transactions: Transaction[], 
                                date: Date): number {
    const accountCreationDate = new Date(account.createdAt);
    console.log(`Calcul du solde pour le compte #${account.id} (${account.name}) à la date ${date.toISOString()}`);
    console.log(`Date de création du compte: ${accountCreationDate.toISOString()}, Solde initial: ${account.initialBalance}`);
    
    // Si la date demandée est antérieure à la création du compte, retourner 0
    if (date < accountCreationDate) {
      console.log(`La date demandée est antérieure à la création du compte, retourne 0`);
      return 0;
    }
    
    // Filtrer les transactions antérieures à la date spécifiée
    const relevantTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate < date && (tx.accountId === account.id || tx.toAccountId === account.id);
    });
    
    console.log(`${relevantTransactions.length} transactions trouvées avant ${date.toISOString()}`);
    
    // Partir du solde initial du compte
    let balance = account.initialBalance;
    
    // Appliquer toutes les transactions dans l'ordre chronologique
    relevantTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    for (const tx of relevantTransactions) {
      if (tx.accountId === account.id) {
        if (tx.type === TransactionType.INCOME) {
          balance += tx.amount;
          console.log(`Revenu: +${tx.amount} (${tx.description}) => ${balance}`);
        } else if (tx.type === TransactionType.EXPENSE) {
          balance -= tx.amount;
          console.log(`Dépense: -${tx.amount} (${tx.description}) => ${balance}`);
        } else if (tx.type === TransactionType.TRANSFER) {
          balance -= tx.amount;
          console.log(`Transfert sortant: -${tx.amount} (${tx.description}) => ${balance}`);
        }
      }
      
      if (tx.toAccountId === account.id && tx.type === TransactionType.TRANSFER) {
        balance += tx.amount;
        console.log(`Transfert entrant: +${tx.amount} (${tx.description}) => ${balance}`);
      }
    }
    
    console.log(`Solde final calculé pour le compte #${account.id}: ${balance}`);
    return balance;
  }
  
  /**
   * Détermine la date la plus ancienne parmi les comptes et transactions
   */
  private getEarliestDate(accounts: Account[], transactions: Transaction[]): Date {
    let earliestDate = new Date();
    
    // Vérifier les dates de création des comptes
    for (const account of accounts) {
      const creationDate = new Date(account.createdAt);
      if (creationDate < earliestDate) {
        earliestDate = creationDate;
      }
    }
    
    // Vérifier les dates des transactions
    for (const tx of transactions) {
      const txDate = new Date(tx.date);
      if (txDate < earliestDate) {
        earliestDate = txDate;
      }
    }
    
    // Retourner le premier jour du mois de la date la plus ancienne
    return new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
  }
  
  /**
   * Met à jour le journal suite à l'ajout d'une transaction
   */
  public async handleTransactionAdded(transaction: Transaction): Promise<void> {
    const yearMonth = format(new Date(transaction.date), 'yyyy-MM');
    console.log(`Mise à jour du journal suite à l'ajout de la transaction #${transaction.id} pour ${yearMonth}`);
    
    await this.generateJournalForMonth(yearMonth);
    
    // Si c'est un transfert, il peut affecter deux comptes
    if (transaction.type === TransactionType.TRANSFER && transaction.toAccountId) {
      // Vérifier si le compte de destination est dans un mois différent
      const toAccountYearMonth = yearMonth; // Généralement le même mois
      if (toAccountYearMonth !== yearMonth) {
        await this.generateJournalForMonth(toAccountYearMonth);
      }
    }
    
    // Régénérer les mois suivants car le solde initial a pu changer
    await this.regenerateFollowingMonths(yearMonth);

    // Nettoyer les doublons et régénérer tout le journal
    const { cleanupAllJournalDuplicates } = await import('@/lib/repairDB');
    await cleanupAllJournalDuplicates();
    await this.generateCompleteJournal();
  }
  
  /**
   * Met à jour le journal suite à la modification d'une transaction
   */
  public async handleTransactionUpdated(transaction: Transaction): Promise<void> {
    console.log(`Mise à jour du journal suite à la modification de la transaction #${transaction.id}`);
    
    try {
      // Récupérer l'ancienne entrée pour connaître son mois
      const oldEntries = await db.accountingJournal.getEntriesByTransactionId(transaction.id);
      const oldYearMonths = new Set(oldEntries.map(e => e.yearMonth));
      
      // Supprimer les entrées existantes pour cette transaction
      await db.accountingJournal.deleteByTransactionId(transaction.id);
      
      // Générer les entrées pour le nouveau mois
      const newYearMonth = format(new Date(transaction.date), 'yyyy-MM');
      await this.generateJournalForMonth(newYearMonth);
      
      // Régénérer tous les mois concernés et les suivants
      const monthsToRegenerate = [...oldYearMonths, newYearMonth];
      for (const month of monthsToRegenerate) {
        await this.regenerateFollowingMonths(month);
      }

      console.log(`Journal mis à jour avec succès pour la transaction #${transaction.id}`);
    } catch (error) {
      console.error(`Erreur lors de la mise à jour du journal pour la transaction #${transaction.id}:`, error);
      // Réessayer de générer uniquement pour le mois actuel en cas d'erreur
      try {
        const currentYearMonth = format(new Date(transaction.date), 'yyyy-MM');
        console.log(`Tentative de récupération - Régénération du journal pour le mois ${currentYearMonth}`);
        await this.generateJournalForMonth(currentYearMonth);
      } catch (secondError) {
        console.error('Échec de la tentative de récupération:', secondError);
        throw new Error(`Impossible de mettre à jour le journal comptable: ${error}`);
      }
    }
  }
  
  /**
   * Met à jour le journal suite à la suppression d'une transaction
   */
  public async handleTransactionDeleted(transaction: Transaction): Promise<void> {
    console.log(`Mise à jour du journal suite à la suppression de la transaction #${transaction.id}`);
    
    // Récupérer les entrées liées à cette transaction pour connaître les mois concernés
    const entries = await db.accountingJournal.getEntriesByTransactionId(transaction.id);
    const yearMonths = new Set(entries.map(e => e.yearMonth));
    
    // Supprimer les entrées pour cette transaction
    await db.accountingJournal.deleteByTransactionId(transaction.id);
    
    // Régénérer chaque mois concerné
    for (const yearMonth of yearMonths) {
      await this.generateJournalForMonth(yearMonth);
      // Régénérer les mois suivants
      await this.regenerateFollowingMonths(yearMonth);
    }
  }
  
  /**
   * Génère le journal comptable pour plusieurs mois
   * Cette méthode est utile pour l'anticipation et la génération en masse
   */
  public async generateJournalForMultipleMonths(months: string[]): Promise<void> {
    console.log(`Génération du journal pour ${months.length} mois: ${months.join(', ')}`);
    
    // Récupérer les données communes pour éviter de les récupérer à chaque fois
    const accounts = await db.accounts.getAll();
    const allTransactions = await db.transactions.getAll();
    
    // Générer le journal pour chaque mois
    for (let i = 0; i < months.length; i++) {
      const month = months[i];
      console.log(`Génération du journal pour le mois ${month} (${i + 1}/${months.length})...`);
      
      // Utiliser les données déjà récupérées
      await this.generateJournalForMonth(month, accounts, allTransactions);
      
      console.log(`Journal pour le mois ${month} généré avec succès (${i + 1}/${months.length})`);
    }
    
    console.log(`Génération terminée pour tous les mois: ${months.join(', ')}`);
  }

  /**
   * Régénère les mois suivant un mois donné
   */
  private async regenerateFollowingMonths(startYearMonth: string): Promise<void> {
    console.log(`Régénération des mois suivant ${startYearMonth}`);
    
    // Utiliser la version optimisée qui exploite le cache
    await this.regenerateFollowingMonthsOptimized(startYearMonth);
  }
  
  /**
   * Récupère les entrées du journal pour affichage
   */
  public async getJournalEntries(yearMonth: string, accountId?: number): Promise<JournalEntry[]> {
    try {
      const entries = await db.accountingJournal.getByMonth(yearMonth);
      
      // Filtrer par compte si nécessaire
      let filteredEntries;
      if (accountId) {
        // Si un compte spécifique est demandé, montrer uniquement les entrées pour ce compte
        filteredEntries = entries.filter(e => e.accountId === accountId);
      } else {
        // Si aucun compte spécifique n'est demandé, montrer toutes les entrées des comptes individuels
        filteredEntries = entries.filter(e => e.accountId !== undefined);
      }
      
      // Déduplicater les entrées identiques
      const uniqueEntries = this.removeDuplicateEntries(filteredEntries);
      
      // Trier les entrées avec une logique spéciale
      return uniqueEntries.sort((a, b) => {
        // Mettre TOUJOURS le Solde Initial en premier, quelle que soit sa date
        if (a.name === JournalEntryName.INITIAL_BALANCE) return -1;
        if (b.name === JournalEntryName.INITIAL_BALANCE) return 1;
        
        // Ensuite trier par date
        const dateComparison = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateComparison !== 0) return dateComparison;
        
        // Puis par catégorie selon un ordre logique
        const categoryOrder = {
          [JournalCategory.BALANCE]: 1,
          [JournalCategory.INCOME]: 2,
          [JournalCategory.FIXED_EXPENSE]: 3,
          [JournalCategory.CURRENT_EXPENSE]: 4,
          [JournalCategory.EXCEPTIONAL_EXPENSE]: 5,
          [JournalCategory.SUMMARY]: 6
        };
        
        const aCategoryOrder = categoryOrder[a.category as JournalCategory] || 99;
        const bCategoryOrder = categoryOrder[b.category as JournalCategory] || 99;
        
        if (aCategoryOrder !== bCategoryOrder) return aCategoryOrder - bCategoryOrder;
        
        // Enfin, pour les résumés, mettre dans un ordre logique
        const summaryOrder = {
          [JournalEntryName.MONTHLY_INCOME_TOTAL]: 1,
          [JournalEntryName.MONTHLY_EXPENSE_TOTAL]: 2,
          [JournalEntryName.MONTHLY_BALANCE]: 3,
          [JournalEntryName.EXPECTED_BALANCE]: 4,
          [JournalEntryName.ADJUSTED_BALANCE]: 5
        };
        
        const aSummaryOrder = summaryOrder[a.name as JournalEntryName] || 99;
        const bSummaryOrder = summaryOrder[b.name as JournalEntryName] || 99;
        
        return aSummaryOrder - bSummaryOrder;
      });
    } catch (error) {
      console.error(`Erreur lors de la récupération des entrées du journal: ${error}`);
      return [];
    }
  }
  
  /**
   * Supprime les entrées dupliquées dans le journal
   */
  private removeDuplicateEntries(entries: JournalEntry[]): JournalEntry[] {
    // Créer un Map pour les entrées uniques
    const uniqueEntries = new Map<string, JournalEntry>();
    
    // Parcourir toutes les entrées
    for (const entry of entries) {
      // Créer une clé unique basée sur les propriétés de l'entrée
      const entryDate = new Date(entry.date);
      const dateStr = `${entryDate.getFullYear()}-${entryDate.getMonth() + 1}-${entryDate.getDate()}`;
      const key = `${dateStr}_${entry.category}_${entry.name}_${entry.amount}_${entry.accountId || 'global'}`;
      
      // Si cette entrée n'existe pas encore ou si elle a un ID, la conserver
      if (!uniqueEntries.has(key) || entry.id) {
        uniqueEntries.set(key, entry);
      }
    }
    
    // Retourner les entrées uniques sous forme de tableau
    return Array.from(uniqueEntries.values());
  }
  
  /**
   * Récupère le solde à une date donnée à partir du journal
   */
  public async getBalanceFromJournal(date: Date, accountId?: number): Promise<number> {
    const yearMonth = format(date, 'yyyy-MM');
    const entries = await this.getJournalEntries(yearMonth, accountId);
    
    // Chercher d'abord un solde ajusté
    const adjustedEntry = entries.find(e => 
      (e.accountId === accountId || (!e.accountId && !accountId)) && 
      e.name === JournalEntryName.ADJUSTED_BALANCE);
      
    if (adjustedEntry) {
      console.log(`Solde ajusté trouvé pour ${yearMonth}: ${adjustedEntry.amount}`);
      return adjustedEntry.amount;
    }
    
    // Sinon, chercher un solde prévu
    const expectedEntry = entries.find(e => 
      (e.accountId === accountId || (!e.accountId && !accountId)) && 
      e.name === JournalEntryName.EXPECTED_BALANCE);
      
    if (expectedEntry) {
      console.log(`Solde prévu trouvé pour ${yearMonth}: ${expectedEntry.amount}`);
      return expectedEntry.amount;
    }
    
    // Si aucun solde final n'est trouvé, chercher le solde initial
    const initialEntry = entries.find(e => 
      (e.accountId === accountId || (!e.accountId && !accountId)) && 
      e.name === JournalEntryName.INITIAL_BALANCE);
      
    if (initialEntry) {
      console.log(`Solde initial trouvé pour ${yearMonth}: ${initialEntry.amount}`);
      return initialEntry.amount;
    }
    
    // Si aucune entrée n'est trouvée, retourner 0
    console.log(`Aucun solde trouvé pour ${yearMonth}`);
    return 0;
  }
  
  /**
   * Récupère le solde courant du mois pour affichage dans les transactions
   * Cette méthode priorise le solde ajusté puis le solde final/prévu
   */
  public async getCurrentMonthBalance(yearMonth: string, accountId?: number): Promise<{amount: number, source: string}> {
    console.log(`Recherche du solde pour le mois ${yearMonth} et le compte ${accountId || 'tous'}`);
    const entries = await db.accountingJournal.getByMonth(yearMonth);
    
    // Filtrer les entrées selon le compte sélectionné
    let filteredEntries;
    if (accountId !== undefined) {
      // Pour un compte spécifique
      filteredEntries = entries.filter(e => e.accountId === accountId);
      console.log(`${filteredEntries.length} entrées trouvées pour le compte #${accountId}`);
    } else {
      // Pour "Tous les comptes", on cherche dans les entrées globales (sans accountId)
      filteredEntries = entries.filter(e => !e.accountId);
      
      // Si pas d'entrées globales, on fait une somme des comptes individuels
      if (filteredEntries.length === 0) {
        console.log(`Pas d'entrées globales trouvées, agrégation des soldes individuels`);
        // Récupérer tous les comptes
        const accounts = await db.accounts.getAll();
        
        let totalAdjusted = 0;
        let totalExpected = 0;
        let hasAdjusted = false;
        let hasExpected = false;
        
        for (const account of accounts) {
          const accountEntries = entries.filter(e => e.accountId === account.id);
          
          // Chercher d'abord un solde ajusté
          const adjustedEntry = accountEntries.find(e => e.name === JournalEntryName.ADJUSTED_BALANCE);
          if (adjustedEntry) {
            totalAdjusted += adjustedEntry.amount;
            hasAdjusted = true;
            continue;
          }
          
          // Sinon utiliser le solde prévu
          const expectedEntry = accountEntries.find(e => e.name === JournalEntryName.EXPECTED_BALANCE);
          if (expectedEntry) {
            totalExpected += expectedEntry.amount;
            hasExpected = true;
          }
        }
        
        // Retourner le résultat agrégé
        if (hasAdjusted) {
          console.log(`Solde ajusté agrégé trouvé: ${totalAdjusted}`);
          return { amount: totalAdjusted, source: 'ajusté' };
        } else if (hasExpected) {
          console.log(`Solde prévu agrégé trouvé: ${totalExpected}`);
          return { amount: totalExpected, source: 'prévu' };
        }
      }
    }
    
    // 1. Priorité au solde ajusté (plus fiable car défini manuellement)
    const adjustedEntry = filteredEntries.find(e => e.name === JournalEntryName.ADJUSTED_BALANCE);
    if (adjustedEntry) {
      console.log(`Solde ajusté trouvé: ${adjustedEntry.amount}`);
      return { amount: adjustedEntry.amount, source: 'ajusté' };
    }
    
    // 2. Puis le solde prévu/final
    const expectedEntry = filteredEntries.find(e => e.name === JournalEntryName.EXPECTED_BALANCE);
    if (expectedEntry) {
      console.log(`Solde prévu trouvé: ${expectedEntry.amount}`);
      return { amount: expectedEntry.amount, source: 'prévu' };
    }
    
    // 3. En dernier recours, le solde initial
    const initialEntry = filteredEntries.find(e => e.name === JournalEntryName.INITIAL_BALANCE);
    if (initialEntry) {
      console.log(`Solde initial trouvé: ${initialEntry.amount}`);
      return { amount: initialEntry.amount, source: 'initial' };
    }
    
    // Si aucun solde n'est trouvé
    console.log(`Aucun solde trouvé pour ${yearMonth}, compte ${accountId || 'tous'}`);
    return { amount: 0, source: 'non trouvé' };
  }
  /**
   * Vérifier si le mois financier est activé dans les préférences
   */
  private async isFinancialMonthEnabled(): Promise<boolean> {
    try {
      const prefs = await db.preferences.get();
      return prefs.useFinancialMonth ?? false;
    } catch (error) {
      console.error('Erreur lors de la vérification du mois financier:', error);
      return false;
    }
  }

  /**
   * Obtenir le jour de début du mois financier depuis les préférences
   */
  private async getFinancialMonthStartDay(): Promise<number> {
    try {
      const prefs = await db.preferences.get();
      return prefs.financialMonthStartDay ?? 1;
    } catch (error) {
      console.error('Erreur lors de la récupération du jour de début du mois financier:', error);
      return 1; // Valeur par défaut
    }
  }

  /**
   * Génère le journal comptable pour une plage de dates spécifique
   * Utile pour le mode financier où les périodes ne correspondent pas aux mois calendaires
   */
  public async generateJournalForDateRange(startDate: Date, endDate: Date): Promise<void> {
    console.log(`Génération du journal pour la période du ${format(startDate, 'dd/MM/yyyy')} au ${format(endDate, 'dd/MM/yyyy')}`);
    
    // Récupérer tous les comptes et transactions
    const accounts = await db.accounts.getAll();
    const allTransactions = await db.transactions.getAll();
    
    // Récupérer les préférences utilisateur
    const prefs = await db.preferences.get();
    const isFinancialMonth = prefs.useFinancialMonth;
    const financialMonthStartDay = prefs.financialMonthStartDay || 1;
    
    console.log(`Mode de mois: ${isFinancialMonth ? 'financier' : 'calendaire'}, Jour de début: ${financialMonthStartDay}`);
    
    // Pour chaque compte, générer son journal pour cette période
    for (const account of accounts) {
      await this.generateJournalForAccountAndDateRange(account, startDate, endDate, allTransactions);
    }
    
    // Générer un journal consolidé pour tous les comptes pour cette période
    await this.generateConsolidatedJournalForDateRange(startDate, endDate, accounts, allTransactions);
    
    console.log(`Journal pour la période du ${format(startDate, 'dd/MM/yyyy')} au ${format(endDate, 'dd/MM/yyyy')} généré avec succès`);
  }
  
  /**
   * Génère le journal pour un compte et une plage de dates spécifiques
   */
  private async generateJournalForAccountAndDateRange(
    account: Account, 
    startDate: Date, 
    endDate: Date,
    allTransactions: Transaction[]
  ): Promise<void> {
    console.log(`Génération du journal pour le compte #${account.id} (${account.name}) - Période du ${format(startDate, 'dd/MM/yyyy')} au ${format(endDate, 'dd/MM/yyyy')}`);
    
    // Déterminer le mois (YYYY-MM) correspondant à la date de fin pour l'indexation
    const yearMonth = format(endDate, 'yyyy-MM');
    
    // 1. Trouver le solde initial à la date de début
    let initialBalance = 0;
    
    // Cas spécial: si la date de début est égale ou postérieure à la date de création du compte
    if (new Date(account.createdAt) <= startDate) {
      if (format(new Date(account.createdAt), 'yyyy-MM-dd') === format(startDate, 'yyyy-MM-dd')) {
        // Si c'est exactement le jour de création, utiliser le solde initial défini
        initialBalance = account.initialBalance;
        console.log(`Date de début = date de création du compte, utilisation du solde initial: ${initialBalance}`);
      } else {
        // Calculer le solde à la date de début à partir des transactions
        initialBalance = this.calculateBalanceAtDate(account, allTransactions, startDate);
        console.log(`Solde calculé à la date de début: ${initialBalance}`);
      }
    }
    
    // 2. Ajouter l'entrée de solde initial
    const initialBalanceEntry: JournalEntry = {
      date: startDate, // Date de début de la période
      category: JournalCategory.BALANCE,
      name: JournalEntryName.INITIAL_BALANCE,
      amount: initialBalance,
      isCalculated: true,
      yearMonth,
      accountId: account.id
    };
    
    await db.accountingJournal.add(initialBalanceEntry);
    
    // 3. Filtrer les transactions de la période pour ce compte
    const accountTransactions = allTransactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= startDate && 
             txDate <= endDate && 
             (tx.accountId === account.id || tx.toAccountId === account.id);
    });
    
    console.log(`${accountTransactions.length} transactions trouvées pour ce compte et cette période`);
    
    // 4. Ajouter chaque transaction au journal (utiliser le même code que la méthode existante)
    for (const tx of accountTransactions) {
      const isSource = tx.accountId === account.id;
      const isDestination = tx.toAccountId === account.id;
      
      // Déterminer la catégorie en fonction du type de transaction
      let category: string;
      let amount: number;
      
      if (tx.type === TransactionType.INCOME && isSource) {
        category = JournalCategory.INCOME;
        amount = tx.amount; // Positif pour les revenus
      } else if (tx.type === TransactionType.EXPENSE && isSource) {
        // Sous-catégoriser les dépenses si possible
        if (tx.category?.includes('Fixe')) {
          category = JournalCategory.FIXED_EXPENSE;
        } else if (tx.category?.includes('Exceptionnelle')) {
          category = JournalCategory.EXCEPTIONAL_EXPENSE;
        } else {
          category = JournalCategory.CURRENT_EXPENSE;
        }
        amount = -tx.amount; // Négatif pour les dépenses
      } else if (tx.type === TransactionType.TRANSFER) {
        if (isSource) {
          category = JournalCategory.CURRENT_EXPENSE; // Ou une catégorie spécifique pour les transferts
          amount = -tx.amount; // Négatif pour les sorties
        } else if (isDestination) {
          category = JournalCategory.INCOME; // Ou une catégorie spécifique pour les transferts
          amount = tx.amount; // Positif pour les entrées
        } else {
          // Ne devrait pas arriver
          continue;
        }
      } else {
        // Transaction qui ne concerne pas ce compte
        continue;
      }
      
      const journalEntry: JournalEntry = {
        date: new Date(tx.date),
        category,
        name: tx.description,
        amount,
        isCalculated: false,
        yearMonth,
        accountId: account.id,
        transactionId: tx.id
      };
      
      await db.accountingJournal.add(journalEntry);
    }
    
    // 5. Calculer les résumés
    // Total des revenus
    const incomeTotal = accountTransactions
      .filter(tx => 
        (tx.type === TransactionType.INCOME && tx.accountId === account.id) ||
        (tx.type === TransactionType.TRANSFER && tx.toAccountId === account.id)
      )
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const incomeTotalEntry: JournalEntry = {
      date: endDate,
      category: JournalCategory.SUMMARY,
      name: JournalEntryName.MONTHLY_INCOME_TOTAL,
      amount: incomeTotal,
      isCalculated: true,
      yearMonth,
      accountId: account.id
    };
    
    await db.accountingJournal.add(incomeTotalEntry);
    
    // Total des dépenses
    const expenseTotal = -accountTransactions
      .filter(tx => 
        (tx.type === TransactionType.EXPENSE && tx.accountId === account.id) ||
        (tx.type === TransactionType.TRANSFER && tx.accountId === account.id)
      )
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const expenseTotalEntry: JournalEntry = {
      date: endDate,
      category: JournalCategory.SUMMARY,
      name: JournalEntryName.MONTHLY_EXPENSE_TOTAL,
      amount: expenseTotal, // Déjà négatif
      isCalculated: true,
      yearMonth,
      accountId: account.id
    };
    
    await db.accountingJournal.add(expenseTotalEntry);
    
    // Balance de la période
    const periodBalance = incomeTotal - Math.abs(expenseTotal);
    
    const periodBalanceEntry: JournalEntry = {
      date: endDate,
      category: JournalCategory.SUMMARY,
      name: JournalEntryName.MONTHLY_BALANCE,
      amount: periodBalance,
      isCalculated: true,
      yearMonth,
      accountId: account.id
    };
    
    await db.accountingJournal.add(periodBalanceEntry);
    
    // 6. Calculer le solde prévu
    const expectedBalance = initialBalance + periodBalance;
    
    const expectedBalanceEntry: JournalEntry = {
      date: endDate,
      category: JournalCategory.BALANCE,
      name: JournalEntryName.EXPECTED_BALANCE,
      amount: expectedBalance,
      isCalculated: true,
      yearMonth,
      accountId: account.id
    };
    
    await db.accountingJournal.add(expectedBalanceEntry);
    
    // 7. Vérifier s'il y a un ajustement de solde manuel pour cette période
    try {
      const balanceAdjustment = await db.balanceAdjustments.getByAccountAndMonth(account.id, yearMonth);
      
      if (balanceAdjustment) {
        const adjustedBalanceEntry: JournalEntry = {
          date: endDate,
          category: JournalCategory.BALANCE,
          name: JournalEntryName.ADJUSTED_BALANCE,
          amount: balanceAdjustment.adjustedBalance,
          isCalculated: true,
          yearMonth,
          accountId: account.id
        };
        
        await db.accountingJournal.add(adjustedBalanceEntry);
        console.log(`Ajustement de solde ajouté: ${balanceAdjustment.adjustedBalance}`);
      }
    } catch (error) {
      console.error(`Erreur lors de la recherche d'ajustement de solde: ${error}`);
    }
    
    console.log(`Journal généré pour le compte #${account.id} (${account.name}) pour la période spécifiée`);
  }
  
  /**
   * Génère un journal consolidé pour tous les comptes pour une plage de dates spécifique
   */
  private async generateConsolidatedJournalForDateRange(
    startDate: Date,
    endDate: Date,
    accounts: Account[],
    allTransactions: Transaction[]
  ): Promise<void> {
    console.log(`Génération du journal consolidé pour la période du ${format(startDate, 'dd/MM/yyyy')} au ${format(endDate, 'dd/MM/yyyy')}`);
    
    // Déterminer le mois (YYYY-MM) correspondant à la date de fin pour l'indexation
    const yearMonth = format(endDate, 'yyyy-MM');
    
    // 1. Calculer le solde initial consolidé (somme des soldes initiaux de tous les comptes à la date de début)
    let initialConsolidatedBalance = 0;
    
    for (const account of accounts) {
      if (new Date(account.createdAt) <= startDate) {
        if (format(new Date(account.createdAt), 'yyyy-MM-dd') === format(startDate, 'yyyy-MM-dd')) {
          // Si c'est exactement le jour de création, utiliser le solde initial défini
          initialConsolidatedBalance += account.initialBalance;
          console.log(`Compte #${account.id}: date de début = date de création, ajout du solde initial: ${account.initialBalance}`);
        } else {
          // Calculer le solde à la date de début à partir des transactions
          const accountBalance = this.calculateBalanceAtDate(account, allTransactions, startDate);
          initialConsolidatedBalance += accountBalance;
          console.log(`Compte #${account.id}: solde calculé à la date de début: ${accountBalance}`);
        }
      }
    }
    
    // 2. Ajouter l'entrée de solde initial consolidé
    const initialBalanceEntry: JournalEntry = {
      date: startDate,
      category: JournalCategory.BALANCE,
      name: JournalEntryName.INITIAL_BALANCE,
      amount: initialConsolidatedBalance,
      isCalculated: true,
      yearMonth,
      accountId: undefined // Pas de compte spécifique car consolidé
    };
    
    await db.accountingJournal.add(initialBalanceEntry);
    
    // 3. Filtrer les transactions de la période (tous comptes confondus)
    const periodTransactions = allTransactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= startDate && txDate <= endDate;
    });
    
    // 4. Ajouter chaque transaction pertinente au journal consolidé
    for (const tx of periodTransactions) {
      // Pour le journal consolidé, on ne s'intéresse pas aux transferts entre comptes
      // car ils s'annulent à l'échelle globale
      if (tx.type === TransactionType.TRANSFER) {
        continue;
      }
      
      // Déterminer la catégorie en fonction du type de transaction
      let category: string;
      let amount: number;
      
      if (tx.type === TransactionType.INCOME) {
        category = JournalCategory.INCOME;
        amount = tx.amount; // Positif pour les revenus
      } else if (tx.type === TransactionType.EXPENSE) {
        // Sous-catégoriser les dépenses si possible
        if (tx.category?.includes('Fixe')) {
          category = JournalCategory.FIXED_EXPENSE;
        } else if (tx.category?.includes('Exceptionnelle')) {
          category = JournalCategory.EXCEPTIONAL_EXPENSE;
        } else {
          category = JournalCategory.CURRENT_EXPENSE;
        }
        amount = -tx.amount; // Négatif pour les dépenses
      } else {
        // Ne devrait pas arriver car on filtre les transferts
        continue;
      }
      
      const journalEntry: JournalEntry = {
        date: new Date(tx.date),
        category,
        name: tx.description,
        amount,
        isCalculated: false,
        yearMonth,
        transactionId: tx.id
      };
      
      await db.accountingJournal.add(journalEntry);
    }
    
    // 5. Calculer les résumés consolidés
    // Récupérer les entrées non calculées pour faire les totaux
    const entries = await db.accountingJournal.getByDateRange(startDate, endDate);
    const consolidatedEntries = entries.filter(e => !e.accountId && !e.isCalculated);
    
    // Total des revenus
    const incomeTotal = consolidatedEntries
      .filter(e => e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0);
    
    const incomeTotalEntry: JournalEntry = {
      date: endDate,
      category: JournalCategory.SUMMARY,
      name: JournalEntryName.MONTHLY_INCOME_TOTAL,
      amount: incomeTotal,
      isCalculated: true,
      yearMonth
    };
    
    await db.accountingJournal.add(incomeTotalEntry);
    
    // Total des dépenses
    const expenseTotal = consolidatedEntries
      .filter(e => e.amount < 0)
      .reduce((sum, e) => sum + e.amount, 0);
    
    const expenseTotalEntry: JournalEntry = {
      date: endDate,
      category: JournalCategory.SUMMARY,
      name: JournalEntryName.MONTHLY_EXPENSE_TOTAL,
      amount: expenseTotal, // Déjà négatif
      isCalculated: true,
      yearMonth
    };
    
    await db.accountingJournal.add(expenseTotalEntry);
    
    // Balance de la période
    const periodBalance = incomeTotal + expenseTotal; // expenseTotal est déjà négatif
    
    const periodBalanceEntry: JournalEntry = {
      date: endDate,
      category: JournalCategory.SUMMARY,
      name: JournalEntryName.MONTHLY_BALANCE,
      amount: periodBalance,
      isCalculated: true,
      yearMonth
    };
    
    await db.accountingJournal.add(periodBalanceEntry);
    
    // 6. Calculer le solde prévu
    const expectedBalance = initialConsolidatedBalance + periodBalance;
    
    const expectedBalanceEntry: JournalEntry = {
      date: endDate,
      category: JournalCategory.BALANCE,
      name: JournalEntryName.EXPECTED_BALANCE,
      amount: expectedBalance,
      isCalculated: true,
      yearMonth
    };
    
    await db.accountingJournal.add(expectedBalanceEntry);
    
    console.log(`Journal consolidé généré pour la période spécifiée`);
  }
  /**
   * Sauvegarde l'état du journal dans un cache pour optimiser les futures régénérations
   * Cette fonction est appelée après chaque génération complète du journal
   */
  public async saveJournalState(): Promise<void> {
    console.log('Sauvegarde de l\'\u00e9tat du journal dans le cache...');
    
    try {
      // Récupérer tous les mois pour lesquels nous avons des entrées
      const allEntries = await db.accountingJournal.getAll();
      const allMonths = new Set<string>();
      
      // Collecter tous les mois uniques
      for (const entry of allEntries) {
        if (entry.yearMonth) {
          allMonths.add(entry.yearMonth);
        }
      }
      
      console.log(`Sauvegarde de l'état du journal pour ${allMonths.size} mois`);
      
      // Pour chaque mois, sauvegarder le solde final (prévu ou ajusté) de chaque compte
      for (const month of allMonths) {
        const monthEntries = allEntries.filter(e => e.yearMonth === month);
        
        // Récupérer tous les comptes concernés
        const accountIds = new Set<number>();
        for (const entry of monthEntries) {
          if (entry.accountId !== undefined) {
            accountIds.add(entry.accountId);
          }
        }
        
        // Sauvegarder le solde de chaque compte
        for (const accountId of accountIds) {
          // Chercher d'abord le solde ajusté (prioritaire)
          const adjustedEntry = monthEntries.find(e => 
            e.accountId === accountId && e.name === JournalEntryName.ADJUSTED_BALANCE);
          
          // Puis le solde prévu
          const expectedEntry = monthEntries.find(e => 
            e.accountId === accountId && e.name === JournalEntryName.EXPECTED_BALANCE);
          
          // Sauvegarder le solde trouvé
          if (adjustedEntry) {
            const cacheKey = `${month}_${accountId}`;
            setCachedBalance(cacheKey, adjustedEntry.amount);
            console.log(`Solde ajusté sauvegardé pour ${month}, compte #${accountId}: ${adjustedEntry.amount}`);
          } else if (expectedEntry) {
            const cacheKey = `${month}_${accountId}`;
            setCachedBalance(cacheKey, expectedEntry.amount);
            console.log(`Solde prévu sauvegardé pour ${month}, compte #${accountId}: ${expectedEntry.amount}`);
          }
        }
        
        // Sauvegarder également le solde consolidé (sans accountId)
        const adjustedConsolidatedEntry = monthEntries.find(e => 
          e.accountId === undefined && e.name === JournalEntryName.ADJUSTED_BALANCE);
        
        const expectedConsolidatedEntry = monthEntries.find(e => 
          e.accountId === undefined && e.name === JournalEntryName.EXPECTED_BALANCE);
        
        if (adjustedConsolidatedEntry) {
          const cacheKey = `${month}_consolidated`;
          setCachedBalance(cacheKey, adjustedConsolidatedEntry.amount);
          console.log(`Solde ajusté consolidé sauvegardé pour ${month}: ${adjustedConsolidatedEntry.amount}`);
        } else if (expectedConsolidatedEntry) {
          const cacheKey = `${month}_consolidated`;
          setCachedBalance(cacheKey, expectedConsolidatedEntry.amount);
          console.log(`Solde prévu consolidé sauvegardé pour ${month}: ${expectedConsolidatedEntry.amount}`);
        }
      }
      
      console.log('Sauvegarde de l\'\u00e9tat du journal terminée avec succès');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de l\'\u00e9tat du journal:', error);
    }
  }
  
  /**
   * Récupère l'état du journal depuis le cache
   * Cette fonction est utilisée pour déterminer s'il est nécessaire de régénérer un mois
   * @param yearMonth Le mois au format 'YYYY-MM'
   * @param accountId L'ID du compte ou undefined pour le consolidé
   * @returns Le solde sauvegardé ou undefined si non trouvé
   */
  public getCachedJournalBalance(yearMonth: string, accountId?: number): number | undefined {
    const cacheKey = accountId ? `${yearMonth}_${accountId}` : `${yearMonth}_consolidated`;
    return getCachedBalance(cacheKey);
  }
  
  /**
   * Détermine si un mois doit être régénéré ou s'il peut être chargé depuis le cache
   * @param yearMonth Le mois à vérifier
   * @returns true si le mois doit être régénéré, false sinon
   */
  public async shouldRegenerateMonth(yearMonth: string): Promise<boolean> {
    // Récupérer les comptes
    const accounts = await db.accounts.getAll();
    
    // Vérifier si tous les comptes ont un solde en cache pour ce mois
    for (const account of accounts) {
      const cachedBalance = this.getCachedJournalBalance(yearMonth, account.id);
      if (cachedBalance === undefined) {
        console.log(`Le mois ${yearMonth} doit être régénéré car le compte #${account.id} n'a pas de solde en cache`);
        return true;
      }
    }
    
    // Vérifier également le solde consolidé
    const cachedConsolidatedBalance = this.getCachedJournalBalance(yearMonth);
    if (cachedConsolidatedBalance === undefined) {
      console.log(`Le mois ${yearMonth} doit être régénéré car le solde consolidé n'est pas en cache`);
      return true;
    }
    
    // Vérifier s'il y a des entrées dans la base de données pour ce mois
    const entriesCount = await db.accountingJournal.getCountByMonth(yearMonth);
    if (entriesCount === 0) {
      console.log(`Le mois ${yearMonth} doit être régénéré car il n'y a pas d'entrées dans la base de données`);
      return true;
    }
    
    // Si tout est OK, pas besoin de régénérer
    console.log(`Le mois ${yearMonth} n'a pas besoin d'être régénéré, utilisation du cache`);
    return false;
  }
  
  /**
   * Version optimisée de la régénération des mois suivants
   * Cette fonction utilise le cache pour éviter de régénérer les mois inutilement
   * @param startYearMonth Le mois à partir duquel régénérer
   */
  public async regenerateFollowingMonthsOptimized(startYearMonth: string): Promise<void> {
    console.log(`Régénération optimisée des mois suivant ${startYearMonth}`);
    
    const [startYear, startMonth] = startYearMonth.split('-').map(Number);
    const startDate = new Date(startYear, startMonth - 1, 1);
    
    // Déterminer la date finale (12 mois après le mois actuel)
    const currentDate = new Date();
    const endDate = new Date(currentDate);
    endDate.setFullYear(currentDate.getFullYear() + 1);
    
    let nextDate = new Date(startDate);
    nextDate.setMonth(nextDate.getMonth() + 1);
    
    // Collecter tous les mois à vérifier
    const months = [];
    while (nextDate <= endDate) {
      months.push(format(nextDate, 'yyyy-MM'));
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
    
    if (months.length === 0) {
      console.log(`Aucun mois suivant à régénérer après ${startYearMonth}`);
      return;
    }
    
    // Filtrer les mois qui doivent réellement être régénérés
    const monthsToRegenerate = [];
    for (const month of months) {
      const shouldRegenerate = await this.shouldRegenerateMonth(month);
      if (shouldRegenerate) {
        monthsToRegenerate.push(month);
      }
    }
    
    if (monthsToRegenerate.length > 0) {
      console.log(`${monthsToRegenerate.length}/${months.length} mois nécessitent une régénération: ${monthsToRegenerate.join(', ')}`);
      await this.generateJournalForMultipleMonths(monthsToRegenerate);
      await this.saveJournalState();
    } else {
      console.log(`Tous les mois suivants (${months.length}) sont déjà à jour dans le cache, aucune régénération nécessaire`);
    }
  }
  
  /**
   * Régénère le journal pour la période spécifiée et les mois suivants au démarrage de l'application
   * Cette méthode est appelée au lancement pour assurer une couverture temporelle complète
   * et une génération prévisionnelle étendue
   */
  public async generateJournalAtStartup(): Promise<void> {
    console.log('Génération du journal au démarrage de l\'application...');
    
    // 1. Récupérer les données nécessaires
    const accounts = await db.accounts.getAll();
    const allTransactions = await db.transactions.getAll();
    
    // 2. Déterminer la plage de dates à traiter
    // Partir de la date du compte le plus ancien (couverture temporelle complète)
    const startDate = this.getEarliestDate(accounts, allTransactions);
    console.log(`Date du compte/transaction le plus ancien: ${format(startDate, 'dd/MM/yyyy')}`);
    
    // 3. Déterminer la date de fin pour inclure 12 mois de prévision
    const currentDate = new Date();
    const endDate = new Date(currentDate);
    endDate.setFullYear(currentDate.getFullYear() + 1); // +12 mois de prévision
    
    console.log(`Génération du journal depuis ${format(startDate, 'dd/MM/yyyy')} jusqu'à ${format(endDate, 'dd/MM/yyyy')} (incluant 12 mois de prévision)`);
    
    // 4. Collecter tous les mois à générer
    let currentMonthDate = new Date(startDate);
    const months = [];
    
    while (currentMonthDate <= endDate) {
      const yearMonth = format(currentMonthDate, 'yyyy-MM');
      
      // Vérifier si ce mois doit être régénéré (optimisation)
      const shouldRegenerate = await this.shouldRegenerateMonth(yearMonth);
      if (shouldRegenerate) {
        months.push(yearMonth);
      }
      
      // Passer au mois suivant
      currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
    }
    
    // 5. Générer le journal pour les mois nécessaires
    if (months.length > 0) {
      console.log(`Génération du journal pour ${months.length} mois, de ${months[0]} à ${months[months.length - 1]}...`);
      await this.generateJournalForMultipleMonths(months);
      
      // 6. Sauvegarder l'état du journal pour optimiser les futures générations
      await this.saveJournalState();
      
      console.log(`Journal comptable généré avec succès pour toute la période historique et prévisionnelle (${months.length} mois).`);
    } else {
      console.log('Tous les mois sont déjà à jour dans le cache, aucune régénération nécessaire.');
    }
  }
}

// Exporter une instance unique du service
export const accountingJournalService = new AccountingJournalService();
