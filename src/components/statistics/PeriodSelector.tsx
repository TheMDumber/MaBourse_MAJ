import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PeriodOption = "1month" | "3months" | "6months" | "12months";
export type TimeframeOption = "past" | "future";

interface PeriodSelectorProps {
  value: PeriodOption;
  onChange: (value: PeriodOption) => void;
  timeframe?: TimeframeOption;
  onTimeframeChange?: (value: TimeframeOption) => void;
}

export function PeriodSelector({ value, onChange, timeframe = "past", onTimeframeChange }: PeriodSelectorProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      {onTimeframeChange && (
        <Select value={timeframe} onValueChange={(val) => onTimeframeChange(val as TimeframeOption)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Période" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="past">Historique passé</SelectItem>
            <SelectItem value="future">Vue projection</SelectItem>
          </SelectContent>
        </Select>
      )}
      
      <Select value={value} onValueChange={(val) => onChange(val as PeriodOption)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Durée" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1month">
            {timeframe === "past" ? "Dernier mois" : "Ce mois ci"}
          </SelectItem>
          <SelectItem value="3months">
            {timeframe === "past" ? "3 derniers mois" : "3 prochains mois"}
          </SelectItem>
          <SelectItem value="6months">
            {timeframe === "past" ? "6 derniers mois" : "6 prochains mois"}
          </SelectItem>
          <SelectItem value="12months">
            {timeframe === "past" ? "12 derniers mois" : "12 prochains mois"}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
