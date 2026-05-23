"use client";

import { useState } from "react";
import { STOCK_BATCHES, INVOICES } from "../../../lib/data/seed";

const TABS = ["Purchases", "Stock", "Trader Sales", "Dispatch"] as const;
type Tab = (typeof TABS)[number];

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Approved: "bg-[#f0fdf4] text-[#15803d]",
    Pending: "bg-[#fef9c3] text-[#a16207]",
    Rejected: "bg-[#fef2f2] text-[#b91c1c]",
    Draft: "bg-[#f3f4f6] text-[#374151]",
    Partial: "bg-[#fff7ed] text-[#c2410c]",
    Paid: "bg-[#f0fdf4] text-[#15803d]",
    Sent: "bg-[#eff6ff] text-[#1d4ed8]",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${map[status] ?? "bg-gray-100 text-gray-700"}`}>{status}</span>;
}

function PurchasesTab() {
  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-[#d8decf] bg-white p-6">
        <h3 className="mb-4 text-xl font-black">Record purchase from Sarvani (Model C)</h3>
        <p className="mb-5 text-sm text-[#60735d]">
          Model C: Purchase DDGS, WDG, CO2, or Corn Oil from Sarvani. Each purchase creates a stock batch. Accounting entry: Dr. Inventory / Cr. Sarvani Payable.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Material", "DDGS / WDG / CO2 / Corn Oil"],
            ["Batch reference", "DDGS-MAY-01"],
            ["Purchase quantity (MT / KG / L)", "52.00"],
            ["Purchase rate (₹/UOM)", "15200"],
            ["Total purchase value (₹)", "7,90,400"],
            ["Sarvani invoice no", "SARB-2627-0044"],
            ["Invoice date", "2026-05-05"],
            ["Payment terms (days)", "30"],
          ].map(([label, placeholder]) => (
            <label key={label} className="grid gap-1.5 text-sm font-bold">
              {label}
              <input type="text" placeholder={placeholder} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
          ))}
          <label className="grid gap-1.5 text-sm font-bold">
            Quality status
            <select className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]">
              <option>Pending quality check</option>
              <option>Approved</option>
              <option>Rejected</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-bold">
            Quality notes
            <input type="text" placeholder="Moisture %, protein %, FFA % etc." className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
          </label>
        </div>
        <div className="mt-5 flex gap-3">
          <button className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white">Record Purchase</button>
          <button className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Reset</button>
        </div>
      </div>
    </div>
  );
}

function StockTab() {
  const totalCost = STOCK_BATCHES.reduce((s, b) => s + b.openingQty * b.purchaseRate, 0);
  const stockValue = STOCK_BATCHES.reduce((s, b) => s + b.availableQty * b.purchaseRate, 0);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Total purchased (batches)</p>
          <p className="mt-2 text-3xl font-black">{STOCK_BATCHES.length}</p>
          <p className="mt-1 text-sm text-[#60735d]">{inr(totalCost)} total cost</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Available stock value</p>
          <p className="mt-2 text-3xl font-black">{inr(stockValue)}</p>
          <p className="mt-1 text-sm text-[#60735d]">At purchase cost</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Sold this month</p>
          <p className="mt-2 text-3xl font-black">
            {INVOICES.filter((i) => i.businessModel === "C" && i.status !== "Draft").length} invoices
          </p>
          <p className="mt-1 text-sm text-[#15803d]">
            {inr(INVOICES.filter((i) => i.businessModel === "C").reduce((s, i) => s + i.totalValue, 0))} billed
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-black">Stock batches</h3>
          <button className="rounded-md border border-[#9baa91] px-3.5 py-1.5 text-sm font-black hover:bg-[#f3f6ef]">Export</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
              <tr>
                {["Batch", "Material", "Purchased", "Opening qty", "Sold qty", "Available qty", "Purchase rate", "Stock value", "Quality", "Action"].map((h) => (
                  <th key={h} className="px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STOCK_BATCHES.map((b) => {
                const pct = (b.soldQty / b.openingQty) * 100;
                return (
                  <tr key={b.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                    <td className="px-5 py-3.5 font-black">{b.batchRef}</td>
                    <td className="px-5 py-3.5 font-bold">{b.materialName}</td>
                    <td className="px-5 py-3.5 text-[#536251]">{b.purchaseDate}</td>
                    <td className="px-5 py-3.5">{b.openingQty.toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-[#15803d]">{b.soldQty.toLocaleString("en-IN")}</span>
                      <span className="ml-1 text-xs text-[#60735d]">({pct.toFixed(0)}%)</span>
                    </td>
                    <td className="px-5 py-3.5 font-black">{b.availableQty.toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3.5 text-[#536251]">₹{b.purchaseRate.toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3.5 font-bold">{inr(b.availableQty * b.purchaseRate)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={b.qualityStatus} /></td>
                    <td className="px-5 py-3.5">
                      <button className="text-xs font-black text-[#172018] hover:underline">Create sale</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TraderSalesTab() {
  const traderInvoices = INVOICES.filter((i) => i.businessModel === "C");
  const totalMargin = traderInvoices.reduce((s, i) => s + (i.grossValue - i.grossValue * 0.845), 0);

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-[#d8decf] bg-white p-6">
        <h3 className="mb-4 text-xl font-black">Create trader sale invoice (Model C)</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Trader name", "Sri Lakshmi Feeds"],
            ["Material", "DDGS"],
            ["Stock batch", "DDGS-MAY-01"],
            ["Sale quantity (MT)", "18.50"],
            ["Sale rate (₹/MT)", "18,000"],
            ["Credit days", "15"],
            ["Delivery date", "2026-05-12"],
          ].map(([label, placeholder]) => (
            <label key={label} className="grid gap-1.5 text-sm font-bold">
              {label}
              <input type="text" placeholder={placeholder} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
          ))}
        </div>

        {/* Invoice preview */}
        <div className="mt-5 rounded-lg border border-[#d8decf] bg-[#f8faf5] p-4">
          <p className="mb-3 text-sm font-black text-[#172018]">Invoice preview</p>
          <div className="grid gap-1.5 text-sm">
            {[
              ["Invoice no", "AAS-2627-0125 (next)"],
              ["Party", "Sri Lakshmi Feeds · GSTIN: 37AADCS9988C1ZP"],
              ["Material", "DDGS · 18.50 MT @ ₹18,000/MT"],
              ["Gross value", "₹3,33,000"],
              ["GST (0% — DDGS)", "₹0"],
              ["Total invoice value", "₹3,33,000"],
              ["Purchase cost", "₹2,80,200 (18.50 MT @ ₹15,150)"],
              ["Estimated margin", "₹52,800 (15.8%)"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-[#e8ede3] py-1.5 last:border-0">
                <span className="text-[#60735d]">{k}</span>
                <span className="font-bold text-right">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white">Generate Invoice Draft</button>
          <button className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Reset</button>
        </div>
      </div>

      {/* Trader invoice list */}
      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-black">Trader sales invoices</h3>
          <button className="rounded-md border border-[#9baa91] px-3.5 py-1.5 text-sm font-black hover:bg-[#f3f6ef]">Export</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
              <tr>
                {["Invoice", "Date", "Trader", "Material", "Qty", "Sale rate", "Invoice value", "Paid", "Due", "Status", "Action"].map((h) => (
                  <th key={h} className="px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {traderInvoices.map((inv) => (
                <tr key={inv.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                  <td className="px-5 py-3.5 font-black">{inv.invoiceNo}</td>
                  <td className="px-5 py-3.5 text-[#536251]">{inv.invoiceDate}</td>
                  <td className="px-5 py-3.5 font-bold">{inv.partyName}</td>
                  <td className="px-5 py-3.5 text-[#536251]">{inv.materialName}</td>
                  <td className="px-5 py-3.5">{inv.quantity} {inv.uom}</td>
                  <td className="px-5 py-3.5 text-[#536251]">₹{inv.grossRate.toLocaleString("en-IN")}</td>
                  <td className="px-5 py-3.5 font-bold">{inr(inv.totalValue)}</td>
                  <td className="px-5 py-3.5 text-[#15803d]">{inr(inv.amountPaid)}</td>
                  <td className="px-5 py-3.5 font-black">{inr(inv.amountDue)}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={inv.status} /></td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      <button className="text-xs font-black text-[#172018] hover:underline">View</button>
                      <button className="text-xs font-black text-[#1d4ed8] hover:underline">Share</button>
                    </div>
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

function DispatchTab() {
  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-[#d8decf] bg-white p-6">
        <h3 className="mb-4 text-xl font-black">Create trader dispatch</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Trader", "Sri Lakshmi Feeds"],
            ["Material", "DDGS"],
            ["Stock batch", "DDGS-MAY-01"],
            ["Dispatch quantity (MT)", "18.50"],
            ["Vehicle no", "AP39XY1234"],
            ["Driver name", "Srinivas"],
            ["Driver mobile", "9848011111"],
            ["E-way bill no", ""],
            ["Expected delivery date", "2026-05-13"],
          ].map(([label, placeholder]) => (
            <label key={label} className="grid gap-1.5 text-sm font-bold">
              {label}
              <input type="text" placeholder={placeholder} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
          ))}
          <label className="grid gap-1.5 text-sm font-bold sm:col-span-2 xl:col-span-3">
            Invoice link
            <input type="text" placeholder="AAS-2627-0124 — links dispatch to invoice for delivery confirmation" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
          </label>
        </div>
        <div className="mt-5 flex gap-3">
          <button className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white">Create Dispatch</button>
          <button className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Reset</button>
        </div>
      </div>

      <div className="rounded-xl border border-[#d8decf] bg-white p-5">
        <h3 className="mb-4 text-lg font-black">Recent dispatches</h3>
        <table className="w-full text-sm">
          <thead className="text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
            <tr className="border-b border-[#edf0e8]">
              {["Dispatch ref", "Trader", "Material", "Qty", "Vehicle", "Date", "Invoice", "Status"].map((h) => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
              <td className="px-4 py-3 font-black">DS-2627-0031</td>
              <td className="px-4 py-3">Sri Lakshmi Feeds</td>
              <td className="px-4 py-3 text-[#536251]">DDGS</td>
              <td className="px-4 py-3 font-bold">18.50 MT</td>
              <td className="px-4 py-3 font-mono text-xs">AP39XY1234</td>
              <td className="px-4 py-3 text-[#536251]">12-May-2026</td>
              <td className="px-4 py-3 text-[#1d4ed8] font-mono text-xs">AAS-2627-0124</td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-[#eff6ff] px-2.5 py-0.5 text-xs font-bold text-[#1d4ed8]">In transit</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SalesPage() {
  const [tab, setTab] = useState<Tab>("Stock");
  return (
    <div className="grid gap-5">
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-md px-4 py-2 text-sm font-black transition ${tab === t ? "bg-[#172018] text-white" : "border border-[#d7dfce] bg-white text-[#40513d] hover:bg-[#f3f6ef]"}`}>{t}</button>
        ))}
      </div>
      {tab === "Purchases" && <PurchasesTab />}
      {tab === "Stock" && <StockTab />}
      {tab === "Trader Sales" && <TraderSalesTab />}
      {tab === "Dispatch" && <DispatchTab />}
    </div>
  );
}
