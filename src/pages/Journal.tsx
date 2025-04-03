import { MainLayout } from "@/components/layout/MainLayout";
import { AccountingJournal } from "@/components/journal/AccountingJournal";
import { useAccountFilter } from "@/contexts/AccountFilterContext";
import { useState } from "react";
import { format } from "date-fns";

const Journal = () => {
  const { selectedAccount } = useAccountFilter();
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), "yyyy-MM"));
  
  return (
    <MainLayout accountFilter={selectedAccount} selectedMonth={currentMonth}>
      <h1 className="text-2xl font-bold mb-6">Journal Comptable</h1>
      
      <div className="space-y-6">
        <AccountingJournal yearMonth={currentMonth} />
      </div>
    </MainLayout>
  );
};

export default Journal;
