import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatAmount, CurrencyDisplayFormat } from '@/lib/formatters';
import { Currency } from '@/lib/types';
import db from '@/lib/db';
import { cn } from '@/lib/utils';

interface FormattedAmountProps {
  /** Montant à afficher */
  amount: number;
  
  /** Devise à utiliser (si non spécifiée, utilise la devise par défaut des préférences) */
  currency?: Currency;
  
  /** Format d'affichage de la devise */
  displayFormat?: CurrencyDisplayFormat;
  
  /** Nombre de décimales à afficher */
  decimals?: number;
  
  /** Forcer l'affichage du signe (+ ou -) */
  showSign?: boolean;
  
  /** Forcer l'affichage du signe + pour les valeurs positives */
  forcePositiveSign?: boolean;
  
  /** Utiliser une couleur différente selon le signe */
  colorize?: boolean;
  
  /** Classes CSS personnalisées */
  className?: string;
  
  /** Autres propriétés React */
  [x: string]: any;
}

/**
 * Composant pour afficher un montant formaté selon les préférences de l'utilisateur
 */
export function FormattedAmount({
  amount,
  currency,
  displayFormat = CurrencyDisplayFormat.SYMBOL,
  decimals = 2,
  showSign = false,
  forcePositiveSign = false,
  colorize = true,
  className,
  ...props
}: FormattedAmountProps) {
  // Récupérer les préférences utilisateur pour la devise par défaut
  const { data: preferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => db.preferences.get(),
    staleTime: 24 * 60 * 60 * 1000, // 24 heures - rarement modifié
  });
  
  // Utiliser la devise passée en prop ou celle des préférences utilisateur
  const currencyToUse = currency || (preferences?.defaultCurrency || Currency.EUR);
  
  // Formater le montant
  const formattedAmount = formatAmount(amount, {
    currency: currencyToUse,
    decimals,
    showSign,
    forcePositiveSign,
    displayFormat,
  });
  
  // Déterminer la classe CSS en fonction du signe
  const colorClass = colorize
    ? amount < 0
      ? 'text-red-600 dark:text-red-400'
      : amount > 0
      ? 'text-green-600 dark:text-green-400'
      : ''
    : '';
  
  return (
    <span 
      className={cn(colorClass, className)}
      {...props}
    >
      {formattedAmount}
    </span>
  );
}

/**
 * Composant pour afficher un montant positif en vert
 */
export function PositiveAmount({ amount, ...props }: Omit<FormattedAmountProps, 'colorize'>) {
  return (
    <FormattedAmount
      amount={Math.abs(amount)}
      colorize={false}
      className="text-green-600 dark:text-green-400"
      {...props}
    />
  );
}

/**
 * Composant pour afficher un montant négatif en rouge
 */
export function NegativeAmount({ amount, ...props }: Omit<FormattedAmountProps, 'colorize'>) {
  return (
    <FormattedAmount
      amount={-Math.abs(amount)}
      colorize={false}
      className="text-red-600 dark:text-red-400"
      {...props}
    />
  );
}

/**
 * Composant pour afficher un solde avec indication positive/négative
 */
export function Balance({ amount, ...props }: FormattedAmountProps) {
  return (
    <FormattedAmount
      amount={amount}
      showSign={true}
      forcePositiveSign={true}
      colorize={true}
      {...props}
    />
  );
}
