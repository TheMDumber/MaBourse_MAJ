import { Menu, Moon, Sun, Zap, LogOut, RefreshCw, User, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, isWithinInterval, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Theme, TransactionType } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import db from '@/lib/db';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem, 
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from '@/components/ui/use-toast';

interface TopBarProps {
  theme: Theme;
  changeTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  accountFilter?: number | "all";
  selectedMonth?: string; // Format YYYY-MM
}

export const TopBar = ({ theme, changeTheme, toggleSidebar, accountFilter = "all", selectedMonth }: TopBarProps) => {
  const { username, logout, syncData, lastSyncTime, isSyncing } = useAuth();
  const [isMobileView, setIsMobileView] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [projectedBalance, setProjectedBalance] = useState(0);
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);
  const [adjustmentValue, setAdjustmentValue] = useState("");
  const [adjustmentNote, setAdjustmentNote] = useState("");
  // État local pour suivre si un ajustement est réellement appliqué
  const [isAdjustmentApplied, setIsAdjustmentApplied] = useState(false);
  const queryClient = useQueryClient();
  
  // Utiliser les mois financiers si activés
  const { data: financialMonthsEnabled } = useQuery({
    queryKey: ['isFinancialMonthEnabled'],
    queryFn: async () => {
      // Importer dynamiquement pour éviter les références circulaires
      const { isFinancialMonthEnabled } = await import('@/lib/financialMonthUtils');
      return isFinancialMonthEnabled();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  // Récupérer les dates du mois financier si activé
  const { data: financialDates, refetch: refetchFinancialDates } = useQuery({
    queryKey: ['financialDates', selectedMonth, financialMonthsEnabled],
    queryFn: async () => {
      if (!financialMonthsEnabled) return null;
      
      const yearMonth = selectedMonth || format(new Date(), "yyyy-MM");
      const [year, month] = yearMonth.split('-').map(Number);
      const date = new Date(year, month - 1, 15); // Date médiane du mois
      
      const { getFinancialMonthRange } = await import('@/lib/financialMonthUtils');
      return getFinancialMonthRange(date);
    },
    enabled: !!financialMonthsEnabled,
    staleTime: 0, // Ne pas mettre en cache ce calcul
  });

  // Formater les dates du mois pour l'affichage
  const formattedMonthRange = useMemo(() => {
    if (financialMonthsEnabled && financialDates) {
      // Mois financier
      const startDay = format(financialDates.start, 'dd', { locale: fr });
      const startMonth = format(financialDates.start, 'MMMM', { locale: fr });
      const endDay = format(financialDates.end, 'dd', { locale: fr });
      const endMonth = format(financialDates.end, 'MMMM', { locale: fr });
      
      // Vérifier si on est dans le même mois (éviter les affichages du type "28 février au 27 mars")
      const currentDate = new Date();
      if (currentDate > financialDates.end) {
        // Si la date actuelle est après la fin de la période, on montre le mois suivant
        const nextMonthStart = addMonths(financialDates.start, 1);
        const nextMonthEnd = addMonths(financialDates.end, 1);
        return `${format(nextMonthStart, 'dd MMMM', { locale: fr })} au ${format(nextMonthEnd, 'dd MMMM', { locale: fr })}`;
      }
      
      return `${startDay} ${startMonth} au ${endDay} ${endMonth}`;
    } else {
      // Mois calendaire standard
      const yearMonth = selectedMonth || format(new Date(), "yyyy-MM");
      const [year, month] = yearMonth.split('-').map(Number);
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      
      const monthName = format(firstDay, 'MMMM', { locale: fr });
      const lastDayOfMonth = format(lastDay, 'dd', { locale: fr });
      
      return `du 01 au ${lastDayOfMonth} ${monthName}`;
    }
  }, [selectedMonth, financialMonthsEnabled, financialDates]);
  
  // Fonction pour supprimer tous les caches de l'ajustement
  const invalidateBalanceCache = () => {
    queryClient.invalidateQueries({ queryKey: ["balanceAdjustments"] });
    queryClient.invalidateQueries({ queryKey: ["forecastBalance"] });
    queryClient.invalidateQueries({ queryKey: ["monthlyBalances"] });
    queryClient.invalidateQueries({ queryKey: ["historicalBalances"] });
    // Force refresh immédiat
    queryClient.refetchQueries({ queryKey: ["balanceAdjustments", accountFilter, selectedMonth] });
    queryClient.refetchQueries({ queryKey: ["forecastBalance", accountFilter, selectedMonth] });
  };
  
  // Récupérer tous les comptes
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      return db.accounts.getAll();
    },
    // Ajouter un sélecteur qui garantit qu'aucun doublon ne soit présent dans les résultats
    select: (data) => {
      // Utiliser un Map pour éliminer les doublons potentiels par ID
      const uniqueAccounts = Array.from(
        new Map(data.map(account => [account.id, account])).values()
      );
      
      // Log pour surveiller si des doublons sont encore détectés malgré notre filtrage dans accountsAPI
      if (data.length !== uniqueAccounts.length) {
        console.warn(`Doublons détectés après useQuery: ${data.length} -> ${uniqueAccounts.length}`);
      }
      
      return uniqueAccounts;
    },
  });

  // Récupérer toutes les transactions
  const { data: allTransactions = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      return db.transactions.getAll();
    },
  });

  // Récupérer les transactions récurrentes
  const { data: recurringTransactions = [] } = useQuery({
    queryKey: ["recurringTransactions"],
    queryFn: async () => {
      return db.recurringTransactions.getAll();
    },
  });
  
  // Récupérer l'ajustement de solde s'il existe
  const { data: balanceAdjustment, isLoading: isAdjustmentLoading } = useQuery({
    queryKey: ["balanceAdjustments", accountFilter, selectedMonth],
    queryFn: async () => {
      if (accountFilter === "all") return null;
      const yearMonth = selectedMonth || format(new Date(), "yyyy-MM");
      try {
        // S'assurer que la fonction renvoie toujours une valeur définie (null si aucun ajustement)
        const adjustment = await db.balanceAdjustments.getByAccountAndMonth(accountFilter as number, yearMonth);
        return adjustment || null; // Retourner null au lieu de undefined
      } catch (error) {
        console.error(`Erreur lors de la récupération de l'ajustement pour ${yearMonth}:`, error);
        return null; // Toujours retourner null en cas d'erreur
      }
    },
    enabled: accountFilter !== "all",
  });
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 640);
    };
    
    handleResize(); // Check initial size
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Écouter les changements de configuration du mois financier
  useEffect(() => {
    const handleFinancialMonthChange = (e: StorageEvent) => {
      if (e.key === 'financialMonthChanged' || e.key === 'financialMonthStartDayChanged') {
        console.log('Changement détecté dans les paramètres du mois financier, mise à jour...');
        
        // Invalider et rafraîchir les requêtes
        queryClient.invalidateQueries({ queryKey: ['isFinancialMonthEnabled'] });
        queryClient.invalidateQueries({ queryKey: ['financialDates'] });
        refetchFinancialDates();
      }
    };
    
    window.addEventListener('storage', handleFinancialMonthChange);
    return () => window.removeEventListener('storage', handleFinancialMonthChange);
  }, [queryClient, refetchFinancialDates]);
  
  // Initialiser la valeur de l'ajustement avec le solde actuel ou l'ajustement existant
  useEffect(() => {
    if (balanceAdjustment) {
      setAdjustmentValue(balanceAdjustment.adjustedBalance.toFixed(2));
      setAdjustmentNote(balanceAdjustment.note || "");
    } else {
      setAdjustmentValue(projectedBalance.toFixed(2));
      setAdjustmentNote("");
    }
  }, [balanceAdjustment, projectedBalance, isAdjustmentDialogOpen]);
  
  // Calculer le solde prévisionnel du compte ou de tous les comptes pour le mois sélectionné
  const { data: forecastData } = useQuery({
    queryKey: ['forecastBalance', accountFilter, selectedMonth, financialMonthsEnabled, financialDates],
    queryFn: async () => {
      const yearMonth = selectedMonth || format(new Date(), "yyyy-MM");
      
      // Obtenir les dates du mois financier si nécessaire
      let effectiveMonthData = {
        yearMonth: yearMonth,
        start: null as Date | null,
        end: null as Date | null
      };
      
      if (financialMonthsEnabled && financialDates) {
        effectiveMonthData = {
          // Garder le yearMonth d'origine et passer uniquement les dates du mois financier
          yearMonth: yearMonth,
          start: financialDates.start,
          end: financialDates.end
        };
      }
      
      // Utiliser la nouvelle fonction utilitaire de calcul du solde
      const { getForecastBalance } = await import('@/lib/calculateBalance');
      return getForecastBalance(
        accountFilter, 
        effectiveMonthData.yearMonth,
        financialMonthsEnabled ? {
          start: effectiveMonthData.start,
          end: effectiveMonthData.end
        } : undefined
      );
    },
    enabled: !!accounts?.length && (financialMonthsEnabled ? !!financialDates : true),
  });
  
  // Mettre à jour les soldes quand les données de prévision changent
  useEffect(() => {
    if (forecastData) {
      setProjectedBalance(forecastData.balance);
    }
  }, [forecastData]);

  const handleSync = async () => {
    try {
      const success = await syncData();
      if (success) {
        // Mise à jour du statut de synchronisation dans localStorage
        localStorage.setItem('lastSyncTime', Date.now().toString());
        
        toast({
          title: "Synchronisation réussie",
          description: "Vos données ont été synchronisées avec succès",
          variant: "default",
        });
        
        // Rafraîchir la page après la synchronisation
        setTimeout(() => {
          window.location.reload();
        }, 1000); // Délai d'une seconde pour laisser le toast s'afficher
      } else {
        toast({
          title: "Erreur de synchronisation",
          description: "Une erreur est survenue lors de la synchronisation",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erreur lors de la synchronisation:', error);
      toast({
        title: "Erreur de synchronisation",
        description: "Une erreur inattendue est survenue",
        variant: "destructive",
      });
    } finally {
      // S'assurer que le badge de synchronisation est désactivé
      localStorage.removeItem('isSyncing');
      localStorage.removeItem('syncEventTriggered');
    }
  };
  
  // Fonction pour ouvrir la boîte de dialogue d'ajustement
  const handleOpenAdjustmentDialog = () => {
    setIsAdjustmentDialogOpen(true);
  };
  
  // Fonction pour sauvegarder l'ajustement
  const handleSaveAdjustment = async () => {
    if (accountFilter === "all") {
      toast({
        title: "Erreur",
        description: "Impossible d'ajuster le solde pour tous les comptes",
        variant: "destructive",
      });
      return;
    }
    
    const numericValue = parseFloat(adjustmentValue);
    if (isNaN(numericValue)) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un montant valide",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const yearMonth = selectedMonth || format(new Date(), "yyyy-MM");
      await db.balanceAdjustments.setAdjustment({
        accountId: accountFilter as number,
        yearMonth,
        adjustedBalance: numericValue,
        note: adjustmentNote,
      });
      
      // Invalider les requêtes pour forcer un rafraîchissement
      invalidateBalanceCache();
      
      toast({
        title: "Solde ajusté",
        description: `Le solde a été ajusté à ${new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: "EUR",
        }).format(numericValue)}`,
      });
      
      setIsAdjustmentDialogOpen(false);
    } catch (error) {
      console.error('Erreur lors de l\'ajustement du solde:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'ajustement du solde",
        variant: "destructive",
      });
    }
  };
  
  // Fonction pour réinitialiser l'ajustement
  const handleResetAdjustment = async () => {
    if (accountFilter === "all") return;
    
    try {
      const yearMonth = selectedMonth || format(new Date(), "yyyy-MM");
      await db.balanceAdjustments.deleteAdjustment(accountFilter as number, yearMonth);
      
      // Force la mise à jour immédiate de l'UI
      invalidateBalanceCache();
      
      // Réinitialiser la valeur de l'ajustement
      setAdjustmentValue(projectedBalance.toFixed(2));
      setAdjustmentNote("");
      
      // Marquer immédiatement l'ajustement comme non appliqué
      setIsAdjustmentApplied(false);
      
      toast({
        title: "Ajustement supprimé",
        description: "Le solde a été réinitialisé à sa valeur calculée",
      });
      
      setIsAdjustmentDialogOpen(false);
    } catch (error) {
      console.error('Erreur lors de la réinitialisation du solde:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la réinitialisation du solde",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <header className="bg-background border-b border-border p-2 md:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {/* Icône hamburger supprimée */}
            {accountFilter === "all" && accounts.length === 0 ? (
              <h1 className="text-xl font-semibold">💰</h1>
            ) : (
              <div className="flex flex-col">
                <div className="text-xs sm:text-sm text-muted-foreground">
                  {accountFilter === "all" ? "Tous les comptes" : (accounts.find(a => a.id === accountFilter)?.name || "Compte")} 
                  - <span className="font-medium text-primary">{formattedMonthRange}</span>
                </div>
                <div className="flex items-center">
                  <div className="text-lg sm:text-2xl font-bold" style={{ color: projectedBalance >= 0 ? 'var(--budget-positive)' : 'var(--budget-negative)' }}>
                    {new Intl.NumberFormat("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                    }).format(projectedBalance)}
                  </div>
                  
                  {/* Badge "ajusté" qui n'apparait que si un ajustement valide existe */}
                  {forecastData && forecastData.isAdjusted && (
                    <span className="ml-1 px-1 py-0.5 text-xs bg-primary/10 text-primary rounded">
                      ajusté
                    </span>
                  )}
                  
                  {accountFilter !== "all" && (
                    <button
                      className="ml-2 h-8 w-8 flex items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20"
                      onClick={handleOpenAdjustmentDialog}
                      title="Ajuster le solde prévisionnel"
                    >
                      <Edit2 className="h-4 w-4 text-primary" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Badge de synchronisation */}
            {isSyncing && (
              <Badge variant="outline" className="animate-pulse bg-primary/20 text-primary">
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Synchronisation
              </Badge>
            )}
            {/* Thèmes */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="mr-2 text-xs md:text-sm">
                  {theme === Theme.LIGHT && <Sun className="h-4 w-4 mr-2" />}
                  {theme === Theme.DARK && <Moon className="h-4 w-4 mr-2" />}
                  {theme === Theme.CYBER && <Zap className="h-4 w-4 mr-2" />}
                  {theme === Theme.SOFTBANK && <span className="mr-2">🏦</span>}
                  {isMobileView ? '' : 'Thème'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Choisir un thème</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => changeTheme(Theme.LIGHT)}>
                  <Sun className="h-4 w-4 mr-2" />
                  Clair
                  {theme === Theme.LIGHT && <span className="ml-2 text-primary">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeTheme(Theme.DARK)}>
                  <Moon className="h-4 w-4 mr-2" />
                  Sombre
                  {theme === Theme.DARK && <span className="ml-2 text-primary">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeTheme(Theme.CYBER)}>
                  <Zap className="h-4 w-4 mr-2" />
                  Cyber
                  {theme === Theme.CYBER && <span className="ml-2 text-primary">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeTheme(Theme.SOFTBANK)}>
                  <span className="mr-2">🏦</span>
                  Soft Bank
                  {theme === Theme.SOFTBANK && <span className="ml-2 text-primary">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeTheme(Theme.RED_BANK)}>
                  <span className="mr-2" style={{color: 'hsl(0, 85%, 55%)'}}>🏦</span>
                  Rouge Banque
                  {theme === Theme.RED_BANK && <span className="ml-2 text-primary">✓</span>}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Menu utilisateur */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="ml-2 text-xs md:text-sm">
                  <User className="h-4 w-4 mr-2" />
                  {isMobileView ? '' : (username || 'Utilisateur')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  Connecté en tant que <span className="font-semibold ml-1">{username}</span>
                </DropdownMenuItem>
                {lastSyncTime && (
                  <DropdownMenuItem disabled>
                    Dernière synchronisation: {format(new Date(lastSyncTime), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      
      {/* Dialog d'ajustement du solde - optimisé pour mobile */}
      <Dialog open={isAdjustmentDialogOpen} onOpenChange={setIsAdjustmentDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg sm:text-xl">Ajuster le solde prévisionnel</DialogTitle>
            <DialogDescription className="text-sm">
              Ajustez le solde prévisionnel de "{accountFilter === "all" ? "Tous les comptes" : (accounts.find(a => a.id === accountFilter)?.name || "Compte")}" 
              pour {selectedMonth ? format(new Date(`${selectedMonth}-01`), "MMMM yyyy", { locale: fr }) : format(new Date(), "MMMM yyyy", { locale: fr })}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 my-2">
            <div className="space-y-2">
              <Label htmlFor="balance" className="text-sm font-medium">
                Solde ajusté:
              </Label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                value={adjustmentValue}
                onChange={(e) => setAdjustmentValue(e.target.value)}
                placeholder="0.00"
                className="text-base"
              />
              <p className="text-xs text-muted-foreground">
                Solde calculé: {new Intl.NumberFormat("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                }).format(projectedBalance)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note" className="text-sm font-medium">
                Note (optionnelle):
              </Label>
              <Textarea
                id="note"
                value={adjustmentNote}
                onChange={(e) => setAdjustmentNote(e.target.value)}
                placeholder="Raison de l'ajustement..."
                className="min-h-24"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4 pt-2 border-t">
            <div className="flex w-full sm:w-auto space-x-2 order-2 sm:order-1">
              <Button 
                variant="outline" 
                onClick={() => setIsAdjustmentDialogOpen(false)}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button 
                variant="destructive"
                onClick={handleResetAdjustment}
                className="flex-1"
              >
                Supprimer
              </Button>
            </div>
            <Button 
              onClick={handleSaveAdjustment} 
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
