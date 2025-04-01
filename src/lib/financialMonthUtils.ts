import { 
  startOfMonth, 
  endOfMonth, 
  format, 
  setDate, 
  addMonths, 
  subDays,
  subMonths,
  differenceInMonths,
  parseISO
} from 'date-fns';
import db from './db';
import { fr } from 'date-fns/locale';

/**
 * Vérifie si l'utilisation du mois financier est activée dans les préférences
 */
export async function isFinancialMonthEnabled(): Promise<boolean> {
  try {
    const prefs = await db.preferences.get();
    return prefs.useFinancialMonth ?? false;
  } catch (error) {
    console.error('Erreur lors de la vérification du mois financier:', error);
    return false;
  }
}

/**
 * Obtient le jour de début du mois financier depuis les préférences
 */
export async function getFinancialMonthStartDay(): Promise<number> {
  try {
    const prefs = await db.preferences.get();
    return prefs.financialMonthStartDay ?? 1;
  } catch (error) {
    console.error('Erreur lors de la récupération du jour de début du mois financier:', error);
    return 1; // Valeur par défaut
  }
}

/**
 * Calcule le début et la fin d'un mois financier pour une date donnée
 */
export async function getFinancialMonthRange(date: Date): Promise<{ start: Date; end: Date; name: string }> {
  const useFinancialMonth = await isFinancialMonthEnabled();
  
  if (!useFinancialMonth) {
    // Mode mois calendaire standard
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const name = format(date, 'MMMM yyyy', { locale: fr });
    return { start, end, name };
  }
  
  // Mode mois financier personnalisé
  const financialMonthStartDay = await getFinancialMonthStartDay();
  const currentMonth = date.getMonth();
  const currentYear = date.getFullYear();
  const currentDay = date.getDate();
  
  // Calculer la date de fin théorique du mois financier en cours
  const tempStartDate = new Date(currentYear, currentMonth, financialMonthStartDay);
  const tempEndDate = subDays(setDate(addMonths(tempStartDate, 1), financialMonthStartDay), 1);
  
  // Vérifier si la date actuelle est après la fin du mois financier en cours
  if (date > tempEndDate) {
    // Basculer sur le mois financier suivant
    const startDate = addMonths(tempStartDate, 1);
    const endDate = subDays(setDate(addMonths(startDate, 1), financialMonthStartDay), 1);
    const financialMonthName = format(startDate, 'MMMM yyyy', { locale: fr });
    return { start: startDate, end: endDate, name: financialMonthName };
  }
  
  // Vérifier si la date est avant le début du mois financier en cours
  if (date < tempStartDate) {
    // Utiliser le mois financier précédent
    const startDate = subMonths(tempStartDate, 1);
    const endDate = subDays(tempStartDate, 1);
    const financialMonthName = format(startDate, 'MMMM yyyy', { locale: fr });
    return { start: startDate, end: endDate, name: financialMonthName };
  }
  
  // Sinon, utiliser le mois financier en cours
  const financialMonthName = format(addMonths(tempStartDate, 1), 'MMMM yyyy', { locale: fr });
  return { start: tempStartDate, end: tempEndDate, name: financialMonthName };
}

/**
 * Convertit un format YYYY-MM en objet Date en tenant compte du mois financier
 */
export async function yearMonthToFinancialMonthRange(yearMonth: string): Promise<{ start: Date; end: Date; name: string }> {
  // Parse le format YYYY-MM
  const date = parseISO(`${yearMonth}-15`); // 15 est une date médiane du mois
  return getFinancialMonthRange(date);
}

/**
 * Génère une série de N mois financiers à partir d'une date donnée
 * @param startDate Date de départ
 * @param monthsCount Nombre de mois à générer
 * @param direction 'past' pour le passé, 'future' pour le futur
 */
export async function generateFinancialMonthsSeries(
  startDate: Date, 
  monthsCount: number, 
  direction: 'past' | 'future' = 'past'
): Promise<{ start: Date; end: Date; name: string }[]> {
  const result: { start: Date; end: Date; name: string }[] = [];
  
  // Obtenir le mois financier de la date de départ
  const initialMonth = await getFinancialMonthRange(startDate);
  result.push(initialMonth);
  
  // Calcul du facteur multiplicateur en fonction de la direction
  const directionFactor = direction === 'past' ? -1 : 1;
  
  // Générer les mois suivants/précédents
  let currentDate = startDate;
  for (let i = 1; i < monthsCount; i++) {
    // Avancer/reculer d'un mois complet
    currentDate = addMonths(currentDate, directionFactor);
    const monthRange = await getFinancialMonthRange(currentDate);
    
    // Vérifier si le mois n'est pas déjà inclus (cas particulier des mois financiers)
    if (result.every(m => differenceInMonths(m.start, monthRange.start) !== 0)) {
      result.push(monthRange);
    }
  }
  
  // Trier les mois par date
  if (direction === 'past') {
    result.sort((a, b) => b.start.getTime() - a.start.getTime());
  } else {
    result.sort((a, b) => a.start.getTime() - b.start.getTime());
  }
  
  return result;
}

/**
 * Convertit une période (ex: "3months") en nombre de mois financiers
 */
export function periodToMonthsCount(period: string): number {
  switch (period) {
    case '1month': return 1;
    case '3months': return 3;
    case '6months': return 6;
    case '12months': return 12;
    default: return parseInt(period.replace('months', '')) || 3;
  }
}

/**
 * Calcule le mois financier suivant pour une date donnée
 */
export async function getNextFinancialMonth(date: Date): Promise<{ start: Date; end: Date; name: string }> {
  const currentMonth = await getFinancialMonthRange(date);
  
  // Décaler d'un jour la date de fin pour obtenir le mois suivant
  const nextMonthDate = new Date(currentMonth.end);
  nextMonthDate.setDate(nextMonthDate.getDate() + 1);
  
  return getFinancialMonthRange(nextMonthDate);
}

/**
 * Calcule le mois financier précédent pour une date donnée
 */
export async function getPreviousFinancialMonth(date: Date): Promise<{ start: Date; end: Date; name: string }> {
  const currentMonth = await getFinancialMonthRange(date);
  
  // Soustraire un jour à la date de début pour obtenir le mois précédent
  const previousMonthDate = new Date(currentMonth.start);
  previousMonthDate.setDate(previousMonthDate.getDate() - 1);
  
  return getFinancialMonthRange(previousMonthDate);
}

/**
 * Génère une série de N mois financiers futurs à partir d'une date donnée
 * @param startDate Date de départ 
 * @param count Nombre de mois à générer (incluant le mois actuel)
 */
/**
 * Détermine le format de mois (YYYY-MM) à afficher dans le filtre
 * basé sur la date de fin d'une période (start_date, end_date)
 * @param endDate La date de fin de la période
 * @returns Format YYYY-MM correspondant au mois à sélectionner dans le filtre
 */
export function getEffectiveDisplayMonth(endDate: Date): string {
  // Extraire le mois et l'année de la date de fin
  const effectiveDisplayYear = endDate.getFullYear();
  const effectiveDisplayMonth = endDate.getMonth() + 1; // getMonth() retourne 0-11, on ajoute 1 pour avoir 1-12
  
  // Formater en YYYY-MM avec padding du mois si nécessaire
  return `${effectiveDisplayYear}-${effectiveDisplayMonth.toString().padStart(2, '0')}`;
}

export async function generateFutureFinancialMonths(
  startDate: Date,
  count: number
): Promise<{ start: Date; end: Date; name: string }[]> {
  const result: { start: Date; end: Date; name: string }[] = [];
  
  // S'assurer que nous commençons bien avec le mois financier actuel
  // et non le mois suivant - c'est une correction importante
  const currentMonth = await getFinancialMonthRange(startDate);
  result.push(currentMonth);
  console.log(`Ajout du mois financier actuel: ${format(currentMonth.start, 'dd/MM/yyyy')} au ${format(currentMonth.end, 'dd/MM/yyyy')} (${currentMonth.name})`);
  
  // Si nous avons besoin de plus d'un mois, générer les mois suivants
  let lastMonthEnd = new Date(currentMonth.end);
  for (let i = 1; i < count; i++) {
    // Avancer d'un jour pour être dans le mois suivant
    const nextMonthStart = new Date(lastMonthEnd);
    nextMonthStart.setDate(nextMonthStart.getDate() + 1);
    
    const nextMonth = await getFinancialMonthRange(nextMonthStart);
    result.push(nextMonth);
    console.log(`Ajout du mois financier suivant: ${format(nextMonth.start, 'dd/MM/yyyy')} au ${format(nextMonth.end, 'dd/MM/yyyy')} (${nextMonth.name})`);
    
    lastMonthEnd = new Date(nextMonth.end);
  }
  
  return result;
}
