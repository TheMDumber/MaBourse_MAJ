import React, { createContext, useContext, useState, ReactNode } from 'react';

interface MonthContextType {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
}

const MonthContext = createContext<MonthContextType | undefined>(undefined);

export const MonthProvider = ({ children }: { children: ReactNode }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const saved = localStorage.getItem('selectedMonth');
    return saved || new Date().toISOString().slice(0, 7); // yyyy-MM
  });

  const updateMonth = (month: string) => {
    setSelectedMonth(month);
    localStorage.setItem('selectedMonth', month);
  };

  return (
    <MonthContext.Provider value={{ selectedMonth, setSelectedMonth: updateMonth }}>
      {children}
    </MonthContext.Provider>
  );
};

export const useMonth = () => {
  const context = useContext(MonthContext);
  if (!context) {
    throw new Error('useMonth must be used within a MonthProvider');
  }
  return context;
};
