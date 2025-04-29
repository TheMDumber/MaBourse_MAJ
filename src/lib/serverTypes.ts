
// Interface pour les réponses du serveur
export interface ServerResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Structure des données d'authentification
export interface AuthCredentials {
  username: string;
  password: string;
}

// Structure de la session utilisateur
export interface UserSession {
  username: string;
  password: string; // Mot de passe stocké temporairement pour le stockage local seulement
}

// Requête d'inscription
export interface RegisterRequest extends AuthCredentials {
  data: unknown; // Données initiales (type renforcé)
}

// Requête de sauvegarde
export interface SaveDataRequest extends AuthCredentials {
  data: unknown; // Données à sauvegarder (type renforcé)
}
