import { useEffect, useState } from 'react';
import { Theme, Currency } from '@/lib/types';
import { preferencesAPI } from '@/lib/db';
import { initDB } from '@/lib/db';

// Clé de stockage local pour le thème
const THEME_STORAGE_KEY = 'app-theme';

export function useTheme() {
  // Utiliser le localStorage comme source initiale pour un chargement rapide
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const initialTheme = storedTheme 
    ? (storedTheme as Theme) 
    : Theme.LIGHT;
  
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [isLoading, setIsLoading] = useState(true);

  // Chargement initial du thème depuis les préférences
  useEffect(() => {
    const loadTheme = async () => {
      try {
        // Appliquer immédiatement le thème stocké localement
        applyThemeToDOM(theme);
        
        // Ensuite tenter de charger depuis la base de données
        const prefs = await preferencesAPI.get();
        
        // Vérification que prefs existe et a une propriété theme
        if (prefs && typeof prefs.theme !== 'undefined') {
          if (prefs.theme !== theme) {
            setTheme(prefs.theme);
            localStorage.setItem(THEME_STORAGE_KEY, prefs.theme);
          }
        } else {
          console.warn('Les préférences existent mais ne contiennent pas de thème');
          
          // Créer des préférences par défaut si elles n'existent pas
          try {
            await createDefaultPreferences(theme);
          } catch (createError) {
            console.error('Erreur lors de la création des préférences par défaut:', createError);
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement du thème:', error);
        
        // Si erreur chargement mais aucun thème encore défini, tenter de créer des préférences
        if (!storedTheme) {
          try {
            await createDefaultPreferences(Theme.LIGHT);
          } catch (createError) {
            console.error('Erreur lors de la création des préférences par défaut:', createError);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
    
    // Ajouter un écouteur pour les changements de route
    const handleRouteChange = () => {
      // Réappliquer le thème lors des changements de page
      applyThemeToDOM(theme);
    };
    
    window.addEventListener('popstate', handleRouteChange);
    
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  // Appliquer le thème au DOM
  const applyThemeToDOM = (themeToApply: Theme) => {
    document.documentElement.classList.remove('light', 'dark', 'cyber', 'softbank', 'redbank');
    
    if (themeToApply === Theme.DARK) {
      document.documentElement.classList.add('dark');
    } else if (themeToApply === Theme.CYBER) {
      document.documentElement.classList.add('cyber');
    } else if (themeToApply === Theme.SOFTBANK) {
      document.documentElement.classList.add('softbank');
    } else if (themeToApply === Theme.RED_BANK) {
      document.documentElement.classList.add('redbank');
    }
  };
  
  // Créer des préférences utilisateur par défaut
  const createDefaultPreferences = async (defaultTheme: Theme) => {
    const db = await initDB();
    
    // Vérifier si des préférences existent déjà
    const existingPrefs = await db.getAll('userPreferences');
    
    if (existingPrefs.length === 0) {
      // Créer des préférences par défaut
      const defaultPreferences = {
        defaultCurrency: Currency.EUR,
        theme: defaultTheme,
        dateFormat: 'dd/MM/yyyy',
        useFinancialMonth: false,
        financialMonthStartDay: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Ajouter aux préférences
      await db.add('userPreferences', defaultPreferences);
      console.log('Préférences utilisateur par défaut créées');
    } else {
      // Les préférences existent mais n'ont pas de thème, les mettre à jour
      const firstPref = existingPrefs[0];
      await db.put('userPreferences', {
        ...firstPref,
        theme: defaultTheme,
        updatedAt: new Date()
      });
      console.log('Préférences utilisateur mises à jour avec le thème par défaut');
    }
  };

  // Mise à jour du thème dans le DOM et dans les préférences
  const changeTheme = async (newTheme: Theme) => {
    // Mettre à jour l'état et le localStorage immédiatement
    setTheme(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    
    // Mise à jour du DOM
    applyThemeToDOM(newTheme);
    
    // Mise à jour dans la base de données de manière asynchrone
    try {
      const prefs = await preferencesAPI.get();
      
      if (prefs && prefs.id) {
        // Si les préférences existent, les mettre à jour
        await preferencesAPI.update({ theme: newTheme });
      } else {
        // Si les préférences n'existent pas encore, les créer
        await createDefaultPreferences(newTheme);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du thème:', error);
      // L'utilisateur ne verra pas l'erreur car nous avons déjà mis à jour le DOM et localStorage
    }
  };

  // Observer les changements de thème pour les appliquer au DOM
  useEffect(() => {
    if (!isLoading) {
      applyThemeToDOM(theme);
    }
  }, [theme, isLoading]);

  return { theme, changeTheme, isLoading };
}
