import React, { useState } from 'react';
import { useErrorHandler } from './useErrorHandler';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

/**
 * Composant d'exemple pour démontrer l'utilisation du hook useErrorHandler
 * N'est pas destiné à être utilisé en production, seulement à des fins de démonstration
 */
export function ErrorHandlingExample() {
  const { error, hasError, handleError, clearError, createAsyncErrorHandler } = useErrorHandler();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Exemple de fonction simulant une requête API qui échoue
  const simulateApiError = async () => {
    setIsLoading(true);
    try {
      // Simuler un délai de chargement
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simuler une erreur de réseau
      throw new Error('Échec de la connexion au serveur. Veuillez vérifier votre connexion internet.');
    } catch (error) {
      // Utiliser notre gestionnaire d'erreur
      handleError(error, {
        severity: 'error',
        context: { component: 'ErrorHandlingExample', action: 'simulateApiError' }
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Exemple d'utilisation avec createAsyncErrorHandler
  const simulateAsyncError = () => {
    setIsLoading(true);
    
    // Utiliser createAsyncErrorHandler pour gérer automatiquement les erreurs
    createAsyncErrorHandler(
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Erreur lors du traitement de la requête'));
        }, 1000);
      }),
      { severity: 'critical', context: { component: 'ErrorHandlingExample', action: 'simulateAsyncError' } }
    ).catch(() => {
      // L'erreur est déjà gérée par createAsyncErrorHandler
      // Mais nous devons attraper la promesse rejetée pour éviter une erreur non gérée
    }).finally(() => {
      setIsLoading(false);
    });
  };

  // Exemple d'erreur avec différents niveaux de gravité
  const simulateWarning = () => {
    handleError('Cette opération pourrait être lente sur certains appareils.', {
      severity: 'warning',
      showToast: true
    });
  };

  const simulateInfo = () => {
    handleError('Les données ont été mises à jour il y a plus d'une semaine.', {
      severity: 'info',
      showToast: true
    });
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h2 className="text-xl font-bold">Démonstration de gestion d'erreurs</h2>
      
      {/* Afficher l'erreur actuelle s'il y en a une */}
      {hasError && (
        <Alert variant={error?.severity === 'critical' ? 'destructive' : 'default'} className="mb-4">
          {error?.severity === 'warning' && <AlertTriangle className="h-4 w-4" />}
          {error?.severity === 'error' || error?.severity === 'critical' ? 
            <AlertCircle className="h-4 w-4" /> : 
            <Info className="h-4 w-4" />
          }
          <AlertTitle>
            {error?.severity === 'warning' && 'Avertissement'}
            {error?.severity === 'error' && 'Erreur'}
            {error?.severity === 'critical' && 'Erreur critique'}
            {error?.severity === 'info' && 'Information'}
          </AlertTitle>
          <AlertDescription>
            {error?.message}
            {error?.details && (
              <details className="mt-2 text-sm">
                <summary>Détails techniques</summary>
                <pre className="mt-2 whitespace-pre-wrap text-xs">{error.details}</pre>
              </details>
            )}
          </AlertDescription>
        </Alert>
      )}
      
      {/* Boutons pour déclencher différentes erreurs */}
      <div className="flex flex-wrap gap-2">
        <Button 
          onClick={simulateApiError}
          disabled={isLoading}
          variant="secondary"
        >
          Simuler une erreur API
        </Button>
        
        <Button 
          onClick={simulateAsyncError}
          disabled={isLoading}
          variant="destructive"
        >
          Simuler une erreur critique
        </Button>
        
        <Button 
          onClick={simulateWarning}
          variant="outline"
        >
          Simuler un avertissement
        </Button>
        
        <Button 
          onClick={simulateInfo}
          variant="ghost"
        >
          Simuler une info
        </Button>
        
        {hasError && (
          <Button onClick={clearError}>
            Effacer l'erreur
          </Button>
        )}
      </div>
      
      <div className="text-sm mt-4">
        <p>
          <strong>Note:</strong> Ce composant montre comment utiliser le hook <code>useErrorHandler</code> pour gérer 
          différents types d'erreurs de manière centralisée. Dans une application réelle, vous devriez inclure ce hook 
          dans vos composants ou dans un contexte global.
        </p>
      </div>
    </div>
  );
}
