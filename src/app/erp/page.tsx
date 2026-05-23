"use client";

import { useState } from "react";
import { KPIS, INWARD_LOTS, INVOICES, APPROVAL_QUEUE, TASKS } from "../../lib/data/seed";
import type { Tone, Trend } from "../../lib/types";

const TABS = ["Overview", "Tasks", "Approvals", "Risk"] as const;
type Tab = (typeof TABS)[number];

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function toneCls(tone: Tone) {
  return tone === "risk" ? "text-[#a04428]" : tone === "warn" ? "text-[#7f6418]" : "text-[#2e7d32]";
}
function toneCardCls(tone: Tone) {
  return tone === "risk" ? "border-[#f8d5c8]" : tone === "warn" ? "border-[#fde8b3]" : "";
}
function toneBgCls(tone: Tone) {
  return tone === "risk" ? "bg-[#fdf3ef]" : tone === "warn" ? "bg-[#fffcf0]" : "bg-white";
}
function trendIcon(trend: Trend) {
  return trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Draft: "bg-[#f3f4f6] text-[#374151]",
    Mapped: "bg-[#eff6ff] text-[#1d4ed8]",
    Approved: "bg-[#f0fdf4] text-[#15803d]",
    Invoiced: "bg-[#f5f3ff] text-[#6d28d9]",
    QualityHold: "bg-[#fef3c7] text-[#92400e]",
    Partial: "bg-[#fff7ed] text-[#c2410c]",
    Paid: "bg-[#f0fdf4] text-[#15803d]",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${map[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

function ModelBadge({ model }: { model: string }) {
  const map: Record<string, string> = {
    A: "bg-[#172018] text-white",
    B: "bg-[#405b3d] text-white",
    C: "bg-[#d8ff72] text-[#172018]",
  };
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-black ${map[model] ?? "bg-gray-100"}`}>
      Model {model}
    </span>
  );
}

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("Overview");
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return (
    <div className="grid gap-6">
      {/* Date + tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#60735d]">{today}</p>
        <div className="flex gap-2 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 rounded-md px-4 py-2 text-sm font-black transition ${tab === t ? "bg-[#172018] text-white" : "border border-[#d7dfce] bg-white text-[#40513d] hover:bg-[#f3f6ef]"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === "Overview" && <OverviewTab />}
      {tab === "Tasks" && <TasksTab />}
      {tab === "Approvals" && <ApprovalsTab />}
      {tab === "Risk" && <RiskTab />}
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="grid gap-6">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {KPIS.map((kpi) => (
          <section key={kpi.label} className={`rounded-xl border p-5 ${toneCardCls(kpi.tone)} ${toneBgCls(kpi.tone)}`}>
            <div className="flex items-start justify-between">
              <p className="text-sm font-bold text-[#60735d]">{kpi.label}</p>
              <span className={`text-sm font-black ${toneCls(kpi.tone)}`}>{trendIcon(kpi.trend)}</span>
            </div>
            <p className="mt-2 text-3xl font-black tracking-tight">{kpi.value}</p>
            <p className={`mt-2 text-sm ${toneCls(kpi.tone)}`}>{kpi.note}</p>
          </section>
        ))}
      </div>

      {/* Live transactions */}
      <TransactionTable />

      {/* Approval queue mini */}
      <section className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-black">Approval queue</h3>
          <span className="rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-xs font-black text-[#92400e]">
            {APPROVAL_QUEUE.length} pending
          </span>
        </div>
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
            <tr>
              {["Reference", "Type", "Required role", "Value", "Details"].map((h) => (
                <th key={h} className="px-5 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {APPROVAL_QUEUE.map((row) => (
              <tr key={row.ref} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                <td className="px-5 py-3.5 font-black text-[#172018]">{row.ref}</td>
                <td className="px-5 py-3.5 text-[#536251]">{row.type}</td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${row.requiredRole === "Admin" ? "bg-[#fdf2f8] text-[#9d174d]" : "bg-[#eff6ff] text-[#1d4ed8]"}`}>
                    {row.requiredRole}
                  </span>
                </td>
                <td className="px-5 py-3.5 font-bold text-[#172018]">{row.value}</td>
                <td className="px-5 py-3.5 text-[#536251]">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function TransactionTable() {
  return (
    <section className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
      <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-4">
        <h3 className="text-lg font-black">Today's transaction status</h3>
        <button className="rounded-md border border-[#9baa91] px-3.5 py-1.5 text-sm font-black hover:bg-[#f3f6ef]">
          Export
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
            <tr>
              {["Model", "Document", "Material", "Customer", "Qty (MT)", "Rate (₹/MT)", "Value", "Status"].map((h) => (
                <th key={h} className="px-5 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {INWARD_LOTS.slice(0, 6).map((lot) => (
              <tr key={lot.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                <td className="px-5 py-3.5"><ModelBadge model={lot.businessModel} /></td>
                <td className="px-5 py-3.5 font-black text-[#172018]">{lot.documentRef}</td>
                <td className="px-5 py-3.5 text-[#536251]">{lot.materialName}</td>
                <td className="px-5 py-3.5 text-[#536251]">{lot.customerName}</td>
                <td className="px-5 py-3.5 font-bold">{lot.acceptedWeight.toFixed(2)}</td>
                <td className="px-5 py-3.5 text-[#536251]">{lot.grossSaleRate.toLocaleString("en-IN")}</td>
                <td className="px-5 py-3.5 font-bold">{inr(lot.grossSaleValue)}</td>
                <td className="px-5 py-3.5"><StatusBadge status={lot.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TasksTab() {
  const colors: Record<string, string> = {
    high: "border-l-4 border-l-[#dc2626]",
    medium: "border-l-4 border-l-[#d97706]",
    low: "border-l-4 border-l-[#16a34a]",
  };
  const labels: Record<string, string> = {
    high: "bg-[#fef2f2] text-[#dc2626]",
    medium: "bg-[#fffbeb] text-[#d97706]",
    low: "bg-[#f0fdf4] text-[#16a34a]",
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {TASKS.map((task) => (
        <div key={task.title} className={`rounded-xl border border-[#d8decf] bg-white p-5 ${colors[task.priority]}`}>
          <div className="flex items-start justify-between gap-4">
            <h3 className="font-black">{task.title}</h3>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${labels[task.priority]}`}>
              {task.priority}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#60735d]">{task.detail}</p>
          <button className="mt-4 rounded-md border border-[#9baa91] px-4 py-2 text-sm font-black hover:bg-[#f3f6ef]">
            Open task
          </button>
        </div>
      ))}
    </div>
  );
}

function ApprovalsTab() {
  return (
    <section className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
      <div className="border-b border-[#edf0e8] px-5 py-4">
        <h3 className="text-lg font-black">Pending approvals</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
            <tr>
              {["Reference", "Type", "Required Role", "Value", "Description", "Action"].map((h) => (
                <th key={h} className="px-5 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {APPROVAL_QUEUE.map((row) => (
              <tr key={row.ref} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                <td className="px-5 py-3.5 font-black">{row.ref}</td>
                <td className="px-5 py-3.5 text-[#536251]">{row.type}</td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${row.requiredRole === "Admin" ? "bg-[#fdf2f8] text-[#9d174d]" : "bg-[#eff6ff] text-[#1d4ed8]"}`}>
                    {row.requiredRole}
                  </span>
                </td>
                <td className="px-5 py-3.5 font-bold">{row.value}</td>
                <td className="px-5 py-3.5 text-[#536251] max-w-xs">{row.description}</td>
                <td className="px-5 py-3.5">
                  <div className="flex gap-2">
                    <button className="rounded-md bg-[#172018] px-3 py-1.5 text-xs font-black text-white hover:bg-[#2a3b29]">Approve</button>
                    <button className="rounded-md border border-[#d7dfce] px-3 py-1.5 text-xs font-black hover:bg-[#f3f6ef]">Review</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RiskTab() {
  const risks = [
    {
      title: "Finance exposure vs Sarvani receivable",
      level: "High",
      detail: `Model B exposure is ₹14.78 L. Outstanding Sarvani invoice AAS-2627-0122 is ₹1,09.51 L. Exposure is covered but collection due 2-Jun-2026. Monitor weekly.`,
      action: "Review exposure",
    },
    {
      title: "Quality hold on DR-12MAY-003",
      level: "Medium",
      detail: "FM 1.8% on lot DR-12MAY-003 exceeds the 2% allowed variance for Maize May 2026 rule. Manager approval needed before settlement can proceed.",
      action: "Approve override",
    },
    {
      title: "Unmapped lots from today's PDF",
      level: "Medium",
      detail: "3 of 38 lots from IMPORT-12052026-001 are not yet mapped to a supplier. These will delay invoice generation. Target: map before 5 PM.",
      action: "Map lots",
    },
    {
      title: "Credit limit — Sri Lakshmi Feeds",
      level: "Low",
      detail: "AAS-2627-0124 is ₹3.12 L outstanding. Pending credit limit increase to ₹5 L. Current limit exceeded. No further sales until approval.",
      action: "Approve limit",
    },
    {
      title: "GST filing — May 2026",
      level: "Low",
      detail: "GSTR-1 for May 2026 due by 11-Jun-2026. Sales register should be reconciled before export. Ensure all invoices are approved.",
      action: "Open GST register",
    },
  ];

  const levelCls: Record<string, string> = {
    High: "bg-[#fef2f2] text-[#b91c1c]",
    Medium: "bg-[#fffbeb] text-[#d97706]",
    Low: "bg-[#f0fdf4] text-[#16a34a]",
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {risks.map((r) => (
        <div key={r.title} className="rounded-xl border border-[#d8decf] bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-black leading-snug">{r.title}</h3>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${levelCls[r.level]}`}>{r.level}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#60735d]">{r.detail}</p>
          <button className="mt-4 rounded-md border border-[#9baa91] px-4 py-2 text-sm font-black hover:bg-[#f3f6ef]">
            {r.action}
          </button>
        </div>
      ))}
    </div>
  );
}
