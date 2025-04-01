import { createContext, useContext, ReactNode } from 'react';
import { useDevice } from '@/hooks/useDevice';

interface DeviceContextProps {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenSize: {
    width: number;
    height: number;
  };
}

const DeviceContext = createContext<DeviceContextProps | undefined>(undefined);

export function DeviceProvider({ children }: { children: ReactNode }) {
  const deviceInfo = useDevice();

  return (
    <DeviceContext.Provider value={deviceInfo}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDeviceContext() {
  const context = useContext(DeviceContext);
  
  if (context === undefined) {
    throw new Error('useDeviceContext must be used within a DeviceProvider');
  }
  
  return context;
}

// Alias for backward compatibility
export const useDeviceType = useDeviceContext;
