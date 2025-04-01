import { getForecastBalance } from '../calculateBalance';

/**
 * Fonction pour mettre à jour le solde prévisionnel après les modifications de solde des mois antérieurs.
 * Cette fonction est utilisée par la rubrique Transactions pour s'assurer que le prévisionnel affiché
 * est cohérent avec les ajustements effectués dans les mois précédents.
 */
export async function updateTransactionForecast(accountId: number | "all", yearMonth: string): Promise<{
  balance: number;
  income: number;
  expense: number;
}> {
  try {
    // Utiliser la fonction existante mais en s'assurant qu'elle recharge les données
    const forecastData = await getForecastBalance(accountId, yearMonth);
    return forecastData;
  } catch (error) {
    console.error('Erreur lors de la mise à jour du solde prévisionnel:', error);
    return { balance: 0, income: 0, expense: 0 };
  }
}
