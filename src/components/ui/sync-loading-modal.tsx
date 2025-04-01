import React, { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface SyncLoadingModalProps {
  open: boolean;
  syncProgress?: number;
}

export function SyncLoadingModal({ open, syncProgress = 0 }: SyncLoadingModalProps) {
  const [timeoutReached, setTimeoutReached] = useState(false);
  const [showRetryButton, setShowRetryButton] = useState(false);
  
  // Ajouter un délai de sécurité pour empêcher le blocage indéfini
  useEffect(() => {
    if (open) {
      // Si la synchronisation dure plus de 15 secondes, afficher un message
      const timeoutId = setTimeout(() => {
        setTimeoutReached(true);
      }, 15000); // 15 secondes
      
      // Si la synchronisation dure plus de 30 secondes, afficher le bouton de reprise
      const retryTimeoutId = setTimeout(() => {
        setShowRetryButton(true);
      }, 30000); // 30 secondes
      
      return () => {
        clearTimeout(timeoutId);
        clearTimeout(retryTimeoutId);
      };
    } else {
      // Réinitialiser les états lorsque le modal est fermé
      setTimeoutReached(false);
      setShowRetryButton(false);
    }
  }, [open]);
  
  // Forcer la fermeture après un délai long si toujours bloqué
  useEffect(() => {
    if (open && timeoutReached) {
      const forceCloseId = setTimeout(() => {
        // Nettoyer toutes les variables de synchronisation
        localStorage.removeItem('isSyncing');
        localStorage.removeItem('syncEventTriggered');
        localStorage.removeItem('layoutRefreshing');
        localStorage.removeItem('statsRefreshing'); 
        localStorage.removeItem('isInitialSync');
        localStorage.setItem('forceSkipSync', 'true');
        
        // Forcer le rechargement de la page
        window.location.reload();
      }, 60000); // 1 minute au total avant de forcer le rechargement
      
      return () => clearTimeout(forceCloseId);
    }
  }, [open, timeoutReached]);
  
  // Gérer le clic sur le bouton de reprise
  const handleRetryClick = () => {
    // Nettoyer toutes les variables de synchronisation
    localStorage.removeItem('isSyncing');
    localStorage.removeItem('syncEventTriggered');
    localStorage.removeItem('layoutRefreshing');
    localStorage.removeItem('statsRefreshing');
    localStorage.removeItem('isInitialSync');
    localStorage.setItem('forceSkipSync', 'true');
    
    // Forcer le rechargement de la page
    window.location.reload();
  };
  
  return (
    <AlertDialog open={open} onOpenChange={() => {}}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-center">{timeoutReached ? "Synchronisation plus longue que prévue" : "Synchronisation en cours"}</AlertDialogTitle>
          <div className="flex justify-center my-6">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
          <AlertDialogDescription className="text-center text-base">
            {timeoutReached ? 
              "La synchronisation prend plus de temps que prévu..." : 
              "Récupération et synchronisation de vos données..."}
            <br />
            {timeoutReached ? "Veuillez patienter un peu plus longtemps." : "Veuillez patienter."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <Progress value={syncProgress} className="mt-4" />
        
        {showRetryButton ? (
          <Button 
            onClick={handleRetryClick}
            className="mt-4 w-full"
            variant="destructive"
          >
            Arrêter la synchronisation et recharger
          </Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground mt-4">
            {timeoutReached ? 
              "Si cela persiste, vous pourrez bientôt forcer le rechargement de l'application" : 
              "La page s'affichera automatiquement une fois la synchronisation terminée"}
          </p>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
