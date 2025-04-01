import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { 
  runAuthDiagnostic, 
  repairAuthSession, 
  resetAuthSession,
  detectAuthInconsistencies
} from '@/lib/authDebug';
import { fileStorage } from '@/lib/fileStorageAdapter';
import { toast } from 'sonner';

interface AuthFixDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AuthFixDialog({ open, onOpenChange, onSuccess }: AuthFixDialogProps) {
  const [isRepairing, setIsRepairing] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [diagnostic, setDiagnostic] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      // Exécuter le diagnostic
      const diagResults = runAuthDiagnostic();
      setDiagnostic(diagResults);
      
      // Détecter les problèmes
      const detectedIssues = detectAuthInconsistencies();
      setIssues(detectedIssues);
    }
  }, [open]);

  // Tenter la réparation automatique
  const handleRepair = async () => {
    setIsRepairing(true);
    
    try {
      const repaired = repairAuthSession();
      
      if (repaired) {
        toast.success("Réparation réussie", {
          description: "Les problèmes d'authentification ont été corrigés"
        });
        
        // Rafraîchir le diagnostic
        const newDiagnostic = runAuthDiagnostic();
        setDiagnostic(newDiagnostic);
        
        // Vérifier s'il reste des problèmes
        const remainingIssues = detectAuthInconsistencies();
        setIssues(remainingIssues);
        
        if (remainingIssues.length === 0) {
          // Si l'utilisateur est connecté après la réparation, continuer
          if (fileStorage.isLoggedIn()) {
            setTimeout(() => {
              onOpenChange(false);
              onSuccess();
            }, 1000);
          }
        }
      } else {
        toast.error("Aucun problème n'a pu être réparé automatiquement");
      }
    } catch (error) {
      console.error('Erreur lors de la réparation:', error);
      toast.error("Erreur lors de la réparation");
    } finally {
      setIsRepairing(false);
    }
  };

  // Réinitialisation complète
  const handleReset = () => {
    setIsRepairing(true);
    
    try {
      resetAuthSession();
      toast.success("Session réinitialisée", {
        description: "Vous devez vous reconnecter"
      });
      
      setTimeout(() => {
        onOpenChange(false);
        navigate('/auth', { replace: true });
      }, 1000);
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
      toast.error("Erreur lors de la réinitialisation");
      setIsRepairing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
            Problème d'authentification détecté
          </DialogTitle>
          <DialogDescription>
            Des incohérences ont été détectées dans votre session. Tentez une réparation automatique ou réinitialisez complètement votre session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2 max-h-[200px] overflow-auto">
          {issues.length > 0 ? (
            <div className="space-y-2">
              <p className="font-medium">Problèmes détectés:</p>
              <ul className="list-disc pl-5 space-y-1">
                {issues.map((issue, index) => (
                  <li key={index} className="text-sm text-muted-foreground">{issue}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex items-center text-green-500">
              <CheckCircle className="h-5 w-5 mr-2" />
              <span>Aucun problème détecté dans la session</span>
            </div>
          )}

          {diagnostic && (
            <div className="text-xs text-muted-foreground mt-4">
              <p className="font-medium mb-1">Informations de diagnostic:</p>
              <p>Session existe: {diagnostic.sessionExists ? 'Oui' : 'Non'}</p>
              <p>État de connexion: {diagnostic.isLoggedIn ? 'Connecté' : 'Déconnecté'}</p>
              <p>Utilisateur: {diagnostic.username || 'Aucun'}</p>
              <p>Réseau distant: {diagnostic.networkInfo.isRemoteNetwork ? 'Oui' : 'Non'}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRepairing}
            className="sm:flex-1"
          >
            Annuler
          </Button>
          <Button
            onClick={handleRepair}
            disabled={isRepairing}
            className="sm:flex-1"
          >
            {isRepairing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Réparation...
              </>
            ) : (
              'Réparer automatiquement'
            )}
          </Button>
          <Button
            variant="destructive"
            onClick={handleReset}
            disabled={isRepairing}
            className="sm:flex-1"
          >
            Réinitialiser la session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
