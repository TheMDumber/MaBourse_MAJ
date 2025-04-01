import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ServerCrash, CheckCircle2 } from 'lucide-react';
import { checkServerAvailable, getServerUrl } from '@/lib/serverCheck';

interface ServerStatusAlertProps {
  onRetry?: () => void;
}

export function ServerStatusAlert({ onRetry }: ServerStatusAlertProps) {
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  // Vérifier la disponibilité du serveur
  const checkServer = async () => {
    setChecking(true);
    const available = await checkServerAvailable();
    setServerAvailable(available);
    setChecking(false);
    return available;
  };

  // Vérifier au chargement du composant
  useEffect(() => {
    checkServer();
    
    // Vérifier périodiquement (toutes les 30 secondes)
    const intervalId = setInterval(checkServer, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Si le statut n'est pas encore déterminé
  if (serverAvailable === null) {
    return (
      <Alert className="bg-blue-50 border-blue-200">
        <AlertTriangle className="h-4 w-4 text-blue-500" />
        <AlertTitle>Vérification du serveur</AlertTitle>
        <AlertDescription>
          Vérification de la connexion au serveur en cours...
        </AlertDescription>
      </Alert>
    );
  }

  // Si le serveur est disponible
  if (serverAvailable) {
    return (
      <Alert className="bg-green-50 border-green-200">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <AlertTitle>Serveur connecté</AlertTitle>
        <AlertDescription>
          La connexion au serveur est établie.
        </AlertDescription>
      </Alert>
    );
  }

  // Si le serveur n'est pas disponible
  return (
    <Alert className="bg-red-50 border-red-200">
      <ServerCrash className="h-4 w-4 text-red-500" />
      <AlertTitle>Erreur de connexion au serveur</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <p>
          Impossible de se connecter au serveur à l'adresse : 
          <span className="font-mono text-sm block mt-1 p-1 bg-gray-100 rounded">
            {getServerUrl()}
          </span>
        </p>
        <p>Vérifiez que :</p>
        <ul className="list-disc pl-5 text-sm">
          <li>Le fichier start_with_server.bat a bien été exécuté</li>
          <li>Le serveur est en cours d'exécution sur le port 3001</li>
          <li>Aucun pare-feu ne bloque la connexion</li>
        </ul>
        <div className="flex justify-end mt-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => {
              checkServer();
              if (onRetry) onRetry();
            }}
            disabled={checking}
          >
            {checking ? 'Vérification...' : 'Vérifier à nouveau'}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
