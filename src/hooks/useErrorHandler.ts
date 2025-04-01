import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface ErrorOptions {
  showToast?: boolean;
  logToConsole?: boolean;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  context?: Record<string, any>;
}

const defaultOptions: ErrorOptions = {
  showToast: true,
  logToConsole: true,
  severity: 'error',
  context: {}
};

interface ErrorState {
  hasError: boolean;
  message: string;
  details?: string;
  context?: Record<string, any>;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

type ErrorHandler = (error: unknown, options?: ErrorOptions) => void;

/**
 * Hook pour centraliser la gestion des erreurs
 * @returns Objet contenant l'état de l'erreur et les fonctions pour la gérer
 */
export function useErrorHandler() {
  const [errorState, setErrorState] = useState<ErrorState | null>(null);

  /**
   * Extrait un message d'erreur lisible à partir de différents types d'erreurs
   */
  const getErrorMessage = useCallback((error: unknown): { message: string, details?: string } => {
    if (error instanceof Error) {
      return { 
        message: error.message,
        details: error.stack
      };
    } else if (typeof error === 'string') {
      return { message: error };
    } else if (error && typeof error === 'object' && 'message' in error) {
      return { 
        // @ts-ignore
        message: error.message?.toString() || 'Erreur inconnue',
        // @ts-ignore
        details: error.details?.toString() || error.stack?.toString()
      };
    } else {
      return { message: 'Erreur inconnue' };
    }
  }, []);

  /**
   * Fonction pour gérer une erreur
   */
  const handleError: ErrorHandler = useCallback((error: unknown, options?: ErrorOptions) => {
    const opts = { ...defaultOptions, ...options };
    const { message, details } = getErrorMessage(error);
    
    // Mettre à jour l'état de l'erreur
    const newErrorState: ErrorState = {
      hasError: true,
      message,
      details,
      context: opts.context,
      timestamp: new Date(),
      severity: opts.severity || 'error'
    };
    
    setErrorState(newErrorState);
    
    // Journalisation dans la console
    if (opts.logToConsole) {
      switch (opts.severity) {
        case 'info':
          console.info(`[INFO] ${message}`, { details, context: opts.context });
          break;
        case 'warning':
          console.warn(`[WARNING] ${message}`, { details, context: opts.context });
          break;
        case 'critical':
          console.error(`[CRITICAL] ${message}`, { details, context: opts.context });
          break;
        default:
          console.error(`[ERROR] ${message}`, { details, context: opts.context });
      }
    }
    
    // Afficher un toast
    if (opts.showToast) {
      switch (opts.severity) {
        case 'info':
          toast.info(message);
          break;
        case 'warning':
          toast.warning(message);
          break;
        case 'critical':
        case 'error':
          toast.error(message, {
            description: details && details.length < 100 ? details : undefined
          });
          break;
      }
    }
  }, [getErrorMessage]);

  /**
   * Fonction pour effacer l'état d'erreur
   */
  const clearError = useCallback(() => {
    setErrorState(null);
  }, []);

  /**
   * Fonction pour créer un gestionnaire d'erreur pour les promesses
   */
  const createAsyncErrorHandler = useCallback(
    <T>(promise: Promise<T>, options?: ErrorOptions): Promise<T> => {
      return promise.catch((error) => {
        handleError(error, options);
        throw error; // Re-lancer l'erreur pour permettre la gestion en aval si nécessaire
      });
    },
    [handleError]
  );

  return {
    error: errorState,
    hasError: !!errorState,
    handleError,
    clearError,
    createAsyncErrorHandler
  };
}

/**
 * Fonction utilitaire pour formater les erreurs API
 */
export function formatApiError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object') {
    // @ts-ignore
    if (error.response?.data?.error) {
      // @ts-ignore
      return error.response.data.error;
    }
    // @ts-ignore
    if (error.message) {
      // @ts-ignore
      return error.message;
    }
  }
  
  return 'Une erreur s\'est produite';
}

/**
 * Crée une fonction de traitement d'erreur pour les requêtes API (React Query)
 */
export function createQueryErrorHandler(options?: ErrorOptions) {
  return (error: unknown) => {
    const { showToast = true, logToConsole = true, severity = 'error' } = options || {};
    
    // Journalisation dans la console
    if (logToConsole) {
      console.error('[API Error]', error);
    }
    
    // Afficher un toast
    if (showToast) {
      const message = formatApiError(error);
      toast.error('Erreur lors de la requête', {
        description: message
      });
    }
    
    // Retourner l'erreur formatée
    return formatApiError(error);
  };
}
