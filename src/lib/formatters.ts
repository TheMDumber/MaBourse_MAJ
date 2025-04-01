import { Currency } from './types';

/**
 * Options pour le formatage des montants
 */
interface FormatAmountOptions {
  /** Devise à utiliser (par défaut EUR) */
  currency?: Currency;
  /** Nombre de décimales à afficher (par défaut 2) */
  decimals?: number;
  /** Afficher le signe +/- devant les nombres positifs/négatifs (par défaut false) */
  showSign?: boolean;
  /** Forcer le signe + pour les montants positifs (par défaut false) */
  forcePositiveSign?: boolean;
  /** Afficher toujours les décimales même si elles sont égales à zéro (par défaut true) */
  alwaysShowDecimals?: boolean;
  /** Utiliser des espaces pour séparer les milliers (par défaut true) */
  useThousandSeparator?: boolean;
}

/**
 * Format d'affichage pour les symboles de devise
 */
export enum CurrencyDisplayFormat {
  /** Affiche le symbole (€, $, etc.) */
  SYMBOL = 'symbol',
  /** Affiche le code (EUR, USD, etc.) */
  CODE = 'code',
  /** N'affiche pas la devise */
  NONE = 'none'
}

/**
 * Positions possibles pour le symbole de devise
 */
export enum CurrencyPosition {
  /** Avant le montant (ex: $100) */
  BEFORE = 'before',
  /** Après le montant (ex: 100€) */
  AFTER = 'after'
}

/**
 * Configuration par devise
 */
interface CurrencyConfig {
  symbol: string;
  code: string;
  position: CurrencyPosition;
  thousandSeparator: string;
  decimalSeparator: string;
  spaceBetweenAmountAndSymbol: boolean;
}

/**
 * Configuration des devises supportées
 */
const CURRENCY_CONFIG: Record<Currency, CurrencyConfig> = {
  [Currency.EUR]: {
    symbol: '€',
    code: 'EUR',
    position: CurrencyPosition.AFTER,
    thousandSeparator: ' ',
    decimalSeparator: ',',
    spaceBetweenAmountAndSymbol: true
  },
  [Currency.USD]: {
    symbol: '$',
    code: 'USD',
    position: CurrencyPosition.BEFORE,
    thousandSeparator: ',',
    decimalSeparator: '.',
    spaceBetweenAmountAndSymbol: false
  },
  [Currency.GBP]: {
    symbol: '£',
    code: 'GBP',
    position: CurrencyPosition.BEFORE,
    thousandSeparator: ',',
    decimalSeparator: '.',
    spaceBetweenAmountAndSymbol: false
  },
  [Currency.CHF]: {
    symbol: 'CHF',
    code: 'CHF',
    position: CurrencyPosition.BEFORE,
    thousandSeparator: "'",
    decimalSeparator: '.',
    spaceBetweenAmountAndSymbol: true
  },
  [Currency.CAD]: {
    symbol: 'C$',
    code: 'CAD',
    position: CurrencyPosition.BEFORE,
    thousandSeparator: ',',
    decimalSeparator: '.',
    spaceBetweenAmountAndSymbol: false
  }
};

/**
 * Formate un montant selon la devise et les options spécifiées
 * @param amount Montant à formater
 * @param options Options de formatage
 * @returns Chaîne formatée
 */
export function formatAmount(amount: number, options?: FormatAmountOptions & { displayFormat?: CurrencyDisplayFormat }): string {
  // Options par défaut
  const {
    currency = Currency.EUR,
    decimals = 2,
    showSign = false,
    forcePositiveSign = false,
    alwaysShowDecimals = true,
    useThousandSeparator = true,
    displayFormat = CurrencyDisplayFormat.SYMBOL
  } = options || {};

  // Récupérer la configuration de la devise
  const currencyConfig = CURRENCY_CONFIG[currency];

  // Préparer le signe
  const isNegative = amount < 0;
  const sign = isNegative ? '-' : (forcePositiveSign || showSign ? '+' : '');

  // Valeur absolue pour le formatage
  const absAmount = Math.abs(amount);

  // Formater le nombre avec les décimales spécifiées
  let formattedNumber: string;
  
  if (alwaysShowDecimals || absAmount % 1 !== 0) {
    // Avec décimales
    formattedNumber = absAmount.toFixed(decimals);
  } else {
    // Sans décimales si c'est un nombre entier et alwaysShowDecimals est false
    formattedNumber = absAmount.toString();
  }

  // Remplacer le séparateur décimal
  formattedNumber = formattedNumber.replace('.', currencyConfig.decimalSeparator);

  // Ajouter les séparateurs de milliers si demandé
  if (useThousandSeparator) {
    const parts = formattedNumber.split(currencyConfig.decimalSeparator);
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, currencyConfig.thousandSeparator);
    formattedNumber = parts.join(currencyConfig.decimalSeparator);
  }

  // Ajouter le signe
  formattedNumber = sign + formattedNumber;

  // Ajouter le symbole de devise
  if (displayFormat !== CurrencyDisplayFormat.NONE) {
    const currencyText = displayFormat === CurrencyDisplayFormat.SYMBOL 
      ? currencyConfig.symbol 
      : currencyConfig.code;
    
    const space = currencyConfig.spaceBetweenAmountAndSymbol ? ' ' : '';
    
    if (currencyConfig.position === CurrencyPosition.BEFORE) {
      formattedNumber = currencyText + space + formattedNumber;
    } else {
      formattedNumber = formattedNumber + space + currencyText;
    }
  }

  return formattedNumber;
}

/**
 * Formate une date selon le format spécifié
 * @param date Date à formater
 * @param format Format de date (par défaut 'dd/MM/yyyy')
 * @returns Date formatée
 */
export function formatDate(date: Date | string, format: string = 'dd/MM/yyyy'): string {
  // Convertir en Date si c'est une chaîne
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Fonction pour ajouter un zéro devant les nombres < 10
  const pad = (num: number) => num < 10 ? `0${num}` : num.toString();
  
  // Extraire les composants de la date
  const day = pad(dateObj.getDate());
  const month = pad(dateObj.getMonth() + 1);
  const year = dateObj.getFullYear().toString();
  const hours = pad(dateObj.getHours());
  const minutes = pad(dateObj.getMinutes());
  const seconds = pad(dateObj.getSeconds());
  
  // Remplacer les parties du format
  return format
    .replace('dd', day)
    .replace('MM', month)
    .replace('yyyy', year)
    .replace('yy', year.slice(-2))
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}
