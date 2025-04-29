import { format, parse, isAfter, isBefore, addMonths, endOfMonth, startOfMonth, isWithinInterval, subMonths } from 'date-fns';
import db, { initDB } from './db';
import { TransactionType, RecurringTransaction } from './types';
import { objectStoreExists } from './dbUtils';
import { getFinancialMonthRange, isFinancialMonthEnabled } from './financialMonthUtils';
import { calculatePeriodDates, calculatePreviousPeriodDates } from './dateUtils';

// Fonction pour calculer le solde à une date donnée pour un compte ou tous les comptes
export async function getBalanceAtDate(accountId: number | "all", date: Date): Promise<number> {
  try {
    // S'assurer que la base de données est initialisée
    await initDB();

    // Récupérer tous les comptes et toutes les transactions
    const accounts = await db.accounts.getAll();
    const transactions = await db.transactions.getAll();

    // Si pas de comptes, retourner 0
    if (accounts.length === 0) {
      return 0;
    }

    // Filtrer les comptes si nécessaire
    const targetAccounts = accountId === "all" 
      ? accounts 
      : accounts.filter(a => a.id === accountId);

    // Si le compte spécifié n'existe pas, retourner 0
    if (targetAccounts.length === 0) {
      return 0;
    }

    // Calculer le solde initial
    let balance = targetAccounts.reduce((sum, account) => sum + account.initialBalance, 0);

    // Filtrer les transactions jusqu'à la date spécifiée
    const relevantTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return isBefore(txDate, date) || txDate.getTime() === date.getTime();
    });

    // Calculer l'impact des transactions sur le solde
    for (const transaction of relevantTransactions) {
      const isRelevantAccount = accountId === "all" || transaction.accountId === accountId;
      const isTargetOfTransfer = accountId === "all" || transaction.toAccountId === accountId;

      if (isRelevantAccount) {
        if (transaction.type === TransactionType.INCOME) {
          balance += transaction.amount;
        } else if (transaction.type === TransactionType.EXPENSE) {
          balance -= transaction.amount;
        } else if (transaction.type === TransactionType.TRANSFER) {
          // Pour les transferts, on déduit du compte source
          balance -= transaction.amount;
        }
      }

      // Pour les transferts, ajouter au compte de destination
      if (transaction.type === TransactionType.TRANSFER && isTargetOfTransfer && transaction.toAccountId) {
        balance += transaction.amount;
      }
    }

    return balance;
  } catch (error) {
    console.error('Erreur lors du calcul du solde:', error);
    return 0;
  }
}

// Fonction pour calculer l'évolution du solde sur une période
export async function getBalanceEvolution(
  accountId: number | "all", 
  startDate: Date, 
  endDate: Date
): Promise<{ date: Date; balance: number }[]> {
  try {
    // S'assurer que la base de données est initialisée
    await initDB();

    // Préparer le tableau de résultats
    const result: { date: Date; balance: number }[] = [];

    // Calculer le solde au début de la période
    let currentDate = startOfMonth(startDate);
    let currentBalance = await getBalanceAtDate(accountId, currentDate);

    // Ajouter le solde initial
    result.push({ date: currentDate, balance: currentBalance });

    // Avancer mois par mois jusqu'à la fin de la période
    while (isBefore(currentDate, endDate)) {
      currentDate = endOfMonth(addMonths(currentDate, 1));
      
      // S'assurer de ne pas dépasser la date de fin
      if (isAfter(currentDate, endDate)) {
        currentDate = endDate;
      }
      
      currentBalance = await getBalanceAtDate(accountId, currentDate);
      result.push({ date: currentDate, balance: currentBalance });
    }

    return result;
  } catch (error) {
    console.error('Erreur lors du calcul de l\'évolution du solde:', error);
    return [];
  }
}

// Interface pour le résultat du solde prévisionnel
interface ForecastResult {
  balance: number;
  income: number;
  expense: number;
  isAdjusted?: boolean;
}

// Fonction pour calculer le solde prévisionnel pour un mois en tenant compte des ajustements précédents
export async function getForecastBalance(
  accountId: number | "all", 
  yearMonth: string, // Format "YYYY-MM"
  financialMonthDates?: { start: Date | null; end: Date | null } // Dates du mois financier
): Promise<ForecastResult> {
  console.log('DÉBUT getForecastBalance - Paramètres:', {
    accountId,
    yearMonth,
    financialMonthDates: financialMonthDates ? {
      start: financialMonthDates.start?.toISOString().slice(0, 10),
      end: financialMonthDates.end?.toISOString().slice(0, 10)
    } : null
  });
  try {
    // S'assurer que la base de données est initialisée
    await initDB();

    // Extraire le mois et l'année à partir du format YYYY-MM
    const targetYear = parseInt(yearMonth.substring(0, 4), 10);
    const targetMonth = parseInt(yearMonth.substring(5, 7), 10);
    
    // Récupérer les préférences utilisateur pour le mode (calendaire/financier) et le jour de début du mois financier
    const prefs = await db.preferences.get();
    const useFinancialMonth = prefs.useFinancialMonth ?? false;
    const financialMonthStartDay = prefs.financialMonthStartDay ?? 1;
    const mode = useFinancialMonth ? 'financier' : 'calendaire';
    
    // Utiliser la nouvelle fonction pour calculer les dates de début et fin de période
    let firstDayOfMonth: Date;
    let lastDayOfMonth: Date;
    
    // Si des dates spécifiques sont fournies, les utiliser en priorité
    if (financialMonthDates && financialMonthDates.start && financialMonthDates.end) {
      // Utiliser les dates du mois financier fournies
      firstDayOfMonth = financialMonthDates.start;
      lastDayOfMonth = financialMonthDates.end;
      console.log(`UTILISATION DATES FINANCIÈRES FOURNIES: ${format(firstDayOfMonth, 'dd/MM/yyyy')} au ${format(lastDayOfMonth, 'dd/MM/yyyy')}`);
    } else {
      // Sinon, utiliser calculatePeriodDates pour calculer les dates
      [firstDayOfMonth, lastDayOfMonth] = calculatePeriodDates(targetMonth, targetYear, mode, financialMonthStartDay);
      console.log(`UTILISATION DATES CALCULÉES (${mode}): ${format(firstDayOfMonth, 'dd/MM/yyyy')} au ${format(lastDayOfMonth, 'dd/MM/yyyy')}`);
    }
    
    // Utiliser une approche directe pour le solde basée sur les dates calculées
    console.log(`Calcul direct des transactions sur la période: ${format(firstDayOfMonth, 'dd/MM/yyyy')} au ${format(lastDayOfMonth, 'dd/MM/yyyy')}`);
    
    // Récupérer les comptes
    const accounts = await db.accounts.getAll();
    const targetAccounts = accountId === "all" 
      ? accounts 
      : accounts.filter(a => a.id === accountId);
    
    // Calculer les dates du mois précédent en utilisant notre fonction utilitaire
    // Cela garantit que nous obtenons la bonne période précédente, qu'elle soit calendaire ou financière
    
    const [prevPeriodStart, prevPeriodEnd] = calculatePreviousPeriodDates(
      firstDayOfMonth, 
      lastDayOfMonth, 
      mode, 
      financialMonthStartDay
    );
    
    // Le prevMonthYearMonth doit correspondre au format YYYY-MM du mois précédent
    const prevMonthYearMonth = format(prevPeriodStart, "yyyy-MM");
    console.log(`Période précédente: ${format(prevPeriodStart, 'dd/MM/yyyy')} au ${format(prevPeriodEnd, 'dd/MM/yyyy')} (${prevMonthYearMonth})`);
    
    // Vérifier si un mois précédent a un ajustement
    let startingBalance = 0;
    if (accountId !== "all") {
      try {
        const storeExists = await objectStoreExists('balanceAdjustments');
        if (storeExists) {
          const prevAdjustment = await db.balanceAdjustments.getByAccountAndMonth(
            accountId as number, 
            prevMonthYearMonth
          );
          
          if (prevAdjustment) {
            // Utiliser l'ajustement du mois précédent comme solde initial
            startingBalance = prevAdjustment.adjustedBalance;
            console.log(`Solde initial basé sur l'ajustement du mois précédent (${prevMonthYearMonth}): ${startingBalance}€`);
          } else {
            // Aucun ajustement trouvé, récupérer le solde prévisionnel calculé pour le mois précédent
            // Note: Nous utilisons directement la date de fin de la période précédente
            startingBalance = await getBalanceAtDate(accountId, prevPeriodEnd);
            console.log(`Solde initial à la fin de la période précédente (${format(prevPeriodEnd, 'dd/MM/yyyy')}): ${startingBalance}€ (pas d'ajustement trouvé)`);
          }
        } else {
          startingBalance = await getBalanceAtDate(accountId, prevPeriodEnd);
          console.log(`Solde initial à la fin de la période précédente (${format(prevPeriodEnd, 'dd/MM/yyyy')}): ${startingBalance}€ (table d'ajustements non disponible)`);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération de l\'ajustement du mois précédent:', error);
        startingBalance = await getBalanceAtDate(accountId, prevPeriodEnd);
        console.log(`Solde initial à la fin de la période précédente (${format(prevPeriodEnd, 'dd/MM/yyyy')}): ${startingBalance}€ (erreur lors de la recherche d'ajustement)`);
      }
    } else {
      // Pour tous les comptes, simplement utiliser le solde calculé à la fin de la période précédente
      startingBalance = await getBalanceAtDate(accountId, prevPeriodEnd);
      console.log(`Solde initial à la fin de la période précédente (${format(prevPeriodEnd, 'dd/MM/yyyy')}): ${startingBalance}€`);
    }
      
    // Calculer les transactions pour la période spécifiée
    const monthData = await calculateMonthForForecast(
      accountId, 
      firstDayOfMonth, 
      lastDayOfMonth
    );
    
    console.log(`Transactions de la période - Revenus: ${monthData.income}€, Dépenses: ${monthData.expense}€`);
    
    // Vérifier s'il y a un ajustement manuel pour ce mois
    let isAdjusted = false;
    let adjustedBalance = startingBalance + monthData.income - monthData.expense;
    
    if (accountId !== "all") {
      try {
        const storeExists = await objectStoreExists('balanceAdjustments');
        if (storeExists) {
          const adjustment = await db.balanceAdjustments.getByAccountAndMonth(
            accountId as number, 
            yearMonth
          );
          
          if (adjustment) {
            adjustedBalance = adjustment.adjustedBalance;
            isAdjusted = true;
            console.log(`Solde ajusté manuellement: ${adjustedBalance}€`);
          }
        }
      } catch (error) {
        console.error('Erreur lors de la récupération de l\'ajustement de solde:', error);
      }
    }
    
    console.log(`Résultat final - Solde prévisionnel: ${adjustedBalance}€ (${isAdjusted ? 'ajusté' : 'calculé'})`);
    
    return {
      balance: adjustedBalance,
      income: monthData.income,
      expense: monthData.expense,
      isAdjusted
    };
  } catch (error) {
    console.error('Erreur lors du calcul du solde prévisionnel:', error);
    return { balance: 0, income: 0, expense: 0, isAdjusted: false };
  }
}

// Interface pour les données mensuelles simplifiées
interface MonthData {
  income: number;
  expense: number;
}

// Fonction utilitaire pour calculer les revenus et dépenses d'une période donnée
async function calculateMonthForForecast(
  accountId: number | "all",
  periodStart: Date,
  periodEnd: Date
): Promise<MonthData> {
  // Force la conversion des dates pour éliminer les problèmes potentiels
  const startDate = new Date(periodStart.getTime());
  const endDate = new Date(periodEnd.getTime());
  console.log(`Calcul des transactions entre ${format(startDate, 'dd/MM/yyyy')} et ${format(endDate, 'dd/MM/yyyy')}`);

  // Récupérer toutes les transactions
  const allTransactions = await db.transactions.getAll();
  console.log(`Nombre total de transactions: ${allTransactions.length}`);
  
  // Filtrer les transactions qui sont dans la période spécifiée (inclus les bornes)
  const periodTransactions = allTransactions.filter(tx => {
    const txDate = new Date(tx.date);
    
    // S'assurer que la date est valide
    if (isNaN(txDate.getTime())) {
      console.warn(`Transaction avec date invalide: ${tx.date}`);
      return false;
    }
    
    // Vérifier que la date est dans l'intervalle (>= startDate ET <= endDate)
    // Note: setHours(0,0,0,0) pour ignorer les heures et comparer uniquement les dates
    const txDateOnly = new Date(txDate);
    txDateOnly.setHours(0, 0, 0, 0);
    
    const startDateOnly = new Date(startDate);
    startDateOnly.setHours(0, 0, 0, 0);
    
    const endDateOnly = new Date(endDate);
    endDateOnly.setHours(0, 0, 0, 0);
    
    const isInRange = 
      (txDateOnly.getTime() >= startDateOnly.getTime()) && 
      (txDateOnly.getTime() <= endDateOnly.getTime());
    
    // Pour le débogage, logger quelques transactions à la limite
    if ((txDateOnly.getTime() === startDateOnly.getTime() || 
         txDateOnly.getTime() === endDateOnly.getTime()) && 
        !isInRange) {
      console.warn(`Transaction à la limite non incluse: ${tx.date}`);
    }
    
    return isInRange;
  });
  
  console.log(`Nombre de transactions dans la période: ${periodTransactions.length}`);
  
  if (periodTransactions.length > 0) {
    console.log('Exemple de transactions filtrées:');
    periodTransactions.slice(0, 3).forEach((tx, i) => {
      console.log(`  Transaction #${i+1}: ${tx.date} - ${tx.type} - ${tx.amount}€`);
    });
  } else {
    console.log('AUCUNE TRANSACTION TROUVÉE DANS CETTE PÉRIODE');
  }
  
  // Calculer les revenus et dépenses pour la période
  let totalIncome = 0;
  let totalExpense = 0;
  
  // Traiter les transactions existantes
  for (const tx of periodTransactions) {
    const isRelevantAccount = accountId === "all" || tx.accountId === accountId;
    const isTargetOfTransfer = accountId === "all" || tx.toAccountId === accountId;
    
    if (isRelevantAccount) {
      if (tx.type === TransactionType.INCOME) {
        totalIncome += tx.amount;
      } else if (tx.type === TransactionType.EXPENSE) {
        totalExpense += tx.amount;
      } else if (tx.type === TransactionType.TRANSFER) {
        totalExpense += tx.amount;
      }
    }
    
    // Pour les transferts, ajouter au compte de destination
    if (tx.type === TransactionType.TRANSFER && isTargetOfTransfer && tx.toAccountId) {
      totalIncome += tx.amount;
    }
  }
  
  // Traiter les transactions récurrentes applicables
  console.log("Vérification des transactions récurrentes pour la période...");
  const recurringTransactions = await db.recurringTransactions.getAll();
  let appliedRecurringTransactions = 0;
  
  for (const rtx of recurringTransactions) {
    // Ignorer les transactions récurrentes désactivées
    if (rtx.isDisabled) {
      continue;
    }
    
    const isRelevantAccount = accountId === "all" || rtx.accountId === accountId;
    const isTargetOfTransfer = accountId === "all" || rtx.toAccountId === accountId;
    
    // Vérifier si la transaction récurrente est applicable (date de début avant la fin de la période)
    const rtxStartDate = new Date(rtx.startDate || rtx.createdAt);
    if (isAfter(rtxStartDate, endDate)) {
      continue; // Pas encore applicable
    }
    
    // Vérifier la date de fin si elle existe
    if (rtx.endDate && isBefore(new Date(rtx.endDate), startDate)) {
      continue; // Déjà terminée
    }
    
    // Pour les prévisions futures, nous considérons que la transaction récurrente sera exécutée
    // même si elle n'a pas encore été exécutée
    const nextExecution = new Date(rtx.nextExecution);
    if (isWithinInterval(nextExecution, { start: startDate, end: endDate })) {
      if (isRelevantAccount) {
        if (rtx.type === TransactionType.INCOME) {
          totalIncome += rtx.amount;
          appliedRecurringTransactions++;
          console.log(`Transaction récurrente de revenu (${rtx.description}) pour ${rtx.amount}€ appliquée`);
        } else if (rtx.type === TransactionType.EXPENSE) {
          totalExpense += rtx.amount;
          appliedRecurringTransactions++;
          console.log(`Transaction récurrente de dépense (${rtx.description}) pour ${rtx.amount}€ appliquée`);
        } else if (rtx.type === TransactionType.TRANSFER) {
          totalExpense += rtx.amount;
          appliedRecurringTransactions++;
          console.log(`Transaction récurrente de transfert (${rtx.description}) pour ${rtx.amount}€ appliquée (sortie)`);
        }
      }
      
      // Pour les transferts, ajouter au compte de destination
      if (rtx.type === TransactionType.TRANSFER && isTargetOfTransfer && rtx.toAccountId) {
        totalIncome += rtx.amount;
        if (!isRelevantAccount) { // Éviter de compter deux fois
          appliedRecurringTransactions++;
          console.log(`Transaction récurrente de transfert (${rtx.description}) pour ${rtx.amount}€ appliquée (entrée)`);
        }
      }
    }
  }
  
  if (appliedRecurringTransactions > 0) {
    console.log(`${appliedRecurringTransactions} transactions récurrentes prises en compte dans les prévisions`);
  } else {
    console.log("Aucune transaction récurrente applicable pour cette période");
  }
  
  console.log(`Total des revenus dans la période: ${totalIncome}€`);
  console.log(`Total des dépenses dans la période: ${totalExpense}€`);
  
  return { income: totalIncome, expense: totalExpense };
}

// Fonction pour calculer le solde actuel
export async function getCurrentBalance(accountId: number | "all"): Promise<number> {
  return getBalanceAtDate(accountId, new Date());
}
export async function getMonthlyBalances(
  startYearMonth: string, // Format YYYY-MM
  months: number, 
  accountId: number | "all"
): Promise<{ month: string; balance: number }[]> {
  const result: { month: string; balance: number }[] = [];
  
  // Date de départ
  let currentDate = parse(startYearMonth + "-01", "yyyy-MM-dd", new Date());
  
  // Pour chaque mois, calculer le solde en fin de mois
  for (let i = 0; i < months; i++) {
    const yearMonth = format(currentDate, "yyyy-MM");
    const endOfMonthDate = endOfMonth(currentDate);
    
    // Calculer le solde pour ce mois
    const balance = await getBalanceAtDate(accountId, endOfMonthDate);
    
    result.push({
      month: yearMonth,
      balance
    });
    
    // Passer au mois suivant
    currentDate = addMonths(currentDate, 1);
  }
  
  return result;
}

// Interface pour les paramètres de calculateMonthlyBalances
interface CalculateMonthlyBalancesParams {
  accountId: number | "all";
  startDate: Date;
  endDate: Date;
  includeAdjustments?: boolean;
}

// Interface pour le résultat mensuel avec soldes détaillés
interface MonthlyBalanceDetail {
  yearMonth: string;
  month: Date;
  initialBalance: number;
  incomes: number;
  expenses: number;
  finalBalance: number;
  isAdjusted: boolean;
  financialMonthName?: string; // Nom du mois financier si applicable
}

// Fonction pour calculer les soldes mensuels détaillés
export async function calculateMonthlyBalances({
  accountId,
  startDate,
  endDate,
  includeAdjustments = true
}: CalculateMonthlyBalancesParams): Promise<MonthlyBalanceDetail[]> {
  const result: MonthlyBalanceDetail[] = [];
  
  // Vérifier si le mode mois financier est activé
  const useFinancialMonth = await isFinancialMonthEnabled();
  
  // Initialiser la date courante au début du mois de la date de début
  let currentDate = useFinancialMonth 
    ? (await getFinancialMonthRange(startDate)).start 
    : startOfMonth(startDate);
  let previousMonthBalance = await getBalanceAtDate(accountId, new Date(currentDate.getTime() - 1)); // Solde du jour précédent
  
  // Boucle sur chaque mois jusqu'à la date de fin
  while (currentDate <= endDate) {
    // Déterminer le début et la fin du mois (standard ou financier)
    let yearMonth: string;
    let monthEnd: Date;
    let monthName: string;
    
    if (useFinancialMonth) {
      const financialMonth = await getFinancialMonthRange(currentDate);
      yearMonth = format(financialMonth.start, "yyyy-MM");
      monthEnd = financialMonth.end;
      monthName = financialMonth.name;
    } else {
      yearMonth = format(currentDate, "yyyy-MM");
      monthEnd = endOfMonth(currentDate);
      monthName = format(currentDate, "MMMM yyyy");
    }
    
    // Récupérer toutes les transactions du mois
    const allTransactions = await db.transactions.getAll();
    const monthTransactions = allTransactions.filter(tx => {
      const txDate = new Date(tx.date);
      return isWithinInterval(txDate, {
        start: currentDate,
        end: monthEnd
      });
    });
    
    // Calculer les revenus et dépenses pour le mois courant
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    
    // Filtrer les transactions par compte si nécessaire
    const relevantTransactions = monthTransactions.filter(tx => {
      return accountId === "all" || 
             tx.accountId === accountId || 
             (tx.type === TransactionType.TRANSFER && tx.toAccountId === accountId);
    });
    
    // Calculer les totaux
    for (const tx of relevantTransactions) {
      if (tx.type === TransactionType.INCOME || 
          (tx.type === TransactionType.TRANSFER && tx.toAccountId === accountId)) {
        monthlyIncome += tx.amount;
      } else if (tx.type === TransactionType.EXPENSE || 
                (tx.type === TransactionType.TRANSFER && tx.accountId === accountId)) {
        monthlyExpense += tx.amount;
      }
    }
    
    // Calculer le solde final du mois
    let finalBalance = previousMonthBalance + monthlyIncome - monthlyExpense;
    let isAdjusted = false;
    
    // Vérifier s'il y a un ajustement manuel pour ce mois
    if (includeAdjustments && accountId !== "all") {
      try {
        // Vérifier d'abord si l'object store existe
        const storeExists = await objectStoreExists('balanceAdjustments');
        
        if (storeExists) {
          const adjustment = await db.balanceAdjustments.getByAccountAndMonth(
            accountId as number, 
            yearMonth
          );
          
          if (adjustment) {
            finalBalance = adjustment.adjustedBalance;
            isAdjusted = true;
          }
        } else {
          console.warn(`L'object store balanceAdjustments n'existe pas dans calculateMonthlyBalances`);
        }
      } catch (error) {
        console.error(`Erreur lors de la récupération de l'ajustement pour ${yearMonth}:`, error);
      }
    }
    
    // Ajouter les données du mois au résultat
    result.push({
      yearMonth,
      month: new Date(currentDate),
      initialBalance: previousMonthBalance,
      incomes: monthlyIncome,
      expenses: monthlyExpense,
      finalBalance,
      isAdjusted,
      // Ajouter le nom du mois financier si applicable
      financialMonthName: useFinancialMonth ? monthName : undefined
    });
    
    // Mettre à jour pour le mois suivant
    previousMonthBalance = finalBalance;
    if (useFinancialMonth) {
      // Pour le mode mois financier, nous avons besoin de calculer correctement le début du mois suivant
      const financialMonth = await getFinancialMonthRange(currentDate);
      currentDate = new Date(monthEnd.getTime() + 86400000); // Ajouter un jour à la fin du mois financier
      currentDate = (await getFinancialMonthRange(currentDate)).start; // Et obtenir le début du mois financier suivant
    } else {
      currentDate = addMonths(currentDate, 1);
    }
  }
  
  return result;
}
