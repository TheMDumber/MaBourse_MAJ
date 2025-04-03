import { DateTime } from 'luxon';
import { Transaction, TransactionType } from '../src/lib/types';
import { debug, info, warning, error } from '../logging/logger';

interface MonthlyBalancesResult {
    [month: string]: number;
}

interface TransactionData {
    date: Date;
    amount: number;
    type: string;
    accountId?: number;
    toAccountId?: number;
}

/**
 * Détermine les limites d'un mois selon le mode (calendaire ou financier)
 * 
 * @param date - Date pour laquelle déterminer les limites
 * @param monthMode - 'calendar' ou 'financial'
 * @param financialMonthDay - Jour définissant les limites du mois financier
 * @returns Tuple [startDate, endDate] pour le mois
 */
function getMonthBoundaries(
    date: Date,
    monthMode: 'calendar' | 'financial',
    financialMonthDay: number
): [Date, Date] {
    const dt = DateTime.fromJSDate(date);
    
    if (monthMode === 'calendar') {
        // Mois calendaire standard (1er jour au dernier jour du mois)
        const startDate = DateTime.fromObject({ 
            year: dt.year, 
            month: dt.month, 
            day: 1 
        }).toJSDate();
        
        const endDate = DateTime.fromObject({ 
            year: dt.year, 
            month: dt.month, 
            day: dt.daysInMonth 
        })
        .set({ hour: 23, minute: 59, second: 59 })
        .toJSDate();
        
        return [startDate, endDate];
    } else {
        // Mois financier
        const day = dt.day;
        
        if (day < financialMonthDay) {
            // Si avant le jour financier, nous sommes dans le mois financier précédent
            const prevMonth = dt.minus({ months: 1 });
            
            const startDate = DateTime.fromObject({
                year: prevMonth.year,
                month: prevMonth.month,
                day: financialMonthDay
            }).toJSDate();
            
            const endDate = DateTime.fromObject({
                year: dt.year,
                month: dt.month,
                day: financialMonthDay - 1
            })
            .set({ hour: 23, minute: 59, second: 59 })
            .toJSDate();
            
            return [startDate, endDate];
        } else {
            // Mois financier actuel
            const startDate = DateTime.fromObject({
                year: dt.year,
                month: dt.month,
                day: financialMonthDay
            }).toJSDate();
            
            const nextMonth = dt.plus({ months: 1 });
            
            const endDate = DateTime.fromObject({
                year: nextMonth.year,
                month: nextMonth.month,
                day: financialMonthDay - 1
            })
            .set({ hour: 23, minute: 59, second: 59 })
            .toJSDate();
            
            return [startDate, endDate];
        }
    }
}

/**
 * Calcule la date de début du mois suivant
 * 
 * @param date - Date à partir de laquelle calculer
 * @param monthMode - 'calendar' ou 'financial'
 * @param financialMonthDay - Jour définissant le début du mois financier
 * @returns Date de début du mois suivant
 */
function getNextMonthStart(
    date: Date,
    monthMode: 'calendar' | 'financial',
    financialMonthDay: number
): Date {
    const dt = DateTime.fromJSDate(date);
    
    if (monthMode === 'calendar') {
        // Pour le mode calendaire, c'est le 1er du mois suivant
        return dt.plus({ months: 1 })
                .set({ day: 1 })
                .toJSDate();
    } else {
        // Pour le mode financier
        const day = dt.day;
        
        if (day < financialMonthDay) {
            // Si avant le jour financier, le prochain mois financier commence ce mois-ci
            return DateTime.fromObject({
                year: dt.year,
                month: dt.month,
                day: financialMonthDay
            }).toJSDate();
        } else {
            // Sinon, il commence le mois prochain
            const nextMonth = dt.plus({ months: 1 });
            return DateTime.fromObject({
                year: nextMonth.year,
                month: nextMonth.month,
                day: financialMonthDay
            }).toJSDate();
        }
    }
}

/**
 * Formate une date au format 'YYYY-MM'
 * 
 * @param date - Date à formater
 * @returns Chaîne au format 'YYYY-MM'
 */
function formatMonthKey(date: Date): string {
    const dt = DateTime.fromJSDate(date);
    return `${dt.year}-${dt.month.toString().padStart(2, '0')}`;
}

export const calculate_monthly_balances = (
    transactions: TransactionData[], 
    account_creation_date: Date,
    initial_balance: number,
    month_mode: 'calendar' | 'financial',
    financial_month_day: number,
    end_date: Date,
    account_id?: number
): MonthlyBalancesResult => {
    /**
     * Calculates the end-of-month balances from the account creation date up to the end_date.
     * 
     * @param transactions - Array of transactions with date, amount, type and account info
     * @param account_creation_date - The starting date for calculations
     * @param initial_balance - The balance at the account_creation_date
     * @param month_mode - 'calendar' for standard months, 'financial' for custom day boundaries
     * @param financial_month_day - The day defining the start/end of a financial month (e.g., 15)
     * @param end_date - The date up to which balances should be pre-calculated
     * @param account_id - Optional ID for filtering transactions by account
     * @returns An object with months as keys ('YYYY-MM') and balances as values
     */

    debug(`Calculating monthly balances - Mode: ${month_mode}, Fin Day: ${financial_month_day}, Start: ${account_creation_date.toISOString()}, End: ${end_date.toISOString()}`, "balance_calculator");
    
    // Créer un dictionnaire pour stocker les soldes mensuels
    const monthly_balances: MonthlyBalancesResult = {};
    
    // Initialiser la date courante et le solde
    let current_date = new Date(account_creation_date);
    let current_balance = initial_balance;
    
    // Itérer mois par mois jusqu'à la date de fin
    while (current_date <= end_date) {
        // Déterminer les limites du mois actuel
        const [month_start, month_end] = getMonthBoundaries(current_date, month_mode, financial_month_day);
        
        // Clé du mois au format 'YYYY-MM'
        const month_key = formatMonthKey(month_start);
        
        // Filtrer les transactions pour ce mois
        const month_transactions = transactions.filter(tx => {
            const tx_date = new Date(tx.date);
            return tx_date >= month_start && tx_date <= month_end;
        });
        
        // Filtrer par compte si nécessaire
        let relevant_transactions = month_transactions;
        if (account_id !== undefined) {
            relevant_transactions = month_transactions.filter(tx => 
                tx.accountId === account_id || tx.toAccountId === account_id
            );
        }
        
        // Calculer le solde du mois
        let month_balance = 0;
        
        if (relevant_transactions.length > 0) {
            // Calculer les revenus
            const incomes = relevant_transactions
                .filter(tx => tx.type === 'income')
                .reduce((sum, tx) => sum + tx.amount, 0);
            
            // Calculer les dépenses
            const expenses = relevant_transactions
                .filter(tx => tx.type === 'expense')
                .reduce((sum, tx) => sum + tx.amount, 0);
            
            // Pour les transferts, il faut tenir compte du compte source et destination
            let transfers_out = 0;
            let transfers_in = 0;
            
            if (account_id !== undefined) {
                // Transferts sortants (de ce compte vers un autre)
                transfers_out = relevant_transactions
                    .filter(tx => tx.type === 'transfer' && tx.accountId === account_id)
                    .reduce((sum, tx) => sum + tx.amount, 0);
                
                // Transferts entrants (d'un autre compte vers celui-ci)
                transfers_in = relevant_transactions
                    .filter(tx => tx.type === 'transfer' && tx.toAccountId === account_id)
                    .reduce((sum, tx) => sum + tx.amount, 0);
            }
            
            // Calculer le solde du mois
            month_balance = incomes - expenses - transfers_out + transfers_in;
        }
        
        // Mettre à jour le solde courant
        current_balance += month_balance;
        
        // Stocker le solde dans le dictionnaire
        monthly_balances[month_key] = current_balance;
        
        // Passer au mois suivant
        current_date = getNextMonthStart(month_end, month_mode, financial_month_day);
    }
    
    debug(`Returning calculated balances: ${JSON.stringify(monthly_balances)}`, "balance_calculator");
    return monthly_balances;
};

interface BalanceAdjustment {
    yearMonth: string;
    accountId: number;
    adjustedBalance: number;
}

export const calculate_monthly_balances_with_adjustments = (
    transactions: TransactionData[],
    account_creation_date: Date,
    initial_balance: number,
    month_mode: 'calendar' | 'financial',
    financial_month_day: number,
    end_date: Date,
    account_id?: number,
    balance_adjustments?: BalanceAdjustment[]
): MonthlyBalancesResult => {
    // Calculer d'abord les soldes normaux
    const monthly_balances = calculate_monthly_balances(
        transactions,
        account_creation_date,
        initial_balance,
        month_mode,
        financial_month_day,
        end_date,
        account_id
    );
    
    // Si pas d'ajustements ou pas d'ID de compte, retourner les soldes normaux
    if (!balance_adjustments || balance_adjustments.length === 0 || account_id === undefined) {
        return monthly_balances;
    }
    
    // Filtrer les ajustements pour ce compte
    const account_adjustments = balance_adjustments.filter(adj => 
        adj.accountId === account_id
    );
    
    // Si pas d'ajustements pour ce compte, retourner les soldes normaux
    if (account_adjustments.length === 0) {
        return monthly_balances;
    }
    
    // Appliquer les ajustements
    const adjusted_balances = { ...monthly_balances };
    
    for (const adjustment of account_adjustments) {
        const year_month = adjustment.yearMonth;
        const adjusted_balance = adjustment.adjustedBalance;
        
        // Si ce mois existe dans nos calculs, appliquer l'ajustement
        if (adjusted_balances[year_month] !== undefined) {
            debug(`Applying adjustment for ${year_month}: ${adjusted_balance}`, "balance_calculator");
            adjusted_balances[year_month] = adjusted_balance;
        }
    }
    
    return adjusted_balances;
};
