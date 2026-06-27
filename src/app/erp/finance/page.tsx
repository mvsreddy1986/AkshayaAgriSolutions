"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { LedgerEntry, Invoice } from "../../../lib/types";
import { useFY as useGlobalFY } from "../fy-context";
import {
  TrendingUp, BarChart3, Wallet, AlertCircle,
  ArrowUpCircle, ArrowDownCircle, RefreshCw, ChevronDown, ChevronRight,
  CheckCircle2, User, Calendar, Clock,
} from "lucide-react";

const TABS = ["Dashboard", "P&L", "Receivables", "Payables", "AR Aging"] as const;
type Tab = (typeof TABS)[number];

const FIN_TAB_ICONS = {
  "Dashboard": TrendingUp,
  "P&L": BarChart3,
  "Receivables": ArrowUpCircle,
  "Payables": ArrowDownCircle,
  "AR Aging": Clock,
} as const;

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

// ─── FY UTILITIES ─────────────────────────────────────────────────────────────

interface FYPeriod {
  label: string;        // "FY 2025-26"
  dateFrom: string;     // "2025-04-01"
  dateTo: string;       // "2026-03-31"
  isCurrent: boolean;
}

function buildFYList(): FYPeriod[] {
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

const FY_LIST = buildFYList();

function FYPicker({ selected, onChange }: { selected: FYPeriod; onChange: (fy: FYPeriod) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#d8decf] bg-white px-3 py-1.5">
      <Calendar size={14} className="text-[#60735d]" />
      <select
        value={selected.label}
        onChange={(e) => {
          const found = FY_LIST.find((f) => f.label === e.target.value);
          if (found) onChange(found);
        }}
        className="bg-transparent text-sm font-semibold text-[#172018] outline-none cursor-pointer"
      >
        {FY_LIST.map((fy) => (
          <option key={fy.label} value={fy.label}>
            {fy.label}{fy.isCurrent ? " (Current)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function ledgerUrl(accountCode: string, fy: FYPeriod): string {
  const params = new URLSearchParams({ accountCode });
  if (fy.dateFrom) params.set("dateFrom", fy.dateFrom);
  if (fy.dateTo) params.set("dateTo", fy.dateTo);
  return `/api/ledger?${params}`;
}

function allLedgerUrl(fy: FYPeriod): string {
  const params = new URLSearchParams();
  if (fy.dateFrom) params.set("dateFrom", fy.dateFrom);
  if (fy.dateTo) params.set("dateTo", fy.dateTo);
  const q = params.toString();
  return `/api/ledger${q ? "?" + q : ""}`;
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function DashboardTab({ fy }: { fy: FYPeriod }) {
  const [byAccount, setByAccount] = useState<Record<string, LedgerEntry[]>>({});
  const [allEntries, setAllEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ACCOUNTS = ["1100", "1190", "1201", "2101", "3100", "3200", "3900", "4101", "4102", "5001", "5101"];

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      ...ACCOUNTS.map((code) =>
        fetch(ledgerUrl(code, fy))
          .then((r) => r.json())
          .then((data): [string, LedgerEntry[]] => [code, Array.isArray(data) ? data : []])
      ),
      fetch(allLedgerUrl(fy)).then((r) => r.json()),
    ])
      .then((results) => {
        const pairs = results.slice(0, ACCOUNTS.length) as [string, LedgerEntry[]][];
        const all = results[ACCOUNTS.length] as LedgerEntry[];
        setByAccount(Object.fromEntries(pairs));
        setAllEntries(Array.isArray(all) ? all : []);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fy.dateFrom, fy.dateTo]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="py-8 text-center text-sm text-[#60735d]">Loading financial data…</p>;
  if (error) return <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-5 text-[#b91c1c]">{error}</div>;

  const sum = (code: string, side: "dr" | "cr") =>
    (byAccount[code] ?? []).reduce((s, e) => s + (side === "dr" ? e.debit : e.credit), 0);

  const receivable    = sum("1201", "dr") - sum("1201", "cr");
  const payable       = sum("2101", "cr") - sum("2101", "dr");
  const sales         = sum("3100", "cr");
  const cess          = sum("5101", "dr");
  const moistureDed   = sum("4101", "dr");
  const fmDed         = sum("4102", "dr");
  const margin        = sum("3200", "cr");
  const tdsReceivable = sum("1190", "dr") - sum("1190", "cr");
  const totalDeductions = moistureDed + fmDed + cess;
  const drawings      = sum("3900", "dr") - sum("3900", "cr");
  const opExp         = allEntries
    .filter((e) => e.accountCode.startsWith("52"))
    .reduce((s, e) => s + e.debit - e.credit, 0);

  const kpis = [
    {
      label: "Sarvani receivable",
      value: inr(Math.abs(receivable)),
      sub: receivable > 0 ? "Outstanding from Sarvani (1201 Dr)" : receivable < 0 ? "We owe Sarvani" : "Nil",
      color: "text-[#1d4ed8]", border: "border-[#bfdbfe]", bg: "bg-white",
      icon: ArrowUpCircle,
    },
    {
      label: "Supplier payable",
      value: inr(Math.abs(payable)),
      sub: payable > 0 ? "Owed to suppliers (2101 Cr)" : payable < 0 ? "Suppliers owe us" : "Nil",
      color: "text-[#d97706]", border: "border-[#fde68a]", bg: "bg-[#fffbeb]",
      icon: ArrowDownCircle,
    },
    {
      label: "Akshaya margin (3200)",
      value: inr(margin),
      sub: "Net service margin earned across settled lots",
      color: "text-[#172018]", border: "border-[#d8ff72]", bg: "bg-[#f9ffe6]",
      icon: BarChart3,
    },
    {
      label: "Pass-through deductions",
      value: inr(totalDeductions),
      sub: `Moisture ${inr(moistureDed)} · FM ${inr(fmDed)} · Cess ${inr(cess)}`,
      color: "text-[#60735d]", border: "border-[#c8d4c0]", bg: "bg-white",
      icon: AlertCircle,
    },
    ...(tdsReceivable > 0 ? [{
      label: "TDS Receivable (1190)",
      value: inr(tdsReceivable),
      sub: "Deducted by customer — claimable against income tax at year-end",
      color: "text-[#92400e]", border: "border-[#fde68a]", bg: "bg-[#fffbeb]",
      icon: Wallet,
    }] : []),
    ...(opExp > 0 ? [{
      label: "Operating Expenses (52xx)",
      value: inr(opExp),
      sub: "Business costs posted to expense accounts this period",
      color: "text-[#d97706]", border: "border-[#fde68a]", bg: "bg-[#fffbeb]",
      icon: AlertCircle,
    }] : []),
    ...(drawings > 0 ? [{
      label: "Owner Drawings (3900)",
      value: inr(drawings),
      sub: "Personal withdrawals — equity reduction, not a P&L expense",
      color: "text-[#7c3aed]", border: "border-[#ddd6fe]", bg: "bg-[#faf5ff]",
      icon: Wallet,
    }] : []),
  ];

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Financial Dashboard</h3>
          <p className="mt-0.5 text-sm text-[#60735d]">
            {fy.label === "All time" ? "All-time ledger totals" : `${fy.label} · ${fy.dateFrom} → ${fy.dateTo}`}
          </p>
        </div>
        <button onClick={load} className="btn btn-ghost flex items-center gap-1.5"><RefreshCw size={14} />Refresh</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`rounded-xl border ${kpi.border} ${kpi.bg} p-5`}>
            <div className="flex items-start justify-between">
              <p className="text-sm text-[#60735d]">{kpi.label}</p>
              <kpi.icon size={18} className={kpi.color} />
            </div>
            <p className={`mt-2 text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="mt-1 text-xs text-[#60735d] truncate">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#c8d4c0] bg-[#f3f6ef] p-5">
        <div className="flex items-start gap-3">
          <TrendingUp size={18} className="mt-0.5 shrink-0 text-[#60735d]" />
          <div>
            <p className="font-semibold text-[#172018]">Net profit = service margin minus operating expenses</p>
            <p className="mt-1.5 text-sm text-[#60735d]">
              Akshaya earns <strong>{inr(margin)}</strong> in service margin{fy.label !== "All time" ? ` in ${fy.label}` : ""}.
              Sales (3100) and procurement (5001) cancel to zero. Quality deductions and cess are pass-through.
              {opExp > 0 && <> Operating expenses (52xx) of <strong>{inr(opExp)}</strong> reduce net profit directly.</>}
              {tdsReceivable > 0 && <> <strong>{inr(tdsReceivable)}</strong> TDS is a tax asset claimable at ITR.</>}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-semibold">Account balances snapshot</h3>
          <p className="mt-0.5 text-xs text-[#60735d]">{fy.label} · Dr and Cr totals from ledger entries in this period</p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-[0.1em] text-[#60735d]">
            <tr>
              <th className="px-5 py-3.5">Account</th>
              <th className="px-5 py-3.5">Description</th>
              <th className="px-5 py-3.5 text-right">Entries</th>
              <th className="px-5 py-3.5 text-right">Total Dr</th>
              <th className="px-5 py-3.5 text-right">Total Cr</th>
            </tr>
          </thead>
          <tbody>
            {[
              { code: "1100", label: "Bank / Cash" },
              { code: "1190", label: "TDS Receivable (Dr normal — advance income tax)" },
              { code: "1201", label: "Sarvani Biofuels — Receivable (Dr normal)" },
              { code: "2101", label: "Supplier Payable (Cr normal)" },
              { code: "3100", label: "Sales — Commodity (Cr normal)" },
              { code: "3200", label: "Akshaya Trading Margin (Cr normal)" },
              { code: "4101", label: "Quality Loss — Moisture (pass-through)" },
              { code: "4102", label: "Quality Loss — FM (pass-through)" },
              { code: "5001", label: "Procurement — Commodity (offsets 3100)" },
              { code: "5101", label: "Market Cess (pass-through)" },
              { code: "3900", label: "Owner Drawings (equity withdrawal — Dr normal)" },
            ].map(({ code, label }) => {
              const es = byAccount[code] ?? [];
              if (es.length === 0) return null;
              const dr = es.reduce((s, e) => s + e.debit, 0);
              const cr = es.reduce((s, e) => s + e.credit, 0);
              return (
                <tr key={code} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                  <td className="px-5 py-3.5 font-mono text-xs font-semibold">{code}</td>
                  <td className="px-5 py-3.5 text-[#172018]">{label}</td>
                  <td className="px-5 py-3.5 text-right text-[#536251]">{es.length}</td>
                  <td className="px-5 py-3.5 text-right text-[#1d4ed8]">{dr > 0 ? inr(dr) : "—"}</td>
                  <td className="px-5 py-3.5 text-right text-[#dc2626]">{cr > 0 ? inr(cr) : "—"}</td>
                </tr>
              );
            })}
            {opExp > 0 && (
              <tr className="border-t border-[#edf0e8] bg-amber-50/40 hover:bg-amber-50">
                <td className="px-5 py-3.5 font-mono text-xs font-semibold text-amber-700">52xx</td>
                <td className="px-5 py-3.5 text-[#172018]">Operating Expenses (aggregated)</td>
                <td className="px-5 py-3.5 text-right text-[#536251]">
                  {allEntries.filter(e => e.accountCode.startsWith("52")).length}
                </td>
                <td className="px-5 py-3.5 text-right text-[#1d4ed8]">{inr(opExp)}</td>
                <td className="px-5 py-3.5 text-right text-[#536251]">—</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── P&L ──────────────────────────────────────────────────────────────────────

function PLTab({ fy }: { fy: FYPeriod }) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(allLedgerUrl(fy))
      .then((r) => r.json())
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fy.dateFrom, fy.dateTo]);

  useEffect(() => { load(); }, [load]);

  const netDr = (code: string) =>
    entries.filter((e) => e.accountCode === code).reduce((s, e) => s + e.debit - e.credit, 0);
  const netCr = (code: string) =>
    entries.filter((e) => e.accountCode === code).reduce((s, e) => s + e.credit - e.debit, 0);

  const totalSales       = netCr("3100");
  const totalMargin      = netCr("3200");
  const totalIncome      = totalSales + totalMargin;
  const totalProcurement = netDr("5001");
  const totalMoisture    = netDr("4101");
  const totalFM          = netDr("4102");
  const totalHold        = netDr("4199");
  const totalCess        = netDr("5101");
  const totalOpExp       = ["5201","5202","5203","5204","5205","5206","5207","5208"]
    .reduce((s, code) => s + netDr(code), 0);
  const totalDrawings    = netDr("3900");
  const totalExpenses    = totalProcurement + totalMoisture + totalFM + totalHold + Math.max(0, totalCess) + totalOpExp;
  const netProfit        = totalIncome - totalExpenses;

  const incomeLines = [
    { label: "Sales — Commodity (3100)", amount: totalSales, note: "Gross notional billed to Sarvani — offsets 5001" },
    { label: "Service Margin (3200)", amount: totalMargin, note: "Akshaya's margin (₹/MT × net weight)" },
  ];
  const expenseLines = [
    { label: "Procurement — Commodity (5001)", amount: totalProcurement, note: "Gross notional paid to suppliers — offsets 3100" },
    { label: "Quality Loss — Moisture (4101)", amount: totalMoisture, note: "Pass-through: nets to zero when both sides posted" },
    { label: "Quality Loss — FM (4102)", amount: totalFM, note: "Pass-through: nets to zero when both sides posted" },
    { label: "Hold Penalty (4199)", amount: totalHold, note: "Penalty for accepting out-of-spec lots" },
    { label: "Market Cess (5101)", amount: Math.max(0, totalCess), note: "Pass-through: residual = gate-paid cess (bank entry pending)" },
    { label: "Operating Expenses (52xx)", amount: totalOpExp, note: "Transport, printing, utilities, staff expenses, professional fees, etc." },
  ];

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Profit & Loss Statement</h3>
          <p className="mt-0.5 text-sm text-[#60735d]">
            {fy.label === "All time" ? "All-time · all posted ledger entries" : `${fy.label} · ${fy.dateFrom} to ${fy.dateTo}`}
          </p>
        </div>
        <button onClick={load} className="btn btn-ghost flex items-center gap-1.5"><RefreshCw size={14} />Refresh</button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-[#60735d]">Loading entries…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[#bbf7d0] bg-white p-5">
              <p className="text-sm text-[#60735d]">Total income</p>
              <p className="mt-2 text-3xl font-bold text-[#15803d]">{inr(totalIncome)}</p>
            </div>
            <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-5">
              <p className="text-sm text-[#60735d]">Total expenses / deductions</p>
              <p className="mt-2 text-3xl font-bold text-[#d97706]">{inr(totalExpenses)}</p>
            </div>
            <div className={`rounded-xl border p-5 ${netProfit >= 0 ? "border-[#d8ff72] bg-[#f9ffe6]" : "border-[#fecaca] bg-[#fef2f2]"}`}>
              <p className="text-sm text-[#60735d]">Net profit</p>
              <p className={`mt-2 text-3xl font-bold ${netProfit >= 0 ? "text-[#172018]" : "text-[#dc2626]"}`}>{inr(netProfit)}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
            <div className="border-b border-[#edf0e8] bg-[#f3f6ef] px-5 py-3">
              <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-[#60735d]">Income</h4>
            </div>
            <table className="w-full text-left text-sm">
              <tbody>
                {incomeLines.map((line) => (
                  <tr key={line.label} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                    <td className="px-5 py-3.5 text-[#172018]">{line.label}</td>
                    <td className="px-5 py-3.5 text-xs text-[#60735d]">{line.note}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-[#15803d]">{inr(line.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-[#c8d4c0] bg-[#f0fdf4]">
                  <td className="px-5 py-3.5 font-bold" colSpan={2}>Total Income</td>
                  <td className="px-5 py-3.5 text-right font-bold text-[#15803d]">{inr(totalIncome)}</td>
                </tr>
              </tbody>
            </table>

            <div className="border-b border-[#edf0e8] border-t border-[#edf0e8] bg-[#f3f6ef] px-5 py-3">
              <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-[#60735d]">Expenses & Deductions</h4>
            </div>
            <table className="w-full text-left text-sm">
              <tbody>
                {expenseLines.map((line) => (
                  <tr key={line.label} className={`border-t border-[#edf0e8] hover:bg-[#fafcf8] ${line.amount === 0 ? "opacity-50" : ""}`}>
                    <td className="px-5 py-3.5 text-[#172018]">{line.label}</td>
                    <td className="px-5 py-3.5 text-xs text-[#60735d]">{line.note}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-[#d97706]">{line.amount > 0 ? inr(line.amount) : "—"}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-[#c8d4c0] bg-[#fffbeb]">
                  <td className="px-5 py-3.5 font-bold" colSpan={2}>Total Expenses</td>
                  <td className="px-5 py-3.5 text-right font-bold text-[#d97706]">{inr(totalExpenses)}</td>
                </tr>
              </tbody>
            </table>

            <div className={`border-t-2 border-[#172018] px-5 py-4 ${netProfit >= 0 ? "bg-[#f9ffe6]" : "bg-[#fef2f2]"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-lg font-bold text-[#172018]">Net Profit / (Loss)</span>
                  <p className="text-xs text-[#60735d] mt-0.5">= Margin (3200) less operating expenses (52xx) — pass-throughs net to zero</p>
                </div>
                <span className={`text-2xl font-bold ${netProfit >= 0 ? "text-[#172018]" : "text-[#dc2626]"}`}>{inr(netProfit)}</span>
              </div>
            </div>

            {totalDrawings > 0 && (
              <div className="border-t border-[#edf0e8] bg-[#faf5ff] px-5 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-[#7c3aed]">Owner Drawings (3900)</span>
                  <p className="text-xs text-[#60735d] mt-0.5">Equity withdrawal — not a P&L expense; reduces capital account</p>
                </div>
                <span className="text-base font-bold text-[#7c3aed]">{inr(totalDrawings)}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── SHARED HELPERS ───────────────────────────────────────────────────────────

function withRunningBalance(
  raw: LedgerEntry[],
  normalBalance: "Dr" | "Cr",
): (LedgerEntry & { runBal: number })[] {
  const sorted = [...raw].sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.id.localeCompare(b.id));
  let bal = 0;
  const result = sorted.map((e) => {
    bal += normalBalance === "Dr" ? e.debit - e.credit : e.credit - e.debit;
    return { ...e, runBal: bal };
  });
  return result.reverse();
}

type EntryRow = LedgerEntry & { runBal: number };

function LedgerTable({ rows, normalBalance }: { rows: EntryRow[]; normalBalance: "Dr" | "Cr" }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-widest text-[#60735d]">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Narration</th>
            <th className="px-4 py-3">Ref</th>
            <th className="px-4 py-3 text-right">Debit</th>
            <th className="px-4 py-3 text-right">Credit</th>
            <th className="px-4 py-3 text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
              <td className="px-4 py-3 text-[#536251] whitespace-nowrap">{e.entryDate}</td>
              <td className="px-4 py-3 max-w-xs truncate text-[#172018]">{e.narration}</td>
              <td className="px-4 py-3 font-mono text-xs text-[#1d4ed8]">{e.sourceRef}</td>
              <td className="px-4 py-3 text-right text-[#1d4ed8]">{e.debit > 0 ? inr(e.debit) : "—"}</td>
              <td className="px-4 py-3 text-right text-[#dc2626]">{e.credit > 0 ? inr(e.credit) : "—"}</td>
              <td className="px-4 py-3 text-right font-semibold">
                {inr(Math.abs(e.runBal))}
                <span className={`ml-1 text-xs ${(normalBalance === "Dr" ? e.runBal >= 0 : e.runBal <= 0) ? "text-[#15803d]" : "text-[#dc2626]"}`}>
                  {e.runBal >= 0 ? "Dr" : "Cr"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── RECEIVABLES ──────────────────────────────────────────────────────────────

function ReceivablesTab({ fy }: { fy: FYPeriod }) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(ledgerUrl("1201", fy))
      .then((r) => r.json())
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fy.dateFrom, fy.dateTo]);

  useEffect(() => { load(); }, [load]);

  const rows    = useMemo(() => withRunningBalance(entries, "Dr"), [entries]);
  const totalDr = entries.reduce((s, e) => s + e.debit,  0);
  const totalCr = entries.reduce((s, e) => s + e.credit, 0);
  const balance = totalDr - totalCr;

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Receivables — Sarvani Biofuels</h3>
          <p className="mt-0.5 text-sm text-[#60735d]">
            Account 1201 · {fy.label}{fy.label !== "All time" ? ` · ${fy.dateFrom} to ${fy.dateTo}` : ""}
          </p>
        </div>
        <button onClick={load} className="btn btn-ghost flex items-center gap-1.5"><RefreshCw size={14} />Refresh</button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-[#60735d]">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-[#d8decf] bg-white p-10 text-center">
          <ArrowUpCircle size={32} className="mx-auto mb-3 text-[#c8d4c0]" />
          <p className="font-semibold">No entries on account 1201{fy.label !== "All time" ? ` in ${fy.label}` : ""}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[#bfdbfe] bg-white p-5">
              <p className="text-sm text-[#60735d]">
                {fy.label === "All time" ? "Outstanding receivable" : `${fy.label} net movement`}
              </p>
              <p className={`mt-2 text-3xl font-bold ${balance >= 0 ? "text-[#1d4ed8]" : "text-[#dc2626]"}`}>
                {inr(Math.abs(balance))}
                <span className="ml-1 text-base font-semibold">{balance >= 0 ? "Dr" : "Cr"}</span>
              </p>
            </div>
            <div className="rounded-xl border border-[#d8decf] bg-white p-5">
              <p className="text-sm text-[#60735d]">Billed to Sarvani (Dr)</p>
              <p className="mt-2 text-3xl font-bold text-[#1d4ed8]">{inr(totalDr)}</p>
            </div>
            <div className="rounded-xl border border-[#d8decf] bg-white p-5">
              <p className="text-sm text-[#60735d]">Receipts + credits (Cr)</p>
              <p className="mt-2 text-3xl font-bold text-[#15803d]">{inr(totalCr)}</p>
              {totalDr > 0 && <p className="mt-1 text-xs text-[#60735d]">{Math.round((totalCr / totalDr) * 100)}% collected</p>}
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
            <div className="border-b border-[#edf0e8] px-5 py-4">
              <h3 className="text-lg font-semibold">Sarvani account statement · {fy.label}</h3>
            </div>
            <LedgerTable rows={rows} normalBalance="Dr" />
          </div>
        </>
      )}
    </div>
  );
}

// ─── PAYABLES ─────────────────────────────────────────────────────────────────

function PayablesTab({ fy }: { fy: FYPeriod }) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedParty, setExpandedParty] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(ledgerUrl("2101", fy))
      .then((r) => r.json())
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fy.dateFrom, fy.dateTo]);

  useEffect(() => { load(); }, [load]);

  const totalDr  = entries.reduce((s, e) => s + e.debit, 0);
  const totalCr  = entries.reduce((s, e) => s + e.credit, 0);
  const netPayable = totalCr - totalDr;

  const suppliers = useMemo(() => {
    const map = new Map<string, { partyId: string; partyName: string; raw: LedgerEntry[] }>();
    for (const e of entries) {
      const key = e.partyId ?? "__unassigned__";
      if (!map.has(key)) map.set(key, { partyId: key, partyName: e.partyName ?? "Unassigned", raw: [] });
      map.get(key)!.raw.push(e);
    }
    return [...map.values()].map((s) => {
      const rows = withRunningBalance(s.raw, "Cr");
      const sCr  = s.raw.reduce((a, e) => a + e.credit, 0);
      const sDr  = s.raw.reduce((a, e) => a + e.debit,  0);
      return { ...s, rows, payable: sCr - sDr, paid: sDr, invoiced: sCr };
    }).sort((a, b) => b.payable - a.payable);
  }, [entries]);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Payables — Supplier sub-ledger</h3>
          <p className="mt-0.5 text-sm text-[#60735d]">
            Account 2101 · {fy.label}{fy.label !== "All time" ? ` · ${fy.dateFrom} to ${fy.dateTo}` : ""}
          </p>
        </div>
        <button onClick={load} className="btn btn-ghost flex items-center gap-1.5"><RefreshCw size={14} />Refresh</button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-[#60735d]">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-[#d8decf] bg-white p-10 text-center">
          <ArrowDownCircle size={32} className="mx-auto mb-3 text-[#c8d4c0]" />
          <p className="font-semibold text-[#172018]">No supplier payable entries{fy.label !== "All time" ? ` in ${fy.label}` : ""}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-5">
              <p className="text-sm text-[#60735d]">
                {fy.label === "All time" ? "Total outstanding payable" : `${fy.label} net movement`}
              </p>
              <p className={`mt-2 text-3xl font-bold ${netPayable > 0 ? "text-[#d97706]" : "text-[#15803d]"}`}>
                {inr(Math.abs(netPayable))}
                <span className="ml-1 text-base font-semibold">{netPayable > 0 ? "Cr" : "Dr"}</span>
              </p>
              <p className="mt-1 text-xs text-[#60735d]">{suppliers.filter(s => s.payable > 0).length} supplier{suppliers.filter(s => s.payable > 0).length !== 1 ? "s" : ""} with open balance</p>
            </div>
            <div className="rounded-xl border border-[#d8decf] bg-white p-5">
              <p className="text-sm text-[#60735d]">Invoiced to suppliers (Cr)</p>
              <p className="mt-2 text-3xl font-bold text-[#dc2626]">{inr(totalCr)}</p>
            </div>
            <div className="rounded-xl border border-[#d8decf] bg-white p-5">
              <p className="text-sm text-[#60735d]">Paid to suppliers (Dr)</p>
              <p className="mt-2 text-3xl font-bold text-[#1d4ed8]">{inr(totalDr)}</p>
              {totalCr > 0 && <p className="mt-1 text-xs text-[#60735d]">{Math.round((totalDr / totalCr) * 100)}% settled</p>}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
            <div className="border-b border-[#edf0e8] px-5 py-4">
              <h3 className="text-lg font-semibold">Supplier-wise payable · {fy.label}</h3>
              <p className="text-xs text-[#60735d] mt-0.5">Click any supplier to see their statement</p>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-widest text-[#60735d]">
                <tr>
                  <th className="px-5 py-3.5 w-8" />
                  <th className="px-5 py-3.5">Supplier</th>
                  <th className="px-5 py-3.5 text-right">Invoiced (Cr)</th>
                  <th className="px-5 py-3.5 text-right">Paid (Dr)</th>
                  <th className="px-5 py-3.5 text-right">Outstanding</th>
                  <th className="px-5 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <React.Fragment key={s.partyId}>
                    <tr
                      onClick={() => setExpandedParty(expandedParty === s.partyId ? null : s.partyId)}
                      className="cursor-pointer border-t border-[#edf0e8] hover:bg-[#fafcf8]"
                    >
                      <td className="px-5 py-3.5 text-[#60735d]">
                        {expandedParty === s.partyId ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f3f6ef]">
                            <User size={12} className="text-[#60735d]" />
                          </div>
                          <span className="font-semibold">{s.partyName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right text-[#dc2626]">{inr(s.invoiced)}</td>
                      <td className="px-5 py-3.5 text-right text-[#1d4ed8]">{s.paid > 0 ? inr(s.paid) : "—"}</td>
                      <td className="px-5 py-3.5 text-right font-bold">
                        {inr(Math.abs(s.payable))}
                        <span className={`ml-1 text-xs font-normal ${s.payable > 0 ? "text-[#d97706]" : "text-[#15803d]"}`}>
                          {s.payable > 0 ? "Cr" : "Dr"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {s.payable <= 0
                          ? <span className="inline-flex items-center gap-1 rounded-full bg-[#f0fdf4] px-2.5 py-0.5 text-xs font-semibold text-[#15803d]"><CheckCircle2 size={11} />Settled</span>
                          : <span className="rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-xs font-semibold text-[#92400e]">Pending</span>
                        }
                      </td>
                    </tr>
                    {expandedParty === s.partyId && (
                      <tr className="border-t border-[#edf0e8] bg-[#f8faf6]">
                        <td colSpan={6} className="px-5 py-4">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#60735d]">
                            {s.partyName} — account statement (2101) · {fy.label}
                          </p>
                          <LedgerTable rows={s.rows} normalBalance="Cr" />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-[#c8d4c0] bg-[#f3f6ef]">
                <tr>
                  <td colSpan={2} className="px-5 py-3.5 font-bold">Total — all suppliers</td>
                  <td className="px-5 py-3.5 text-right font-bold text-[#dc2626]">{inr(totalCr)}</td>
                  <td className="px-5 py-3.5 text-right font-bold text-[#1d4ed8]">{totalDr > 0 ? inr(totalDr) : "—"}</td>
                  <td className="px-5 py-3.5 text-right font-bold">{inr(netPayable)} <span className="text-xs font-normal text-[#60735d]">Cr</span></td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── AR AGING ─────────────────────────────────────────────────────────────────

const AGING_BUCKETS = [
  { label: "Current",    days: [null, 0],   color: "text-[#15803d]", bg: "bg-[#f0fdf4]", border: "border-[#bbf7d0]", badge: "bg-[#dcfce7] text-[#15803d]" },
  { label: "1–30 days",  days: [1,   30],   color: "text-[#1d4ed8]", bg: "bg-white",     border: "border-[#bfdbfe]", badge: "bg-[#dbeafe] text-[#1d4ed8]" },
  { label: "31–60 days", days: [31,  60],   color: "text-[#d97706]", bg: "bg-[#fffbeb]", border: "border-[#fde68a]", badge: "bg-[#fef3c7] text-[#92400e]" },
  { label: "61–90 days", days: [61,  90],   color: "text-[#c2410c]", bg: "bg-[#fff7ed]", border: "border-[#fed7aa]", badge: "bg-[#ffedd5] text-[#c2410c]" },
  { label: "90+ days",   days: [91,  null], color: "text-[#dc2626]", bg: "bg-[#fef2f2]", border: "border-[#fecaca]", badge: "bg-[#fee2e2] text-[#dc2626]" },
] as const;

function agingBucket(daysOverdue: number) {
  if (daysOverdue <= 0) return AGING_BUCKETS[0];
  if (daysOverdue <= 30) return AGING_BUCKETS[1];
  if (daysOverdue <= 60) return AGING_BUCKETS[2];
  if (daysOverdue <= 90) return AGING_BUCKETS[3];
  return AGING_BUCKETS[4];
}

function ARAgingTab({ fy }: { fy: FYPeriod }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading,  setLoading]  = useState(true);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((data) => setInvoices(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Open Sales invoices with balance remaining
  const openInvoices = useMemo(() => {
    return invoices
      .filter((inv) =>
        inv.invoiceType === "Sales" &&
        inv.amountDue > 0.01 &&
        inv.status !== "Cancelled" &&
        // If a FY is selected, filter by invoice date; for aging, "All time" shows all open
        (fy.label === "All time" || (inv.invoiceDate >= fy.dateFrom && inv.invoiceDate <= fy.dateTo))
      )
      .map((inv) => {
        const msOverdue = new Date(today).getTime() - new Date(inv.dueDate).getTime();
        const daysOverdue = Math.floor(msOverdue / (1000 * 60 * 60 * 24));
        const daysFromInvoice = Math.floor(
          (new Date(today).getTime() - new Date(inv.invoiceDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        return { ...inv, daysOverdue, daysFromInvoice, bucket: agingBucket(daysOverdue) };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [invoices, fy, today]);

  const bucketTotals = useMemo(() =>
    AGING_BUCKETS.map((b) => {
      const rows = openInvoices.filter((inv) => inv.bucket.label === b.label);
      return { ...b, rows, total: rows.reduce((s, i) => s + i.amountDue, 0), count: rows.length };
    }),
  [openInvoices]);

  const grandTotal = openInvoices.reduce((s, i) => s + i.amountDue, 0);
  const totalInvoiced = openInvoices.reduce((s, i) => s + i.totalValue, 0);
  const totalCollected = openInvoices.reduce((s, i) => s + i.amountPaid, 0);
  const worstBucket = bucketTotals.slice().reverse().find((b) => b.count > 0);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">AR Aging — Sarvani Biofuels</h3>
          <p className="mt-0.5 text-sm text-[#60735d]">
            Open sales invoices · {fy.label === "All time" ? "all periods" : fy.label}
            {" · "}as of {today}
          </p>
        </div>
        <button onClick={load} className="btn btn-ghost flex items-center gap-1.5">
          <RefreshCw size={14} />Refresh
        </button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-[#60735d]">Loading invoices…</p>
      ) : openInvoices.length === 0 ? (
        <div className="rounded-xl border border-[#d8decf] bg-white p-12 text-center">
          <CheckCircle2 size={40} className="mx-auto mb-3 text-[#15803d]" />
          <p className="text-lg font-semibold text-[#172018]">All invoices collected</p>
          <p className="mt-1 text-sm text-[#60735d]">No open receivables{fy.label !== "All time" ? ` in ${fy.label}` : ""}.</p>
        </div>
      ) : (
        <>
          {/* Summary KPI row */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[#bfdbfe] bg-white p-5">
              <p className="text-sm text-[#60735d]">Total outstanding</p>
              <p className="mt-2 text-3xl font-bold text-[#1d4ed8]">{inr(grandTotal)}</p>
              <p className="mt-1 text-xs text-[#60735d]">{openInvoices.length} open invoice{openInvoices.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="rounded-xl border border-[#d8decf] bg-white p-5">
              <p className="text-sm text-[#60735d]">Collection rate</p>
              <p className="mt-2 text-3xl font-bold text-[#172018]">
                {totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0}%
              </p>
              <p className="mt-1 text-xs text-[#60735d]">{inr(totalCollected)} collected of {inr(totalInvoiced)}</p>
            </div>
            <div className={`rounded-xl border p-5 ${worstBucket ? worstBucket.border + " " + worstBucket.bg : "border-[#d8decf] bg-white"}`}>
              <p className="text-sm text-[#60735d]">Oldest outstanding</p>
              <p className={`mt-2 text-3xl font-bold ${worstBucket?.color ?? "text-[#172018]"}`}>
                {worstBucket ? worstBucket.label : "—"}
              </p>
              <p className="mt-1 text-xs text-[#60735d]">
                {worstBucket ? `${inr(worstBucket.total)} · ${worstBucket.count} invoice${worstBucket.count !== 1 ? "s" : ""}` : "All current"}
              </p>
            </div>
          </div>

          {/* Aging bucket summary */}
          <div className="grid gap-3 sm:grid-cols-5">
            {bucketTotals.map((b) => (
              <div key={b.label} className={`rounded-xl border ${b.border} ${b.bg} p-4 text-center`}>
                <p className={`text-sm font-semibold ${b.color}`}>{b.label}</p>
                <p className={`mt-1 text-xl font-bold ${b.color}`}>{inr(b.total)}</p>
                <p className="mt-0.5 text-xs text-[#60735d]">{b.count} inv.</p>
                {grandTotal > 0 && (
                  <div className="mt-2 h-1.5 rounded-full bg-[#f3f4f6] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${b.color.replace("text-", "bg-")}`}
                      style={{ width: `${Math.round((b.total / grandTotal) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Invoice-level aging table */}
          <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
            <div className="border-b border-[#edf0e8] px-5 py-4">
              <h3 className="text-lg font-semibold">Open invoice detail</h3>
              <p className="mt-0.5 text-xs text-[#60735d]">Sorted by most overdue first</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-[0.1em] text-[#60735d]">
                  <tr>
                    <th className="px-5 py-3.5">Invoice no</th>
                    <th className="px-5 py-3.5">Invoice date</th>
                    <th className="px-5 py-3.5">Due date</th>
                    <th className="px-5 py-3.5">Party</th>
                    <th className="px-5 py-3.5 text-right">Invoiced</th>
                    <th className="px-5 py-3.5 text-right">Collected</th>
                    <th className="px-5 py-3.5 text-right">Outstanding</th>
                    <th className="px-5 py-3.5 text-right">Days overdue</th>
                    <th className="px-5 py-3.5">Bucket</th>
                  </tr>
                </thead>
                <tbody>
                  {openInvoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                      <td className="px-5 py-3.5 font-semibold text-[#172018]">{inv.invoiceNo}</td>
                      <td className="px-5 py-3.5 text-[#536251]">{inv.invoiceDate}</td>
                      <td className="px-5 py-3.5 text-[#536251]">{inv.dueDate}</td>
                      <td className="px-5 py-3.5">{inv.partyName}</td>
                      <td className="px-5 py-3.5 text-right">{inr(inv.totalValue)}</td>
                      <td className="px-5 py-3.5 text-right text-[#15803d]">{inv.amountPaid > 0 ? inr(inv.amountPaid) : "—"}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-[#1d4ed8]">{inr(inv.amountDue)}</td>
                      <td className="px-5 py-3.5 text-right">
                        {inv.daysOverdue <= 0
                          ? <span className="text-[#15803d]">Not due</span>
                          : <span className={`font-semibold ${inv.bucket.color}`}>{inv.daysOverdue}d</span>
                        }
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${inv.bucket.badge}`}>
                          {inv.bucket.label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-[#c8d4c0] bg-[#f3f6ef]">
                  <tr>
                    <td colSpan={4} className="px-5 py-3.5 font-bold">Total outstanding</td>
                    <td className="px-5 py-3.5 text-right font-bold">{inr(totalInvoiced)}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-[#15803d]">{inr(totalCollected)}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-[#1d4ed8]">{inr(grandTotal)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Aging insight */}
          {bucketTotals.slice(2).some((b) => b.count > 0) && (
            <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-5">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-[#dc2626]" />
                <div>
                  <p className="font-semibold text-[#dc2626]">Overdue invoices need attention</p>
                  <p className="mt-1 text-sm text-[#7f1d1d]">
                    {inr(bucketTotals.slice(2).reduce((s, b) => s + b.total, 0))} is overdue by more than 60 days.
                    Consider following up with Sarvani Biofuels or reviewing credit terms.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>("Dashboard");
  const { fy: globalFy } = useGlobalFY();
  const [fy, setFy]   = useState<FYPeriod>(() => {
    // initialise from global; the local picker still allows override
    const match = FY_LIST.find((f) => f.label === globalFy.label);
    return match ?? FY_LIST[0];
  });

  // Keep in sync when user changes the global FY picker in the header
  useEffect(() => {
    const match = FY_LIST.find((f) => f.label === globalFy.label);
    if (match) setFy(match);
  }, [globalFy.label]);

  return (
    <div className="grid gap-5">
      {/* Tab bar + FY picker on the same row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2 overflow-x-auto">
          {TABS.map((t) => {
            const TabIcon = FIN_TAB_ICONS[t];
            return (
              <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold transition-all flex items-center gap-1.5 ${tab === t ? "bg-[var(--ink)] text-white shadow-sm" : "border border-[var(--border)] bg-[var(--card)] text-[var(--ink-2)] hover:bg-[var(--muted)]"}`}>
                <TabIcon size={14} />{t}
              </button>
            );
          })}
        </div>
        <div className="ml-auto">
          <FYPicker selected={fy} onChange={setFy} />
        </div>
      </div>

      {tab === "Dashboard"   && <DashboardTab   fy={fy} />}
      {tab === "P&L"         && <PLTab          fy={fy} />}
      {tab === "Receivables" && <ReceivablesTab fy={fy} />}
      {tab === "Payables"    && <PayablesTab    fy={fy} />}
      {tab === "AR Aging"    && <ARAgingTab     fy={fy} />}
    </div>
  );
}
