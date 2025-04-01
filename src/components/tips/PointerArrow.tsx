import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowLeft, ArrowRight } from 'lucide-react';

export type ArrowDirection = 'up' | 'down' | 'left' | 'right';

interface PointerArrowProps {
  direction?: ArrowDirection;
  color?: string;
  size?: number;
  pulseSpeed?: 'slow' | 'medium' | 'fast';
  className?: string;
  text?: string;
  textPosition?: 'top' | 'bottom' | 'left' | 'right';
  onClick?: () => void;
}

export const PointerArrow: React.FC<PointerArrowProps> = ({
  direction = 'down',
  color = 'text-primary',
  size = 32,
  pulseSpeed = 'medium',
  className = '',
  text,
  textPosition = 'top',
  onClick,
}) => {
  const [visible, setVisible] = useState(true);
  
  // Animation de clignotement
  useEffect(() => {
    const intervalDuration = 
      pulseSpeed === 'slow' ? 1000 :
      pulseSpeed === 'fast' ? 400 : 600;
    
    const interval = setInterval(() => {
      setVisible(prev => !prev);
    }, intervalDuration);
    
    return () => clearInterval(interval);
  }, [pulseSpeed]);

  // Choisir la bonne flèche selon la direction
  const ArrowComponent = 
    direction === 'up' ? ArrowUp :
    direction === 'down' ? ArrowDown :
    direction === 'left' ? ArrowLeft : ArrowRight;

  // Style pour le texte selon sa position
  const textStyles = {
    top: 'mb-2 text-center font-semibold bg-white/80 dark:bg-background/80 px-3 py-1 rounded-md shadow-sm',
    bottom: 'mt-2 text-center font-semibold bg-white/80 dark:bg-background/80 px-3 py-1 rounded-md shadow-sm',
    left: 'mr-2 my-auto font-semibold bg-white/80 dark:bg-background/80 px-3 py-1 rounded-md shadow-sm',
    right: 'ml-2 my-auto font-semibold bg-white/80 dark:bg-background/80 px-3 py-1 rounded-md shadow-sm',
  };

  // Animation de rebond
  const bounceAnimation = `animate-bounce ${
    pulseSpeed === 'slow' ? 'animation-duration-1500' :
    pulseSpeed === 'fast' ? 'animation-duration-500' : 'animation-duration-1000'
  }`;

  return (
    <div
      className={`flex ${
        textPosition === 'top' || textPosition === 'bottom' ? 'flex-col' : 'flex-row'
      } items-center justify-center ${className} cursor-pointer`}
      onClick={onClick}
      style={{ opacity: visible ? 1 : 0.3, transition: 'opacity 0.3s ease-in-out' }}
    >
      {text && textPosition === 'top' && (
        <div className={textStyles.top}>{text}</div>
      )}
      
      {text && textPosition === 'left' && (
        <div className={textStyles.left}>{text}</div>
      )}
      
      <div className={bounceAnimation}>
        <ArrowComponent 
          size={size} 
          className={`${color} drop-shadow-md filter-none stroke-[3]`} 
          strokeWidth={3}
        />
      </div>
      
      {text && textPosition === 'right' && (
        <div className={textStyles.right}>{text}</div>
      )}
      
      {text && textPosition === 'bottom' && (
        <div className={textStyles.bottom}>{text}</div>
      )}
    </div>
  );
};
