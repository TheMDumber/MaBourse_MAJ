import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { PointerArrow, ArrowDirection } from './PointerArrow';

export interface TipConfig {
  id: string;
  targetSelector: string;
  text: string;
  arrowDirection: ArrowDirection;
  textPosition?: 'top' | 'bottom' | 'left' | 'right';
  page: string;
  offset?: { x: number, y: number };
}

// Liste des astuces de l'application
export const appTips: TipConfig[] = [
  {
    id: 'add-transaction',
    targetSelector: 'button:has(.lucide-plus)',
    text: 'Cliquez ici pour ajouter une transaction',
    arrowDirection: 'down',
    textPosition: 'top',
    page: '/transactions',
    offset: { x: 20, y: 0 }
  },
  {
    id: 'account-filter',
    targetSelector: '#account-select-header-0',
    text: 'Sélectionnez un compte ici',
    arrowDirection: 'right',
    textPosition: 'left',
    page: '/transactions',
    offset: { x: 50, y: 0 }
  },
  {
    id: 'export-data',
    targetSelector: 'button:has(.lucide-download)',
    text: 'Exportez vos données',
    arrowDirection: 'down',
    textPosition: 'top',
    page: '/settings',
    offset: { x: 15, y: 0 }
  }
];

interface AppTipsProps {
  currentPage: string;
}

export const AppTips: React.FC<AppTipsProps> = ({ currentPage }) => {
  const [seenTips, setSeenTips] = useState<string[]>(() => {
    const saved = localStorage.getItem('seenTips');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [activeTip, setActiveTip] = useState<TipConfig | null>(null);
  const [tipPosition, setTipPosition] = useState({ top: 0, left: 0 });
  
  // Sauvegarder les astuces vues
  useEffect(() => {
    localStorage.setItem('seenTips', JSON.stringify(seenTips));
  }, [seenTips]);
  
  // Afficher une astuce non vue pour la page actuelle
  useEffect(() => {
    const pageTips = appTips.filter(tip => 
      tip.page === currentPage && !seenTips.includes(tip.id)
    );
    
    if (pageTips.length > 0) {
      const nextTip = pageTips[0];
      setActiveTip(nextTip);
      
      // Trouver la position de l'élément cible
      setTimeout(() => {
        const targetElement = document.querySelector(nextTip.targetSelector);
        if (targetElement) {
          const rect = targetElement.getBoundingClientRect();
          const xOffset = nextTip.offset?.x || 0;
          const yOffset = nextTip.offset?.y || 0;
          
          const position = {
            top: rect.top + window.scrollY + (rect.height / 2) + yOffset,
            left: rect.left + window.scrollX + (rect.width / 2) + xOffset
          };
          setTipPosition(position);
        }
      }, 500);
    } else {
      setActiveTip(null);
    }
  }, [currentPage, seenTips]);
  
  // Marquer une astuce comme vue
  const dismissTip = () => {
    if (activeTip) {
      setSeenTips(prev => [...prev, activeTip.id]);
      setActiveTip(null);
    }
  };
  
  // Réinitialiser toutes les astuces
  const resetTips = () => {
    localStorage.removeItem('seenTips');
    setSeenTips([]);
  };
  
  if (!activeTip) return null;
  
  return (
    <div 
      className="fixed z-50 pointer-events-none"
      style={{
        top: `${tipPosition.top}px`,
        left: `${tipPosition.left}px`,
        transform: 'translate(-50%, -50%)'
      }}
    >
      <div className="relative">
        <PointerArrow
          direction={activeTip.arrowDirection}
          text={activeTip.text}
          textPosition={activeTip.textPosition}
          color="text-primary"
          pulseSpeed="medium"
          size={30}
          className="pointer-events-auto"
        />
        <Button
          size="icon"
          variant="outline"
          className="absolute top-0 right-0 h-6 w-6 rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-auto"
          onClick={dismissTip}
        >
          <X size={12} />
        </Button>
      </div>
    </div>
  );
};

// Composant pour réinitialiser les astuces (à placer dans les paramètres)
export const ResetTipsButton: React.FC = () => {
  const resetTips = () => {
    localStorage.removeItem('seenTips');
    window.location.reload();
  };
  
  return (
    <Button onClick={resetTips} variant="outline" size="sm">
      Réinitialiser les astuces
    </Button>
  );
};
