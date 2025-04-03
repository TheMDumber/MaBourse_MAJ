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
    
    // Utiliser un timeout plus court pour la vérification de disponibilité
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    // Essayer de récupérer la liste des utilisateurs (endpoint qui ne nécessite pas d'authentification)
    const response = await fetch(`${apiBaseUrl}/api/storage/users-list`, {
      method: 'GET',
      signal: controller.signal,
      // S'assurer que la requête n'utilise pas le cache
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
        // 'Pragma' en-tête a été retiré car il causait des erreurs CORS
      }
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

// Vérifier si le serveur est disponible et en bonne santé (plus complet)
export async function checkServerHealth(): Promise<{available: boolean, message: string}> {
  try {
    const serverAvailable = await checkServerAvailable();
    
    if (!serverAvailable) {
      return {
        available: false,
        message: "Le serveur ne répond pas. Vérifiez qu'il est démarré et accessible."
      };
    }
    
    // Vérifier si le fichier utilisateurs est accessible
    const apiBaseUrl = getAPIBaseUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    try {
      const response = await fetch(`${apiBaseUrl}/api/storage/check-username`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: 'test_health_check' }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return {
          available: true,
          message: "Serveur opérationnel et accessible"
        };
      } else {
        return {
          available: true,
          message: `Serveur accessible mais avec un problème potentiel: ${response.status} ${response.statusText}`
        };
      }
    } catch (error) {
      return {
        available: true,
        message: "Serveur accessible mais avec des problèmes d'API"
      };
    }
  } catch (error) {
    return {
      available: false,
      message: `Erreur lors de la vérification: ${error.message}`
    };
  }
}

// Obtenir l'URL complète de l'API serveur
export function getServerUrl(): string {
  return getAPIBaseUrl();
}