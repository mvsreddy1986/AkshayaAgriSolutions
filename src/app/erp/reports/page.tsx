"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  TrendingUp, Activity, Layers, Wallet, FileText, Receipt,
  Search, ChevronDown, ChevronRight, AlertCircle, RefreshCw,
} from "lucide-react";
import type { InwardLot, LedgerEntry, Invoice, Material, Party, LotStatus } from "../../../lib/types";
import { useFY as useGlobalFY } from "../fy-context";

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Voucher {
  id: string; voucherNo: string; voucherType: string; voucherDate: string;
  partyId: string | null; partyName: string; amount: number;
  paymentMode: string; bankRef: string; narration: string;
  status: string; allocatedTo: string[];
}

interface DataBundle {
  lots: InwardLot[];
  ledger: LedgerEntry[];
  vouchers: Voucher[];
  invoices: Invoice[];
  materials: Material[];
  parties: Party[];
}

// ── Formatting ────────────────────────────────────────────────────────────────
const inr = (n: number, compact?: boolean) => {
  if (compact) {
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
    if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(1)}L`;
    return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
  }
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
};

const toL = (n: number) => Math.round((n / 1_00_000) * 10) / 10;
const fmt2 = (n: number) => n.toFixed(2);

// ── Period helpers ────────────────────────────────────────────────────────────
type QuickPeriod = "month" | "quarter" | "fy" | "all" | "custom";

interface Period { quick: QuickPeriod; from: string; to: string; }

function periodBounds(q: QuickPeriod): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (q === "month") return { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmt(today) };
  if (q === "quarter") {
    const qs = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
    return { from: fmt(qs), to: fmt(today) };
  }
  if (q === "fy") {
    const fyYear = today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear();
    return { from: `${fyYear}-04-01`, to: `${fyYear + 1}-03-31` };
  }
  return { from: "2020-01-01", to: "2099-12-31" };
}

function inPeriod(date: string, p: Period) { return date >= p.from && date <= p.to; }

// ── Color palette ─────────────────────────────────────────────────────────────
const MAT_COLORS = ["#172018", "#15803d", "#4d7c0f", "#166534", "#84cc16", "#65a30d"];

// ── Custom tooltip ────────────────────────────────────────────────────────────
interface TooltipPayload { name: string; value: number; color: string; }

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#d8decf] bg-white/95 p-3.5 shadow-xl text-xs min-w-36">
      <p className="font-bold text-[#172018] border-b border-[#edf0e8] pb-1.5 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4 mt-1">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-[#60735d]">{p.name}</span>
          </div>
          <span className="font-bold text-[#172018]">
            {typeof p.value === "number" ? `₹${Math.abs(p.value).toFixed(1)}L` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, accent = "neutral",
}: {
  label: string; value: string; sub?: string;
  icon?: React.ElementType; accent?: "green" | "amber" | "red" | "neutral";
}) {
  const subCls = { green: "text-[#15803d]", amber: "text-[#d97706]", red: "text-[#dc2626]", neutral: "text-[#9aad9c]" }[accent];
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#d8decf] bg-white p-6 transition-shadow hover:shadow-md">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#f0f4ec] opacity-50 transition-transform duration-300 group-hover:scale-125" />
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-[#60735d] leading-snug">{label}</p>
          {Icon && <div className="rounded-lg bg-[#f0f4ec] p-2 shrink-0"><Icon size={14} className="text-[#172018]" /></div>}
        </div>
        <p className="mt-3 text-3xl font-bold tracking-tight text-[#172018]">{value}</p>
        {sub && <p className={`mt-1 text-xs font-medium ${subCls}`}>{sub}</p>}
      </div>
    </div>
  );
}

function SectionCard({
  title, subtitle, action, children, noPad,
}: {
  title: string; subtitle?: string; action?: React.ReactNode;
  children: React.ReactNode; noPad?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#d8decf] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#edf0e8] px-6 py-4">
        <div>
          <h3 className="text-base font-semibold text-[#172018]">{title}</h3>
          {subtitle && <p className="text-xs text-[#9aad9c] mt-0.5">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className={noPad ? "" : "p-6"}>{children}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#9aad9c]">
      <AlertCircle size={32} strokeWidth={1.5} />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── Period bar ────────────────────────────────────────────────────────────────
const QUICK_OPTS: { key: QuickPeriod; label: string }[] = [
  { key: "month", label: "This Month" },
  { key: "quarter", label: "Quarter" },
  { key: "fy", label: "This FY" },
  { key: "all", label: "All Time" },
  { key: "custom", label: "Custom" },
];

function PeriodBar({
  period, onChange, lastUpdated, onRefresh, loading,
}: {
  period: Period; onChange: (p: Period) => void;
  lastUpdated: string | null; onRefresh: () => void; loading: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#d8decf] bg-white px-5 py-3">
      <div className="flex flex-wrap gap-1.5">
        {QUICK_OPTS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => {
              if (key === "custom") onChange({ quick: "custom", from: period.from, to: period.to });
              else onChange({ quick: key, ...periodBounds(key) });
            }}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              period.quick === key
                ? "bg-[#172018] text-white shadow-sm"
                : "border border-[#c8d4c0] bg-white text-[#536251] hover:bg-[#f0f4ec]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {period.quick === "custom" && (
        <div className="flex items-center gap-2 ml-1">
          <input type="date" value={period.from} onChange={(e) => onChange({ ...period, from: e.target.value })}
            className="rounded-lg border border-[#c8d4c0] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#172018]" />
          <span className="text-xs text-[#9aad9c]">→</span>
          <input type="date" value={period.to} onChange={(e) => onChange({ ...period, to: e.target.value })}
            className="rounded-lg border border-[#c8d4c0] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#172018]" />
        </div>
      )}
      <div className="ml-auto flex items-center gap-3">
        {lastUpdated && <span className="text-xs text-[#9aad9c]">Updated {lastUpdated}</span>}
        <button onClick={onRefresh} disabled={loading}
          className="rounded-lg border border-[#c8d4c0] p-1.5 text-[#60735d] hover:bg-[#f0f4ec] transition-colors disabled:opacity-50">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );
}

// ── TABS ──────────────────────────────────────────────────────────────────────
const TABS = ["Dashboard", "P&L", "Cash Flow", "Commodity", "Settlement", "GST"] as const;
type Tab = (typeof TABS)[number];
const TAB_ICONS: Record<Tab, React.ElementType> = {
  Dashboard: Activity, "P&L": TrendingUp, "Cash Flow": Wallet,
  Commodity: Layers, Settlement: FileText, GST: Receipt,
};

// ── TAB 1: Dashboard ──────────────────────────────────────────────────────────
function DashboardTab({ data, period }: { data: DataBundle; period: Period }) {
  const { lots, ledger } = data;

  const periodLots = useMemo(() => lots.filter((l) => inPeriod(l.lotDate, period)), [lots, period]);
  const periodLedger = useMemo(() => ledger.filter((e) => inPeriod(e.entryDate, period)), [ledger, period]);

  const revenue = useMemo(() => periodLedger.filter((e) => e.accountCode === "3100").reduce((s, e) => s + e.credit - e.debit, 0), [periodLedger]);
  const margin = useMemo(() => periodLedger.filter((e) => e.accountCode === "3200").reduce((s, e) => s + e.credit - e.debit, 0), [periodLedger]);
  const totalVolume = useMemo(() => periodLots.reduce((s, l) => s + l.netWeight, 0), [periodLots]);
  const settledCount = useMemo(() => periodLots.filter((l) => l.status === "Settled" || l.status === "Invoiced").length, [periodLots]);
  const arOutstanding = useMemo(() => Math.max(0, ledger.filter((e) => e.accountCode === "1201").reduce((s, e) => s + e.debit - e.credit, 0)), [ledger]);
  const apOutstanding = useMemo(() => Math.max(0, ledger.filter((e) => e.accountCode === "2101").reduce((s, e) => s + e.credit - e.debit, 0)), [ledger]);
  const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
  const marginPerMT = totalVolume > 0 ? margin / totalVolume : 0;

  const monthlyData = useMemo(() => {
    const map = new Map<string, { revenue: number; margin: number }>();
    for (const e of ledger) {
      const month = e.entryDate.slice(0, 7);
      const cur = map.get(month) ?? { revenue: 0, margin: 0 };
      if (e.accountCode === "3100") cur.revenue += e.credit - e.debit;
      if (e.accountCode === "3200") cur.margin += e.credit - e.debit;
      map.set(month, cur);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, vals]) => ({
        month: new Date(month + "-01").toLocaleString("en-IN", { month: "short", year: "2-digit" }),
        Revenue: toL(vals.revenue),
        Margin: toL(vals.margin),
      }));
  }, [ledger]);

  const materialData = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of lots.filter((l) => l.status === "Settled" || l.status === "Invoiced")) {
      map.set(l.materialName, (map.get(l.materialName) ?? 0) + l.netWeight);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
  }, [lots]);
  const totalMT = materialData.reduce((s, d) => s + d.value, 0);

  const PIPELINE: { status: LotStatus; label: string; color: string }[] = [
    { status: "Draft", label: "Draft", color: "#9ca3af" },
    { status: "Mapped", label: "Mapped", color: "#3b82f6" },
    { status: "QualityHold", label: "Hold", color: "#f59e0b" },
    { status: "Approved", label: "Approved", color: "#8b5cf6" },
    { status: "Settled", label: "Settled", color: "#22c55e" },
    { status: "Invoiced", label: "Invoiced", color: "#10b981" },
  ];
  const pipelineCounts = useMemo(() => {
    const c: Partial<Record<LotStatus, number>> = {};
    for (const l of periodLots) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [periodLots]);

  return (
    <div className="grid gap-6">
      {/* Hero banner */}
      <div className="rounded-2xl bg-[#172018] p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#4ade80] mb-1">Akshaya Agri Intelligence</p>
            <h2 className="text-2xl font-bold">Financial Overview</h2>
            <p className="text-sm text-[#6ee7b7] mt-1">Agri commodity trading · Model A · Sarvani Biofuels</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Revenue", value: inr(revenue, true) },
              { label: "Margin", value: inr(margin, true) },
              { label: "Volume", value: `${fmt2(totalVolume)} MT` },
              { label: "AR Due", value: inr(arOutstanding, true) },
            ].map((k) => (
              <div key={k.label} className="text-center rounded-xl bg-white/10 px-4 py-3">
                <p className="text-xs text-[#6ee7b7] mb-0.5">{k.label}</p>
                <p className="text-lg font-bold">{k.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Revenue Posted" value={inr(revenue, true)} sub={`${settledCount} lots settled`} icon={TrendingUp} accent="green" />
        <KpiCard label="Trading Margin" value={inr(margin, true)} sub={`${marginPct.toFixed(1)}% · ${inr(marginPerMT)}/MT avg`} icon={Activity} accent="green" />
        <KpiCard label="Net Volume" value={`${fmt2(totalVolume)} MT`} sub={`${periodLots.length} lots received`} icon={Layers} />
        <KpiCard label="AR Outstanding" value={inr(arOutstanding, true)} sub={`AP payable ${inr(apOutstanding, true)}`} icon={Wallet} accent={arOutstanding > 500000 ? "amber" : "neutral"} />
      </div>

      {/* Monthly Trend */}
      <SectionCard title="Revenue & Margin Trend" subtitle="Monthly (₹ Lakhs) — last 12 months">
        {monthlyData.length === 0 ? <EmptyState message="No ledger data yet" /> : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#15803d" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#15803d" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gMgn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#172018" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#172018" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#edf0e8" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9aad9c" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9aad9c" }} axisLine={false} tickLine={false} width={38} tickFormatter={(v) => `${v}L`} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="Revenue" stroke="#15803d" strokeWidth={2.5} fill="url(#gRev)" dot={false} activeDot={{ r: 5, fill: "#15803d" }} />
                <Area type="monotone" dataKey="Margin" stroke="#172018" strokeWidth={2} fill="url(#gMgn)" dot={false} activeDot={{ r: 4, fill: "#172018" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      {/* Commodity mix + Pipeline */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Commodity Mix" subtitle="Settled volume by material (MT)">
          {materialData.length === 0 ? <EmptyState message="No settled lots" /> : (
            <div className="flex items-center gap-6">
              <div style={{ height: 200, width: 200 }} className="shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={materialData} dataKey="value" innerRadius={52} outerRadius={88} paddingAngle={3} startAngle={90} endAngle={-270}>
                      {materialData.map((_, i) => <Cell key={i} fill={MAT_COLORS[i % MAT_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: unknown) => typeof v === "number" ? `${v.toFixed(2)} MT` : String(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #d8decf" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid gap-3 flex-1 min-w-0">
                {materialData.map((d, i) => {
                  const pct = totalMT > 0 ? (d.value / totalMT) * 100 : 0;
                  return (
                    <div key={d.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: MAT_COLORS[i % MAT_COLORS.length] }} />
                          <span className="text-sm font-semibold text-[#172018] truncate">{d.name}</span>
                        </div>
                        <span className="text-xs font-bold text-[#60735d] ml-2 shrink-0">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#eef3e8] overflow-hidden">
                        <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: MAT_COLORS[i % MAT_COLORS.length] }} />
                      </div>
                      <p className="text-xs text-[#9aad9c] mt-0.5 text-right">{fmt2(d.value)} MT</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Lot Pipeline" subtitle={`${periodLots.length} lots in selected period`}>
          <div className="grid gap-3">
            {PIPELINE.map((stage) => {
              const count = pipelineCounts[stage.status] ?? 0;
              const pct = periodLots.length > 0 ? (count / periodLots.length) * 100 : 0;
              return (
                <div key={stage.status} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-20 shrink-0">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: stage.color }} />
                    <span className="text-sm text-[#60735d]">{stage.label}</span>
                  </div>
                  <div className="flex-1 h-7 rounded-lg bg-[#f0f4ec] overflow-hidden">
                    <div
                      className="h-7 rounded-lg flex items-center justify-end pr-2 transition-all duration-700"
                      style={{ width: count > 0 ? `${Math.max(12, pct)}%` : "0%", background: stage.color }}
                    >
                      {count > 0 && <span className="text-xs font-bold text-white">{count}</span>}
                    </div>
                  </div>
                  {count === 0 && <span className="text-xs text-[#c8d4c0] w-4">0</span>}
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ── TAB 2: P&L ────────────────────────────────────────────────────────────────
function PLTab({ data, period }: { data: DataBundle; period: Period }) {
  const { ledger } = data;
  const periodLedger = useMemo(() => ledger.filter((e) => inPeriod(e.entryDate, period)), [ledger, period]);

  const pl = useMemo(() => {
    const nc = (code: string) => periodLedger.filter((e) => e.accountCode === code).reduce((s, e) => s + e.credit - e.debit, 0);
    const nd = (code: string) => periodLedger.filter((e) => e.accountCode === code).reduce((s, e) => s + e.debit - e.credit, 0);
    const revenue = nc("3100");
    const qualityDed = nc("4101") + nc("4102") + nc("4199");
    const cess = nd("5101");
    const margin = nc("3200");
    const opExp = ["5201","5202","5203","5204","5205","5206","5207","5208"].reduce((s, c) => s + nd(c), 0);
    return { revenue, qualityDed, cess, margin, opExp, netProfit: margin - opExp };
  }, [periodLedger]);

  const marginPct = pl.revenue > 0 ? (pl.margin / pl.revenue) * 100 : 0;
  const netPct = pl.revenue > 0 ? (pl.netProfit / pl.revenue) * 100 : 0;

  const barData = [
    { name: "Revenue", value: toL(pl.revenue), fill: "#15803d" },
    { name: "Qual. Ded.", value: toL(Math.abs(pl.qualityDed)), fill: "#fca5a5" },
    { name: "Cess", value: toL(pl.cess), fill: "#fcd34d" },
    { name: "Margin", value: toL(pl.margin), fill: "#172018" },
    ...(pl.opExp > 0 ? [{ name: "Op. Exp.", value: toL(pl.opExp), fill: "#f87171" }] : []),
    { name: "Net Profit", value: toL(pl.netProfit), fill: pl.netProfit >= 0 ? "#064e3b" : "#dc2626" },
  ];

  const rows: { code: string; label: string; value: number; isTotal?: boolean; isNeg?: boolean; indent?: boolean }[] = [
    { code: "3100", label: "Revenue from Operations", value: pl.revenue },
    { code: "4xxx", label: "Less: Quality Pass-through Deductions", value: -Math.abs(pl.qualityDed), isNeg: true, indent: true },
    { code: "5101", label: "Less: Cess Pass-through", value: -pl.cess, isNeg: true, indent: true },
    { code: "3200", label: "Gross Trading Margin", value: pl.margin },
    ...(pl.opExp > 0 ? [{ code: "52xx", label: "Less: Operating Expenses", value: -pl.opExp, isNeg: true, indent: true }] : []),
    { code: "NET", label: "Net Profit / (Loss)", value: pl.netProfit, isTotal: true },
  ];

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total Revenue" value={inr(pl.revenue, true)} sub="from settled lots" icon={TrendingUp} accent="green" />
        <KpiCard label="Gross Margin" value={inr(pl.margin, true)} sub={`${marginPct.toFixed(1)}% of revenue`} icon={Activity} accent="green" />
        <KpiCard label="Net Profit" value={inr(pl.netProfit, true)} sub={`${netPct.toFixed(1)}% net margin`} accent={pl.netProfit >= 0 ? "green" : "red"} />
      </div>

      <SectionCard title="P&L Breakdown" subtitle="₹ Lakhs — income vs deductions">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#edf0e8" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9aad9c" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9aad9c" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}L`} width={40} />
              <Tooltip formatter={(v: unknown) => typeof v === "number" ? [`₹${v.toFixed(1)}L`] : [String(v)]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #d8decf" }} />
              <ReferenceLine y={0} stroke="#d8decf" />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {barData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard title="Income Statement" noPad>
        <table className="w-full text-sm">
          <thead className="bg-[#f8faf5]">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-[#60735d]">Description</th>
              <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-[#60735d]">Amount</th>
              <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-[#60735d] hidden sm:table-cell">% Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pct = pl.revenue > 0 ? (Math.abs(row.value) / pl.revenue) * 100 : 0;
              return (
                <tr key={row.code} className={`border-t ${row.isTotal ? "border-t-2 border-[#172018] bg-[#f8faf5] font-bold" : "border-[#edf0e8] hover:bg-[#fafcf8]"}`}>
                  <td className={`px-6 py-4 ${row.indent ? "pl-10" : ""}`}>
                    <div className="flex items-center gap-2">
                      {!row.isTotal && <span className="font-mono text-xs text-[#c8d4c0]">{row.code}</span>}
                      <span className={row.isTotal ? "text-base" : ""}>{row.label}</span>
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-right font-semibold ${
                    row.isTotal ? (row.value >= 0 ? "text-[#15803d] text-lg" : "text-[#dc2626] text-lg")
                    : row.isNeg ? "text-[#dc2626]" : "text-[#172018]"
                  }`}>{inr(row.value)}</td>
                  <td className="px-6 py-4 text-right text-xs text-[#9aad9c] hidden sm:table-cell">
                    {!row.isTotal && `${pct.toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}

// ── TAB 3: Cash Flow ──────────────────────────────────────────────────────────
function CashFlowTab({ data, period }: { data: DataBundle; period: Period }) {
  const { ledger } = data;
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

  const periodLedger = useMemo(() => ledger.filter((e) => inPeriod(e.entryDate, period)), [ledger, period]);

  const ar = useMemo(() => {
    const p1201 = periodLedger.filter((e) => e.accountCode === "1201");
    const billed = p1201.reduce((s, e) => s + e.debit, 0);
    const collected = p1201.reduce((s, e) => s + e.credit, 0);
    const outstanding = Math.max(0, ledger.filter((e) => e.accountCode === "1201").reduce((s, e) => s + e.debit - e.credit, 0));
    return { billed, collected, outstanding, efficiency: billed > 0 ? (collected / billed) * 100 : 0 };
  }, [periodLedger, ledger]);

  interface SupPay { name: string; invoiced: number; paid: number; outstanding: number; lastDate: string; lines: LedgerEntry[]; }
  const supplierPayables = useMemo((): SupPay[] => {
    const map = new Map<string, LedgerEntry[]>();
    for (const e of ledger.filter((e) => e.accountCode === "2101")) {
      const k = e.partyName ?? "Unknown";
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    return [...map.entries()].map(([name, lines]) => ({
      name,
      invoiced: lines.reduce((s, e) => s + e.credit, 0),
      paid: lines.reduce((s, e) => s + e.debit, 0),
      outstanding: Math.max(0, lines.reduce((s, e) => s + e.credit - e.debit, 0)),
      lastDate: [...lines].sort((a, b) => b.entryDate.localeCompare(a.entryDate))[0]?.entryDate ?? "",
      lines,
    })).sort((a, b) => b.outstanding - a.outstanding);
  }, [ledger]);

  const totalAP = supplierPayables.reduce((s, r) => s + r.outstanding, 0);
  const collectedPct = Math.min(100, ar.billed > 0 ? (ar.collected / ar.billed) * 100 : 0);

  return (
    <div className="grid gap-6">
      <SectionCard title="Customer Receivables — Sarvani Biofuels" subtitle="Account 1201">
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <KpiCard label="Billed (Period)" value={inr(ar.billed, true)} accent="green" icon={TrendingUp} />
          <KpiCard label="Collected (Period)" value={inr(ar.collected, true)} accent="green" icon={Activity} />
          <KpiCard label="Outstanding (All Time)" value={inr(ar.outstanding, true)} accent={ar.outstanding > 500000 ? "amber" : "neutral"} icon={Wallet} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-[#60735d]">Collection Progress</p>
            <p className="text-xs font-bold text-[#172018]">{ar.efficiency.toFixed(1)}% collected</p>
          </div>
          <div className="relative h-6 rounded-full bg-[#eef3e8] overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-[#15803d] rounded-full transition-all duration-700" style={{ width: `${collectedPct}%` }} />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-[#9aad9c]">
            <span>Collected {inr(ar.collected, true)}</span>
            <span>Pending {inr(ar.outstanding, true)}</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Supplier Payables" subtitle="Account 2101 — all-time balances" noPad>
        {supplierPayables.length === 0 ? <div className="p-6"><EmptyState message="No supplier payable entries" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f8faf5]">
                <tr>
                  {["", "Supplier", "Invoiced / Payable", "Paid", "Outstanding", "Last Activity"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[#60735d] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {supplierPayables.map((row) => (
                  <React.Fragment key={row.name}>
                    <tr className="border-t border-[#edf0e8] hover:bg-[#fafcf8] cursor-pointer"
                      onClick={() => setExpandedSupplier(expandedSupplier === row.name ? null : row.name)}>
                      <td className="pl-5 pr-2 py-3.5">
                        {expandedSupplier === row.name
                          ? <ChevronDown size={14} className="text-[#60735d]" />
                          : <ChevronRight size={14} className="text-[#c8d4c0]" />}
                      </td>
                      <td className="px-5 py-3.5 font-semibold">{row.name}</td>
                      <td className="px-5 py-3.5">{inr(row.invoiced)}</td>
                      <td className="px-5 py-3.5 text-[#15803d] font-semibold">{inr(row.paid)}</td>
                      <td className="px-5 py-3.5 font-bold text-[#d97706]">{inr(row.outstanding)}</td>
                      <td className="px-5 py-3.5 text-[#9aad9c] text-xs">{row.lastDate}</td>
                    </tr>
                    {expandedSupplier === row.name && (
                      <tr><td colSpan={6} className="px-5 pb-4 pt-0 bg-[#fafcf8]">
                        <div className="rounded-xl border border-[#edf0e8] overflow-hidden mt-1">
                          <table className="w-full text-xs">
                            <thead className="bg-[#f0f4ec] text-[#60735d]">
                              <tr>{["Date", "Narration", "Debit", "Credit", "Ref"].map((h) => (
                                <th key={h} className="px-4 py-2 text-left font-semibold">{h}</th>
                              ))}</tr>
                            </thead>
                            <tbody>
                              {[...row.lines].sort((a, b) => b.entryDate.localeCompare(a.entryDate)).slice(0, 10).map((line) => (
                                <tr key={line.id} className="border-t border-[#edf0e8]">
                                  <td className="px-4 py-2 text-[#9aad9c]">{line.entryDate}</td>
                                  <td className="px-4 py-2 max-w-xs truncate">{line.narration}</td>
                                  <td className="px-4 py-2 text-[#dc2626]">{line.debit > 0 ? inr(line.debit) : "—"}</td>
                                  <td className="px-4 py-2 text-[#15803d]">{line.credit > 0 ? inr(line.credit) : "—"}</td>
                                  <td className="px-4 py-2 font-mono text-[#9aad9c]">{line.sourceRef}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                ))}
                <tr className="border-t-2 border-[#172018] bg-[#f8faf5]">
                  <td colSpan={4} className="px-5 py-3.5 font-semibold">Total Outstanding</td>
                  <td className="px-5 py-3.5 font-bold text-[#d97706] text-lg">{inr(totalAP)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── TAB 4: Commodity ──────────────────────────────────────────────────────────
function CommodityTab({ data, period }: { data: DataBundle; period: Period }) {
  const { lots } = data;

  const periodLots = useMemo(
    () => lots.filter((l) => inPeriod(l.lotDate, period) && (l.status === "Settled" || l.status === "Invoiced")),
    [lots, period],
  );

  interface MatRow {
    name: string; lots: number; mt: number; grossValue: number;
    deductions: number; margin: number; marginPerMT: number; deductionPct: number;
  }

  const matRows = useMemo((): MatRow[] => {
    const map = new Map<string, MatRow>();
    for (const l of periodLots) {
      const ded = Object.values(l.paramDeductions).reduce((s, v) => s + v, 0);
      const m = l.akshayaMarginPerMT * l.netWeight;
      const cur = map.get(l.materialName) ?? { name: l.materialName, lots: 0, mt: 0, grossValue: 0, deductions: 0, margin: 0, marginPerMT: 0, deductionPct: 0 };
      map.set(l.materialName, { ...cur, lots: cur.lots + 1, mt: cur.mt + l.netWeight, grossValue: cur.grossValue + l.grossSaleValue, deductions: cur.deductions + ded, margin: cur.margin + m });
    }
    return [...map.values()].map((r) => ({
      ...r,
      marginPerMT: r.mt > 0 ? r.margin / r.mt : 0,
      deductionPct: r.grossValue > 0 ? (r.deductions / r.grossValue) * 100 : 0,
    })).sort((a, b) => b.mt - a.mt);
  }, [periodLots]);

  const supplierData = useMemo(() => {
    const map = new Map<string, { mt: number; value: number }>();
    for (const l of periodLots) {
      const name = l.supplierName ?? l.farmerName ?? "Unknown";
      const cur = map.get(name) ?? { mt: 0, value: 0 };
      map.set(name, { mt: cur.mt + l.netWeight, value: cur.value + l.grossSaleValue });
    }
    return [...map.entries()]
      .sort((a, b) => b[1].mt - a[1].mt)
      .slice(0, 8)
      .map(([name, v]) => ({ name: name.length > 14 ? name.slice(0, 12) + "…" : name, MT: Math.round(v.mt * 10) / 10, Value: toL(v.value) }));
  }, [periodLots]);

  const matBarData = matRows.map((r, i) => ({
    name: r.name,
    "Volume MT": Math.round(r.mt * 10) / 10,
    "Margin (L)": toL(r.margin),
    fill: MAT_COLORS[i % MAT_COLORS.length],
  }));

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Materials Traded" value={String(matRows.length)} sub="commodity types" icon={Layers} />
        <KpiCard label="Volume (Settled)" value={`${fmt2(matRows.reduce((s, r) => s + r.mt, 0))} MT`} icon={Activity} accent="green" />
        <KpiCard label="Total Margin" value={inr(matRows.reduce((s, r) => s + r.margin, 0), true)} icon={TrendingUp} accent="green" />
      </div>

      <SectionCard title="Material-wise Performance" subtitle="Settled lots in period" noPad>
        {matRows.length === 0 ? <div className="p-6"><EmptyState message="No settled lots in this period" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f8faf5]">
                <tr>
                  {["Material", "Lots", "Net MT", "Gross Value", "Deductions", "Ded. %", "Margin", "₹/MT"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[#60735d] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matRows.map((r, i) => (
                  <tr key={r.name} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ background: MAT_COLORS[i % MAT_COLORS.length] }} />
                        <span className="font-semibold">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">{r.lots}</td>
                    <td className="px-5 py-4 font-bold">{fmt2(r.mt)} MT</td>
                    <td className="px-5 py-4">{inr(r.grossValue)}</td>
                    <td className="px-5 py-4 text-[#dc2626]">{r.deductions > 0 ? inr(r.deductions) : "—"}</td>
                    <td className="px-5 py-4 text-[#d97706]">{r.deductionPct.toFixed(2)}%</td>
                    <td className="px-5 py-4 font-semibold text-[#15803d]">{inr(r.margin)}</td>
                    <td className="px-5 py-4 text-[#60735d]">{inr(r.marginPerMT)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {matBarData.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Volume vs Margin by Material">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={matBarData} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#edf0e8" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9aad9c" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="mt" tick={{ fontSize: 10, fill: "#9aad9c" }} axisLine={false} tickLine={false} width={32} />
                  <YAxis yAxisId="l" orientation="right" tick={{ fontSize: 10, fill: "#9aad9c" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}L`} width={36} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #d8decf" }} />
                  <Bar yAxisId="mt" dataKey="Volume MT" radius={[4, 4, 0, 0]}>
                    {matBarData.map((d, i) => <Cell key={i} fill={MAT_COLORS[i % MAT_COLORS.length]} />)}
                  </Bar>
                  <Bar yAxisId="l" dataKey="Margin (L)" fill="#172018" radius={[4, 4, 0, 0]} opacity={0.5} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard title="Top Suppliers by Volume">
            {supplierData.length === 0 ? <EmptyState message="No settled supplier lots" /> : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={supplierData} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#edf0e8" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#9aad9c" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}MT`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#60735d" }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #d8decf" }} />
                    <Bar dataKey="MT" fill="#172018" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}

// ── TAB 5: Settlement ─────────────────────────────────────────────────────────
function SettlementTab({ data, period }: { data: DataBundle; period: Period }) {
  const { lots, materials } = data;
  const [search, setSearch] = useState("");

  function cessBalance(l: InwardLot): number {
    const mat = materials.find((m) => m.id === l.materialId);
    const cessRate = mat?.cessRate ?? 0;
    const total = Math.round((cessRate / 100) * l.netWeight * l.grossSaleRate * 100) / 100;
    return Math.max(0, total - l.cessAmount);
  }

  const settledLots = useMemo(
    () => lots.filter((l) => inPeriod(l.lotDate, period) && (l.status === "Settled" || l.status === "Invoiced")),
    [lots, period],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return settledLots;
    const q = search.toLowerCase();
    return settledLots.filter(
      (l) => l.documentRef.toLowerCase().includes(q) || l.materialName.toLowerCase().includes(q)
        || (l.supplierName ?? "").toLowerCase().includes(q) || (l.farmerName ?? "").toLowerCase().includes(q),
    );
  }, [settledLots, search]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => b.lotDate.localeCompare(a.lotDate)), [filtered]);

  const totals = useMemo(() => ({
    mt: settledLots.reduce((s, l) => s + l.netWeight, 0),
    gross: settledLots.reduce((s, l) => s + l.netWeight * l.grossSaleRate, 0),
    ded: settledLots.reduce((s, l) => s + Object.values(l.paramDeductions).reduce((a, v) => a + v, 0), 0),
    cess: settledLots.reduce((s, l) => s + cessBalance(l), 0),
    margin: settledLots.reduce((s, l) => s + l.akshayaMarginPerMT * l.netWeight, 0),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [settledLots]);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Lots Settled" value={String(settledLots.length)} accent="green" />
        <KpiCard label="Total Volume" value={`${fmt2(totals.mt)} MT`} accent="green" />
        <KpiCard label="Gross Notional" value={inr(totals.gross, true)} accent="green" />
        <KpiCard label="Margin Earned" value={inr(totals.margin, true)} accent="green" />
      </div>

      <SectionCard
        title="Settled Lots"
        subtitle={`${settledLots.length} lots · ${sorted.length} shown`}
        noPad
        action={
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9aad9c]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lot, material, supplier…"
              className="rounded-lg border border-[#c8d4c0] pl-8 pr-3 py-1.5 text-xs w-52 focus:outline-none focus:ring-1 focus:ring-[#172018]"
            />
          </div>
        }
      >
        {sorted.length === 0 ? <div className="p-6"><EmptyState message="No settled lots in this period" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f8faf5]">
                <tr>
                  {["Lot Ref", "Date", "Material", "Supplier", "Net MT", "Rate", "Gross", "Deductions", "Cess", "Margin", "Net Payout"].map((h) => (
                    <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[#60735d] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((l) => {
                  const ded = Object.values(l.paramDeductions).reduce((s, v) => s + v, 0);
                  const cb = cessBalance(l);
                  const margin = l.akshayaMarginPerMT * l.netWeight;
                  const netPayout = l.grossSaleValue - cb - margin - (l.holdPenalty ?? 0);
                  return (
                    <tr key={l.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                      <td className="px-4 py-3.5 font-mono text-xs font-semibold">{l.documentRef}</td>
                      <td className="px-4 py-3.5 text-[#9aad9c] text-xs">{l.lotDate}</td>
                      <td className="px-4 py-3.5">{l.materialName}</td>
                      <td className="px-4 py-3.5 text-[#536251]">{l.supplierName ?? l.farmerName ?? "—"}</td>
                      <td className="px-4 py-3.5 font-bold">{fmt2(l.netWeight)}</td>
                      <td className="px-4 py-3.5">₹{l.grossSaleRate.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3.5">{inr(l.netWeight * l.grossSaleRate)}</td>
                      <td className="px-4 py-3.5 text-[#dc2626]">{ded > 0 ? inr(ded) : "—"}</td>
                      <td className="px-4 py-3.5 text-[#d97706]">{cb > 0 ? inr(cb) : "—"}</td>
                      <td className="px-4 py-3.5 text-[#15803d]">{inr(margin)}</td>
                      <td className="px-4 py-3.5 font-semibold">{inr(netPayout)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-[#172018] bg-[#f8faf5] font-semibold">
                  <td className="px-4 py-3.5" colSpan={4}>Total ({sorted.length} lots)</td>
                  <td className="px-4 py-3.5">{fmt2(totals.mt)} MT</td>
                  <td />
                  <td className="px-4 py-3.5">{inr(totals.gross)}</td>
                  <td className="px-4 py-3.5 text-[#dc2626]">{totals.ded > 0 ? inr(totals.ded) : "—"}</td>
                  <td className="px-4 py-3.5 text-[#d97706]">{totals.cess > 0 ? inr(totals.cess) : "—"}</td>
                  <td className="px-4 py-3.5 text-[#15803d]">{inr(totals.margin)}</td>
                  <td className="px-4 py-3.5">{inr(totals.gross - totals.cess - totals.margin)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── TAB 6: GST ────────────────────────────────────────────────────────────────
function GSTTab({ data, period }: { data: DataBundle; period: Period }) {
  const { invoices, materials } = data;
  const periodInv = useMemo(() => invoices.filter((i) => inPeriod(i.invoiceDate, period)), [invoices, period]);

  const totals = useMemo(() => ({
    taxableValue: periodInv.reduce((s, i) => s + i.taxableValue, 0),
    gst: periodInv.reduce((s, i) => s + i.totalTax, 0),
    exempt: periodInv.filter((i) => i.totalTax === 0).reduce((s, i) => s + i.taxableValue, 0),
  }), [periodInv]);

  const hsnRows = useMemo(() => {
    const map = new Map<string, { hsn: string; material: string; qty: number; uom: string; taxableValue: number; cgst: number; sgst: number; igst: number; total: number }>();
    for (const inv of periodInv) {
      const mat = materials.find((m) => m.id === inv.materialId);
      const hsn = mat?.hsn ?? "N/A";
      const cur = map.get(hsn) ?? { hsn, material: inv.materialName, qty: 0, uom: inv.uom, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
      map.set(hsn, { ...cur, qty: cur.qty + inv.quantity, taxableValue: cur.taxableValue + inv.taxableValue, cgst: cur.cgst + inv.cgstAmount, sgst: cur.sgst + inv.sgstAmount, igst: cur.igst + inv.igstAmount, total: cur.total + inv.totalValue });
    }
    return [...map.values()].sort((a, b) => a.hsn.localeCompare(b.hsn));
  }, [periodInv, materials]);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total Invoices" value={String(periodInv.length)} icon={Receipt} />
        <KpiCard label="Taxable Value" value={inr(totals.taxableValue, true)} icon={TrendingUp} accent="green" />
        <KpiCard label="GST Collected" value={inr(totals.gst, true)} sub={`Ag-exempt: ${inr(totals.exempt, true)}`} accent={totals.gst > 0 ? "amber" : "neutral"} />
      </div>

      <SectionCard title="HSN-wise Summary" noPad>
        {hsnRows.length === 0 ? <div className="p-6"><EmptyState message="No invoices in this period" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f8faf5]">
                <tr>
                  {["HSN", "Material", "Qty", "Taxable Value", "CGST", "SGST", "IGST", "Total"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[#60735d] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hsnRows.map((row) => (
                  <tr key={row.hsn} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                    <td className="px-5 py-3.5 font-mono text-sm">{row.hsn}</td>
                    <td className="px-5 py-3.5 font-semibold">{row.material}</td>
                    <td className="px-5 py-3.5">{fmt2(row.qty)} {row.uom}</td>
                    <td className="px-5 py-3.5 font-bold">{inr(row.taxableValue)}</td>
                    <td className="px-5 py-3.5 text-[#536251]">{row.cgst > 0 ? inr(row.cgst) : "—"}</td>
                    <td className="px-5 py-3.5 text-[#536251]">{row.sgst > 0 ? inr(row.sgst) : "—"}</td>
                    <td className="px-5 py-3.5 text-[#536251]">{row.igst > 0 ? inr(row.igst) : "—"}</td>
                    <td className="px-5 py-3.5 font-semibold">{inr(row.total)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-[#172018] bg-[#f8faf5]">
                  <td colSpan={3} className="px-5 py-3.5 font-semibold">Total</td>
                  <td className="px-5 py-3.5 font-semibold">{inr(hsnRows.reduce((s, r) => s + r.taxableValue, 0))}</td>
                  <td className="px-5 py-3.5 font-bold">{inr(hsnRows.reduce((s, r) => s + r.cgst, 0))}</td>
                  <td className="px-5 py-3.5 font-bold">{inr(hsnRows.reduce((s, r) => s + r.sgst, 0))}</td>
                  <td className="px-5 py-3.5 font-bold">{inr(hsnRows.reduce((s, r) => s + r.igst, 0))}</td>
                  <td className="px-5 py-3.5 font-semibold">{inr(hsnRows.reduce((s, r) => s + r.total, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="grid gap-6 animate-pulse">
      <div className="rounded-2xl bg-[#edf0e8] h-32" />
      <div className="grid gap-4 sm:grid-cols-4">{[1,2,3,4].map((i) => <div key={i} className="rounded-2xl bg-[#edf0e8] h-28" />)}</div>
      <div className="rounded-2xl bg-[#edf0e8] h-72" />
      <div className="grid gap-4 lg:grid-cols-2">{[1,2].map((i) => <div key={i} className="rounded-2xl bg-[#edf0e8] h-56" />)}</div>
    </div>
  );
}

// ── Root page ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { fy: globalFy } = useGlobalFY();
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DataBundle>({ lots: [], ledger: [], vouchers: [], invoices: [], materials: [], parties: [] });
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [period, setPeriod] = useState<Period>(() =>
    globalFy.dateFrom
      ? { quick: "custom", from: globalFy.dateFrom, to: globalFy.dateTo }
      : { quick: "fy", ...periodBounds("fy") },
  );

  useEffect(() => {
    setPeriod(
      globalFy.dateFrom
        ? { quick: "custom", from: globalFy.dateFrom, to: globalFy.dateTo }
        : { quick: "fy", ...periodBounds("fy") },
    );
  }, [globalFy.dateFrom, globalFy.dateTo]);

  const load = useCallback(() => {
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
        setData({
          lots: Array.isArray(lots) ? lots : [],
          ledger: Array.isArray(ledger) ? ledger : [],
          vouchers: Array.isArray(vouchers) ? vouchers : [],
          invoices: Array.isArray(invoices) ? invoices : [],
          materials: Array.isArray(materials) ? materials : [],
          parties: Array.isArray(parties) ? parties : [],
        });
        setLastUpdated(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="grid gap-5">
      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {TABS.map((t) => {
          const Icon = TAB_ICONS[t];
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-all flex items-center gap-1.5 ${
                tab === t ? "bg-[#172018] text-white shadow-sm" : "border border-[#c8d4c0] bg-white text-[#536251] hover:bg-[#f0f4ec]"
              }`}
            >
              <Icon size={14} />
              {t}
            </button>
          );
        })}
      </div>

      {/* Period selector */}
      <PeriodBar period={period} onChange={setPeriod} lastUpdated={lastUpdated} onRefresh={load} loading={loading} />

      {/* Content */}
      {loading ? <Skeleton /> : error ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-[#dc2626]">
          <AlertCircle size={32} strokeWidth={1.5} />
          <p className="text-sm">{error}</p>
        </div>
      ) : (
        <>
          {tab === "Dashboard" && <DashboardTab data={data} period={period} />}
          {tab === "P&L" && <PLTab data={data} period={period} />}
          {tab === "Cash Flow" && <CashFlowTab data={data} period={period} />}
          {tab === "Commodity" && <CommodityTab data={data} period={period} />}
          {tab === "Settlement" && <SettlementTab data={data} period={period} />}
          {tab === "GST" && <GSTTab data={data} period={period} />}
        </>
      )}
    </div>
  );
}
