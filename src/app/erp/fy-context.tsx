"use client";

import { createContext, useContext, useState } from "react";

export interface FYPeriod {
  label: string;     // "FY 2025-26"
  dateFrom: string;  // "2025-04-01"  (empty string = All time)
  dateTo: string;    // "2026-03-31"  (empty string = All time)
  isCurrent: boolean;
}

export function buildFYList(): FYPeriod[] {
  const now = new Date();
  const currentFYStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const list: FYPeriod[] = [];
  for (let y = currentFYStartYear; y >= currentFYStartYear - 2; y--) {
    list.push({
      label: `FY ${y}-${String(y + 1).slice(2)}`,
      dateFrom: `${y}-04-01`,
      dateTo: `${y + 1}-03-31`,
      isCurrent: y === currentFYStartYear,
    });
  }
  list.push({ label: "All time", dateFrom: "", dateTo: "", isCurrent: false });
  return list;
}

export const FY_LIST = buildFYList();

interface FYContextValue {
  fy: FYPeriod;
  setFy: (fy: FYPeriod) => void;
}

const FYContext = createContext<FYContextValue>({ fy: FY_LIST[0], setFy: () => {} });

export function FYProvider({ children }: { children: React.ReactNode }) {
  const [fy, setFy] = useState<FYPeriod>(FY_LIST[0]);
  return <FYContext.Provider value={{ fy, setFy }}>{children}</FYContext.Provider>;
}

export function useFY() {
  return useContext(FYContext);
}

/** Returns true if the given ISO date string falls within the selected FY. */
export function inFY(date: string, fy: FYPeriod): boolean {
  if (!fy.dateFrom) return true; // "All time"
  return date >= fy.dateFrom && date <= fy.dateTo;
}
