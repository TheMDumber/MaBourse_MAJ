import { format, parse, endOfMonth, setDate, addMonths, subMonths, getDaysInMonth } from 'date-fns';

/**
 * Calcule les dates de début et de fin d'une période mensuelle selon le mode choisi.
 * 
 * @param targetMonth - Mois cible (1-12)
 * @param targetYear - Année cible
 * @param mode - Mode de calcul ('calendaire' ou 'financier')
 * @param financialStartDay - Jour de début du mois financier (1-31)
 * @returns Tuple contenant la date de début et la date de fin de la période
 * 
 * Exemples:
 * // Mode calendaire pour Janvier 2025
 * calculatePeriodDates(1, 2025, 'calendaire')
 * // Retourne: [new Date(2025, 0, 1), new Date(2025, 0, 31)]
 * 
 * // Mode financier avec début au 15 pour Janvier 2025
 * calculatePeriodDates(1, 2025, 'financier', 15)
 * // Retourne: [new Date(2024, 11, 15), new Date(2025, 0, 14)]
 */
export function calculatePeriodDates(
  targetMonth: number, 
  targetYear: number, 
  mode: 'calendaire' | 'financier' = 'calendaire', 
  financialStartDay: number = 1
): [Date, Date] {
  if (targetMonth < 1 || targetMonth > 12) {
    throw new Error("Le mois doit être compris entre 1 et 12");
  }
  
  if (financialStartDay < 1 || financialStartDay > 31) {
    throw new Error("Le jour de début du mois financier doit être compris entre 1 et 31");
  }
  
  // Ajustement pour l'indexation des mois en JavaScript (0-11 au lieu de 1-12)
  const jsMonth = targetMonth - 1;
  
  if (mode === 'calendaire') {
    // Mode calendaire: du 1er au dernier jour du mois
    const startDate = new Date(targetYear, jsMonth, 1);
    const endDate = endOfMonth(startDate);
    
    return [startDate, endDate];
  } else { // mode === 'financier'
    // Mode financier: du jour J du mois M-1 au jour J-1 du mois M
    
    // Calculer le mois et l'année précédents
    let prevMonth: number, prevYear: number;
    
    if (targetMonth === 1) { // Janvier
      prevMonth = 11; // Décembre (indexé 0-11)
      prevYear = targetYear - 1;
    } else {
      prevMonth = jsMonth - 1;
      prevYear = targetYear;
    }
    
    // S'assurer que financialStartDay ne dépasse pas le nombre de jours du mois précédent
    const prevMonthDays = getDaysInMonth(new Date(prevYear, prevMonth, 1));
    const actualStartDay = Math.min(financialStartDay, prevMonthDays);
    
    // Date de début: jour J du mois précédent
    const startDate = new Date(prevYear, prevMonth, actualStartDay);
    
    // Calculer la date de fin (veille du jour J du mois courant)
    let endDate: Date;
    
    if (financialStartDay === 1) {
      // Si le jour de début est le 1er, la fin est le dernier jour du mois précédent
      endDate = new Date(prevYear, prevMonth, prevMonthDays);
    } else {
      // S'assurer que le jour de fin n'excède pas le nombre de jours du mois courant
      const currentMonthDays = getDaysInMonth(new Date(targetYear, jsMonth, 1));
      const endDay = Math.min(financialStartDay - 1, currentMonthDays);
      endDate = new Date(targetYear, jsMonth, endDay);
    }
    
    return [startDate, endDate];
  }
}

/**
 * Calcule la période du mois précédent par rapport à une période donnée.
 * 
 * @param periodStart - Date de début de la période actuelle
 * @param periodEnd - Date de fin de la période actuelle
 * @param mode - Mode de calcul ('calendaire' ou 'financier')
 * @param financialStartDay - Jour de début du mois financier (1-31)
 * @returns Tuple contenant la date de début et la date de fin de la période précédente
 */
export function calculatePreviousPeriodDates(
  periodStart: Date, 
  periodEnd: Date, 
  mode: 'calendaire' | 'financier' = 'calendaire', 
  financialStartDay: number = 1
): [Date, Date] {
  const currentMonth = periodStart.getMonth() + 1; // +1 pour convertir de 0-11 à 1-12
  const currentYear = periodStart.getFullYear();
  
  let prevMonth: number, prevYear: number;
  
  if (currentMonth === 1) { // Janvier
    prevMonth = 12;
    prevYear = currentYear - 1;
  } else {
    prevMonth = currentMonth - 1;
    prevYear = currentYear;
  }
  
  return calculatePeriodDates(prevMonth, prevYear, mode, financialStartDay);
}
