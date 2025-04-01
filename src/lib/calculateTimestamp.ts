/**
 * Utilitaire pour comparer les dates de modification des objets
 * et déterminer quel objet est le plus récent
 */

/**
 * Vérifie si un objet a une date de modification plus récente qu'un autre
 * @param obj1 Premier objet avec une propriété updatedAt
 * @param obj2 Second objet avec une propriété updatedAt
 * @returns true si le premier objet est plus récent, false sinon
 */
export function isMoreRecent(obj1: any, obj2: any): boolean {
  // Vérifier si les objets sont définis
  if (!obj1 || !obj2) {
    return !!obj1 && !obj2; // obj1 existe mais pas obj2 -> obj1 est plus récent
  }
  
  // Vérifier si les propriétés updatedAt sont définies
  if (!obj1.updatedAt || !obj2.updatedAt) {
    return !!obj1.updatedAt && !obj2.updatedAt; // obj1.updatedAt existe mais pas obj2.updatedAt -> obj1 est plus récent
  }
  
  try {
    const date1 = obj1.updatedAt instanceof Date ? obj1.updatedAt : new Date(obj1.updatedAt);
    const date2 = obj2.updatedAt instanceof Date ? obj2.updatedAt : new Date(obj2.updatedAt);
    
    return date1 > date2;
  } catch (error) {
    console.error('Erreur lors de la comparaison des dates:', error);
    return false; // En cas d'erreur, considérer que obj1 n'est pas plus récent
  }
}

/**
 * Convertit une date en horodatage numérique pour faciliter les comparaisons
 * @param date Date à convertir
 * @returns Timestamp en millisecondes
 */
export function dateToTimestamp(date: Date | string): number {
  return (date instanceof Date ? date : new Date(date)).getTime();
}

/**
 * Compare deux objets et retourne le plus récent
 * @param obj1 Premier objet avec une propriété updatedAt
 * @param obj2 Second objet avec une propriété updatedAt
 * @returns L'objet le plus récent ou le premier disponible si l'un est indéfini
 */
export function getMostRecent<T extends { updatedAt?: Date | string }>(obj1: T | null | undefined, obj2: T | null | undefined): T | null {
  // Si l'un des objets est indéfini, retourner l'autre
  if (!obj1) return obj2 || null;
  if (!obj2) return obj1;
  
  // Si les deux sont définis, comparer les dates
  return isMoreRecent(obj1, obj2) ? obj1 : obj2;
}
