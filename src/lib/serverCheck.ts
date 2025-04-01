/**
 * Utilitaire pour vérifier la disponibilité du serveur
 */

// URL de base pour l'API
const getAPIBaseUrl = () => {
  return `http://${window.location.hostname}:3001`;
};

// Vérifier si le serveur est disponible
export async function checkServerAvailable(): Promise<boolean> {
  try {
    const apiBaseUrl = getAPIBaseUrl();
    console.log(`Vérification de la disponibilité du serveur: ${apiBaseUrl}`);
    
    // Utiliser un timeout pour la requête
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    // Essayer de récupérer la liste des utilisateurs (endpoint qui ne nécessite pas d'authentification)
    const response = await fetch(`${apiBaseUrl}/api/storage/users-list`, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Si le serveur répond avec un code 200, il est disponible
    if (response.ok) {
      console.log('Serveur disponible');
      return true;
    }
    
    console.warn(`Serveur non disponible, code d'état: ${response.status}`);
    return false;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Délai d\'attente dépassé lors de la vérification du serveur');
    } else {
      console.error('Erreur lors de la vérification du serveur:', error);
    }
    return false;
  }
}

// Obtenir l'URL complète de l'API serveur
export function getServerUrl(): string {
  return getAPIBaseUrl();
}
