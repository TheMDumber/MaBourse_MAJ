
/**
 * Types pour la base de données
 */

// Types de comptes bancaires
export enum AccountType {
  CHECKING = "checking",
  SAVINGS = "savings",
  CREDIT_CARD = "creditCard",
  CASH = "cash",
  INVESTMENT = "investment",
  OTHER = "other"
}

// Devises supportées
export enum Currency {
  EUR = "EUR",
  USD = "USD",
  GBP = "GBP",
  CHF = "CHF",
  CAD = "CAD",
  JPY = "JPY"
}

// Structure d'un compte bancaire
export interface Account {
  id?: number; // ID généré automatiquement par IndexedDB
  name: string;
  type: AccountType;
  initialBalance: number;
  currency: Currency;
  icon?: string;
  color?: string;
  isArchived?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Types de transactions
export enum TransactionType {
  INCOME = "income",
  EXPENSE = "expense",
  TRANSFER = "transfer"
}

// Catégories de dépenses
export enum ExpenseCategory {
  FIXED = "fixed",
  RECURRING = "recurring",
  EXCEPTIONAL = "exceptional"
}

// Structure d'une transaction
export interface Transaction {
  id?: number;
  accountId: number;
  toAccountId?: number; // Pour les transferts
  amount: number;
  type: TransactionType;
  category?: string;
  description: string;
  date: Date;
  isRecurring?: boolean;
  recurringId?: number;
  recurringMonths?: number; // Nombre de mois pour une transaction récurrente mensuelle
  createdAt: Date;
  updatedAt: Date;
}

// Structure pour les transactions récurrentes
export interface RecurringTransaction {
  id?: number;
  accountId: number;
  toAccountId?: number;
  amount: number;
  type: TransactionType;
  category?: string;
  description: string;
  frequency: RecurringFrequency;
  startDate: Date;
  endDate?: Date;
  lastExecuted?: Date;
  nextExecution: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Fréquence des transactions récurrentes
export enum RecurringFrequency {
  DAILY = "daily",
  WEEKLY = "weekly",
  BIWEEKLY = "biweekly",
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  YEARLY = "yearly"
}

// Thèmes visuels
export enum Theme {
  LIGHT = "light",
  DARK = "dark",
  CYBER = "cyber",
  SOFTBANK = "softbank",
  RED_BANK = "redbank"
}

// Structure pour les préférences utilisateur
export interface UserPreferences {
  id?: number;
  defaultCurrency: Currency;
  theme: Theme;
  defaultAccount?: number;
  dateFormat: string;
  // Paramètres du mois financier
  useFinancialMonth: boolean; // true pour utiliser le mois financier, false pour le mois calendaire
  financialMonthStartDay: number; // Jour du mois où commence le mois financier (1-31)
  financialMonthAccountId?: number; // Compte utilisé pour déterminer le jour de début (optionnel)
  createdAt: Date;
  updatedAt: Date;
}

// Structure pour les ajustements de solde
export interface BalanceAdjustment {
  id?: number;
  accountId: number;
  yearMonth: string; // Format: "YYYY-MM"
  adjustedBalance: number;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}
