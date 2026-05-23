"use client";

import { useState } from "react";
import { FARMER_PAYOUTS, INVOICES, LEDGER_SARVANI, INWARD_LOTS } from "../../../lib/data/seed";

const TABS = ["Exposure", "Farmer Bills", "Recoveries", "Reconciliation"] as const;
type Tab = (typeof TABS)[number];

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const totalFarmerPaid = FARMER_PAYOUTS.reduce((s, f) => s + f.netAmount, 0);
const totalRecovered = FARMER_PAYOUTS.filter((f) => f.paymentStatus === "Paid").reduce((s, f) => s + f.netAmount, 0);
const exposure = totalFarmerPaid - totalRecovered;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pending: "bg-[#fef9c3] text-[#a16207]",
    Approved: "bg-[#eff6ff] text-[#1d4ed8]",
    Paid: "bg-[#f0fdf4] text-[#15803d]",
    Partial: "bg-[#fff7ed] text-[#c2410c]",
    Draft: "bg-[#f3f4f6] text-[#374151]",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${map[status] ?? "bg-gray-100 text-gray-700"}`}>{status}</span>;
}

function ExposureTab() {
  return (
    <div className="grid gap-6">
      {/* Exposure summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[#fecaca] bg-[#fdf3ef] p-5">
          <p className="text-sm text-[#60735d]">Total finance paid to farmers</p>
          <p className="mt-2 text-3xl font-black text-[#172018]">{inr(totalFarmerPaid)}</p>
          <p className="mt-1 text-xs text-[#dc2626]">Model B cumulative outflow</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Recovered from Sarvani</p>
          <p className="mt-2 text-3xl font-black text-[#15803d]">{inr(totalRecovered)}</p>
          <p className="mt-1 text-xs text-[#60735d]">Against invoices settled</p>
        </div>
        <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-5">
          <p className="text-sm text-[#60735d]">Net outstanding exposure</p>
          <p className="mt-2 text-3xl font-black text-[#d97706]">{inr(exposure)}</p>
          <p className="mt-1 text-xs text-[#d97706]">A/c 1400 balance</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Sarvani receivable (Model B)</p>
          <p className="mt-2 text-3xl font-black">{inr(INVOICES.filter((i) => i.businessModel === "B" && i.status !== "Paid").reduce((s, i) => s + i.amountDue, 0))}</p>
          <p className="mt-1 text-xs text-[#60735d]">Covers exposure + margin</p>
        </div>
      </div>

      {/* Accounting explanation */}
      <div className="rounded-xl border border-[#c8d4f0] bg-[#eff6ff] p-5">
        <h3 className="font-black text-[#1d4ed8]">How Model B accounting works</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            ["Farmer payment", "Dr. Farmer Finance Advance Control (A/c 1400)\nCr. Bank — HDFC Current (A/c 1100)\nCreates exposure record"],
            ["Invoice to Sarvani", "Dr. Sarvani Biofuels — Receivable (A/c 1201)\nCr. Sales Revenue — Model B (A/c 3101)\nCovers the advance + margin"],
            ["Receipt from Sarvani", "Dr. Bank — HDFC Current (A/c 1100)\nCr. Sarvani Biofuels — Receivable (A/c 1201)\nRecovery reduces bank advance"],
            ["Exposure reconciliation", "Exposure = Total paid to farmers – Total recovered.\nA/c 1400 balance should approach zero as invoices are paid."],
          ].map(([title, detail]) => (
            <div key={title} className="rounded-lg bg-white p-4">
              <p className="text-sm font-black text-[#1d4ed8]">{title}</p>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-[#374151]">{detail}</pre>
            </div>
          ))}
        </div>
      </div>

      {/* Farmer finance register */}
      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-black">Finance advance register</h3>
          <button className="rounded-md border border-[#9baa91] px-3.5 py-1.5 text-sm font-black hover:bg-[#f3f6ef]">Export</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
              <tr>
                {["Farmer", "Lot ref", "Material", "Qty (MT)", "Advance paid", "Recovered", "Outstanding", "Payment ref", "Status"].map((h) => (
                  <th key={h} className="px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FARMER_PAYOUTS.map((fp) => {
                const recovered = fp.paymentStatus === "Paid" ? fp.netAmount : 0;
                return (
                  <tr key={fp.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                    <td className="px-5 py-3.5 font-black">{fp.farmerName}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-[#536251]">{fp.documentRef}</td>
                    <td className="px-5 py-3.5 text-[#536251]">{fp.materialName}</td>
                    <td className="px-5 py-3.5 font-bold">{fp.quantity.toFixed(2)}</td>
                    <td className="px-5 py-3.5 font-bold">{inr(fp.netAmount)}</td>
                    <td className="px-5 py-3.5 text-[#15803d]">{inr(recovered)}</td>
                    <td className={`px-5 py-3.5 font-black ${fp.netAmount - recovered > 0 ? "text-[#dc2626]" : "text-[#15803d]"}`}>
                      {inr(fp.netAmount - recovered)}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-[#536251]">{fp.paymentRef || "—"}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={fp.paymentStatus} /></td>
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

function FarmerBillsTab() {
  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-[#d8decf] bg-white p-6">
        <h3 className="mb-4 text-xl font-black">Create farmer finance bill</h3>
        <p className="mb-5 text-sm text-[#60735d]">Farmer bills are audit reference documents — they link a farmer to an inward lot and document the payment amount. They do not affect the customer ledger.</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Farmer name", "Select from party master"],
            ["Material", "Maize"],
            ["Inward lot reference", "FF-12MAY-014"],
            ["Accepted quantity (MT)", "9.79"],
            ["Gross sale rate (₹/MT)", "22500"],
            ["Farmer payment rate (₹/MT)", "22200"],
            ["Farmer gross amount (₹)", "217338"],
            ["Deductions (₹)", "1087"],
            ["Net farmer payment (₹)", "216251"],
          ].map(([label, placeholder]) => (
            <label key={label} className="grid gap-1.5 text-sm font-bold">
              {label}
              <input type="text" placeholder={placeholder} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
          ))}
          <label className="grid gap-1.5 text-sm font-bold sm:col-span-2 xl:col-span-3">
            Sarvani invoice reference
            <input type="text" placeholder="AAS-2627-0123 — links this farmer bill to the bulk invoice" className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
          </label>
        </div>
        <div className="mt-5 flex gap-3">
          <button className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white">Create Farmer Bill</button>
          <button className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Reset</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-black">Farmer bill register</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
              <tr>
                {["Batch", "Farmer", "Lot ref", "Qty (MT)", "Rate (₹/MT)", "Net payout", "Invoice link", "Status"].map((h) => (
                  <th key={h} className="px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FARMER_PAYOUTS.map((fp) => (
                <tr key={fp.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                  <td className="px-5 py-3.5 font-black">{fp.batchRef}</td>
                  <td className="px-5 py-3.5 font-bold">{fp.farmerName}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-[#536251]">{fp.documentRef}</td>
                  <td className="px-5 py-3.5">{fp.quantity.toFixed(2)}</td>
                  <td className="px-5 py-3.5 text-[#536251]">₹{fp.rate.toLocaleString("en-IN")}</td>
                  <td className="px-5 py-3.5 font-black">{inr(fp.netAmount)}</td>
                  <td className="px-5 py-3.5 text-[#1d4ed8] font-mono text-xs">AAS-2627-0122</td>
                  <td className="px-5 py-3.5"><StatusBadge status={fp.paymentStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RecoveriesTab() {
  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-[#d8decf] bg-white p-6">
        <h3 className="mb-4 text-xl font-black">Post recovery from Sarvani</h3>
        <p className="mb-5 text-sm text-[#60735d]">
          When Sarvani pays an invoice containing Model B supply, the receipt auto-reduces the Finance Advance Control account. Post the receipt here and allocate to the relevant invoice.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Receipt date", "2026-05-12", "date"],
            ["Amount received (₹)", "22,02,750", "text"],
            ["Bank account (received in)", "HDFC Current — XXXX4321", "text"],
            ["UTR / reference", "RTGS/20260512/0012345", "text"],
            ["Against invoice", "AAS-2627-0123", "text"],
          ].map(([label, placeholder, type = "text"]) => (
            <label key={label} className="grid gap-1.5 text-sm font-bold">
              {label}
              <input type={type} placeholder={placeholder} className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" />
            </label>
          ))}
          <label className="grid gap-1.5 text-sm font-bold sm:col-span-2 xl:col-span-3">
            Remarks
            <textarea className="rounded-lg border border-[#c8d4c0] px-3.5 py-2.5 font-normal outline-none focus:border-[#172018]" rows={2} placeholder="Recovery for Model B batch — reduces finance exposure" />
          </label>
        </div>
        <div className="mt-5 flex gap-3">
          <button className="rounded-md bg-[#172018] px-5 py-2.5 text-sm font-black text-white">Post Receipt & Recovery</button>
          <button className="rounded-md border border-[#d7dfce] px-5 py-2.5 text-sm font-black">Reset</button>
        </div>
      </div>
    </div>
  );
}

function ReconciliationTab() {
  const sarvaniModelBInvoices = INVOICES.filter((i) => i.businessModel === "B");
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Sarvani receivable (Model B)</p>
          <p className="mt-2 text-3xl font-black">{inr(sarvaniModelBInvoices.reduce((s, i) => s + i.amountDue, 0))}</p>
        </div>
        <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-5">
          <p className="text-sm text-[#60735d]">Finance advance outstanding</p>
          <p className="mt-2 text-3xl font-black text-[#d97706]">{inr(exposure)}</p>
        </div>
        <div className="rounded-xl border border-[#d8decf] bg-white p-5">
          <p className="text-sm text-[#60735d]">Net margin (receivable – exposure)</p>
          <p className="mt-2 text-3xl font-black text-[#15803d]">
            {inr(sarvaniModelBInvoices.reduce((s, i) => s + i.amountDue, 0) - exposure)}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d8decf] bg-white">
        <div className="border-b border-[#edf0e8] px-5 py-4">
          <h3 className="text-lg font-black">Model B invoice reconciliation</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f6ef] text-xs font-black uppercase tracking-[0.1em] text-[#60735d]">
              <tr>
                {["Invoice", "Date", "Farmer batches", "Invoice value", "Paid", "Due", "Status"].map((h) => (
                  <th key={h} className="px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sarvaniModelBInvoices.map((inv) => (
                <tr key={inv.id} className="border-t border-[#edf0e8] hover:bg-[#fafcf8]">
                  <td className="px-5 py-3.5 font-black">{inv.invoiceNo}</td>
                  <td className="px-5 py-3.5 text-[#536251]">{inv.invoiceDate}</td>
                  <td className="px-5 py-3.5 text-[#536251]">{inv.linkedLotIds.length} lots</td>
                  <td className="px-5 py-3.5 font-bold">{inr(inv.totalValue)}</td>
                  <td className="px-5 py-3.5 text-[#15803d]">{inr(inv.amountPaid)}</td>
                  <td className="px-5 py-3.5 font-black">{inr(inv.amountDue)}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>("Exposure");
  return (
    <div className="grid gap-5">
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-md px-4 py-2 text-sm font-black transition ${tab === t ? "bg-[#172018] text-white" : "border border-[#d7dfce] bg-white text-[#40513d] hover:bg-[#f3f6ef]"}`}>{t}</button>
        ))}
      </div>
      {tab === "Exposure" && <ExposureTab />}
      {tab === "Farmer Bills" && <FarmerBillsTab />}
      {tab === "Recoveries" && <RecoveriesTab />}
      {tab === "Reconciliation" && <ReconciliationTab />}
    </div>
  );
}
