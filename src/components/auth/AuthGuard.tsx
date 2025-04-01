import React, { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { detectAuthInconsistencies, repairAuthSession } from '@/lib/authDebug';
import { toast } from 'sonner';

interface AuthGuardProps {
  children: ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isRepairingAuth, setIsRepairingAuth] = useState(false);
  
  useEffect(() => {
    // Vérifier les inconsistences dans l'authentification
    if (!isLoading && !isAuthenticated) {
      const issues = detectAuthInconsistencies();
      if (issues.length > 0) {
        // Tenter une réparation silencieuse
        console.warn('Problèmes d\'authentification détectés, tentative de réparation silencieuse...');
        setIsRepairingAuth(true);
        
        // Essayer de réparer la session
        const wasRepaired = repairAuthSession();
        
        if (wasRepaired) {
          // Si réparé, vérifier si maintenant authentifié
          if (localStorage.getItem('userSession')) {
            console.log('Session réparée avec succès, rafraîchissement de la page');
            toast.success('Problème corrigé', {
              description: 'Votre session a été restaurée automatiquement',
              duration: 3000
            });
            
            // Forcer un rechargement après un court délai
            setTimeout(() => {
              window.location.reload();
            }, 1000);
            return;
          }
        }
        
        // Si la réparation a échoué ou s'il n'y a pas de session, continuer avec la redirection normale
        setIsRepairingAuth(false);
      }
    }
  }, [isLoading, isAuthenticated]);

  console.log('AuthGuard - isAuthenticated:', isAuthenticated, 'isLoading:', isLoading, 'isRepairingAuth:', isRepairingAuth);

  // Pendant le chargement ou la réparation, afficher un indicateur de chargement
  if (isLoading || isRepairingAuth) {
    console.log('AuthGuard - Affichage du chargement');
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium">
            {isRepairingAuth ? 'Réparation de la session...' : 'Chargement...'}
          </p>
        </div>
      </div>
    );
  }

  // Si l'utilisateur n'est pas authentifié, rediriger vers la page de connexion
  if (!isAuthenticated) {
    console.log('AuthGuard - Redirection vers /auth, location:', location);
    
    // Nettoyer tous les marqueurs de redirection avant la redirection
    localStorage.removeItem('isRedirecting');
    localStorage.removeItem('isCheckingRedirect');
    localStorage.removeItem('redirectAttemptCount');
    localStorage.removeItem('lastRedirectTime');
    localStorage.removeItem('lastAuthCheck');
    
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  
  console.log('AuthGuard - Affichage du contenu protégé');

  // Si l'utilisateur est authentifié, afficher le contenu protégé
  return <>{children}</>;
};
