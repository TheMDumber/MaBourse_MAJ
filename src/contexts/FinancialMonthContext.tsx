import React, { createContext, useContext, useState, useEffect } from 'react';
import db from '@/lib/db';
import { 
  startOfMonth, 
  endOfMonth, 
  setDate, 
  addMonths, 
  subDays,
  format
} from 'date-fns';
import { fr } from 'date-fns/locale';

interface FinancialMonthContextType {
  isFinancialMonthEnabled: boolean;
  financialMonthStartDay: number;
  financialMonthAccountId?: number;
  currentMonth: string;
  minSelectableMonth: string | null;
  accountCreationMonth: string | null; // Pour compatibilité
  setCurrentMonth: (month: string) => void;
  toggleFinancialMonth: () => Promise<void>;
  setFinancialMonthStartDay: (day: number) => Promise<void>;
  setFinancialMonthAccount: (accountId?: number) => Promise<void>;
  getFinancialMonthRange: (date: Date) => { start: Date; end: Date; name: string };
  getFinancialMonthName: (date: Date) => string;
  isLoading: boolean;
}

const FinancialMonthContext = createContext<FinancialMonthContextType>({
  isFinancialMonthEnabled: false,
  financialMonthStartDay: 1,
  financialMonthAccountId: undefined,
  currentMonth: format(new Date(), 'yyyy-MM'),
  minSelectableMonth: null,
  accountCreationMonth: null, // Pour compatibilité
  setCurrentMonth: () => {},
  toggleFinancialMonth: async () => {},
  setFinancialMonthStartDay: async () => {},
  setFinancialMonthAccount: async () => {},
  getFinancialMonthRange: () => ({ start: new Date(), end: new Date(), name: '' }),
  getFinancialMonthName: () => '',
  isLoading: true
});

export const useFinancialMonth = () => useContext(FinancialMonthContext);

export const FinancialMonthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Fonction pour récupérer le mois initial depuis localStorage ou utiliser le mois actuel par défaut
  const getInitialMonth = (): string => {
    const savedMonth = localStorage.getItem('selectedMonth');
    return savedMonth || format(new Date(), 'yyyy-MM');
  };

  const [isFinancialMonthEnabled, setIsFinancialMonthEnabled] = useState<boolean>(false);
  const [financialMonthStartDay, setFinancialMonthStartDayState] = useState<number>(1);
  const [financialMonthAccountId, setFinancialMonthAccountIdState] = useState<number | undefined>(undefined);
  const [currentMonth, setCurrentMonthState] = useState<string>(getInitialMonth());
  // Forcer la date de mars 2025 comme minimum si non disponible
  const [minSelectableMonth, setMinSelectableMonth] = useState<string | null>(
    localStorage.getItem('minSelectableMonth') || localStorage.getItem('accountCreationMonth') || "2025-03"
  );
  const [accountCreationMonth, setAccountCreationMonth] = useState<string | null>(
    localStorage.getItem('minSelectableMonth') || localStorage.getItem('accountCreationMonth') || "2025-03"
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Wrapper autour de setCurrentMonth pour sauvegarder dans localStorage
  const setCurrentMonth = (month: string) => {
    localStorage.setItem('selectedMonth', month);
    setCurrentMonthState(month);
  };

  // Charger les préférences au démarrage
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await db.preferences.get();
        const isFinancialEnabled = prefs.useFinancialMonth ?? false;
        const startDay = prefs.financialMonthStartDay ?? 1;
        
        setIsFinancialMonthEnabled(isFinancialEnabled);
        setFinancialMonthStartDayState(startDay);
        setFinancialMonthAccountIdState(prefs.financialMonthAccountId);
        
        // Si le mode financier est activé, calculer le mois effectif pour l'initialisation
        if (isFinancialEnabled) {
          try {
            // Importer dynamiquement la fonction d'utilitaire
            const { getFinancialMonthRange, getEffectiveDisplayMonth } = await import('@/lib/financialMonthUtils');
            
            // Obtenir la date actuelle et calculer la période financière
            const today = new Date();
            const financialMonth = await getFinancialMonthRange(today);
            
            // Extraire le mois effectif de la date de fin
            const effectiveMonth = getEffectiveDisplayMonth(financialMonth.end);
            
            // Mettre à jour le mois courant
            console.log(`Initialisation avec le mois financier effectif: ${effectiveMonth}`);
            setCurrentMonth(effectiveMonth);
            
            // Sauvegarder dans localStorage pour persistance
            localStorage.setItem('selectedMonth', effectiveMonth);
          } catch (error) {
            console.error('Erreur lors du calcul du mois financier initial:', error);
          }
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Erreur lors du chargement des préférences de mois financier:', error);
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, []);

  // Méthode pour activer/désactiver le mois financier
  const toggleFinancialMonth = async () => {
    try {
      const newValue = !isFinancialMonthEnabled;
      await db.preferences.update({ useFinancialMonth: newValue });
      setIsFinancialMonthEnabled(newValue);
      
      // Notifier les autres composants du changement
      localStorage.setItem('financialMonthChanged', Date.now().toString());
    } catch (error) {
      console.error('Erreur lors de la mise à jour du paramètre de mois financier:', error);
    }
  };

  // Méthode pour changer le jour de début du mois financier
  const setFinancialMonthStartDay = async (day: number) => {
    try {
      // Vérifier que le jour est valide (entre 1 et 31)
      const validDay = Math.min(Math.max(1, day), 31);
      await db.preferences.update({ financialMonthStartDay: validDay });
      setFinancialMonthStartDayState(validDay);
      
      // Notifier les autres composants du changement
      localStorage.setItem('financialMonthStartDayChanged', Date.now().toString());
    } catch (error) {
      console.error('Erreur lors de la mise à jour du jour de début du mois financier:', error);
    }
  };

  // Méthode pour changer le compte associé au mois financier
  const setFinancialMonthAccount = async (accountId?: number) => {
    try {
      await db.preferences.update({ financialMonthAccountId: accountId });
      setFinancialMonthAccountIdState(accountId);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du compte associé au mois financier:', error);
    }
  };

  // Calculer le début et la fin d'un mois financier pour une date donnée
  const getFinancialMonthRange = (date: Date) => {
    if (!isFinancialMonthEnabled) {
      // Mode mois calendaire standard
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      const name = format(date, 'MMMM yyyy', { locale: fr });
      return { start, end, name };
    }

    // Mode mois financier personnalisé
    const currentMonth = date.getMonth();
    const currentYear = date.getFullYear();
    const currentDay = date.getDate();

    // Déterminer si la date est dans la première ou la deuxième partie du mois financier
    const isAfterStartDay = currentDay >= financialMonthStartDay;

    // Calculer la date de début du mois financier actuel
    let startDate: Date;
    if (isAfterStartDay) {
      // La date est dans la première partie du mois financier (qui porte le nom du mois suivant)
      startDate = new Date(currentYear, currentMonth, financialMonthStartDay);
    } else {
      // La date est dans la seconde partie du mois financier précédent
      startDate = new Date(currentYear, currentMonth - 1, financialMonthStartDay);
    }

    // Calculer la fin du mois financier (veille du prochain début de mois financier)
    const endDate = subDays(setDate(addMonths(startDate, 1), financialMonthStartDay), 1);

    // Déterminer le nom du mois financier (qui est toujours le mois suivant le début)
    const financialMonthName = format(addMonths(startDate, 1), 'MMMM yyyy', { locale: fr });

    return {
      start: startDate,
      end: endDate,
      name: financialMonthName
    };
  };

  // Obtenir juste le nom du mois financier pour une date donnée
  const getFinancialMonthName = (date: Date) => {
    const { name } = getFinancialMonthRange(date);
    return name;
  };

  // Effet pour mettre à jour minSelectableMonth lorsqu'il change dans localStorage
  useEffect(() => {
    // S'assurer que les valeurs sont définies dans localStorage
    if (!localStorage.getItem('minSelectableMonth') && !localStorage.getItem('accountCreationMonth')) {
      console.log("Définition du mois minimal sélectionnable par défaut à 2025-03");
      localStorage.setItem('minSelectableMonth', "2025-03");
      localStorage.setItem('accountCreationMonth', "2025-03");
    }
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'minSelectableMonth' && e.newValue) {
        setMinSelectableMonth(e.newValue);
        setAccountCreationMonth(e.newValue); // Pour compatibilité
      } else if (e.key === 'accountCreationMonth' && e.newValue) {
        // Fallback pour compatibilité
        setMinSelectableMonth(e.newValue);
        setAccountCreationMonth(e.newValue);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Vérifier si minSelectableMonth existe déjà dans localStorage
    const storedMinSelectableMonth = localStorage.getItem('minSelectableMonth') || localStorage.getItem('accountCreationMonth') || "2025-03";
    if (storedMinSelectableMonth && storedMinSelectableMonth !== minSelectableMonth) {
      setMinSelectableMonth(storedMinSelectableMonth);
      setAccountCreationMonth(storedMinSelectableMonth); // Pour compatibilité
    }
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [minSelectableMonth, accountCreationMonth]);
  
  const value = {
    isFinancialMonthEnabled,
    financialMonthStartDay,
    financialMonthAccountId,
    currentMonth,
    minSelectableMonth,
    accountCreationMonth, // Pour compatibilité
    setCurrentMonth,
    toggleFinancialMonth,
    setFinancialMonthStartDay,
    setFinancialMonthAccount,
    getFinancialMonthRange,
    getFinancialMonthName,
    isLoading
  };

  return (
    <FinancialMonthContext.Provider value={value}>
      {children}
    </FinancialMonthContext.Provider>
  );
};
