"use client";

import { useState } from "react";
import { KPIS, INWARD_LOTS, INVOICES, MATERIALS } from "../../../lib/data/seed";

const TABS = ["KPI", "Ageing", "Margins", "GST"] as const;
type Tab = (typeof TABS)[number];

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function ReportCard({ title, copy, action = "Open report" }: { title: string; copy: string; action?: string }) {
  return (
    <div className="rounded-xl border border-[#d8decf] bg-white p-5">
      <h3 className="text-lg font-black">{title}</h3>
      <p className="mt-3 min-h-[3.5rem] text-sm leading-6 text-[#60735d]">{copy}</p>
      <div className="mt-4 flex gap-2">
        <button className="rounded-md border border-[#9baa91] px-4 py-2 text-sm font-black hover:bg-[#f3f6ef]">{action}</button>
        <button className="rounded-md border border-[#c8d4c0] px-4 py-2 text-sm font-black hover:bg-[#f3f6ef]">Export</button>
      </div>
    </div>
  );
}

function KPITab() {
  const toneCls = (tone: string) =>
    tone === "risk" ? "text-[#a04428]" : tone === "warn" ? "text-[#7f6418]" : "text-[#2e7d32]";

  const dailySupply = INWARD_LOTS.reduce((s, l) => s + l.acceptedWeight, 0);
  const totalInvoiced = INVOICES.reduce((s, i) => s + i.totalValue, 0);
  const totalDue = INVOICES.filter((i) => i.amountDue > 0).reduce((s, i) => s + i.amountDue, 0);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {KPIS.map((k) => (
          <div key={k.label} className="rounded-xl border border-[#d8decf] bg-white p-5">
            <p className="text-sm text-[#60735d]">{k.label}</p>
            <p className="mt-2 text-3xl font-black">{k.value}</p>
            <p className={`mt-1 text-sm ${toneCls(k.tone)}`}>{k.note}</p>
          </div>
        ))}
      </div>

      {/* Volume by material */}
      <div className="rounded-xl border border-[#d8decf] bg-white p-5">
        <h3 className="mb-4 text-lg font-black">Inward volume by material — today</h3>
        <div className="grid gap-3">
          {[
            { material: "Maize", qty: 462.72, pct: 95 },
            { material: "Biomass", qty: 20.72, pct: 4.2 },
            { material: "Paddy Husk", qty: 3.28, pct: 0.8 },
          ].map(({ material, qty, pct }) => (
            <div key={material} className="flex items-center gap-4">
              <span className="w-28 text-sm font-black shrink-0">{material}</span>
              <div className="flex-1 h-5 rounded-full bg-[#eef3e8]">
                <div className="h-5 rounded-full bg-[#172018] transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-28 text-right text-sm font-bold text-[#60735d]">{qty} MT ({pct}%)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "May inward (cumulative)", value: `${dailySupply.toFixed(0)} MT`, sub: "All models combined" },
          { label: "Total invoiced (May)", value: inr(totalInvoiced), sub: "Sarvani + traders" },
          { label: "Total outstanding", value: inr(totalDue), sub: "Receivables" },
          { label: "Average daily supply", value: "486 MT", sub: "Rolling 7-day avg" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-xl border border-[#d8decf] bg-white p-5">
            <p className="text-sm text-[#60735d]">{label}</p>
            <p className="mt-2 text-2xl font-black">{value}</p>
            <p className="mt-1 text-xs text-[#8a9e87]">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgeingTab() {
  const receivables = [
    { party: "Sarvani Biofuels Pvt Ltd", type: "Customer", total: 10951200, current: 10951200, d30: 0, d60: 0, d90: 0, overdue: 0 },
    { party: "Sri Lakshmi Feeds", type: "Trader", total: 312300, current: 312300, d30: 0, d60: 0, d90: 0, overdue: 0 },
  ];
  const payables = [
    { party: "Mallikarjuna Traders", type: "Supplier", total: 825400, current: 825400, d30: 0, d60: 0, d90: 0, overdue: 0 },
    { party: "Farmer Finance Pool", type: "Control A/c", total: 490829, current: 490829, d30: 0, d60: 0, d90: 0, overdue: 0 },
  ];

  function AgeTable({ data, title }: { data: typeof receivables; title: string }) {
    return (
      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-black">{title}</h3>
          <button className="rounded-md border border-[#9baa91] px-3.5 py-1.5 text-sm font-black hover:bg-[#f3f6ef]">Export</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
              <tr>
                {["Party", "Type", "Total", "Current (0–30d)", "31–60 days", "61–90 days", "90+ days", "Action"].map((h) => (
                  <th key={h} className="px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.party} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                  <td className="px-5 py-3.5 font-black">{row.party}</td>
                  <td className="px-5 py-3.5 text-[#536251]">{row.type}</td>
                  <td className="px-5 py-3.5 font-black">{inr(row.total)}</td>
                  <td className="px-5 py-3.5 text-[#15803d] font-bold">{inr(row.current)}</td>
                  <td className="px-5 py-3.5 text-[#536251]">{row.d30 > 0 ? inr(row.d30) : "—"}</td>
                  <td className="px-5 py-3.5 text-[#536251]">{row.d60 > 0 ? inr(row.d60) : "—"}</td>
                  <td className="px-5 py-3.5 text-[#dc2626] font-bold">{row.overdue > 0 ? inr(row.overdue) : "—"}</td>
                  <td className="px-5 py-3.5">
                    <button className="text-xs font-black text-[#1d4ed8] hover:underline">Share statement</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <AgeTable data={receivables} title="Customer receivable ageing" />
      <AgeTable data={payables} title="Supplier payable ageing" />
    </div>
  );
}

function MarginsTab() {
  const materialMargins = [
    { material: "Maize", model: "A/B", qty: "486.72 MT", saleRate: 22500, procureCost: 21800, deductions: 380, netMargin: 320, marginPct: 1.42 },
    { material: "DDGS", model: "C", qty: "18.50 MT", saleRate: 18000, procureCost: 15200, deductions: 0, netMargin: 2800, marginPct: 15.56 },
    { material: "Biomass", model: "A", qty: "6.72 MT", saleRate: 3500, procureCost: 3100, deductions: 45, netMargin: 355, marginPct: 10.14 },
    { material: "Corn Oil", model: "C", qty: "4,200 L", saleRate: 85, procureCost: 68, deductions: 0, netMargin: 17, marginPct: 20.0 },
  ];

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Highest margin material</p>
          <p className="mt-2 text-2xl font-black">Corn Oil</p>
          <p className="mt-1 text-sm text-[#15803d] font-bold">20% gross margin</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Maize margin (Model A)</p>
          <p className="mt-2 text-2xl font-black">₹320/MT</p>
          <p className="mt-1 text-sm text-[#60735d]">1.42% — volume-driven</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">DDGS margin (Model C)</p>
          <p className="mt-2 text-2xl font-black">₹2,800/MT</p>
          <p className="mt-1 text-sm text-[#15803d] font-bold">15.6% retail markup</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-black">Material-wise margin analysis — May 2026</h3>
          <button className="rounded-md border border-[#9baa91] px-3.5 py-1.5 text-sm font-black hover:bg-[#f3f6ef]">Export</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
              <tr>
                {["Material", "Model", "Qty", "Sale rate (₹)", "Procure cost (₹)", "Deductions (₹)", "Net margin (₹/UOM)", "Margin %"].map((h) => (
                  <th key={h} className="px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {materialMargins.map((row) => (
                <tr key={row.material} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                  <td className="px-5 py-3.5 font-black">{row.material}</td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-md bg-[#172018] px-2 py-0.5 text-xs font-black text-white">{row.model}</span>
                  </td>
                  <td className="px-5 py-3.5 font-bold">{row.qty}</td>
                  <td className="px-5 py-3.5">₹{row.saleRate.toLocaleString("en-IN")}</td>
                  <td className="px-5 py-3.5 text-[#dc2626]">₹{row.procureCost.toLocaleString("en-IN")}</td>
                  <td className="px-5 py-3.5 text-[#dc2626]">₹{row.deductions}</td>
                  <td className="px-5 py-3.5 font-black text-[#15803d]">₹{row.netMargin.toLocaleString("en-IN")}</td>
                  <td className="px-5 py-3.5">
                    <span className={`font-black ${row.marginPct > 10 ? "text-[#15803d]" : row.marginPct > 5 ? "text-[#d97706]" : "text-[#536251]"}`}>
                      {row.marginPct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GSTTab() {
  const gstReports = [
    { title: "GSTR-1 Sales register", desc: "All taxable and exempt sales invoices for the period. Group by GSTIN, HSN, and tax rate. Export in GSTR-1 compatible format.", period: "May 2026" },
    { title: "GSTR-3B summary", desc: "Aggregate outward supply, ITC availed, and net GST payable. Cross-check against invoice register before filing.", period: "May 2026" },
    { title: "Purchase register (ITC)", desc: "All inward taxable purchases with GSTIN, invoice number, and ITC amount. Used for reconciliation with GSTR-2B.", period: "May 2026" },
    { title: "HSN summary", desc: "Quantity and value aggregated by HSN code. Required for GSTR-1 when turnover exceeds ₹5 Cr.", period: "May 2026" },
  ];

  const invoiceSummary = [
    { hsn: "1005", material: "Maize", qty: "486.72 MT", taxableValue: 10951200, cgst: 0, sgst: 0, igst: 0, total: 10951200 },
    { hsn: "2303", material: "DDGS", qty: "18.50 MT", taxableValue: 333000, cgst: 0, sgst: 0, igst: 0, total: 333000 },
    { hsn: "4401", material: "Biomass", qty: "6.72 MT", taxableValue: 23520, cgst: 588, sgst: 588, igst: 0, total: 24696 },
  ];

  return (
    <div className="grid gap-6">
      <div className="grid gap-5 sm:grid-cols-2">
        {gstReports.map((r) => (
          <ReportCard key={r.title} title={r.title} copy={`${r.period} · ${r.desc}`} action="Generate report" />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-black">GST invoice summary — May 2026</h3>
          <div className="flex gap-2">
            <button className="rounded-md border border-[#9baa91] px-3.5 py-1.5 text-sm font-black hover:bg-[#f3f6ef]">Export GSTR-1</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
              <tr>
                {["HSN", "Material", "Quantity", "Taxable value", "CGST", "SGST", "IGST", "Total"].map((h) => (
                  <th key={h} className="px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoiceSummary.map((row) => (
                <tr key={row.hsn} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                  <td className="px-5 py-3.5 font-mono text-sm">{row.hsn}</td>
                  <td className="px-5 py-3.5 font-black">{row.material}</td>
                  <td className="px-5 py-3.5">{row.qty}</td>
                  <td className="px-5 py-3.5 font-bold">{inr(row.taxableValue)}</td>
                  <td className="px-5 py-3.5 text-[#536251]">{row.cgst > 0 ? inr(row.cgst) : "—"}</td>
                  <td className="px-5 py-3.5 text-[#536251]">{row.sgst > 0 ? inr(row.sgst) : "—"}</td>
                  <td className="px-5 py-3.5 text-[#536251]">{row.igst > 0 ? inr(row.igst) : "—"}</td>
                  <td className="px-5 py-3.5 font-black">{inr(row.total)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-[#172018] bg-[#f8faf5]">
                <td className="px-5 py-3.5 font-black" colSpan={3}>Total</td>
                <td className="px-5 py-3.5 font-black">{inr(invoiceSummary.reduce((s, r) => s + r.taxableValue, 0))}</td>
                <td className="px-5 py-3.5 font-bold">{inr(invoiceSummary.reduce((s, r) => s + r.cgst, 0))}</td>
                <td className="px-5 py-3.5 font-bold">{inr(invoiceSummary.reduce((s, r) => s + r.sgst, 0))}</td>
                <td className="px-5 py-3.5 font-bold">—</td>
                <td className="px-5 py-3.5 font-black">{inr(invoiceSummary.reduce((s, r) => s + r.total, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("KPI");
  return (
    <div className="grid gap-5">
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-md px-4 py-2 text-sm font-black transition ${tab === t ? "bg-[#172018] text-white" : "border border-[#d7dfce] bg-white text-[#40513d] hover:bg-[#f3f6ef]"}`}>{t}</button>
        ))}
      </div>
      {tab === "KPI" && <KPITab />}
      {tab === "Ageing" && <AgeingTab />}
      {tab === "Margins" && <MarginsTab />}
      {tab === "GST" && <GSTTab />}
    </div>
  );
}
