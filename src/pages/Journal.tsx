import { MainLayout } from "@/components/layout/MainLayout";
import { AccountingJournal } from "@/components/journal/AccountingJournal";
import { useAccountFilter } from "@/contexts/AccountFilterContext";
import { useState } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import db from "@/lib/db";

const Journal = () => {
  const { selectedAccount, setSelectedAccount } = useAccountFilter();
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), "yyyy-MM"));

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => db.accounts.getAll(),
  });

  return (
    <MainLayout accountFilter={selectedAccount} selectedMonth={currentMonth}>
      <h1 className="text-2xl font-bold mb-6">Journal Comptable</h1>

      <div className="mb-4 flex items-center space-x-4">
        <label className="font-medium">Filtrer par compte :</label>
        <Select
          value={selectedAccount === "all" ? "all" : String(selectedAccount)}
          onValueChange={(value) => {
            setSelectedAccount(value === "all" ? "all" : Number(value));
          }}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Tous les comptes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les comptes</SelectItem>
            {accounts.map((account: any) => (
              <SelectItem key={account.id} value={String(account.id)}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-6">
        <AccountingJournal yearMonth={currentMonth} />
      </div>
    </MainLayout>
  );
};

export default Journal;
