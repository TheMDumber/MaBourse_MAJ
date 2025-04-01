
import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart, LineChart, BarChart3 } from "lucide-react";

export type ChartType = "line" | "bar" | "bar3d";

interface ChartTypeSelectorProps {
  value: ChartType;
  onChange: (value: ChartType) => void;
}

export function ChartTypeSelector({ value, onChange }: ChartTypeSelectorProps) {
  return (
    <Select value={value} onValueChange={(val) => onChange(val as ChartType)}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Type de graphique" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="line" className="flex items-center">
          <LineChart className="h-4 w-4 mr-2" />
          <span>Ligne</span>
        </SelectItem>
        <SelectItem value="bar" className="flex items-center">
          <BarChart className="h-4 w-4 mr-2" />
          <span>Barres</span>
        </SelectItem>
        <SelectItem value="bar3d" className="flex items-center">
          <BarChart3 className="h-4 w-4 mr-2" />
          <span>Barres 3D</span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
