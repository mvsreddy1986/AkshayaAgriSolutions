"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  PackagePlus,
  FileUp,
  CheckCircle2,
  Receipt,
  BarChart3,
  Database,
  PackageSearch,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  ChevronRight,
  BarChart2,
  Banknote,
} from "lucide-react";
import type { InwardLot, LedgerEntry, Invoice, Material, Voucher } from "../../lib/types";
import { useFY, inFY } from "./fy-context";

// ── Formatting helpers ────────────────────────────────────────────────────────

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const today = new Date().toISOString().slice(0, 10);
const thisMonthStart = new Date(
  new Date().getFullYear(),
  new Date().getMonth(),
  1
)
  .toISOString()
  .slice(0, 10);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });

// ── Shared components ─────────────────────────────────────────────────────────

function SectionCard({
  title,
  action,
  accent,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-[#d8decf] bg-white overflow-hidden${accent ? ` ${accent}` : ""}`}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#eef3e8]">
        <h3 className="text-sm font-semibold text-[#172018]">{title}</h3>
        {action && <div className="text-xs text-[#536251]">{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Draft:       { bg: "#f3f4f6", color: "#374151" },
  Mapped:      { bg: "#dbeafe", color: "#1d4ed8" },
  QualityHold: { bg: "#fef3c7", color: "#92400e" },
  Approved:    { bg: "#f3e8ff", color: "#7c3aed" },
  Settled:     { bg: "#dcfce7", color: "#15803d" },
  Invoiced:    { bg: "#d1fae5", color: "#065f46" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: "#f3f4f6", color: "#374151" };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: s.bg, color: s.color }}
    >
      {status}
    </span>
  );
}

function LoadingShimmer() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-8 rounded-lg bg-[#eef3e8]" />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CommandCenterPage() {
  const { fy } = useFY();
  const [lots, setLots] = useState<InwardLot[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [_materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState("Team");

  // Resolve user name from localStorage (client-only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("erp_auth");
      if (raw) {
        const parsed = JSON.parse(raw) as { name?: string };
        if (parsed.name) setUserName(parsed.name);
      }
    } catch {
      // ignore
    }
  }, []);

  const loadData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch("/api/lots").then((r) => r.json()),
      fetch("/api/ledger").then((r) => r.json()),
      fetch("/api/vouchers").then((r) => r.json()),
      fetch("/api/invoices").then((r) => r.json()),
      fetch("/api/materials").then((r) => r.json()),
    ])
      .then(([lotsData, ledgerData, vouchersData, invoicesData, materialsData]) => {
        setLots(Array.isArray(lotsData) ? lotsData : []);
        setLedger(Array.isArray(ledgerData) ? ledgerData : []);
        setVouchers(Array.isArray(vouchersData) ? vouchersData : []);
        setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
        setMaterials(Array.isArray(materialsData) ? materialsData : []);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load data")
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Greeting ──────────────────────────────────────────────────────────────
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const todayFormatted = useMemo(
    () =>
      new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    []
  );

  // ── Lot pipeline stats ────────────────────────────────────────────────────
  const {
    lotsToday,
    lotsThisMonth,
    qualityHolds,
    pendingSettlements,
    lotsByStatus,
    totalLots,
    volumeMTThisMonth,
    volumeMTPendingSettlement,
    recentLots,
    pendingApprovalLots,
    qualityHoldLots,
  } = useMemo(() => {
    const fyLots = lots.filter((l) => inFY(l.lotDate, fy));
    const lotsToday = fyLots.filter((l) => l.lotDate === today).length;
    const lotsThisMonth = fyLots.filter((l) => l.lotDate >= thisMonthStart).length;
    const qualityHolds = fyLots.filter((l) => l.status === "QualityHold").length;
    const pendingSettlements = fyLots.filter((l) => l.status === "Approved").length;

    const statusOrder = [
      "Draft",
      "Mapped",
      "QualityHold",
      "Approved",
      "Settled",
      "Invoiced",
    ] as const;
    type LotStatusKey = (typeof statusOrder)[number];
    const lotsByStatus = statusOrder.map((s) => ({
      status: s as LotStatusKey,
      count: fyLots.filter((l) => l.status === s).length,
    }));
    const totalLots = fyLots.length;

    const settledInvoicedThisMonth = fyLots.filter(
      (l) =>
        (l.status === "Settled" || l.status === "Invoiced") &&
        l.lotDate >= thisMonthStart
    );
    const volumeMTThisMonth =
      settledInvoicedThisMonth.reduce((sum, l) => sum + l.netWeight, 0) / 1000;

    const pendingSettlementLots = fyLots.filter(
      (l) => l.status !== "Settled" && l.status !== "Invoiced"
    );
    const volumeMTPendingSettlement =
      pendingSettlementLots.reduce((sum, l) => sum + l.netWeight, 0) / 1000;

    const recentLots = [...fyLots]
      .sort((a, b) => {
        const d = b.lotDate.localeCompare(a.lotDate);
        return d !== 0 ? d : b.id.localeCompare(a.id);
      })
      .slice(0, 8);

    const pendingApprovalLots = fyLots.filter((l) => l.status === "Approved");

    const qualityHoldLots = fyLots
      .filter((l) => l.status === "QualityHold")
      .slice(0, 5);

    return {
      lotsToday,
      lotsThisMonth,
      qualityHolds,
      pendingSettlements,
      lotsByStatus,
      totalLots,
      volumeMTThisMonth,
      volumeMTPendingSettlement,
      recentLots,
      pendingApprovalLots,
      qualityHoldLots,
    };
  }, [lots, fy]);

  // ── Ledger-based financials ───────────────────────────────────────────────
  const fyLedger = useMemo(() => ledger.filter((e) => inFY(e.entryDate, fy)), [ledger, fy]);

  const {
    revenuePosted,
    marginEarned,
    marginMTD,
    customerDr,
    customerCr,
    supplierCr,
    supplierDr,
    customerOutstanding,
    supplierPayable,
    expensesMTD,
    drawingsFY,
    uniqueSuppliers,
    unsettledInvoiceCount,
  } = useMemo(() => {
    const sumCr = (code: string) =>
      fyLedger
        .filter((e) => e.accountCode === code)
        .reduce((s, e) => s + e.credit, 0);
    const sumDr = (code: string) =>
      fyLedger
        .filter((e) => e.accountCode === code)
        .reduce((s, e) => s + e.debit, 0);

    const revenuePosted = sumCr("3100") - sumDr("3100");
    const marginEarned = sumCr("3200") - sumDr("3200");

    const marginMTD = fyLedger
      .filter((e) => e.accountCode === "3200" && e.entryDate >= thisMonthStart)
      .reduce((s, e) => s + e.credit - e.debit, 0);

    const customerDr = sumDr("1201");
    const customerCr = sumCr("1201");
    const supplierCr = sumCr("2101");
    const supplierDr = sumDr("2101");

    const customerOutstanding = Math.max(0, customerDr - customerCr);
    const supplierPayable = Math.max(0, supplierCr - supplierDr);

    const expensesMTD = fyLedger
      .filter((e) => e.accountCode.startsWith("52") && e.entryDate >= thisMonthStart)
      .reduce((s, e) => s + e.debit - e.credit, 0);

    const drawingsFY = fyLedger
      .filter((e) => e.accountCode === "3900")
      .reduce((s, e) => s + e.debit - e.credit, 0);

    const uniqueSuppliers = new Set(
      fyLedger
        .filter((e) => e.accountCode === "2101" && e.partyId)
        .map((e) => e.partyId)
    ).size;

    const unsettledInvoiceCount = invoices.filter(
      (inv) => inv.status !== "Paid" && inv.status !== "Cancelled"
    ).length;

    return {
      revenuePosted,
      marginEarned,
      marginMTD,
      customerDr,
      customerCr,
      supplierCr,
      supplierDr,
      customerOutstanding,
      supplierPayable,
      expensesMTD,
      drawingsFY,
      uniqueSuppliers,
      unsettledInvoiceCount,
    };
  }, [fyLedger, invoices]);

  // ── Vouchers ──────────────────────────────────────────────────────────────
  const recentVouchers = useMemo(
    () =>
      [...vouchers]
        .sort((a, b) => b.voucherDate.localeCompare(a.voucherDate))
        .slice(0, 6),
    [vouchers]
  );

  // ── Collection / payment rates ────────────────────────────────────────────
  const collectionRate = customerDr > 0 ? customerCr / customerDr : 0;
  const settledLotsCount = lots.filter(
    (l) => l.status === "Settled" || l.status === "Invoiced"
  ).length;
  const avgPerLot =
    settledLotsCount > 0 ? marginEarned / settledLotsCount : 0;

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="grid gap-5">
        <div className="rounded-xl bg-[#172018] p-6 animate-pulse h-28" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-[#eef3e8] animate-pulse" />
          ))}
        </div>
        <LoadingShimmer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-sm text-red-600 font-medium">
          Error loading data: {error}
        </p>
        <button
          onClick={loadData}
          className="rounded-lg bg-[#172018] px-4 py-2 text-sm font-semibold text-white hover:bg-[#243525] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const STATUS_DOT_COLORS: Record<string, string> = {
    Draft:       "bg-gray-400",
    Mapped:      "bg-blue-500",
    QualityHold: "bg-amber-400",
    Approved:    "bg-purple-500",
    Settled:     "bg-green-500",
    Invoiced:    "bg-emerald-600",
  };

  return (
    <div className="grid gap-6">

      {/* ── 1. HERO BANNER ───────────────────────────────────────────────── */}
      <div className="rounded-xl bg-[#172018] p-6 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#8aab8e] uppercase tracking-widest mb-1">
            Command Center
          </p>
          <h1 className="text-xl font-bold text-white leading-tight">
            {greeting}, {userName}
          </h1>
          <p className="mt-1 text-sm text-[#8aab8e]">{todayFormatted}</p>
          <p className="mt-0.5 text-xs text-[#6b8c6e]">
            {fy.label === "All time" ? "All-time data" : `Showing ${fy.label} · ${fy.dateFrom} → ${fy.dateTo}`}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="rounded-lg bg-white/10 px-4 py-2.5 text-center min-w-20">
            <p className="text-2xl font-black text-white">{lotsToday}</p>
            <p className="text-xs text-[#8aab8e] mt-0.5">Lots today</p>
          </div>
          <div className="rounded-lg bg-white/10 px-4 py-2.5 text-center min-w-20">
            <p className="text-2xl font-black text-amber-300">{qualityHolds}</p>
            <p className="text-xs text-[#8aab8e] mt-0.5">Quality holds</p>
          </div>
          <div className="rounded-lg bg-white/10 px-4 py-2.5 text-center min-w-20">
            <p className="text-2xl font-black text-purple-300">
              {pendingSettlements}
            </p>
            <p className="text-xs text-[#8aab8e] mt-0.5">Pending settle</p>
          </div>
        </div>
      </div>

      {/* ── 2. QUICK ACTIONS ─────────────────────────────────────────────── */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex gap-3 min-w-max sm:min-w-0 sm:grid sm:grid-cols-4 lg:grid-cols-7">
          {[
            { Icon: PackagePlus,  label: "New Lot",       href: "/erp/procurement" },
            { Icon: FileUp,       label: "Import PDF",    href: "/erp/procurement" },
            { Icon: CheckCircle2, label: "Settle Lot",    href: "/erp/procurement" },
            { Icon: Receipt,      label: "Invoices",      href: "/erp/accounting"  },
            { Icon: Banknote,     label: "Expenses",      href: "/erp/accounting"  },
            { Icon: BarChart3,    label: "Reports",       href: "/erp/reports"     },
            { Icon: Database,     label: "Masters",       href: "/erp/masters"     },
          ].map(({ Icon, label, href }) => (
            <Link
              key={label}
              href={href}
              className="rounded-xl border border-[#d8decf] bg-white p-4 flex flex-col items-center gap-2 hover:bg-[#f0f4ec] hover:border-[#a8c0a0] transition-all cursor-pointer min-w-24 sm:min-w-0"
            >
              <Icon size={24} className="text-[#172018]" />
              <span className="text-xs font-semibold text-[#536251] mt-1 text-center leading-tight">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── 3. KPI TILES ─────────────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-3">

        {/* Lots Today */}
        <div className="rounded-xl border border-[#d8decf] bg-white p-5 relative">
          <div className="absolute top-4 right-4 h-9 w-9 rounded-full bg-teal-50 flex items-center justify-center">
            <PackageSearch size={16} className="text-teal-600" />
          </div>
          <p className="text-xs font-medium text-[#60735d] uppercase tracking-wider pr-10">
            Lots Today
          </p>
          <p className="text-3xl font-black text-[#172018] mt-2">{lotsToday}</p>
          <p className="text-xs text-[#9aad9c] mt-1">{lotsThisMonth} this month</p>
        </div>

        {/* Volume MT */}
        <div className="rounded-xl border border-[#d8decf] bg-white p-5 relative">
          <div className="absolute top-4 right-4 h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center">
            <BarChart2 size={16} className="text-blue-600" />
          </div>
          <p className="text-xs font-medium text-[#60735d] uppercase tracking-wider pr-10">
            Volume (MT)
          </p>
          <p className="text-3xl font-black text-[#172018] mt-2">
            {volumeMTThisMonth.toFixed(1)}
          </p>
          <p className="text-xs text-[#9aad9c] mt-1">
            {volumeMTPendingSettlement.toFixed(1)} MT pending settlement
          </p>
        </div>

        {/* Revenue Posted */}
        <div className="rounded-xl border border-[#d8decf] bg-white p-5 relative">
          <div className="absolute top-4 right-4 h-9 w-9 rounded-full bg-green-50 flex items-center justify-center">
            <TrendingUp size={16} className="text-green-600" />
          </div>
          <p className="text-xs font-medium text-[#60735d] uppercase tracking-wider pr-10">
            Revenue Posted
          </p>
          <p className="text-xl font-black text-[#172018] mt-2">
            {inr(revenuePosted)}
          </p>
          <p className="text-xs text-[#9aad9c] mt-1">from ledger</p>
        </div>

        {/* Margin Earned */}
        <div className="rounded-xl border border-[#d8decf] bg-white p-5 relative">
          <div className="absolute top-4 right-4 h-9 w-9 rounded-full bg-amber-50 flex items-center justify-center">
            <DollarSign size={16} className="text-amber-600" />
          </div>
          <p className="text-xs font-medium text-[#60735d] uppercase tracking-wider pr-10">
            Margin Earned
          </p>
          <p className="text-xl font-black text-[#172018] mt-2">
            {inr(marginEarned)}
          </p>
          <p className="text-xs text-[#9aad9c] mt-1">Akshaya trading profit</p>
        </div>

        {/* Customer Outstanding */}
        <div className="rounded-xl border border-[#d8decf] bg-white p-5 relative">
          <div className="absolute top-4 right-4 h-9 w-9 rounded-full bg-orange-50 flex items-center justify-center">
            <ArrowUpRight size={16} className="text-orange-600" />
          </div>
          <p className="text-xs font-medium text-[#60735d] uppercase tracking-wider pr-10">
            Customer Outstanding
          </p>
          <p className="text-xl font-black text-[#172018] mt-2">
            {inr(customerOutstanding)}
          </p>
          <p className="text-xs text-[#9aad9c] mt-1">
            {unsettledInvoiceCount} unsettled invoices
          </p>
        </div>

        {/* Supplier Payable */}
        <div className="rounded-xl border border-[#d8decf] bg-white p-5 relative">
          <div className="absolute top-4 right-4 h-9 w-9 rounded-full bg-red-50 flex items-center justify-center">
            <ArrowDownLeft size={16} className="text-red-600" />
          </div>
          <p className="text-xs font-medium text-[#60735d] uppercase tracking-wider pr-10">
            Supplier Payable
          </p>
          <p className="text-xl font-black text-[#172018] mt-2">
            {inr(supplierPayable)}
          </p>
          <p className="text-xs text-[#9aad9c] mt-1">
            across {uniqueSuppliers} suppliers
          </p>
        </div>

      </div>

      {/* ── 4. LOT PIPELINE + FINANCIAL PULSE ───────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* Lot Pipeline */}
        <SectionCard title="Lot Pipeline">
          <div className="space-y-3">
            {lotsByStatus.map(({ status, count }) => (
              <div key={status} className="flex items-center gap-3">
                <span
                  className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                    STATUS_DOT_COLORS[status] ?? "bg-gray-400"
                  }`}
                />
                <span className="w-28 shrink-0 text-sm text-[#536251]">
                  {status}
                </span>
                <div className="flex-1 h-2 rounded-full bg-[#eef3e8] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#172018] transition-all"
                    style={{
                      width:
                        totalLots > 0
                          ? `${(count / totalLots) * 100}%`
                          : "0%",
                    }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-semibold text-[#172018]">
                  {count}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 pt-3 border-t border-[#eef3e8] text-xs text-[#9aad9c]">
            {totalLots} total lots
          </p>
        </SectionCard>

        {/* Financial Pulse */}
        <SectionCard title="Financial Pulse">
          <div className="space-y-4">

            {/* Customer AR */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-[#536251]">Customer AR</span>
                <span className="text-sm font-bold text-[#172018]">
                  {inr(customerDr)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#eef3e8] overflow-hidden flex">
                <div
                  className="h-full bg-green-400 transition-all"
                  style={{ width: `${collectionRate * 100}%` }}
                />
                <div
                  className="h-full bg-amber-400 transition-all"
                  style={{
                    width: `${Math.max(0, 1 - collectionRate) * 100}%`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-green-600">
                  {(collectionRate * 100).toFixed(0)}% collected
                </span>
                <span className="text-xs text-amber-600">
                  {inr(customerOutstanding)} outstanding
                </span>
              </div>
            </div>

            {/* Supplier AP */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-[#536251]">Supplier AP</span>
                <span className="text-sm font-bold text-[#172018]">
                  {inr(supplierCr)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#eef3e8] overflow-hidden flex">
                <div
                  className="h-full bg-green-400 transition-all"
                  style={{
                    width:
                      supplierCr > 0
                        ? `${(supplierDr / supplierCr) * 100}%`
                        : "0%",
                  }}
                />
                <div
                  className="h-full bg-amber-400 transition-all"
                  style={{
                    width:
                      supplierCr > 0
                        ? `${Math.max(
                            0,
                            ((supplierCr - supplierDr) / supplierCr) * 100
                          )}%`
                        : "0%",
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-green-600">
                  {supplierCr > 0
                    ? ((supplierDr / supplierCr) * 100).toFixed(0)
                    : "0"}
                  % paid
                </span>
                <span className="text-xs text-amber-600">
                  {inr(supplierPayable)} outstanding
                </span>
              </div>
            </div>

            {/* Margin MTD */}
            <div className="flex items-center justify-between py-2.5 border-t border-[#eef3e8]">
              <span className="text-sm text-[#536251]">Margin (MTD)</span>
              <span className="text-sm font-bold text-green-700">
                {inr(marginMTD)}
              </span>
            </div>

            {/* Expenses MTD */}
            <div className="flex items-center justify-between py-2.5 border-t border-[#eef3e8]">
              <span className="text-sm text-[#536251]">Expenses (MTD)</span>
              <span className="text-sm font-bold text-amber-700">
                {expensesMTD > 0 ? inr(expensesMTD) : "—"}
              </span>
            </div>

            {/* Drawings FY */}
            {drawingsFY > 0 && (
              <div className="flex items-center justify-between py-2.5 border-t border-[#eef3e8]">
                <span className="text-sm text-[#536251]">Drawings (FY)</span>
                <span className="text-sm font-bold text-purple-700">
                  {inr(drawingsFY)}
                </span>
              </div>
            )}

          </div>
          <p className="mt-2 text-xs text-[#9aad9c] border-t border-[#eef3e8] pt-3">
            {settledLotsCount} lots settled ·{" "}
            {settledLotsCount > 0 ? inr(avgPerLot) : "₹0"} avg margin per lot
          </p>
        </SectionCard>

      </div>

      {/* ── 5. QUALITY HOLDS ALERT ───────────────────────────────────────── */}
      {qualityHolds > 0 && (
        <div className="rounded-xl border border-[#d8decf] bg-white border-l-4 border-l-amber-400 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[#eef3e8]">
            <AlertTriangle size={18} className="text-amber-500 shrink-0" />
            <h3 className="text-sm font-semibold text-[#172018] flex-1">
              Quality Holds Requiring Attention
            </h3>
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              {qualityHolds}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#eef3e8] bg-[#fafaf8]">
                  {["Lot Ref", "Date", "Material", "Supplier", "Net MT", "Status", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-xs font-semibold text-[#60735d] uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {qualityHoldLots.map((lot) => (
                  <tr
                    key={lot.id}
                    className="border-b border-[#eef3e8] hover:bg-[#fafdf7]"
                  >
                    <td className="px-4 py-2.5 font-semibold text-[#172018]">
                      {lot.documentRef}
                    </td>
                    <td className="px-4 py-2.5 text-[#536251]">
                      {fmtDate(lot.lotDate)}
                    </td>
                    <td className="px-4 py-2.5 text-[#536251]">
                      {lot.materialName}
                    </td>
                    <td className="px-4 py-2.5 text-[#536251]">
                      {lot.supplierName ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[#536251]">
                      {(lot.netWeight / 1000).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={lot.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href="/erp/procurement"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#172018] hover:underline"
                      >
                        Review <ChevronRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 6. RECENT LOTS + PENDING SETTLEMENTS ────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* Recent Lots */}
        <SectionCard
          title="Recent Lots"
          action={
            <Link
              href="/erp/procurement"
              className="hover:underline text-[#172018] font-medium"
            >
              View all →
            </Link>
          }
        >
          <div className="overflow-x-auto -m-1 p-1">
            {recentLots.length === 0 ? (
              <p className="text-sm text-[#9aad9c] text-center py-4">
                No lots yet
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#eef3e8]">
                    {["Ref", "Date", "Material", "MT", "Value", "Status"].map(
                      (h) => (
                        <th
                          key={h}
                          className="pb-2 text-left text-xs font-semibold text-[#60735d] uppercase tracking-wider pr-3 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {recentLots.map((lot) => (
                    <tr
                      key={lot.id}
                      className="border-b border-[#eef3e8] last:border-0 hover:bg-[#fafdf7]"
                    >
                      <td className="py-2 pr-3 font-semibold text-[#172018] text-xs whitespace-nowrap">
                        {lot.documentRef}
                      </td>
                      <td className="py-2 pr-3 text-[#536251] text-xs whitespace-nowrap">
                        {fmtDate(lot.lotDate)}
                      </td>
                      <td className="py-2 pr-3 text-[#536251] text-xs max-w-20 truncate">
                        {lot.materialName}
                      </td>
                      <td className="py-2 pr-3 text-[#536251] text-xs">
                        {(lot.netWeight / 1000).toFixed(2)}
                      </td>
                      <td className="py-2 pr-3 text-[#536251] text-xs whitespace-nowrap">
                        {inr(lot.grossSaleValue)}
                      </td>
                      <td className="py-2">
                        <StatusBadge status={lot.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </SectionCard>

        {/* Pending Settlements */}
        <SectionCard
          title="Pending Settlements"
          action={
            <Link
              href="/erp/procurement"
              className="hover:underline text-[#172018] font-medium"
            >
              View all →
            </Link>
          }
        >
          <div className="overflow-x-auto -m-1 p-1">
            {pendingApprovalLots.length === 0 ? (
              <p className="text-sm text-[#9aad9c] text-center py-4">
                No pending settlements
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#eef3e8]">
                    {["Ref", "Material", "Supplier", "MT", "Value", ""].map(
                      (h) => (
                        <th
                          key={h}
                          className="pb-2 text-left text-xs font-semibold text-[#60735d] uppercase tracking-wider pr-3 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pendingApprovalLots.map((lot) => (
                    <tr
                      key={lot.id}
                      className="border-b border-[#eef3e8] last:border-0 hover:bg-[#fafdf7]"
                    >
                      <td className="py-2 pr-3 font-semibold text-[#172018] text-xs whitespace-nowrap">
                        {lot.documentRef}
                      </td>
                      <td className="py-2 pr-3 text-[#536251] text-xs max-w-20 truncate">
                        {lot.materialName}
                      </td>
                      <td className="py-2 pr-3 text-[#536251] text-xs max-w-20 truncate">
                        {lot.supplierName ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-[#536251] text-xs">
                        {(lot.netWeight / 1000).toFixed(2)}
                      </td>
                      <td className="py-2 pr-3 text-[#536251] text-xs whitespace-nowrap">
                        {inr(lot.grossSaleValue)}
                      </td>
                      <td className="py-2">
                        <Link
                          href="/erp/procurement"
                          className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#172018] hover:underline whitespace-nowrap"
                        >
                          Settle <ChevronRight size={11} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </SectionCard>

      </div>

      {/* ── 7. RECENT VOUCHERS ───────────────────────────────────────────── */}
      {recentVouchers.length > 0 && (
        <SectionCard title="Recent Transactions">
          <div className="overflow-x-auto -m-1 p-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#eef3e8]">
                  {["Date", "Type", "Party", "Amount", "Mode", "Narration"].map(
                    (h) => (
                      <th
                        key={h}
                        className="pb-2 text-left text-xs font-semibold text-[#60735d] uppercase tracking-wider pr-4 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {recentVouchers.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-[#eef3e8] last:border-0 hover:bg-[#fafdf7]"
                  >
                    <td className="py-2 pr-4 text-[#536251] text-xs whitespace-nowrap">
                      {fmtDate(v.voucherDate)}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={
                          v.voucherType === "Receipt"
                            ? { background: "#dcfce7", color: "#15803d" }
                            : v.voucherType === "Payment"
                            ? { background: "#fee2e2", color: "#b91c1c" }
                            : v.voucherType === "Expense"
                            ? { background: "#fef3c7", color: "#92400e" }
                            : { background: "#ede9fe", color: "#7c3aed" }
                        }
                      >
                        {v.voucherType}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-[#536251] text-xs max-w-30 truncate">
                      {v.partyName}
                    </td>
                    <td className="py-2 pr-4 font-semibold text-[#172018] text-xs whitespace-nowrap">
                      {inr(v.amount)}
                    </td>
                    <td className="py-2 pr-4 text-[#536251] text-xs">
                      {v.paymentMode}
                    </td>
                    <td className="py-2 text-[#9aad9c] text-xs max-w-45 truncate">
                      {v.narration}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

    </div>
  );
}
