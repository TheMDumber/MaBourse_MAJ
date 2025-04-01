import { useState, useEffect } from 'react';

type DeviceType = 'mobile' | 'tablet' | 'desktop';

export function useDevice() {
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
  const [screenSize, setScreenSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0
  });
  
  const isMobile = deviceType === 'mobile';
  const isTablet = deviceType === 'tablet';
  const isDesktop = deviceType === 'desktop';

  useEffect(() => {
    // Détection initiale
    detectDevice();
    
    // Fonction de mise à jour basée sur la taille
    function handleResize() {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
      detectDevice();
    }

    // Détecter le type d'appareil
    function detectDevice() {
      const userAgent = navigator.userAgent.toLowerCase();
      
      // Détection par User Agent
      const isMobileDevice = /iphone|ipod|android|blackberry|windows phone/g.test(userAgent);
      const isTabletDevice = /ipad|tablet|playbook|silk/g.test(userAgent);
      
      // Détection par taille d'écran
      const width = window.innerWidth;
      
      if (isMobileDevice || width < 640) {
        setDeviceType('mobile');
      } else if (isTabletDevice || (width >= 640 && width < 1024)) {
        setDeviceType('tablet');
      } else {
        setDeviceType('desktop');
      }
    }

    // Ajouter l'écouteur d'événement pour redimensionnement
    window.addEventListener('resize', handleResize);
    
    // Nettoyer l'écouteur d'événement
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    deviceType,
    isMobile,
    isTablet,
    isDesktop,
    screenSize
  };
}
