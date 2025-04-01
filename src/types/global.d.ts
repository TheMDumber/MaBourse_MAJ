/**
 * Déclarations globales pour TypeScript
 */

// Étend l'interface Window pour ajouter nos propriétés personnalisées
interface Window {
  /**
   * Flag indiquant si une tentative de réparation de la base de données a déjà été effectuée
   * Utilisé dans repairDB.ts pour éviter les boucles infinies de réparation
   */
  hasAttemptedDBRepair?: boolean;
}
