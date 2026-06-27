"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
  Package,
  DollarSign,
  CheckCircle2,
  Receipt,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Loader2,
  Search,
} from "lucide-react";
import type { InwardLot, LedgerEntry, Invoice, Material, Party, LotStatus } from "../../../lib/types";
import { useFY as useGlobalFY } from "../fy-context";

// ── Voucher type (API returns these) ────────────────────────────────────────
interface Voucher {
  id: string;
  voucherNo: string;
  voucherType: "Receipt" | "Payment" | "Expense" | "Drawing";
  voucherDate: string;
  partyId: string | null;
  partyName: string;
  amount: number;
  paymentMode: string;
  bankRef: string;
  narration: string;
  status: string;
  allocatedTo: string[];
}

// ── Period types ─────────────────────────────────────────────────────────────
type QuickPeriod = "today" | "week" | "month" | "quarter" | "all" | "custom";
interface Period {
  quick: QuickPeriod;
  from: string;
  to: string;
}

function periodBounds(q: QuickPeriod): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (q === "today") return { from: fmt(today), to: fmt(today) };
  if (q === "week") {
    const mon = new Date(today);
    mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return { from: fmt(mon), to: fmt(today) };
  }
  if (q === "month")
    return {
      from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: fmt(today),
    };
  if (q === "quarter") {
    const qs = new Date(
      today.getFullYear(),
      Math.floor(today.getMonth() / 3) * 3,
      1
    );
    return { from: fmt(qs), to: fmt(today) };
  }
  return { from: "2020-01-01", to: "2099-12-31" };
}

function inPeriod(date: string, p: Period): boolean {
  return date >= p.from && date <= p.to;
}

// ── Formatting helpers ────────────────────────────────────────────────────────
const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const fmt2 = (n: number) => n.toFixed(2);

// ── Shared components ────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "amber" | "red";
}) {
  const subCls =
    accent === "green"
      ? "text-[#15803d]"
      : accent === "amber"
      ? "text-[#d97706]"
      : accent === "red"
      ? "text-[#dc2626]"
      : "text-[#9aad9c]";
  return (
    <div className="rounded-xl border border-[#d8decf] bg-white p-5">
      <p className="text-sm text-[#60735d]">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      {sub && <p className={`mt-1 text-xs ${subCls}`}>{sub}</p>}
    </div>
  );
}

function HBar({
  label,
  value,
  max,
  sub,
}: {
  label: string;
  value: number;
  max: number;
  sub?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-sm font-semibold text-[#2a3a28] truncate">
        {label}
      </span>
      <div className="flex-1 h-5 rounded-full bg-[#eef3e8]">
        <div
          className="h-5 rounded-full bg-[#172018] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-36 shrink-0 text-right text-sm font-bold text-[#60735d]">
        {sub ?? fmt2(value)}
      </span>
    </div>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
      <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {action && <div>{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#9aad9c]">
      <AlertCircle size={36} />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-[#60735d]">
      <Loader2 size={24} className="animate-spin" />
      <span className="text-sm">Loading data…</span>
    </div>
  );
}

// ── Period bar ────────────────────────────────────────────────────────────────

const QUICK_LABELS: { key: QuickPeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "quarter", label: "This Quarter" },
  { key: "all", label: "All Time" },
  { key: "custom", label: "Custom" },
];

function PeriodBar({
  period,
  onChange,
  lastUpdated,
}: {
  period: Period;
  onChange: (p: Period) => void;
  lastUpdated: string | null;
}) {
  function selectQuick(q: QuickPeriod) {
    if (q === "custom") {
      onChange({ quick: "custom", from: period.from, to: period.to });
    } else {
      const bounds = periodBounds(q);
      onChange({ quick: q, from: bounds.from, to: bounds.to });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#d8decf] bg-white px-4 py-3">
      <div className="flex flex-wrap gap-1.5">
        {QUICK_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => selectQuick(key)}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              period.quick === key
                ? "bg-[#172018] text-white"
                : "border border-[#c8d4c0] bg-white text-[#536251] hover:bg-[#f0f4ec]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {period.quick === "custom" && (
        <div className="flex items-center gap-2 ml-2">
          <input
            type="date"
            value={period.from}
            onChange={(e) =>
              onChange({ ...period, from: e.target.value })
            }
            className="rounded-md border border-[#c8d4c0] px-2 py-1 text-xs"
          />
          <span className="text-xs text-[#60735d]">to</span>
          <input
            type="date"
            value={period.to}
            onChange={(e) =>
              onChange({ ...period, to: e.target.value })
            }
            className="rounded-md border border-[#c8d4c0] px-2 py-1 text-xs"
          />
        </div>
      )}
      {lastUpdated && (
        <span className="ml-auto text-xs text-[#9aad9c]">
          Last updated {lastUpdated}
        </span>
      )}
    </div>
  );
}

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = ["Overview", "Procurement", "Financials", "Settlement", "GST"] as const;
type Tab = (typeof TABS)[number];

const TAB_ICONS: Record<Tab, React.ElementType> = {
  Overview: LayoutDashboard,
  Procurement: Package,
  Financials: DollarSign,
  Settlement: CheckCircle2,
  GST: Receipt,
};

// ── Data bundle ───────────────────────────────────────────────────────────────
interface DataBundle {
  lots: InwardLot[];
  ledger: LedgerEntry[];
  vouchers: Voucher[];
  invoices: Invoice[];
  materials: Material[];
  parties: Party[];
}

// ── Lot status pipeline stage config ─────────────────────────────────────────
const PIPELINE_STAGES: {
  status: LotStatus;
  label: string;
  color: string;
  dot: string;
}[] = [
  { status: "Draft", label: "Draft", color: "text-[#6b7280]", dot: "bg-[#9ca3af]" },
  { status: "Mapped", label: "Mapped", color: "text-[#1d4ed8]", dot: "bg-[#3b82f6]" },
  { status: "QualityHold", label: "Quality Hold", color: "text-[#d97706]", dot: "bg-[#f59e0b]" },
  { status: "Approved", label: "Approved", color: "text-[#7c3aed]", dot: "bg-[#8b5cf6]" },
  { status: "Settled", label: "Settled", color: "text-[#15803d]", dot: "bg-[#22c55e]" },
  { status: "Invoiced", label: "Invoiced", color: "text-[#065f46]", dot: "bg-[#10b981]" },
];

// ── TAB 1: Overview ───────────────────────────────────────────────────────────

function OverviewTab({
  data,
  period,
}: {
  data: DataBundle;
  period: Period;
}) {
  const { lots, ledger } = data;

  const periodLots = useMemo(
    () => lots.filter((l) => inPeriod(l.lotDate, period)),
    [lots, period]
  );

  const periodLedger = useMemo(
    () => ledger.filter((e) => inPeriod(e.entryDate, period)),
    [ledger, period]
  );

  // KPI calculations
  const settledCount = useMemo(
    () => periodLots.filter((l) => l.status === "Settled" || l.status === "Invoiced").length,
    [periodLots]
  );
  const holdCount = useMemo(
    () => periodLots.filter((l) => l.status === "QualityHold").length,
    [periodLots]
  );

  const totalVolume = useMemo(
    () => periodLots.reduce((s, l) => s + l.netWeight, 0),
    [periodLots]
  );
  const settledVolume = useMemo(
    () =>
      periodLots
        .filter((l) => l.status === "Settled" || l.status === "Invoiced")
        .reduce((s, l) => s + l.netWeight, 0),
    [periodLots]
  );

  // Revenue (account 3100 net Cr in period)
  const revenue3100 = useMemo(() => {
    const entries = periodLedger.filter((e) => e.accountCode === "3100");
    return entries.reduce((s, e) => s + e.credit - e.debit, 0);
  }, [periodLedger]);

  // Margin (account 3200 net Cr in period)
  const margin3200 = useMemo(() => {
    const entries = periodLedger.filter((e) => e.accountCode === "3200");
    return entries.reduce((s, e) => s + e.credit - e.debit, 0);
  }, [periodLedger]);
  const marginPerMT = totalVolume > 0 ? margin3200 / totalVolume : 0;

  // Customer outstanding (1201 all-time net Dr)
  const customerOutstanding = useMemo(() => {
    const all1201 = ledger.filter((e) => e.accountCode === "1201");
    return all1201.reduce((s, e) => s + e.debit - e.credit, 0);
  }, [ledger]);

  // Supplier payable (2101 all-time net Cr)
  const supplierPayable = useMemo(() => {
    const all2101 = ledger.filter((e) => e.accountCode === "2101");
    return all2101.reduce((s, e) => s + e.credit - e.debit, 0);
  }, [ledger]);

  const supplierCount = useMemo(() => {
    const suppliers = new Set(
      ledger
        .filter((e) => e.accountCode === "2101" && e.partyName)
        .map((e) => e.partyName)
    );
    return suppliers.size;
  }, [ledger]);

  // Pipeline counts
  const pipelineCounts = useMemo(() => {
    const counts: Record<LotStatus, number> = {
      Draft: 0,
      Mapped: 0,
      QualityHold: 0,
      Approved: 0,
      Settled: 0,
      Invoiced: 0,
    };
    for (const l of periodLots) counts[l.status] = (counts[l.status] ?? 0) + 1;
    return counts;
  }, [periodLots]);

  // Material volume chart
  const materialVolumes = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of periodLots) {
      map.set(l.materialName, (map.get(l.materialName) ?? 0) + l.netWeight);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [periodLots]);

  const maxMaterialVol =
    materialVolumes.length > 0 ? materialVolumes[0][1] : 1;
  const totalMaterialVol = materialVolumes.reduce((s, [, v]) => s + v, 0);

  // Quality deduction summary
  const paramDeductionSummary = useMemo(() => {
    const map = new Map<string, { total: number; lots: number }>();
    for (const l of periodLots.filter(
      (l) => l.status === "Settled" || l.status === "Invoiced"
    )) {
      for (const [key, val] of Object.entries(l.paramDeductions)) {
        const existing = map.get(key) ?? { total: 0, lots: 0 };
        map.set(key, { total: existing.total + val, lots: existing.lots + 1 });
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 3);
  }, [periodLots]);

  return (
    <div className="grid gap-6">
      {/* KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiTile
          label="Lots Received"
          value={String(periodLots.length)}
          sub={`${settledCount} settled · ${holdCount} on hold`}
        />
        <KpiTile
          label="Inward Volume"
          value={`${fmt2(totalVolume)} MT`}
          sub={`${fmt2(settledVolume)} MT settled`}
          accent="green"
        />
        <KpiTile
          label="Revenue Posted"
          value={inr(revenue3100)}
          sub="from settled lots"
          accent="green"
        />
        <KpiTile
          label="Margin Earned"
          value={inr(margin3200)}
          sub={`${inr(marginPerMT)}/MT avg`}
          accent="green"
        />
        <KpiTile
          label="Customer Outstanding"
          value={inr(Math.max(0, customerOutstanding))}
          sub="receivable from Sarvani"
          accent={customerOutstanding > 0 ? "amber" : undefined}
        />
        <KpiTile
          label="Supplier Payable"
          value={inr(Math.max(0, supplierPayable))}
          sub={`${supplierCount} supplier${supplierCount !== 1 ? "s" : ""}`}
          accent={supplierPayable > 0 ? "amber" : undefined}
        />
      </div>

      {/* Lot Status Pipeline */}
      <SectionCard title="Lot Status Pipeline">
        {periodLots.length === 0 ? (
          <EmptyState message="No lots in this period" />
        ) : (
          <div className="flex flex-wrap items-center gap-1 overflow-x-auto py-2">
            {PIPELINE_STAGES.map((stage, idx) => (
              <div key={stage.status} className="flex items-center gap-1">
                <div className="flex items-center gap-2 rounded-lg border border-[#d8decf] px-3 py-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${stage.dot}`} />
                  <span className={`text-sm font-medium ${stage.color}`}>
                    {stage.label}
                  </span>
                  <span className="ml-1 rounded-md bg-[#f0f4ec] px-2 py-0.5 text-xs font-bold text-[#172018]">
                    {pipelineCounts[stage.status] ?? 0}
                  </span>
                </div>
                {idx < PIPELINE_STAGES.length - 1 && (
                  <ChevronRight size={14} className="text-[#c8d4c0] shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Material Volume Chart */}
      <SectionCard title="Material Volume (Top 5)">
        {materialVolumes.length === 0 ? (
          <EmptyState message="No lot data in this period" />
        ) : (
          <div className="grid gap-3">
            {materialVolumes.map(([name, vol]) => {
              const pct =
                totalMaterialVol > 0 ? (vol / totalMaterialVol) * 100 : 0;
              return (
                <HBar
                  key={name}
                  label={name}
                  value={vol}
                  max={maxMaterialVol}
                  sub={`${fmt2(vol)} MT (${pct.toFixed(1)}%)`}
                />
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Quality Deduction Summary */}
      <SectionCard title="Top Quality Deductions (Settled Lots)">
        {paramDeductionSummary.length === 0 ? (
          <EmptyState message="No quality deductions recorded in this period" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {paramDeductionSummary.map(([key, { total, lots }]) => (
              <div
                key={key}
                className="rounded-xl border border-[#d8decf] bg-[#fafcf8] p-4"
              >
                <p className="text-xs font-mono text-[#60735d]">{key}</p>
                <p className="mt-1 text-xl font-bold text-[#dc2626]">
                  {inr(total)}
                </p>
                <p className="mt-0.5 text-xs text-[#9aad9c]">
                  {lots} lot{lots !== 1 ? "s" : ""} affected
                </p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── TAB 2: Procurement ────────────────────────────────────────────────────────

function ProcurementTab({
  data,
  period,
}: {
  data: DataBundle;
  period: Period;
}) {
  const { lots } = data;

  const periodLots = useMemo(
    () => lots.filter((l) => inPeriod(l.lotDate, period)),
    [lots, period]
  );

  const totalMT = useMemo(
    () => periodLots.reduce((s, l) => s + l.netWeight, 0),
    [periodLots]
  );

  const qualityHoldRate = useMemo(() => {
    const nonDraft = periodLots.filter((l) => l.status !== "Draft").length;
    if (nonDraft === 0) return 0;
    const held = periodLots.filter((l) => l.status === "QualityHold").length;
    return (held / nonDraft) * 100;
  }, [periodLots]);

  const settlementRate = useMemo(() => {
    if (periodLots.length === 0) return 0;
    const settled = periodLots.filter(
      (l) => l.status === "Settled" || l.status === "Invoiced"
    ).length;
    return (settled / periodLots.length) * 100;
  }, [periodLots]);

  // Supplier performance
  interface SupplierRow {
    name: string;
    lots: number;
    totalMT: number;
    totalDeductions: number;
    grossSaleValue: number;
    avgDeductionPct: number;
    netPayout: number;
    statusBreakdown: Partial<Record<LotStatus, number>>;
  }

  const supplierRows = useMemo((): SupplierRow[] => {
    const map = new Map<string, SupplierRow>();
    for (const l of periodLots.filter(
      (l) => l.status === "Settled" || l.status === "Invoiced"
    )) {
      const name = l.supplierName ?? l.farmerName ?? "Unknown";
      const existing = map.get(name) ?? {
        name,
        lots: 0,
        totalMT: 0,
        totalDeductions: 0,
        grossSaleValue: 0,
        avgDeductionPct: 0,
        netPayout: 0,
        statusBreakdown: {},
      };
      const deductions = Object.values(l.paramDeductions).reduce(
        (s, v) => s + v,
        0
      );
      const netPayout =
        l.grossSaleValue -
        l.cessAmount -
        l.akshayaMarginPerMT * l.netWeight -
        l.holdPenalty;
      const sb = { ...existing.statusBreakdown };
      sb[l.status] = (sb[l.status] ?? 0) + 1;
      map.set(name, {
        name,
        lots: existing.lots + 1,
        totalMT: existing.totalMT + l.netWeight,
        totalDeductions: existing.totalDeductions + deductions,
        grossSaleValue: existing.grossSaleValue + l.grossSaleValue,
        avgDeductionPct: 0,
        netPayout: existing.netPayout + netPayout,
        statusBreakdown: sb,
      });
    }
    return Array.from(map.values())
      .map((r) => ({
        ...r,
        avgDeductionPct:
          r.grossSaleValue > 0
            ? (r.totalDeductions / r.grossSaleValue) * 100
            : 0,
      }))
      .sort((a, b) => b.totalMT - a.totalMT);
  }, [periodLots]);

  // Quality analysis
  interface QualityParamRow {
    key: string;
    readings: number;
    min: number;
    max: number;
    avg: number;
    totalDeduction: number;
    lotsWithDeduction: number;
  }

  const qualityRows = useMemo((): QualityParamRow[] => {
    const map = new Map<string, { vals: number[]; deduction: number; lots: number }>();
    for (const l of periodLots) {
      for (const [key, val] of Object.entries(l.qualityReadings)) {
        const num = typeof val === "number" ? val : parseFloat(val);
        if (isNaN(num)) continue;
        const existing = map.get(key) ?? { vals: [], deduction: 0, lots: 0 };
        existing.vals.push(num);
        const ded = l.paramDeductions[key] ?? 0;
        if (ded > 0) {
          existing.deduction += ded;
          existing.lots += 1;
        }
        map.set(key, existing);
      }
    }
    return Array.from(map.entries()).map(([key, { vals, deduction, lots }]) => ({
      key,
      readings: vals.length,
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: vals.reduce((s, v) => s + v, 0) / vals.length,
      totalDeduction: deduction,
      lotsWithDeduction: lots,
    }));
  }, [periodLots]);

  const STATUS_BADGE_STYLE: Partial<Record<LotStatus, string>> = {
    Draft: "bg-gray-100 text-gray-600",
    Mapped: "bg-blue-100 text-blue-700",
    QualityHold: "bg-amber-100 text-amber-700",
    Approved: "bg-purple-100 text-purple-700",
    Settled: "bg-green-100 text-green-700",
    Invoiced: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="grid gap-6">
      {/* Stats bar */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Total Lots" value={String(periodLots.length)} />
        <KpiTile
          label="Total MT Received"
          value={`${fmt2(totalMT)} MT`}
          accent="green"
        />
        <KpiTile
          label="Quality Hold Rate"
          value={`${qualityHoldRate.toFixed(1)}%`}
          accent={qualityHoldRate > 15 ? "red" : qualityHoldRate > 5 ? "amber" : undefined}
        />
        <KpiTile
          label="Settlement Rate"
          value={`${settlementRate.toFixed(1)}%`}
          accent={settlementRate > 80 ? "green" : settlementRate > 50 ? "amber" : "red"}
        />
      </div>

      {/* Supplier performance */}
      <SectionCard title="Supplier Performance (Settled Lots)">
        {supplierRows.length === 0 ? (
          <EmptyState message="No settled lots in this period" />
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-widest text-[#60735d]">
                <tr>
                  {[
                    "Supplier",
                    "Lots",
                    "Total MT",
                    "Total Deductions",
                    "Avg Deduction %",
                    "Net Payout",
                    "Status",
                  ].map((h) => (
                    <th key={h} className="px-5 py-3.5 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {supplierRows.map((row) => (
                  <tr
                    key={row.name}
                    className="border-t border-[#edf0e8] hover:bg-[#fafcf8]"
                  >
                    <td className="px-5 py-3.5 font-semibold">{row.name}</td>
                    <td className="px-5 py-3.5">{row.lots}</td>
                    <td className="px-5 py-3.5 font-bold">
                      {fmt2(row.totalMT)} MT
                    </td>
                    <td className="px-5 py-3.5 text-[#dc2626]">
                      {inr(row.totalDeductions)}
                    </td>
                    <td className="px-5 py-3.5">
                      {row.avgDeductionPct.toFixed(2)}%
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-[#15803d]">
                      {inr(row.netPayout)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {(
                          Object.entries(row.statusBreakdown) as [
                            LotStatus,
                            number
                          ][]
                        ).map(([st, cnt]) => (
                          <span
                            key={st}
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              STATUS_BADGE_STYLE[st] ??
                              "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {st} {cnt}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Quality analysis */}
      <SectionCard title="Quality Parameter Analysis">
        {qualityRows.length === 0 ? (
          <EmptyState message="No quality readings in this period" />
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-widest text-[#60735d]">
                <tr>
                  {[
                    "Parameter",
                    "Readings",
                    "Min",
                    "Max",
                    "Avg",
                    "Total Deduction",
                    "Lots Affected",
                  ].map((h) => (
                    <th key={h} className="px-5 py-3.5 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {qualityRows.map((row) => (
                  <tr
                    key={row.key}
                    className="border-t border-[#edf0e8] hover:bg-[#fafcf8]"
                  >
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold">
                      {row.key}
                    </td>
                    <td className="px-5 py-3.5">{row.readings}</td>
                    <td className="px-5 py-3.5">{fmt2(row.min)}</td>
                    <td className="px-5 py-3.5">{fmt2(row.max)}</td>
                    <td className="px-5 py-3.5 font-bold">{fmt2(row.avg)}</td>
                    <td className="px-5 py-3.5 text-[#dc2626]">
                      {row.totalDeduction > 0 ? inr(row.totalDeduction) : "—"}
                    </td>
                    <td className="px-5 py-3.5">{row.lotsWithDeduction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── TAB 3: Financials ─────────────────────────────────────────────────────────

function FinancialsTab({
  data,
  period,
}: {
  data: DataBundle;
  period: Period;
}) {
  const { ledger } = data;
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

  const periodLedger = useMemo(
    () => ledger.filter((e) => inPeriod(e.entryDate, period)),
    [ledger, period]
  );

  // Receivables (1201)
  const receivables = useMemo(() => {
    const period1201 = periodLedger.filter((e) => e.accountCode === "1201");
    const totalDr = period1201.reduce((s, e) => s + e.debit, 0);
    const totalCr = period1201.reduce((s, e) => s + e.credit, 0);
    const all1201 = ledger.filter((e) => e.accountCode === "1201");
    const outstanding = all1201.reduce((s, e) => s + e.debit - e.credit, 0);
    const efficiency = totalDr > 0 ? (totalCr / totalDr) * 100 : 0;
    return { totalDr, totalCr, outstanding, efficiency };
  }, [periodLedger, ledger]);

  // Payables by supplier (2101)
  interface SupplierPayable {
    name: string;
    totalCr: number;
    totalDr: number;
    outstanding: number;
    lastActivity: string;
    lines: LedgerEntry[];
  }

  const supplierPayables = useMemo((): SupplierPayable[] => {
    const all2101 = ledger.filter((e) => e.accountCode === "2101");
    const map = new Map<string, LedgerEntry[]>();
    for (const e of all2101) {
      const key = e.partyName ?? "Unknown";
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .map(([name, lines]) => {
        const totalCr = lines.reduce((s, e) => s + e.credit, 0);
        const totalDr = lines.reduce((s, e) => s + e.debit, 0);
        const outstanding = totalCr - totalDr;
        const lastActivity = lines
          .map((e) => e.entryDate)
          .sort()
          .reverse()[0] ?? "";
        return { name, totalCr, totalDr, outstanding, lastActivity, lines };
      })
      .sort((a, b) => b.outstanding - a.outstanding);
  }, [ledger]);

  const totalPayableOutstanding = useMemo(
    () => supplierPayables.reduce((s, r) => s + r.outstanding, 0),
    [supplierPayables]
  );

  // P&L summary
  interface PLRow {
    code: string;
    label: string;
    value: number;
  }
  const plRows = useMemo((): PLRow[] => {
    function netCr(code: string) {
      return periodLedger
        .filter((e) => e.accountCode === code)
        .reduce((s, e) => s + e.credit - e.debit, 0);
    }
    function netDr(code: string) {
      return periodLedger
        .filter((e) => e.accountCode === code)
        .reduce((s, e) => s + e.debit - e.credit, 0);
    }
    const qualityPassthrough = netCr("4101") + netCr("4102") + netCr("4199");
    const opExp = ["5201","5202","5203","5204","5205","5206","5207","5208"]
      .reduce((s, c) => s + netDr(c), 0);
    return [
      { code: "3100", label: "Revenue", value: netCr("3100") },
      { code: "5001", label: "Procurement Cost", value: -netDr("5001") },
      { code: "4xxx", label: "Quality Pass-through", value: qualityPassthrough },
      { code: "5101", label: "Cess Pass-through", value: -netDr("5101") },
      { code: "3200", label: "Service Margin", value: netCr("3200") },
      ...(opExp > 0 ? [{ code: "52xx", label: "Operating Expenses", value: -opExp }] : []),
    ];
  }, [periodLedger]);

  const collectedPct = receivables.totalDr > 0
    ? Math.min(100, (receivables.totalCr / receivables.totalDr) * 100)
    : 0;

  return (
    <div className="grid gap-6">
      {/* Receivables */}
      <SectionCard title="Customer Receivables (Account 1201)">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-5">
          <KpiTile
            label="Billed (Period)"
            value={inr(receivables.totalDr)}
            accent="green"
          />
          <KpiTile
            label="Collected (Period)"
            value={inr(receivables.totalCr)}
            accent="green"
          />
          <KpiTile
            label="Outstanding (All Time)"
            value={inr(Math.max(0, receivables.outstanding))}
            accent={receivables.outstanding > 0 ? "amber" : undefined}
          />
          <KpiTile
            label="Collection Efficiency"
            value={`${receivables.efficiency.toFixed(1)}%`}
            accent={
              receivables.efficiency >= 90
                ? "green"
                : receivables.efficiency >= 60
                ? "amber"
                : "red"
            }
          />
        </div>
        <div>
          <p className="mb-2 text-xs text-[#60735d]">Collection Progress</p>
          <div className="flex h-6 w-full overflow-hidden rounded-full bg-[#fef3c7]">
            <div
              className="h-6 bg-[#15803d] transition-all"
              style={{ width: `${collectedPct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-[#9aad9c]">
            <span>Collected {inr(receivables.totalCr)}</span>
            <span>Outstanding {inr(Math.max(0, receivables.outstanding))}</span>
          </div>
        </div>
      </SectionCard>

      {/* Payables */}
      <SectionCard title="Supplier Payables (Account 2101)">
        {supplierPayables.length === 0 ? (
          <EmptyState message="No supplier payable entries found" />
        ) : (
          <>
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-widest text-[#60735d]">
                  <tr>
                    {[
                      "",
                      "Supplier",
                      "Invoiced / Payable",
                      "Paid",
                      "Outstanding",
                      "Last Activity",
                    ].map((h) => (
                      <th key={h} className="px-5 py-3.5 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {supplierPayables.map((row) => (
                    <React.Fragment key={row.name}>
                      <tr
                        className="cursor-pointer border-t border-[#edf0e8] hover:bg-[#fafcf8]"
                        onClick={() =>
                          setExpandedSupplier(
                            expandedSupplier === row.name ? null : row.name
                          )
                        }
                      >
                        <td className="pl-4 pr-2 py-3.5">
                          {expandedSupplier === row.name ? (
                            <ChevronDown size={14} className="text-[#60735d]" />
                          ) : (
                            <ChevronRight size={14} className="text-[#c8d4c0]" />
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-semibold">{row.name}</td>
                        <td className="px-5 py-3.5">{inr(row.totalCr)}</td>
                        <td className="px-5 py-3.5 text-[#15803d]">
                          {inr(row.totalDr)}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-[#d97706]">
                          {inr(Math.max(0, row.outstanding))}
                        </td>
                        <td className="px-5 py-3.5 text-[#9aad9c] text-xs">
                          {row.lastActivity}
                        </td>
                      </tr>
                      {expandedSupplier === row.name && (
                        <tr key={`${row.name}-expand`}>
                          <td colSpan={6} className="px-5 pb-4 pt-0">
                            <div className="rounded-lg border border-[#edf0e8] overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-[#f8faf5] text-[#60735d]">
                                  <tr>
                                    {["Date", "Narration", "Dr", "Cr", "Ref"].map((h) => (
                                      <th key={h} className="px-4 py-2 text-left">
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.lines
                                    .sort((a, b) =>
                                      b.entryDate.localeCompare(a.entryDate)
                                    )
                                    .slice(0, 10)
                                    .map((line) => (
                                      <tr
                                        key={line.id}
                                        className="border-t border-[#edf0e8]"
                                      >
                                        <td className="px-4 py-2 text-[#9aad9c]">
                                          {line.entryDate}
                                        </td>
                                        <td className="px-4 py-2 max-w-50 truncate">
                                          {line.narration}
                                        </td>
                                        <td className="px-4 py-2 text-[#dc2626]">
                                          {line.debit > 0 ? inr(line.debit) : "—"}
                                        </td>
                                        <td className="px-4 py-2 text-[#15803d]">
                                          {line.credit > 0 ? inr(line.credit) : "—"}
                                        </td>
                                        <td className="px-4 py-2 font-mono text-[#9aad9c]">
                                          {line.sourceRef}
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  <tr className="border-t-2 border-[#172018] bg-[#f8faf5]">
                    <td colSpan={4} className="px-5 py-3.5 font-semibold">
                      Total Outstanding
                    </td>
                    <td className="px-5 py-3.5 font-bold text-[#d97706]">
                      {inr(Math.max(0, totalPayableOutstanding))}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>

      {/* P&L Mini Summary */}
      <SectionCard title="P&L Summary (Period)">
        <div className="overflow-x-auto -mx-5 -mb-5">
          <table className="w-full text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-widest text-[#60735d]">
              <tr>
                <th className="px-5 py-3.5 text-left">Account</th>
                <th className="px-5 py-3.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {plRows.map((row) => (
                <tr
                  key={row.code}
                  className="border-t border-[#edf0e8] hover:bg-[#fafcf8]"
                >
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs text-[#9aad9c] mr-2">
                      {row.code}
                    </span>
                    {row.label}
                  </td>
                  <td
                    className={`px-5 py-3.5 text-right font-bold ${
                      row.value >= 0 ? "text-[#15803d]" : "text-[#dc2626]"
                    }`}
                  >
                    {inr(row.value)}
                  </td>
                </tr>
              ))}
              {(() => {
                const netProfit = plRows.reduce((s, r) => s + r.value, 0);
                return (
                  <tr className="border-t-2 border-[#172018] bg-[#f8faf5]">
                    <td className="px-5 py-3.5 font-semibold">Net Profit</td>
                    <td className={`px-5 py-3.5 text-right font-bold text-xl ${netProfit >= 0 ? "text-[#15803d]" : "text-[#dc2626]"}`}>
                      {inr(netProfit)}
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ── TAB 4: Settlement ─────────────────────────────────────────────────────────

function SettlementTab({
  data,
  period,
}: {
  data: DataBundle;
  period: Period;
}) {
  const { lots, materials } = data;
  const [search, setSearch] = useState("");

  // Compute cessBalance for a lot: (cessRate% × netWeight × rate) − cessPaid
  function lotCessBalance(l: InwardLot): number {
    const mat = materials.find((m) => m.id === l.materialId);
    const cessRate = mat?.cessRate ?? 0;
    const cessTotal = Math.round((cessRate / 100) * l.netWeight * l.grossSaleRate * 100) / 100;
    return Math.max(0, cessTotal - l.cessAmount);
  }

  const settledLots = useMemo(
    () =>
      lots.filter(
        (l) =>
          inPeriod(l.lotDate, period) &&
          (l.status === "Settled" || l.status === "Invoiced")
      ),
    [lots, period]
  );

  const filteredLots = useMemo(() => {
    if (!search.trim()) return settledLots;
    const q = search.toLowerCase();
    return settledLots.filter(
      (l) =>
        l.documentRef.toLowerCase().includes(q) ||
        l.materialName.toLowerCase().includes(q) ||
        (l.supplierName ?? "").toLowerCase().includes(q) ||
        (l.farmerName ?? "").toLowerCase().includes(q)
    );
  }, [settledLots, search]);

  const sortedLots = useMemo(
    () => [...filteredLots].sort((a, b) => b.lotDate.localeCompare(a.lotDate)),
    [filteredLots]
  );

  const totals = useMemo(() => {
    return {
      grossNotional: settledLots.reduce((s, l) => s + l.netWeight * l.grossSaleRate, 0),
      deductions:    settledLots.reduce((s, l) => s + Object.values(l.paramDeductions).reduce((a, v) => a + v, 0), 0),
      cessBalance:   settledLots.reduce((s, l) => s + lotCessBalance(l), 0),
      margin:        settledLots.reduce((s, l) => s + l.akshayaMarginPerMT * l.netWeight, 0),
      netWeight:     settledLots.reduce((s, l) => s + l.netWeight, 0),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settledLots]);

  const totalNetPayout = useMemo(
    () =>
      sortedLots.reduce(
        (s, l) =>
          s +
          l.grossSaleValue -
          lotCessBalance(l) -
          l.akshayaMarginPerMT * l.netWeight -
          (l.holdPenalty ?? 0),
        0
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortedLots]
  );

  return (
    <div className="grid gap-6">
      {/* Summary tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Lots Settled"
          value={String(settledLots.length)}
          accent="green"
        />
        <KpiTile
          label="Total Gross (Notional)"
          value={inr(totals.grossNotional)}
          accent="green"
        />
        <KpiTile label="Total Cess (Balance)" value={inr(totals.cessBalance)} />
        <KpiTile
          label="Total Margin Earned"
          value={inr(totals.margin)}
          accent="green"
        />
      </div>

      {/* Table */}
      <SectionCard
        title="Settled Lots"
        action={
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9aad9c]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lot, material, supplier…"
              className="rounded-md border border-[#c8d4c0] pl-8 pr-3 py-1.5 text-xs w-56 focus:outline-none focus:ring-1 focus:ring-[#172018]"
            />
          </div>
        }
      >
        {sortedLots.length === 0 ? (
          <EmptyState message="No settled lots in this period" />
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-widest text-[#60735d]">
                <tr>
                  {[
                    "Lot Ref",
                    "Date",
                    "Material",
                    "Supplier",
                    "Net MT",
                    "Rate",
                    "Gross",
                    "Deductions",
                    "Cess",
                    "Margin",
                    "Net Payout",
                  ].map((h) => (
                    <th key={h} className="px-4 py-3.5 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedLots.map((l) => {
                  const grossNotional = l.netWeight * l.grossSaleRate;
                  const deductions = Object.values(l.paramDeductions).reduce(
                    (s, v) => s + v,
                    0
                  );
                  const cessBalance = lotCessBalance(l);
                  const netPayout =
                    l.grossSaleValue -
                    cessBalance -
                    l.akshayaMarginPerMT * l.netWeight -
                    (l.holdPenalty ?? 0);
                  return (
                    <tr
                      key={l.id}
                      className="border-t border-[#edf0e8] hover:bg-[#fafcf8]"
                    >
                      <td className="px-4 py-3.5 font-mono text-xs font-semibold">
                        {l.documentRef}
                      </td>
                      <td className="px-4 py-3.5 text-[#9aad9c] text-xs">
                        {l.lotDate}
                      </td>
                      <td className="px-4 py-3.5">{l.materialName}</td>
                      <td className="px-4 py-3.5 text-[#536251]">
                        {l.supplierName ?? l.farmerName ?? "—"}
                      </td>
                      <td className="px-4 py-3.5 font-bold">
                        {fmt2(l.netWeight)}
                      </td>
                      <td className="px-4 py-3.5">
                        ₹{l.grossSaleRate.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3.5">{inr(grossNotional)}</td>
                      <td className="px-4 py-3.5 text-[#dc2626]">
                        {deductions > 0 ? inr(deductions) : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-[#d97706]">
                        {cessBalance > 0 ? inr(cessBalance) : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-[#15803d]">
                        {inr(l.akshayaMarginPerMT * l.netWeight)}
                        {l.holdPenalty > 0 && (
                          <span
                            className="ml-1 rounded-md bg-amber-100 px-1 py-0.5 text-xs text-amber-700"
                            title={l.holdPenaltyNote ?? "Hold penalty applied"}
                          >
                            +₹{l.holdPenalty.toLocaleString("en-IN")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-semibold">
                        {inr(netPayout)}
                      </td>
                    </tr>
                  );
                })}
                {/* Footer */}
                <tr className="border-t-2 border-[#172018] bg-[#f8faf5] font-semibold">
                  <td className="px-4 py-3.5" colSpan={4}>
                    Total ({sortedLots.length} lots)
                  </td>
                  <td className="px-4 py-3.5">
                    {fmt2(sortedLots.reduce((s, l) => s + l.netWeight, 0))} MT
                  </td>
                  <td className="px-4 py-3.5" />
                  <td className="px-4 py-3.5">
                    {inr(sortedLots.reduce((s, l) => s + l.netWeight * l.grossSaleRate, 0))}
                  </td>
                  <td className="px-4 py-3.5 text-[#dc2626]">
                    {totals.deductions > 0 ? inr(totals.deductions) : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-[#d97706]">
                    {totals.cessBalance > 0 ? inr(totals.cessBalance) : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-[#15803d]">
                    {inr(totals.margin)}
                  </td>
                  <td className="px-4 py-3.5">{inr(totalNetPayout)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── TAB 5: GST ────────────────────────────────────────────────────────────────

function GSTTab({
  data,
  period,
}: {
  data: DataBundle;
  period: Period;
}) {
  const { invoices, materials } = data;

  const periodInvoices = useMemo(
    () => invoices.filter((i) => inPeriod(i.invoiceDate, period)),
    [invoices, period]
  );

  const taxableInvoices = useMemo(
    () => periodInvoices.filter((i) => i.totalTax > 0),
    [periodInvoices]
  );
  const exemptInvoices = useMemo(
    () => periodInvoices.filter((i) => i.totalTax === 0),
    [periodInvoices]
  );

  const totalTaxableValue = useMemo(
    () => periodInvoices.reduce((s, i) => s + i.taxableValue, 0),
    [periodInvoices]
  );
  const totalGSTCollected = useMemo(
    () => periodInvoices.reduce((s, i) => s + i.totalTax, 0),
    [periodInvoices]
  );
  const totalExemptValue = useMemo(
    () => exemptInvoices.reduce((s, i) => s + i.taxableValue, 0),
    [exemptInvoices]
  );

  // HSN summary
  interface HSNRow {
    hsn: string;
    material: string;
    qty: number;
    uom: string;
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  }

  const hsnRows = useMemo((): HSNRow[] => {
    const map = new Map<string, HSNRow>();
    for (const inv of periodInvoices) {
      const mat = materials.find((m) => m.id === inv.materialId);
      const hsn = mat?.hsn ?? "N/A";
      const existing = map.get(hsn) ?? {
        hsn,
        material: inv.materialName,
        qty: 0,
        uom: inv.uom,
        taxableValue: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        total: 0,
      };
      map.set(hsn, {
        ...existing,
        qty: existing.qty + inv.quantity,
        taxableValue: existing.taxableValue + inv.taxableValue,
        cgst: existing.cgst + inv.cgstAmount,
        sgst: existing.sgst + inv.sgstAmount,
        igst: existing.igst + inv.igstAmount,
        total: existing.total + inv.totalValue,
      });
    }
    return Array.from(map.values()).sort((a, b) =>
      a.hsn.localeCompare(b.hsn)
    );
  }, [periodInvoices, materials]);

  return (
    <div className="grid gap-6">
      {/* Summary tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Total Invoices"
          value={String(periodInvoices.length)}
        />
        <KpiTile
          label="Taxable Value"
          value={inr(totalTaxableValue)}
          accent="green"
        />
        <KpiTile
          label="Tax-exempt (Ag)"
          value={inr(totalExemptValue)}
          sub={`${exemptInvoices.length} invoices`}
        />
        <KpiTile
          label="GST Collected"
          value={inr(totalGSTCollected)}
          sub={`${taxableInvoices.length} taxable invoices`}
          accent={totalGSTCollected > 0 ? "amber" : undefined}
        />
      </div>

      {/* HSN Summary */}
      <SectionCard title="HSN-wise Summary">
        {periodInvoices.length === 0 ? (
          <EmptyState message="No invoices in this period" />
        ) : hsnRows.length === 0 ? (
          <EmptyState message="No invoices with HSN data found" />
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f6ef] text-xs font-semibold uppercase tracking-widest text-[#60735d]">
                <tr>
                  {[
                    "HSN",
                    "Material",
                    "Qty",
                    "Taxable Value",
                    "CGST",
                    "SGST",
                    "IGST",
                    "Total",
                  ].map((h) => (
                    <th key={h} className="px-5 py-3.5 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hsnRows.map((row) => (
                  <tr
                    key={row.hsn}
                    className="border-t border-[#edf0e8] hover:bg-[#fafcf8]"
                  >
                    <td className="px-5 py-3.5 font-mono text-sm">{row.hsn}</td>
                    <td className="px-5 py-3.5 font-semibold">{row.material}</td>
                    <td className="px-5 py-3.5">
                      {fmt2(row.qty)} {row.uom}
                    </td>
                    <td className="px-5 py-3.5 font-bold">
                      {inr(row.taxableValue)}
                    </td>
                    <td className="px-5 py-3.5 text-[#536251]">
                      {row.cgst > 0 ? inr(row.cgst) : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[#536251]">
                      {row.sgst > 0 ? inr(row.sgst) : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[#536251]">
                      {row.igst > 0 ? inr(row.igst) : "—"}
                    </td>
                    <td className="px-5 py-3.5 font-semibold">
                      {inr(row.total)}
                    </td>
                  </tr>
                ))}
                {/* Footer */}
                <tr className="border-t-2 border-[#172018] bg-[#f8faf5]">
                  <td className="px-5 py-3.5 font-semibold" colSpan={3}>
                    Total
                  </td>
                  <td className="px-5 py-3.5 font-semibold">
                    {inr(hsnRows.reduce((s, r) => s + r.taxableValue, 0))}
                  </td>
                  <td className="px-5 py-3.5 font-bold">
                    {inr(hsnRows.reduce((s, r) => s + r.cgst, 0))}
                  </td>
                  <td className="px-5 py-3.5 font-bold">
                    {inr(hsnRows.reduce((s, r) => s + r.sgst, 0))}
                  </td>
                  <td className="px-5 py-3.5 font-bold">
                    {inr(hsnRows.reduce((s, r) => s + r.igst, 0))}
                  </td>
                  <td className="px-5 py-3.5 font-semibold">
                    {inr(hsnRows.reduce((s, r) => s + r.total, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Root page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { fy: globalFy } = useGlobalFY();
  const [tab, setTab] = useState<Tab>("Overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DataBundle>({
    lots: [],
    ledger: [],
    vouchers: [],
    invoices: [],
    materials: [],
    parties: [],
  });
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Initialise period from the global FY picker; stay in sync when user changes it
  const [period, setPeriod] = useState<Period>(() =>
    globalFy.dateFrom
      ? { quick: "custom", from: globalFy.dateFrom, to: globalFy.dateTo }
      : { quick: "all", from: "2020-01-01", to: "2099-12-31" }
  );

  useEffect(() => {
    setPeriod(
      globalFy.dateFrom
        ? { quick: "custom", from: globalFy.dateFrom, to: globalFy.dateTo }
        : { quick: "all", from: "2020-01-01", to: "2099-12-31" }
    );
  }, [globalFy.dateFrom, globalFy.dateTo]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch("/api/lots").then((r) => r.json()),
      fetch("/api/ledger").then((r) => r.json()),
      fetch("/api/vouchers").then((r) => r.json()),
      fetch("/api/invoices").then((r) => r.json()),
      fetch("/api/materials").then((r) => r.json()),
      fetch("/api/parties").then((r) => r.json()),
    ])
      .then(([lots, ledger, vouchers, invoices, materials, parties]) => {
        if (cancelled) return;
        setData({
          lots: Array.isArray(lots) ? lots : [],
          ledger: Array.isArray(ledger) ? ledger : [],
          vouchers: Array.isArray(vouchers) ? vouchers : [],
          invoices: Array.isArray(invoices) ? invoices : [],
          materials: Array.isArray(materials) ? materials : [],
          parties: Array.isArray(parties) ? parties : [],
        });
        setLastUpdated(
          new Date().toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })
        );
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-5">
      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => {
          const TabIcon = TAB_ICONS[t];
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold transition-all flex items-center gap-1.5 ${
                tab === t
                  ? "bg-[#172018] text-white shadow-sm"
                  : "border border-[#c8d4c0] bg-white text-[#536251] hover:bg-[#f0f4ec]"
              }`}
            >
              <TabIcon size={14} />
              {t}
            </button>
          );
        })}
      </div>

      {/* Period selector */}
      <PeriodBar
        period={period}
        onChange={setPeriod}
        lastUpdated={lastUpdated}
      />

      {/* Content */}
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-[#dc2626]">
          <AlertCircle size={32} />
          <p className="text-sm">{error}</p>
        </div>
      ) : (
        <>
          {tab === "Overview" && <OverviewTab data={data} period={period} />}
          {tab === "Procurement" && (
            <ProcurementTab data={data} period={period} />
          )}
          {tab === "Financials" && (
            <FinancialsTab data={data} period={period} />
          )}
          {tab === "Settlement" && (
            <SettlementTab data={data} period={period} />
          )}
          {tab === "GST" && <GSTTab data={data} period={period} />}
        </>
      )}
    </div>
  );
}
