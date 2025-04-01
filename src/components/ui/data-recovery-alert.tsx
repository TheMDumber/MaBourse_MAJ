import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface DataRecoveryAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DataRecoveryAlert({ open, onOpenChange }: DataRecoveryAlertProps) {
  const { syncData } = useAuth();
  const [isRecovering, setIsRecovering] = useState(false);
  
  const handleRecoverData = async () => {
    try {
      setIsRecovering(true);
      // Forcer la récupération des données depuis le serveur
      await syncData(true);
      // La page sera automatiquement rechargée par la fonction syncData(true)
    } catch (error) {
      console.error('Erreur lors de la récupération des données:', error);
      onOpenChange(false);
    }
  };
  
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Données locales perdues</AlertDialogTitle>
          <AlertDialogDescription>
            Vos données locales semblent avoir été effacées ou ne sont pas disponibles.
            Cela peut se produire après avoir vidé l'historique de votre navigateur ou
            lors de l'utilisation d'un nouvel appareil.
            <br /><br />
            Voulez-vous récupérer vos données depuis le serveur ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continuer sans récupérer</AlertDialogCancel>
          <AlertDialogAction onClick={handleRecoverData} disabled={isRecovering}>
            {isRecovering ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Récupération en cours...
              </>
            ) : (
              "Récupérer mes données"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
