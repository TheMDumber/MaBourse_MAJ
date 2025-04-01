import { Account, Transaction, RecurringTransaction, UserPreferences } from './types';
import { UserData } from './fileStorage';

// Interface pour les requêtes au serveur local
interface ServerResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Déterminer l'URL du serveur en fonction de l'environnement
const getBaseUrl = () => {
  // Utiliser explicitement le port 3001 pour l'API, quel que soit l'environnement
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    // En production ou sur un réseau distant, utiliser une URL explicite
    return `http://${window.location.hostname}:3001/api/storage`;
  }
  
  // En développement local (localhost)
  return `http://${window.location.hostname}:3001/api/storage`;
};

// URL de base pour les requêtes vers le serveur local
const API_BASE_URL = getBaseUrl();

// Définir un timeout pour les requêtes fetch (en millisecondes)
const FETCH_TIMEOUT = 15000; // 15 secondes

// Classe pour gérer le stockage de fichiers côté client
export class FileStorageAdapter {
  private username: string | null = null;
  private password: string | null = null;
  private loggedIn: boolean = false;

  // Initialisation de l'adaptateur
  constructor() {
    // Restaurer la session depuis localStorage si disponible
    const savedSession = localStorage.getItem('userSession');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        this.username = session.username;
        this.password = session.password;
        this.loggedIn = true;
      } catch (error) {
        console.error('Erreur lors de la restauration de la session:', error);
        localStorage.removeItem('userSession');
      }
    }
  }

  // Vérifier si l'utilisateur est connecté
  isLoggedIn(): boolean {
    // Recharger les informations de session depuis localStorage si elles ont changé
    const savedSession = localStorage.getItem('userSession');
    if (savedSession && !this.loggedIn) {
      try {
        const session = JSON.parse(savedSession);
        this.username = session.username;
        this.password = session.password;
        this.loggedIn = true;
        console.log('Session restaurée depuis localStorage');
      } catch (error) {
        console.error('Erreur lors de la restauration de la session:', error);
      }
    }
    return this.loggedIn;
  }

  // Récupérer le nom d'utilisateur actuel
  getCurrentUsername(): string | null {
    // S'assurer que les informations sont à jour
    this.isLoggedIn();
    return this.username;
  }

  // Méthode d'authentification
  async login(username: string, password: string): Promise<boolean> {
    try {
      console.log('Tentative de connexion à', API_BASE_URL);
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        console.error('Erreur de connexion:', response.status, response.statusText);
        return false;
      }

      const result: ServerResponse<boolean> = await response.json();
      
      if (result.success) {
        this.username = username;
        this.password = password;
        this.loggedIn = true;
        
        // Sauvegarder la session dans localStorage
        localStorage.setItem('userSession', JSON.stringify({ username, password }));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      return false;
    }
  }

  // Créer un nouvel utilisateur
  async register(username: string, password: string, initialData: UserData): Promise<boolean> {
    try {
      console.log('Tentative d\'inscription à', API_BASE_URL);
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, data: initialData }),
      });

      if (!response.ok) {
        console.error('Erreur d\'inscription:', response.status, response.statusText);
        return false;
      }

      const result: ServerResponse<boolean> = await response.json();
      
      if (result.success) {
        // Connecter automatiquement après l'inscription
        return await this.login(username, password);
      }
      
      return false;
    } catch (error) {
      console.error('Erreur lors de l\'inscription:', error);
      return false;
    }
  }

  // Récupérer les données utilisateur depuis le serveur
  async loadUserData(): Promise<UserData | null> {
    if (!this.loggedIn || !this.username || !this.password) {
      console.error('Utilisateur non connecté');
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: this.username, password: this.password }),
      });

      if (!response.ok) {
        console.error('Erreur de chargement des données:', response.status, response.statusText);
        return null;
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        // Stocker la date de création du compte dans localStorage pour y accéder facilement
        if (result.minSelectableMonth) {
          localStorage.setItem('minSelectableMonth', result.minSelectableMonth);
          localStorage.setItem('accountCreationMonth', result.minSelectableMonth); // Pour compatibilité
          console.log(`Premier mois sélectionnable stocké: ${result.minSelectableMonth}`);
        } else if (result.accountCreationMonth) {
          // Fallback pour compatibilité avec d'anciennes versions de l'API
          localStorage.setItem('minSelectableMonth', result.accountCreationMonth);
          localStorage.setItem('accountCreationMonth', result.accountCreationMonth);
          console.log(`Date de création du compte stockée (ancien format): ${result.accountCreationMonth}`);
        }
        
        return result.data;
      }
      
      return null;
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      return null;
    }
  }

  // Sauvegarder les données utilisateur sur le serveur
  async saveUserData(data: UserData): Promise<boolean> {
    // Recharger les informations de session depuis localStorage avant la tentative de sauvegarde
    const savedSession = localStorage.getItem('userSession');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        this.username = session.username;
        this.password = session.password;
        this.loggedIn = true;
      } catch (error) {
        console.error('Erreur lors de la lecture de la session:', error);
      }
    }

    if (!this.loggedIn || !this.username || !this.password) {
      console.error('Utilisateur non connecté, impossible de sauvegarder');
      return false;
    }

    try {
      console.log(`Tentative de sauvegarde des données pour l'utilisateur ${this.username}`);
      
      const response = await fetch(`${API_BASE_URL}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: this.username,
          password: this.password,
          data
        }),
      });

      if (!response.ok) {
        console.error('Erreur de sauvegarde des données:', response.status, response.statusText);
        
        // Si erreur 401, c'est un problème d'authentification - réessayer de se connecter automatiquement
        if (response.status === 401) {
          console.log('Tentative de reconnexion automatique...');
          const loginSuccess = await this.login(this.username, this.password);
          
          if (loginSuccess) {
            console.log('Reconnexion réussie, nouvelle tentative de sauvegarde');
            // Réessayer la sauvegarde
            return await this.saveUserData(data);
          } else {
            console.error('Échec de la reconnexion automatique');
            return false;
          }
        }
        
        return false;
      }

      const result: ServerResponse<boolean> = await response.json();
      if (result.success) {
        console.log('Sauvegarde des données réussie');
      }
      return result.success;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des données:', error);
      return false;
    }
  }

  // Déconnexion
  logout(): void {
    this.username = null;
    this.password = null;
    this.loggedIn = false;
    localStorage.removeItem('userSession');
  }

  // Vérifier si un nom d'utilisateur existe déjà
  async checkUsernameExists(username: string): Promise<boolean> {
    try {
      console.log('Vérification du nom d\'utilisateur à', API_BASE_URL);
      const response = await fetch(`${API_BASE_URL}/check-username`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        console.error('Erreur de vérification du nom d\'utilisateur:', response.status, response.statusText);
        return false;
      }

      const result: ServerResponse<boolean> = await response.json();
      return result.success && result.data === true;
    } catch (error) {
      console.error('Erreur lors de la vérification du nom d\'utilisateur:', error);
      return false;
    }
  }

  // Obtenir la liste des utilisateurs
  async getUsersList(): Promise<string[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/users-list`);
      
      if (!response.ok) {
        console.error('Erreur de récupération de la liste des utilisateurs:', response.status, response.statusText);
        return [];
      }
      
      const result: ServerResponse<string[]> = await response.json();
      
      if (result.success && result.data) {
        return result.data;
      }
      
      return [];
    } catch (error) {
      console.error('Erreur lors de la récupération de la liste des utilisateurs:', error);
      return [];
    }
  }
}

// Exporter une instance unique de l'adaptateur
export const fileStorage = new FileStorageAdapter();
