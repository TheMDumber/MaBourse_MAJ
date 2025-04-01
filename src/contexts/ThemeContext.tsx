import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { Theme } from '@/lib/types';
import { preferencesAPI } from '@/lib/db';

// Interface pour le contexte du thème
interface ThemeContextType {
  theme: Theme;
  changeTheme: (newTheme: Theme) => Promise<void>;
  isLoading: boolean;
}

// Valeur par défaut du contexte
const defaultThemeContext: ThemeContextType = {
  theme: Theme.LIGHT,
  changeTheme: async () => {},
  isLoading: true
};

// Création du contexte
const ThemeContext = createContext<ThemeContextType>(defaultThemeContext);

// Hook pour utiliser le contexte du thème
export const useTheme = () => useContext(ThemeContext);

interface ThemeProviderProps {
  children: ReactNode;
}

// Fournisseur du contexte du thème
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(Theme.LIGHT);
  const [isLoading, setIsLoading] = useState(true);

  // Chargement initial du thème depuis les préférences
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const prefs = await preferencesAPI.get();
        // Vérification que prefs existe et a une propriété theme
        if (prefs && typeof prefs.theme !== 'undefined') {
          setTheme(prefs.theme);
        } else {
          console.warn('Les préférences existent mais ne contiennent pas de thème');
          setTheme(Theme.LIGHT); // Fallback sur le thème clair
        }
      } catch (error) {
        console.error('Erreur lors du chargement du thème:', error);
        // Fallback sur le thème clair
        setTheme(Theme.LIGHT);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, []);

  // Mise à jour du thème