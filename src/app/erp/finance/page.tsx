"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { LedgerEntry } from "../../../lib/types";
import {
  TrendingUp, BarChart3, Wallet, AlertCircle,
  ArrowUpCircle, ArrowDownCircle, RefreshCw, ChevronDown, ChevronRight,
  CheckCircle2, User,
} from "lucide-react";

const TABS = ["Dashboard", "P&L", "Receivables", "Payables"] as const;
type Tab = (typeof TABS)[number];

const FIN_TAB_ICONS = {
  "Dashboard": TrendingUp,
  "P&L": BarChart3,
  "Receivables": ArrowUpCircle,
  "Payables": ArrowDownCircle,
} as const;

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

// Derive the closing balance for an account from its entries (last runningBalance)
function closingBalance(entries: LedgerEntry[]): number {
  if (entries.length === 0) return 0;
  return entries[entries.length - 1].runningBalance;
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function DashboardTab() {
  const [byAccount, setByAccount] = useState<Record<string, LedgerEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ACCOUNTS = ["1201", "2101", "3100", "3200", "4101", "4102", "5001", "5101"];

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all(
      ACCOUNTS.map((code) =>
        fetch(`/api/ledger?accountCode=${code}`)
          .then((r) => r.json())
          .then((data): [string, LedgerEntry[]] => [code, Array.isArray(data) ? data : []])
      )
    )
      .then((pairs) => {
        setByAccount(Object.fromEntries(pairs));
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="py-8 text-center text-sm text-[#60735d]">Loading financial data…</p>;
  if (error) return <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-5 text-[#b91c1c]">{error}</div>;

  const receivable = (byAccount["1201"] ?? []).reduce((s, e) => s + e.debit - e.credit, 0);
  const payable = (byAccount["2101"] ?? []).reduce((s, e) => s + e.credit - e.debit, 0);
  const sales = (byAccount["3100"] ?? []).reduce((s, e) => s + e.credit, 0);
  const cess = (byAccount["5101"] ?? []).reduce((s, e) => s + e.debit, 0);
  const moistureDed = (byAccount["4101"] ?? []).reduce((s, e) => s + e.debit, 0);
  const fmDed = (byAccount["4102"] ?? []).reduce((s, e) => s + e.debit, 0);
  const margin = (byAccount["3200"] ?? []).reduce((s, e) => s + e.credit, 0);
  const totalDeductions = moistureDed + fmDed + cess;
  const netProfit = margin;

  const kpis = [
    {
      label: "Sarvani receivable",
      value: inr(Math.abs(receivable)),
      sub: receivable > 0 ? "Outstanding from Sarvani (1201 Dr)" : receivable < 0 ? "We owe Sarvani" : "Nil",
      color: "text-[#1d4ed8]",
      border: "border-[#bfdbfe]",
      bg: "bg-white",
      icon: ArrowUpCircle,
    },
    {
      label: "Supplier payable",
      value: inr(Math.abs(payable)),
      sub: payable > 0 ? "Owed to suppliers (2101 Cr)" : payable < 0 ? "Suppliers owe us" : "Nil",
      color: "text-[#d97706]",
      border: "border-[#fde68a]",
      bg: "bg-[#fffbeb]",
      icon: ArrowDownCircle,
    },
    {
      label: "Akshaya margin (3200)",
      value: inr(margin),
      sub: "Net service margin earned across settled lots",
      color: "text-[#172018]",
      border: "border-[#d8ff72]",
      bg: "bg-[#f9ffe6]",
      icon: BarChart3,
    },
    {
      label: "Pass-through deductions",
      value: inr(totalDeductions),
      sub: `Moisture ${inr(moistureDed)} · FM ${inr(fmDed)} · Cess ${inr(cess)} (Dr-side customer)`,
      color: "text-[#60735d]",
      border: "border-[#c8d4c0]",
      bg: "bg-white",
      icon: AlertCircle,
    },
  ];

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Financial Dashboard</h3>
          <p className="mt-0.5 text-sm text-[#60735d]">Live from ledger — fetched accounts 1201, 3100, 3200, 4101, 4102, 5101</p>
        </div>
        <button onClick={load} className="btn btn-ghost flex items-center gap-1.5"><RefreshCw size={14} />Refresh</button>
      </div>

      {/* KPI tiles */}
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

      {/* P&L summary note */}
      <div className="rounded-xl border border-[#c8d4c0] bg-[#f3f6ef] p-5">
        <div className="flex items-start gap-3">
          <TrendingUp size={18} className="mt-0.5 shrink-0 text-[#60735d]" />
          <div>
            <p className="font-semibold text-[#172018]">Net profit = service margin only</p>
            <p className="mt-1.5 text-sm text-[#60735d]">
              Akshaya earns <strong>{inr(margin)}</strong> in service margin (₹/MT × net weight) across all settled lots.
              Sales (3100) and procurement (5001) are both posted at gross notional, so they cancel to zero.
              Quality deductions and cess are pass-through costs — they reduce both the customer receivable and the supplier payment, netting to zero in Akshaya&apos;s P&L.
              The Supplier payable (2101) balance of <strong>{inr(payable)}</strong> is the amount Akshaya owes suppliers pending cash payment.
            </p>
            <p className="mt-2 text-sm text-[#60735d]">
              Remaining gap: mandi gate-paid cess (₹/lot) is not yet automated — once posted (Dr Bank, Cr 5101), account 5101 will net to zero.
            </p>
          </div>
        </div>
      </div>

      {/* Quick breakdown table */}
      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-semibold">Account balances snapshot</h3>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-[0.1em] text-[#60735d]">
            <tr>
              <th className="px-5 py-3.5">Account code</th>
              <th className="px-5 py-3.5">Description</th>
              <th className="px-5 py-3.5 text-right">Entries</th>
              <th className="px-5 py-3.5 text-right">Total Dr</th>
              <th className="px-5 py-3.5 text-right">Total Cr</th>
            </tr>
          </thead>
          <tbody>
            {[
              { code: "1201", label: "Sarvani Biofuels — Receivable (Dr normal)" },
              { code: "2101", label: "Supplier Payable (Cr normal)" },
              { code: "3100", label: "Sales — Commodity (Cr normal)" },
              { code: "3200", label: "Akshaya Trading Margin (Cr normal)" },
              { code: "4101", label: "Quality Loss — Moisture (pass-through)" },
              { code: "4102", label: "Quality Loss — FM (pass-through)" },
              { code: "5001", label: "Procurement — Commodity (offsets 3100)" },
              { code: "5101", label: "Market Cess (pass-through)" },
            ].map(({ code, label }) => {
              const es = byAccount[code] ?? [];
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
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── P&L ──────────────────────────────────────────────────────────────────────

function PLTab() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/ledger")
      .then((r) => r.json())
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Helper: net Dr balance for an account (Dr - Cr)
  const netDr = (code: string) =>
    entries.filter((e) => e.accountCode === code).reduce((s, e) => s + e.debit - e.credit, 0);
  const netCr = (code: string) =>
    entries.filter((e) => e.accountCode === code).reduce((s, e) => s + e.credit - e.debit, 0);

  // Income: Cr-normal accounts
  const totalSales   = netCr("3100");  // gross notional billed to Sarvani
  const totalMargin  = netCr("3200");  // Akshaya's service margin
  const totalIncome  = totalSales + totalMargin;

  // Expenses / offsets: 5001 nets against 3100; quality and cess are pass-throughs
  const totalProcurement = netDr("5001");  // same as 3100 — nets to zero
  const totalMoisture    = netDr("4101");  // customer Dr - supplier Cr → 0 net pass-through
  const totalFM          = netDr("4102");  // same
  const totalHold        = netDr("4199");  // hold penalty (if any)
  const totalCess        = netDr("5101");  // customer Dr - supplier Cr → net = cessPaid (gate entry pending)
  const totalExpenses    = totalProcurement + totalMoisture + totalFM + totalHold + Math.max(0, totalCess);

  const netProfit = totalIncome - totalExpenses;

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
  ];

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Profit & Loss Statement</h3>
          <p className="mt-0.5 text-sm text-[#60735d]">Computed from all posted ledger entries</p>
        </div>
        <button onClick={load} className="btn btn-ghost flex items-center gap-1.5"><RefreshCw size={14} />Refresh</button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-[#60735d]">Loading entries…</p>
      ) : (
        <>
          {/* Summary KPIs */}
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

          {/* P&L statement */}
          <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
            {/* Income section */}
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

            {/* Expenses section */}
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

            {/* Net profit row */}
            <div className={`border-t-2 border-[#172018] px-5 py-4 ${netProfit >= 0 ? "bg-[#f9ffe6]" : "bg-[#fef2f2]"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-lg font-bold text-[#172018]">Net Profit / (Loss)</span>
                  <p className="text-xs text-[#60735d] mt-0.5">= Service Margin (3200) — pass-throughs net to zero</p>
                </div>
                <span className={`text-2xl font-bold ${netProfit >= 0 ? "text-[#172018]" : "text-[#dc2626]"}`}>{inr(netProfit)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── SHARED HELPERS ───────────────────────────────────────────────────────────

// Compute running balance client-side (stored value is always 0).
// normalBalance "Dr" → bal += debit - credit;  "Cr" → bal += credit - debit.
// Returns entries sorted oldest→newest with accumulating bal, then reversed for display.
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
  return result.reverse(); // newest first for display
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
                <span className={`ml-1 text-xs ${
                  (normalBalance === "Dr" ? e.runBal >= 0 : e.runBal <= 0)
                    ? "text-[#15803d]" : "text-[#dc2626]"
                }`}>
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

function ReceivablesTab() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/ledger?accountCode=1201")
      .then((r) => r.json())
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => withRunningBalance(entries, "Dr"), [entries]);
  const totalDr  = entries.reduce((s, e) => s + e.debit,  0);
  const totalCr  = entries.reduce((s, e) => s + e.credit, 0);
  const balance  = totalDr - totalCr;

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Receivables — Sarvani Biofuels</h3>
          <p className="mt-0.5 text-sm text-[#60735d]">Account 1201 · Dr-normal · Settlements add Dr, receipts reduce via Cr</p>
        </div>
        <button onClick={load} className="btn btn-ghost flex items-center gap-1.5"><RefreshCw size={14} />Refresh</button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-[#60735d]">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-[#d8decf] bg-white p-10 text-center">
          <ArrowUpCircle size={32} className="mx-auto mb-3 text-[#c8d4c0]" />
          <p className="font-semibold">No entries on account 1201 yet</p>
          <p className="mt-1 text-sm text-[#60735d]">Posted once a lot is settled.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[#bfdbfe] bg-white p-5">
              <p className="text-sm text-[#60735d]">Outstanding receivable</p>
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
              <p className="text-sm text-[#60735d]">Receipts collected (Cr)</p>
              <p className="mt-2 text-3xl font-bold text-[#15803d]">{inr(totalCr)}</p>
              {totalCr > 0 && <p className="mt-1 text-xs text-[#60735d]">{Math.round((totalCr / totalDr) * 100)}% collected</p>}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
            <div className="border-b border-[#edf0e8] px-5 py-4">
              <h3 className="text-lg font-semibold">Sarvani account statement</h3>
            </div>
            <LedgerTable rows={rows} normalBalance="Dr" />
          </div>
        </>
      )}
    </div>
  );
}

// ─── PAYABLES ─────────────────────────────────────────────────────────────────

function PayablesTab() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedParty, setExpandedParty] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/ledger?accountCode=2101")
      .then((r) => r.json())
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalDr = entries.reduce((s, e) => s + e.debit, 0);
  const totalCr = entries.reduce((s, e) => s + e.credit, 0);
  const netPayable = totalCr - totalDr; // Cr-normal: how much we owe

  // Group entries by supplier party for sub-ledger view
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
          <p className="mt-0.5 text-sm text-[#60735d]">Account 2101 · per-supplier breakdown · click a row to see statement</p>
        </div>
        <button onClick={load} className="btn btn-ghost flex items-center gap-1.5"><RefreshCw size={14} />Refresh</button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-[#60735d]">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-[#d8decf] bg-white p-10 text-center">
          <ArrowDownCircle size={32} className="mx-auto mb-3 text-[#c8d4c0]" />
          <p className="font-semibold text-[#172018]">No supplier payable entries yet</p>
          <p className="mt-1 text-sm text-[#60735d]">Posted when a lot is settled (Cr 2101) and when a payment is made to a supplier (Dr 2101).</p>
        </div>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-5">
              <p className="text-sm text-[#60735d]">Total outstanding payable</p>
              <p className={`mt-2 text-3xl font-bold ${netPayable > 0 ? "text-[#d97706]" : "text-[#15803d]"}`}>
                {inr(Math.abs(netPayable))}
                <span className="ml-1 text-base font-semibold">{netPayable > 0 ? "Cr" : "Dr"}</span>
              </p>
              <p className="mt-1 text-xs text-[#60735d]">{suppliers.filter(s => s.payable > 0).length} supplier{suppliers.filter(s => s.payable > 0).length !== 1 ? "s" : ""} with open balance</p>
            </div>
            <div className="rounded-xl border border-[#d8decf] bg-white p-5">
              <p className="text-sm text-[#60735d]">Total invoiced to suppliers (Cr)</p>
              <p className="mt-2 text-3xl font-bold text-[#dc2626]">{inr(totalCr)}</p>
            </div>
            <div className="rounded-xl border border-[#d8decf] bg-white p-5">
              <p className="text-sm text-[#60735d]">Total paid to suppliers (Dr)</p>
              <p className="mt-2 text-3xl font-bold text-[#1d4ed8]">{inr(totalDr)}</p>
              {totalCr > 0 && <p className="mt-1 text-xs text-[#60735d]">{Math.round((totalDr / totalCr) * 100)}% settled</p>}
            </div>
          </div>

          {/* Per-supplier sub-ledger */}
          <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
            <div className="border-b border-[#edf0e8] px-5 py-4">
              <h3 className="text-lg font-semibold">Supplier-wise payable</h3>
              <p className="text-xs text-[#60735d] mt-0.5">Click any supplier to see their full account statement</p>
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
                            {s.partyName} — account statement (2101)
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

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>("Dashboard");
  return (
    <div className="grid gap-5">
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
      {tab === "Dashboard" && <DashboardTab />}
      {tab === "P&L" && <PLTab />}
      {tab === "Receivables" && <ReceivablesTab />}
      {tab === "Payables" && <PayablesTab />}
    </div>
  );
}
